import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import type { PublicUser } from '../users/public-user.js';
import { PrismaService } from '../database/prisma.service.js';
import { bookingSelect } from '../bookings/booking-view.js';
import { orderSelect, orderView } from '../service-orders/order-view.js';
import { billingBookingView, invoiceSelect, invoiceView, paymentAmount, paymentKey, paymentSelect } from './billing-view.js';
import type { CreatePaymentDto } from './dto/create-payment.dto.js';
import { throwBillingError } from './billing-errors.js';

type Actor = Pick<PublicUser, 'id' | 'role'>;
@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}
  private staff(actor: Actor) {
    if (actor.role !== 'RECEPTIONIST' && actor.role !== 'ADMIN') throw new ForbiddenException('Insufficient permissions');
  }
  private scope(actor: Actor): Prisma.BookingWhereInput {
    if (actor.role === 'GUEST') return { userId: actor.id };
    this.staff(actor); return {};
  }
  private async lockBooking(tx: Prisma.TransactionClient, id: string) {
    const result = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM hotel.bookings WHERE id=${id}::uuid FOR UPDATE`;
    if (!result.length) throw new NotFoundException('Booking not found');
  }
  private async lockInvoice(tx: Prisma.TransactionClient, id: string) {
    const result = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM hotel.invoices WHERE id=${id}::uuid FOR UPDATE`;
    if (!result.length) throw new NotFoundException('Invoice not found');
  }

  async preview(id: string, actor: Actor) {
    const scope = this.scope(actor);
    return this.prisma.client.$transaction(async tx => {
      const booking = await tx.booking.findFirst({ where: { id, ...scope }, select: bookingSelect });
      if (!booking) throw new NotFoundException('Booking not found');
      const completed = await tx.serviceOrder.findMany({ where: { bookingId: id, status: 'COMPLETED' }, select: orderSelect, orderBy: [{ orderedAt: 'asc' }, { id: 'asc' }] });
      const serviceAmount = completed.reduce((sum, order) => order.items.reduce((subtotal, item) => subtotal.add(item.subtotal), sum), new Prisma.Decimal(0));
      const pendingOrderCount = await tx.serviceOrder.count({ where: { bookingId: id, status: 'PENDING' } });
      const view = billingBookingView(booking);
      return { booking: view, completedOrders: completed.map(orderView), pendingOrderCount,
        roomAmount: booking.totalRoomAmount.toFixed(2), serviceAmount: serviceAmount.toFixed(2), totalAmount: booking.totalRoomAmount.add(serviceAmount).toFixed(2) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  async issue(id: string, actor: Actor) {
    this.staff(actor);
    try {
      return await this.prisma.client.$transaction(async tx => {
        await this.lockBooking(tx, id);
        const booking = await tx.booking.findUniqueOrThrow({ where: { id }, select: { status: true, invoice: { select: { id: true } } } });
        if (booking.status !== 'CHECKED_IN' || booking.invoice) throw new ConflictException('Invoice requires a checked-in booking without an existing invoice');
        if (await tx.serviceOrder.count({ where: { bookingId: id, status: 'PENDING' } })) throw new ConflictException('Resolve pending service orders before issuing the invoice');
        const invoice = await tx.invoice.create({ data: { bookingId: id }, select: invoiceSelect });
        return invoiceView(invoice);
      });
    } catch (error) { throwBillingError(error); }
  }

  async getInvoice(id: string, actor: Actor, byBooking = false) {
    const scope = this.scope(actor);
    return this.prisma.client.$transaction(async tx => {
      const invoice = await tx.invoice.findFirst({ where: { ...(byBooking ? { bookingId: id } : { id }), booking: scope }, select: invoiceSelect });
      if (!invoice) throw new NotFoundException('Invoice not found');
      return invoiceView(invoice);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  async pay(id: string, suppliedKey: unknown, dto: CreatePaymentDto, actor: Actor) {
    this.staff(actor);
    const key = paymentKey(suppliedKey);
    const amount = paymentAmount(dto.amount);
    try {
      return await this.prisma.client.$transaction(async tx => {
        const target = await tx.invoice.findUnique({ where: { id }, select: { bookingId: true } });
        if (!target) throw new NotFoundException('Invoice not found');
        // Same parent-first lock order as invoice/service/check-out operations.
        await this.lockBooking(tx, target.bookingId); await this.lockInvoice(tx, id);
        const finishCheckout = async () => {
          if (!dto.checkout) return;
          const booking = await tx.booking.findUniqueOrThrow({ where: { id: target.bookingId }, select: { status: true } });
          if (booking.status === 'CHECKED_OUT') return;
          if (booking.status !== 'CHECKED_IN') throw new ConflictException('Booking must be checked in');
          const paid = invoiceView(await tx.invoice.findUniqueOrThrow({ where: { id }, select: invoiceSelect }));
          if (paid.status !== 'PAID' || new Prisma.Decimal(paid.balance).gt(0)) throw new ConflictException('Full payment required for checkout');
          if (await tx.serviceOrder.count({ where: { bookingId: target.bookingId, status: 'PENDING' } })) throw new ConflictException('Resolve pending service orders before checkout');
          await tx.booking.update({ where: { id: target.bookingId }, data: { status: 'CHECKED_OUT' } });
        };
        const prior = await tx.payment.findUnique({ where: { id: key }, select: paymentSelect });
        if (prior) {
          if (prior.invoiceId !== id || !prior.amount.equals(amount) || prior.method !== dto.method || prior.status !== 'COMPLETED') throw new ConflictException('Idempotency key was already used for a different payment');
          await finishCheckout();
          return { payment: { ...prior, amount: prior.amount.toFixed(2) }, replayed: true, invoice: invoiceView(await tx.invoice.findUniqueOrThrow({ where: { id }, select: invoiceSelect })) };
        }
        const invoice = await tx.invoice.findUniqueOrThrow({ where: { id }, select: invoiceSelect });
        const balance = new Prisma.Decimal(invoiceView(invoice).balance);
        if (dto.checkout && !amount.equals(balance)) throw new ConflictException('Full payment required for checkout');
        if (amount.gt(balance)) throw new ConflictException('Payment exceeds outstanding balance');
        // A counter receipt for funds staff already verified, never bank/gateway verification.
        const payment = await tx.payment.create({ data: { id: key, invoiceId: id, amount, method: dto.method, status: 'COMPLETED' }, select: paymentSelect });
        await finishCheckout();
        return { payment: { ...payment, amount: payment.amount.toFixed(2) }, replayed: false, invoice: invoiceView(await tx.invoice.findUniqueOrThrow({ where: { id }, select: invoiceSelect })) };
      });
    } catch (error) { throwBillingError(error); }
  }

  async checkout(id: string, actor: Actor) {
    this.staff(actor);
    try {
      return await this.prisma.client.$transaction(async tx => {
        await this.lockBooking(tx, id);
        const booking = await tx.booking.findUniqueOrThrow({ where: { id }, select: { status: true, roomId: true, invoice: { select: { id: true } } } });
        if (booking.status !== 'CHECKED_IN' || !booking.invoice) throw new ConflictException('Checkout requires a checked-in booking with a paid invoice');
        await this.lockInvoice(tx, booking.invoice.id);
        const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: booking.invoice.id }, select: invoiceSelect });
        if (invoice.status !== 'PAID' || new Prisma.Decimal(invoiceView(invoice).balance).gt(0)) throw new ConflictException('Invoice must be fully paid before checkout');
        if (await tx.serviceOrder.count({ where: { bookingId: id, status: 'PENDING' } })) throw new ConflictException('Resolve pending service orders before checkout');
        const result = await tx.booking.updateMany({ where: { id, status: 'CHECKED_IN' }, data: { status: 'CHECKED_OUT' } });
        if (result.count !== 1) throw new ConflictException('Booking changed concurrently');
        const view = billingBookingView(await tx.booking.findUniqueOrThrow({ where: { id }, select: bookingSelect }));
        const room = await tx.room.findUniqueOrThrow({ where: { id: booking.roomId }, select: { id: true, housekeepingStatus: true, operationalStatus: true } });
        const task = await tx.housekeepingTask.findFirst({ where: { roomId: booking.roomId, status: { not: 'DONE' } }, select: { id: true, status: true, assignedStaffId: true } });
        const finalInvoice = await tx.invoice.findUniqueOrThrow({ where: { id: invoice.id }, select: invoiceSelect });
        return { booking: view, invoice: invoiceView(finalInvoice), room, housekeepingTask: task };
      });
    } catch (error) { throwBillingError(error); }
  }
}
