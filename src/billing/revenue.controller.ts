import { BadRequestException, Controller, Get, Header, Query } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { PrismaService } from '../database/prisma.service.js';

const day = 86400000;
const hotelOffset = 7 * 3600000;
const bookingSelect = {
  id: true, reference: true,
  room: { select: { roomNumber: true } },
  user: { select: { id: true, fullName: true } },
  invoice: { select: { id: true } },
} satisfies Prisma.BookingSelect;

function midnight(value: string) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new BadRequestException('Ngày phải có định dạng YYYY-MM-DD');
  }
  const date = new Date(value + 'T00:00:00Z');
  if (!Number.isFinite(+date) || date.toISOString().slice(0, 10) !== value) {
    throw new BadRequestException('Ngày không hợp lệ');
  }
  return +date - hotelOffset;
}

const zero = new Prisma.Decimal(0);
const paymentSelect = { id: true, amount: true, paidAt: true, method: true, payosOrderCode: true } as const;

type BookingInfo = Prisma.BookingGetPayload<{ select: typeof bookingSelect }>;

function entry(id: string, booking: BookingInfo, date: Date, amount: Prisma.Decimal,
  method: 'CASH' | 'BANK_TRANSFER', source: string, collector: string | null, roomAmount: Prisma.Decimal, refund = false) {
  return {
    id, bookingId: booking.id, reference: booking.reference, invoiceId: booking.invoice?.id,
    room: booking.room.roomNumber, guestId: booking.user.id, guest: booking.user.fullName, date: date.toISOString(),
    amount: amount.toFixed(2), roomAmount: roomAmount.toFixed(2), serviceAmount: amount.sub(roomAmount).toFixed(2), method, source, collector, refund,
  };
}

@Controller('revenue')
@Roles('RECEPTIONIST', 'ADMIN')
export class RevenueController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  async report(@Query('from') from: string, @Query('to') to: string) {
    const start = midnight(from);
    const end = midnight(to) + day;
    const duration = end - start;
    if (duration < day || duration > 366 * day) {
      throw new BadRequestException('Khoảng báo cáo phải từ 1 đến 366 ngày');
    }
    const range = { gte: new Date(start - duration), lt: new Date(end) };
    return this.prisma.client.$transaction(async tx => {
      const [bookingPayments, invoicePayments, orders, pending] = await Promise.all([
        tx.bookingPayment.findMany({
          where: { status: 'COMPLETED', paidAt: range }, select: { ...paymentSelect, collectedById: true, booking: { select: bookingSelect } },
        }),
        tx.payment.findMany({
          where: { status: 'COMPLETED', paidAt: range },
          select: { ...paymentSelect, invoiceId: true },
        }),
        tx.serviceOrder.findMany({
          where: { paymentMethod: { not: null }, OR: [{ paidAt: range }, { refundedAt: range }] },
          select: {
            id: true, totalAmount: true, paymentMethod: true, paidAt: true, refundedAt: true, payosOrderCode: true,
            booking: { select: bookingSelect }, collector: { select: { fullName: true } }, refunder: { select: { fullName: true } },
          },
        }),
        tx.bookingPayment.count({ where: { reviewReason: { not: null }, reviewResolvedAt: null } }),
      ]);
      const invoices = await tx.invoice.findMany({
        where: { id: { in: [...new Set(invoicePayments.map(p => p.invoiceId))] } },
        select: {
          roomAmount: true,
          booking: { select: { ...bookingSelect, bookingPayments: {
            where: { status: 'COMPLETED' }, select: { id: true, amount: true },
          } } },
          payments: {
            where: { status: 'COMPLETED', paidAt: { lt: range.lt } },
            orderBy: [{ paidAt: 'asc' }, { id: 'asc' }],
            select: { id: true, amount: true },
          },
        },
      });
      const allocations = new Map<string, { booking: BookingInfo; roomAmount: Prisma.Decimal }>();
      for (const invoice of invoices) {
        // Prepayments are reported separately. Allocate later receipts to the remaining room charge first.
        const prepayments = new Map(invoice.booking.bookingPayments.map(p => [p.id, p.amount]));
        let roomBalance = Prisma.Decimal.max(zero, [...prepayments.values()].reduce(
          (balance, amount) => balance.sub(amount), invoice.roomAmount,
        ));
        for (const payment of invoice.payments) {
          if (prepayments.has(payment.id)) continue;
          const roomAmount = Prisma.Decimal.min(roomBalance, payment.amount);
          allocations.set(payment.id, { booking: invoice.booking, roomAmount });
          roomBalance = roomBalance.sub(roomAmount);
        }
      }
      const collectorIds = bookingPayments.flatMap(payment => payment.collectedById ? [payment.collectedById] : []);
      const collectors = new Map((await tx.user.findMany({
        where: { id: { in: [...new Set(collectorIds)] } }, select: { id: true, fullName: true },
      })).map(user => [user.id, user.fullName]));
      const rows = [
        ...bookingPayments.map(p => entry(p.id, p.booking, p.paidAt!, p.amount, p.method,
          p.payosOrderCode ? 'payOS · Tiền phòng' : 'Tiền phòng', collectors.get(p.collectedById ?? '') ?? null, p.amount)),
        ...invoicePayments.flatMap(p => {
          const allocation = allocations.get(p.id);
          return allocation ? [entry(p.id, allocation.booking, p.paidAt!, p.amount, p.method,
            p.payosOrderCode ? 'payOS · Hóa đơn' : 'Hóa đơn', null, allocation.roomAmount)] : [];
        }),
        ...orders.flatMap(order => {
          const rows = [];
          if (order.paidAt && order.paymentMethod) {
            rows.push(entry(order.id, order.booking, order.paidAt, order.totalAmount, order.paymentMethod,
              order.payosOrderCode ? 'payOS · Dịch vụ' : 'Dịch vụ', order.collector?.fullName ?? null, zero));
          }
          if (order.refundedAt && order.paymentMethod) {
            rows.push(entry(order.id + '-refund', order.booking, order.refundedAt, order.totalAmount.negated(),
              order.paymentMethod, 'Dịch vụ', order.refunder?.fullName ?? null, zero, true));
          }
          return rows;
        }),
      ];
      const previousTotal = rows.filter(row => +new Date(row.date) >= start - duration && +new Date(row.date) < start)
        .reduce((sum, row) => sum.add(row.amount), new Prisma.Decimal(0)).toFixed(2);
      return {
        pending, previousTotal,
        transactions: rows.filter(row => +new Date(row.date) >= start && +new Date(row.date) < end)
          .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id)),
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }
}
