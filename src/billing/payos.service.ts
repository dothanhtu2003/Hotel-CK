import { BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PayOS } from '@payos/node';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../database/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';
import type { PublicUser } from '../users/public-user.js';
import { BillingService } from './billing.service.js';
import { invoiceSelect, invoiceView } from './billing-view.js';

@Injectable()
export class PayosService {
  constructor(private readonly prisma: PrismaService, private readonly billing: BillingService, private readonly config: ConfigService) {}

  private client() {
    const clientId = this.config.get<string>('PAYOS_CLIENT_ID');
    const apiKey = this.config.get<string>('PAYOS_API_KEY');
    const checksumKey = this.config.get<string>('PAYOS_CHECKSUM_KEY');
    if (!clientId || !apiKey || !checksumKey) throw new ServiceUnavailableException('payOS chưa được cấu hình');
    return new PayOS({ clientId, apiKey, checksumKey, timeout: 8000, maxRetries: 0 });
  }

  private async ownedBooking(id: string, actor: PublicUser) {
    const booking = await this.prisma.client.booking.findFirst({ where: { id, userId: actor.id } });
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }

  async bookingState(id: string, actor: PublicUser) {
    const booking = await this.ownedBooking(id, actor);
    const attempts = await this.prisma.client.bookingPayment.findMany({ where: { bookingId: id }, select: { status: true, amount: true } });
    const paid = attempts.filter(p => p.status === 'COMPLETED').reduce((sum, p) => sum.add(p.amount), new Prisma.Decimal(0));
    return { required: booking.onlinePaymentRequired, totalAmount: booking.totalRoomAmount.toFixed(2), paidAmount: paid.toFixed(2),
      pending: attempts.some(p => p.status === 'PENDING'), paid: paid.gte(booking.totalRoomAmount), bookingStatus: booking.status };
  }

  async startBooking(id: string, actor: PublicUser) {
    this.client();
    await this.ownedBooking(id, actor);
    await this.syncBooking(id, actor);
    const payment = await this.prisma.client.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM hotel.bookings WHERE id=${id}::uuid FOR UPDATE`;
      const booking = await tx.booking.findUniqueOrThrow({ where: { id } });
      if (!booking.onlinePaymentRequired || booking.status !== 'PENDING') throw new ConflictException('Booking không còn chờ thanh toán');
      if (!booking.totalRoomAmount.isInteger() || !Number.isSafeInteger(booking.totalRoomAmount.toNumber()) || booking.totalRoomAmount.lte(0)) throw new ConflictException('Số tiền phòng phải là số nguyên VND dương');
      const pending = await tx.bookingPayment.findFirst({ where: { bookingId: id, status: 'PENDING' } });
      return pending ?? tx.bookingPayment.create({ data: { bookingId: id, amount: booking.totalRoomAmount, payosOrderCode: (1n << 48n) + BigInt(randomBytes(6).readUIntBE(0, 6)) } });
    });
    if (payment.checkoutUrl) return { checkoutUrl: payment.checkoutUrl };
    const checkoutUrl = await this.createLink(Number(payment.payosOrderCode), payment.amount.toNumber(), `/guest/bookings/${id}`);
    await this.prisma.client.bookingPayment.updateMany({ where: { id: payment.id, status: 'PENDING' }, data: { checkoutUrl } });
    return { checkoutUrl };
  }

  async syncBooking(id: string, actor?: PublicUser) {
    if (actor) await this.ownedBooking(id, actor);
    const attempts = await this.prisma.client.bookingPayment.findMany({ where: { bookingId: id, status: 'PENDING' } });
    for (const attempt of attempts) {
      let remote;
      try { remote = await this.client().paymentRequests.get(Number(attempt.payosOrderCode)); }
      catch {
        if (!attempt.checkoutUrl) continue;
        throw new ServiceUnavailableException('Chưa thể kiểm tra giao dịch payOS');
      }
      if (remote.orderCode !== Number(attempt.payosOrderCode) || remote.amount !== attempt.amount.toNumber()) throw new ConflictException('Thông tin giao dịch không khớp');
      let status: 'COMPLETED' | 'FAILED' | undefined;
      if (remote.status === 'PAID') {
        if (remote.amountPaid < remote.amount || remote.amountRemaining !== 0) throw new ConflictException('Giao dịch chưa đủ tiền');
        status = 'COMPLETED';
      } else if (['CANCELLED', 'EXPIRED', 'FAILED'].includes(remote.status) && remote.amountPaid === 0) status = 'FAILED';
      if (status) await this.prisma.client.$transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM hotel.bookings WHERE id=${id}::uuid FOR UPDATE`;
        // DB trigger confirms the booking atomically, only after full verified payment.
        await tx.bookingPayment.updateMany({ where: { id: attempt.id, status: 'PENDING' }, data: { status } });
      });
    }
    return { checked: true };
  }

  async cancelBooking(id: string, actor: PublicUser) {
    const booking = await this.ownedBooking(id, actor);
    if (!booking.onlinePaymentRequired || booking.status !== 'PENDING') throw new ConflictException('Vui lòng liên hệ lễ tân để xử lý booking đã thanh toán');
    const pending = await this.prisma.client.bookingPayment.findFirst({ where: { bookingId: id, status: 'PENDING' } });
    if (pending) {
      // Cancel remotely first. If payment won the race, sync confirms it and cancellation is rejected.
      try { await this.client().paymentRequests.cancel(Number(pending.payosOrderCode), 'Khach huy booking'); }
      catch { throw new ServiceUnavailableException('Chưa thể hủy liên kết thanh toán. Vui lòng thử lại hoặc liên hệ lễ tân'); }
      await this.syncBooking(id, actor);
    }
    await this.prisma.client.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM hotel.bookings WHERE id=${id}::uuid FOR UPDATE`;
      if (await tx.bookingPayment.count({ where: { bookingId: id, status: { in: ['PENDING', 'COMPLETED'] } } })) throw new ConflictException('Giao dịch đang xử lý hoặc đã nhận tiền. Vui lòng liên hệ lễ tân');
      const result = await tx.booking.updateMany({ where: { id, userId: actor.id, status: 'PENDING' }, data: { status: 'CANCELLED' } });
      if (!result.count) throw new ConflictException('Booking đã thay đổi');
    });
    return { cancelled: true };
  }

  private async createLink(orderCode: number, amount: number, path: string) {
    const client = this.client();
    const origin = this.config.get<string>('PAYOS_RETURN_ORIGIN');
    let validOrigin = false;
    try { validOrigin = !!origin && ['http:', 'https:'].includes(new URL(origin).protocol) && new URL(origin).origin === origin; } catch { /* Invalid deployment configuration. */ }
    if (!validOrigin) throw new ServiceUnavailableException('PAYOS_RETURN_ORIGIN chưa hợp lệ');
    let checkoutUrl: string;
    try {
      const link = await client.paymentRequests.create({ orderCode, amount, description: `HOTEL ${orderCode}`,
        returnUrl: `${origin}${path}?payos=return`, cancelUrl: `${origin}${path}?payos=cancel` });
      if (link.orderCode !== orderCode || link.amount !== amount || link.currency !== 'VND') throw new Error('Payment link mismatch');
      checkoutUrl = link.checkoutUrl;
    } catch {
      try {
        const existing = await client.paymentRequests.get(orderCode);
        if (!/^[a-f0-9]{32}$/i.test(existing.id) || !['PENDING', 'UNDERPAID', 'PROCESSING'].includes(existing.status) || existing.amount !== amount) throw new Error('Invalid link');
        checkoutUrl = `https://pay.payos.vn/web/${existing.id}`;
      } catch { throw new ServiceUnavailableException('Chưa thể tạo liên kết payOS. Vui lòng thử lại'); }
    }
    const url = new URL(checkoutUrl);
    if (url.protocol !== 'https:' || url.hostname !== 'pay.payos.vn' || url.username || url.password) throw new ServiceUnavailableException('Liên kết payOS không hợp lệ');
    return checkoutUrl;
  }

  async start(id: string, actor: PublicUser) {
    this.client();
    const invoice = await this.billing.getInvoice(id, actor);
    // Reconcile a previous attempt before offering another payment.
    await this.sync(id, actor);
    const payment = await this.prisma.client.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM hotel.bookings WHERE id=${invoice.bookingId}::uuid FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM hotel.invoices WHERE id=${id}::uuid FOR UPDATE`;
      const current = invoiceView(await tx.invoice.findUniqueOrThrow({ where: { id }, select: invoiceSelect }));
      const balance = new Prisma.Decimal(current.balance);
      if (current.booking.status !== 'CHECKED_IN' || balance.lte(0)) throw new ConflictException('Hóa đơn không còn khoản cần thanh toán');
      if (!balance.isInteger() || !Number.isSafeInteger(balance.toNumber())) throw new ConflictException('payOS yêu cầu số tiền nguyên VND');
      const pending = await tx.payment.findFirst({ where: { invoiceId: id, payosOrderCode: { not: null }, status: 'PENDING' } });
      if (pending) {
        if (!pending.amount.equals(balance)) throw new ConflictException('Số dư đã thay đổi. Vui lòng liên hệ lễ tân để kiểm tra giao dịch đang chờ');
        return pending;
      }
      return tx.payment.create({ data: { invoiceId: id, amount: balance, method: 'BANK_TRANSFER', payosOrderCode: BigInt(randomBytes(6).readUIntBE(0, 6)) } });
    });
    if (payment.checkoutUrl) return { checkoutUrl: payment.checkoutUrl };
    const checkoutUrl = await this.createLink(Number(payment.payosOrderCode), payment.amount.toNumber(), `/guest/invoices/${id}`);
    await this.prisma.client.payment.updateMany({ where: { id: payment.id, status: 'PENDING' }, data: { checkoutUrl } });
    return { checkoutUrl };
  }

  async sync(id: string, actor?: PublicUser) {
    if (actor) await this.billing.getInvoice(id, actor);
    const attempts = await this.prisma.client.payment.findMany({ where: { invoiceId: id, payosOrderCode: { not: null }, status: 'PENDING' } });
    for (const attempt of attempts) {
      let remote;
      try { remote = await this.client().paymentRequests.get(Number(attempt.payosOrderCode)); }
      catch {
        if (!attempt.checkoutUrl) continue;
        throw new ServiceUnavailableException('Chưa thể kiểm tra giao dịch payOS');
      }
      if (remote.orderCode !== Number(attempt.payosOrderCode) || remote.amount !== attempt.amount.toNumber()) throw new ConflictException('Thông tin giao dịch không khớp');
      if (remote.status === 'PAID') {
        if (remote.amountPaid < remote.amount || remote.amountRemaining !== 0) throw new ConflictException('Giao dịch chưa đủ tiền');
        await this.prisma.client.$transaction(async tx => {
          const invoice = await tx.invoice.findUniqueOrThrow({ where: { id }, select: { bookingId: true } });
          await tx.$queryRaw`SELECT id FROM hotel.bookings WHERE id=${invoice.bookingId}::uuid FOR UPDATE`;
          await tx.$queryRaw`SELECT id FROM hotel.invoices WHERE id=${id}::uuid FOR UPDATE`;
          // The DB trigger updates the invoice and rejects overpayment. Conditional update makes retries idempotent.
          await tx.payment.updateMany({ where: { id: attempt.id, status: 'PENDING' }, data: { status: 'COMPLETED' } });
        });
      } else if (['CANCELLED', 'EXPIRED', 'FAILED'].includes(remote.status) && remote.amountPaid === 0) {
        await this.prisma.client.payment.updateMany({ where: { id: attempt.id, status: 'PENDING' }, data: { status: 'FAILED' } });
      }
    }
    return { checked: true };
  }

  async webhook(body: unknown) {
    let data;
    try { data = await this.client().webhooks.verify(body as Parameters<PayOS['webhooks']['verify']>[0]); }
    catch { throw new BadRequestException('Chữ ký payOS không hợp lệ'); }
    const payment = await this.prisma.client.payment.findUnique({ where: { payosOrderCode: BigInt(data.orderCode) } });
    // Acknowledge signed registration probes and unrelated orders without changing billing.
    if (payment && data.code === '00') await this.sync(payment.invoiceId);
    const bookingPayment = await this.prisma.client.bookingPayment.findUnique({ where: { payosOrderCode: BigInt(data.orderCode) } });
    if (bookingPayment && data.code === '00') await this.syncBooking(bookingPayment.bookingId);
    return { success: true };
  }
}
