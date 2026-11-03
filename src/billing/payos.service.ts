import { BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException, Logger, type OnModuleInit, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PayOS, NotFoundError as PayosNotFoundError } from '@payos/node';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../database/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';
import type { PublicUser } from '../users/public-user.js';
import { BillingService } from './billing.service.js';
import { postgresCode } from '../common/database/postgres-code.js';
import { invoiceSelect, invoiceView } from './billing-view.js';

@Injectable()
export class PayosService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private sweeping = false;
  private readonly logger = new Logger(PayosService.name);
  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => { void this.sweepExpiredBookings(); }, 30000);
    this.timer.unref();
    void this.sweepExpiredBookings();
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  constructor(private readonly prisma: PrismaService, private readonly billing: BillingService, private readonly config: ConfigService) {}

  private client() {
    const clientId = this.config.get<string>('PAYOS_CLIENT_ID');
    const apiKey = this.config.get<string>('PAYOS_API_KEY');
    const checksumKey = this.config.get<string>('PAYOS_CHECKSUM_KEY');
    if (!clientId || !apiKey || !checksumKey) throw new ServiceUnavailableException('payOS chưa được cấu hình');
    return new PayOS({ clientId, apiKey, checksumKey, timeout: 8000, maxRetries: 0 });
  }

  private async ownedBooking(id: string, actor: PublicUser) {
    const booking = await this.prisma.client.booking.findFirst({ where: { id, ...(actor.role === 'GUEST' ? { userId:actor.id } : { user: { is: { role:'GUEST' } } }) } });
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }

  async bookingState(id: string, actor: PublicUser) {
    const booking = await this.ownedBooking(id, actor);
    const attempts = await this.prisma.client.bookingPayment.findMany({ where: { bookingId: id }, select: { status: true, amount: true, receivedAmount: true, reviewReason: true, reviewResolvedAt: true } });
    const paid = attempts.filter(p => p.status === 'COMPLETED').reduce((sum, p) => sum.add(p.amount), new Prisma.Decimal(0));
    return { required: booking.onlinePaymentRequired, totalAmount: booking.totalRoomAmount.toFixed(2), paidAmount: paid.toFixed(2),
      pending: attempts.some(p => p.status === 'PENDING'), paid: paid.gte(booking.totalRoomAmount), bookingStatus: booking.status, holdState: booking.holdState, expiredAt: booking.holdExpiresAt, serverNow: new Date(), paymentReview: attempts.some(p => p.reviewReason && !p.reviewResolvedAt), receivedAmount: attempts.reduce((sum,p) => sum.add(p.receivedAmount), new Prisma.Decimal(0)).toFixed(2) };
  }

  async startBooking(id: string, actor: PublicUser) {
    this.client();
    await this.ownedBooking(id, actor);
    await this.syncBooking(id, actor);
    const payment = await this.prisma.client.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM hotel.bookings WHERE id=${id}::uuid FOR UPDATE`;
      const booking = await tx.booking.findUniqueOrThrow({ where: { id } });
      if (!booking.onlinePaymentRequired || booking.status !== 'PENDING') throw new ConflictException('Booking không còn chờ thanh toán');
      if (booking.holdState !== 'ACTIVE' || !booking.holdExpiresAt || booking.holdExpiresAt.getTime() <= Date.now()) throw new ConflictException('Đã hết thời gian thanh toán. Hệ thống đang đối soát booking');
      if (!booking.totalRoomAmount.isInteger() || !Number.isSafeInteger(booking.totalRoomAmount.toNumber()) || booking.totalRoomAmount.lte(0)) throw new ConflictException('Số tiền phòng phải là số nguyên VND dương');
      const pending = await tx.bookingPayment.findFirst({ where: { bookingId: id, status: 'PENDING' } });
      const payment = pending ?? await tx.bookingPayment.create({ data: { bookingId: id, amount: booking.totalRoomAmount, payosOrderCode: (1n << 48n) + BigInt(randomBytes(6).readUIntBE(0, 6)) } });
      return payment;
    });
    return this.prisma.client.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM hotel.bookings WHERE id=${id}::uuid FOR UPDATE`;
      const booking = await tx.booking.findUniqueOrThrow({ where:{ id } });
      if (booking.status !== 'PENDING' || booking.holdState !== 'ACTIVE' || !booking.holdExpiresAt || booking.holdExpiresAt.getTime() <= Date.now()) throw new ConflictException('Đã hết thời gian thanh toán');
      const attempt = await tx.bookingPayment.findUniqueOrThrow({ where:{ id:payment.id } });
      if (attempt.status !== 'PENDING') throw new ConflictException('Giao dịch đã thay đổi');
      if (attempt.checkoutUrl) return { checkoutUrl:attempt.checkoutUrl };
      const checkoutUrl = await this.createLink(Number(attempt.payosOrderCode), attempt.amount.toNumber(), `/guest/bookings/${id}`, Math.floor(booking.holdExpiresAt.getTime()/1000));
      await tx.bookingPayment.update({ where:{ id:attempt.id }, data:{ checkoutUrl } });
      return { checkoutUrl };
    }, { timeout:25000 });
  }

  private async remoteBookingPayment(attempt: { id:string; checkoutUrl:string|null; payosOrderCode:bigint; amount:Prisma.Decimal }) {
    try { return await this.client().paymentRequests.get(Number(attempt.payosOrderCode)); }
    catch (error) {
      // A definitive 404 can clear an attempt that never created a link.
      // Timeouts, 429s and ambiguous errors must retain the room and retry.
      if (!attempt.checkoutUrl && error instanceof PayosNotFoundError) return { orderCode:Number(attempt.payosOrderCode), amount:attempt.amount.toNumber(), amountPaid:0, amountRemaining:attempt.amount.toNumber(), status:'FAILED' as const };
      throw new ServiceUnavailableException('Chưa thể kiểm tra giao dịch payOS');
    }
  }

  private validBookingRemote(remote: { orderCode: number; amount: number; amountPaid: number; amountRemaining: number; status: string }, attempt: { payosOrderCode: bigint; amount: Prisma.Decimal }) {
    if (remote.orderCode !== Number(attempt.payosOrderCode) || remote.amount !== attempt.amount.toNumber() || !Number.isSafeInteger(remote.amountPaid) || remote.amountPaid < 0) throw new ConflictException('Thông tin giao dịch không khớp');
    if (remote.status === 'PAID' && (remote.amountPaid < remote.amount || remote.amountRemaining !== 0)) throw new ConflictException('Giao dịch chưa đủ tiền');
  }

  private async applyBookingRemote(id: string, attemptId: string, remote: { orderCode: number; amount: number; amountPaid: number; amountRemaining: number; status: string }) {
    try {
      await this.prisma.client.$transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM hotel.bookings WHERE id=${id}::uuid FOR UPDATE`;
        const b = await tx.booking.findUniqueOrThrow({ where: { id } });
        const attempt = await tx.bookingPayment.findUniqueOrThrow({ where: { id: attemptId } });
        this.validBookingRemote(remote, attempt);
        if (attempt.status === 'COMPLETED') return;
        if (attempt.reviewResolvedAt) return;
        const terminal = ['CANCELLED','EXPIRED','FAILED'].includes(remote.status);
        if (remote.status === 'PAID') {
          const canRestore = b.status === 'CANCELLED' && b.holdState === 'EXPIRED';
          if (b.status !== 'PENDING' && !canRestore) throw new ConflictException('Late payment requires review');
          if (canRestore) {
            const room = await tx.room.findUniqueOrThrow({ where: { id: b.roomId } });
            const guest = await tx.user.findUniqueOrThrow({ where: { id: b.userId } });
            const today = new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Ho_Chi_Minh', year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date());
            if (room.operationalStatus !== 'ACTIVE' || guest.status !== 'ACTIVE' || b.checkOutDate.toISOString().slice(0,10) <= today) throw new ConflictException('Late payment requires review');
          }
          // The trigger confirms PENDING, or restores EXPIRED only if the overlap
          // exclusion constraint still allows this exact room and stay.
          await tx.bookingPayment.updateMany({ where: { id: attemptId, status: { in: ['PENDING','FAILED'] } }, data: { status:'COMPLETED', receivedAmount:remote.amountPaid, reviewReason:null } });
        } else {
          await tx.bookingPayment.update({ where: { id: attemptId }, data: {
            receivedAmount: Prisma.Decimal.max(attempt.receivedAmount, remote.amountPaid),
            ...(remote.amountPaid > 0 ? { reviewReason:'PARTIAL_PAYMENT' } : {}),
            ...(terminal && attempt.status === 'PENDING' ? { status:'FAILED' } : {}),
          } });
        }
      });
    } catch (error) {
      if (remote.amountPaid <= 0 || !(error instanceof ConflictException || ['23P01','23514','23505'].includes(postgresCode(error) ?? '') || (error as { code?:string }).code === 'P2002')) throw error;
      // Keep money received after release in a durable review queue. Never
      // claim a refund occurred or credit a different guest's occupied room.
      await this.prisma.client.bookingPayment.updateMany({ where: { id:attemptId, status: { not:'COMPLETED' }, reviewResolvedAt:null }, data: { receivedAmount:remote.amountPaid, reviewReason:'LATE_PAYMENT_ROOM_UNAVAILABLE' } });
      this.logger.warn(`Booking payment requires review: ${attemptId}`);
    }
  }

  async syncBooking(id: string, actor?: PublicUser) {
    if (actor) await this.ownedBooking(id, actor);
    const attempts = await this.prisma.client.bookingPayment.findMany({ where: { bookingId: id, status: { not:'COMPLETED' } } });
    for (const attempt of attempts) {
      const remote = await this.remoteBookingPayment(attempt);
      this.validBookingRemote(remote, attempt);
      await this.applyBookingRemote(id, attempt.id, remote);
    }
    return { checked: true };
  }

  async expireBooking(id: string, now = new Date()) {
    // Persist the intermediate state so errors/crashes keep the room held and
    // a later worker can resume. Claims are conditional and multi-worker safe.
    const claimed = await this.prisma.client.booking.updateMany({ where: { id, onlinePaymentRequired:true, status:'PENDING', holdExpiresAt: { lte:new Date(now.getTime()-120000) }, OR: [{ holdState:'ACTIVE' }, { holdState:'CHECKING_PAYMENT', paymentCheckAt:{ lte:new Date(now.getTime()-60000) } }] }, data: { holdState:'CHECKING_PAYMENT', paymentCheckAt:now } });
    if (!claimed.count) return;
    const attempts = await this.prisma.client.bookingPayment.findMany({ where: { bookingId:id, status:'PENDING' } });
    for (const attempt of attempts) {
      let remote = await this.remoteBookingPayment(attempt);
      this.validBookingRemote(remote, attempt);
      if (remote.status !== 'PAID' && !['CANCELLED','EXPIRED','FAILED'].includes(remote.status)) {
        await this.client().paymentRequests.cancel(Number(attempt.payosOrderCode), 'Het han giu phong');
        remote = await this.client().paymentRequests.get(Number(attempt.payosOrderCode));
        this.validBookingRemote(remote, attempt);
      }
      await this.applyBookingRemote(id, attempt.id, remote);
      // PROCESSING and unknown outcomes keep the room held for another pass.
      if (!['PAID','CANCELLED','EXPIRED','FAILED'].includes(remote.status)) return;
    }
    await this.prisma.client.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM hotel.bookings WHERE id=${id}::uuid FOR UPDATE`;
      if (await tx.bookingPayment.count({ where: { bookingId:id, status: { in:['PENDING','COMPLETED'] } } })) return;
      await tx.booking.updateMany({ where: { id, status:'PENDING', holdState:'CHECKING_PAYMENT' }, data: { status:'CANCELLED', holdState:'EXPIRED' } });
    });
  }

  async sweepExpiredBookings() {
    if (this.sweeping) return;
    this.sweeping = true;
    try {
      const now = new Date();
      const due = await this.prisma.client.booking.findMany({ where: { onlinePaymentRequired:true, status:'PENDING', holdExpiresAt: { lte:new Date(now.getTime()-120000) }, OR: [{ paymentCheckAt:null }, { paymentCheckAt: { lte:new Date(now.getTime()-60000) } }] }, select:{ id:true }, orderBy:[{ paymentCheckAt:{ sort:'asc',nulls:'first' } },{ holdExpiresAt:'asc' }], take:10 });
      for (const b of due) { try { await this.expireBooking(b.id, now); } catch { this.logger.warn(`Payment expiry reconciliation will retry: ${b.id}`); } }
      const released = await this.prisma.client.booking.findMany({ where:{ onlinePaymentRequired:true,status:'CANCELLED',holdState:'EXPIRED',bookingPayments:{ some:{ status:{ not:'COMPLETED' },reviewResolvedAt:null } },OR:[{paymentCheckAt:null},{paymentCheckAt:{lte:new Date(now.getTime()-300000)}}] },select:{id:true},orderBy:{paymentCheckAt:{sort:'asc',nulls:'first'}},take:10 });
      for (const b of released) {
        await this.prisma.client.booking.update({where:{id:b.id},data:{paymentCheckAt:now}});
        try { await this.syncBooking(b.id); } catch { this.logger.warn(`Late payment audit will retry: ${b.id}`); }
      }
    } catch { this.logger.error('Booking hold worker unavailable; rooms remain held until reconciliation succeeds'); }
    finally { this.sweeping = false; }
  }

  async paymentReviews() {
    const payments = await this.prisma.client.bookingPayment.findMany({ where: { reviewReason:{ not:null }, reviewResolvedAt:null }, include: { booking:{ select:{ reference:true, room:{ select:{ roomNumber:true } }, user:{ select:{ fullName:true } } } } }, orderBy:{ id:'asc' }, take:100 });
    const staleCounterBookings = await this.prisma.client.booking.findMany({ where:{ onlinePaymentRequired:false, status:'PENDING', createdAt:{ lte:new Date(Date.now()-24*60*60*1000) } }, select:{ id:true,reference:true,createdAt:true,room:{ select:{ roomNumber:true } },user:{ select:{ fullName:true } } }, orderBy:{ createdAt:'asc' }, take:100 });
    return { payments:payments.map(p => ({ id:p.id,bookingId:p.bookingId,reference:p.booking.reference,roomNumber:p.booking.room.roomNumber,customerName:p.booking.user.fullName,amount:p.receivedAmount.toFixed(2),reason:p.reviewReason })), staleCounterBookings };
  }

  async resolvePaymentReview(id: string, refundReference: string, actor: PublicUser) {
    if (!['ADMIN','RECEPTIONIST'].includes(actor.role)) throw new BadRequestException('Staff required');
    if (typeof refundReference !== 'string' || !refundReference.trim() || refundReference.length>200) throw new BadRequestException('Cần mã giao dịch hoàn tiền đã xác minh');
    const result = await this.prisma.client.bookingPayment.updateMany({ where:{ id, reviewReason:{ not:null }, reviewResolvedAt:null, status:{ not:'COMPLETED' } }, data:{ reviewResolvedAt:new Date(), refundReference:refundReference.trim(), resolvedById:actor.id } });
    if (!result.count) throw new ConflictException('Khoản tiền đã được xử lý hoặc cần tải lại');
    return { resolved:true };
  }

  async cancelBooking(id: string, actor: PublicUser) {
    const booking = await this.ownedBooking(id, actor);
    if (!booking.onlinePaymentRequired || booking.status !== 'PENDING') throw new ConflictException('Vui lòng liên hệ lễ tân để xử lý booking đã thanh toán');
    await this.prisma.client.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM hotel.bookings WHERE id=${id}::uuid FOR UPDATE`;
      await tx.booking.updateMany({ where:{id,status:'PENDING'},data:{holdState:'CHECKING_PAYMENT',paymentCheckAt:new Date()} });
    });
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
      const result = await tx.booking.updateMany({ where: { id, ...(actor.role === 'GUEST' ? {userId:actor.id} : {}), status: 'PENDING' }, data: { status: 'CANCELLED',holdState:null } });
      if (!result.count) throw new ConflictException('Booking đã thay đổi');
    });
    return { cancelled: true };
  }

  private async serviceOrder(id: string, actor?: PublicUser) {
    if (actor && !['GUEST', 'RECEPTIONIST', 'ADMIN'].includes(actor.role)) throw new BadRequestException('Staff required');
    const order = await this.prisma.client.serviceOrder.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Service order not found');
    if (actor?.role === 'GUEST') {
      const owned = await this.prisma.client.booking.findFirst({ where: { id: order.bookingId, userId: actor.id } });
      if (!owned || !order.requestedPaymentMethod) throw new NotFoundException('Service order not found');
    }
    return order;
  }

  async startServiceOrder(id: string, actor: PublicUser) {
    this.client();
    const target = await this.serviceOrder(id, actor);
    if (target.payosOrderCode) await this.syncServiceOrder(id, actor);
    const reconciled = await this.serviceOrder(id, actor);
    let renewableCode: bigint | null = null;
    if (reconciled.payosStatus === 'CLOSED' && reconciled.payosOrderCode) {
      // Recheck the previous link before replacing it: never create another QR
      // when the gateway has received funds or its outcome is uncertain.
      let remote;
      try { remote = await this.client().paymentRequests.get(Number(reconciled.payosOrderCode)); }
      catch { throw new ServiceUnavailableException('Chưa thể kiểm tra liên kết cũ. Vui lòng thử lại'); }
      this.validBookingRemote(remote, { payosOrderCode: reconciled.payosOrderCode, amount: reconciled.totalAmount });
      if (!['CANCELLED', 'EXPIRED', 'FAILED'].includes(remote.status) || remote.amountPaid !== 0) throw new ConflictException('Liên kết cũ cần đối soát trước khi tạo QR mới');
      renewableCode = reconciled.payosOrderCode;
    }
    await this.prisma.client.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM hotel.bookings WHERE id=${target.bookingId}::uuid FOR UPDATE`;
      const booking = await tx.booking.findUniqueOrThrow({ where: { id: target.bookingId }, select: { status: true, invoice: { select: { id: true } } } });
      const order = await tx.serviceOrder.findUniqueOrThrow({ where: { id } });
      if (order.paymentMethod) return;
      if (booking.status !== 'CHECKED_IN' || (booking.invoice && !order.requestedPaymentMethod) || order.status === 'CANCELLED') throw new ConflictException('Đơn dịch vụ không còn được thanh toán riêng');
      if (order.payosStatus === 'CLOSED' && order.payosOrderCode !== renewableCode) throw new ConflictException('Giao dịch đã thay đổi. Vui lòng tải lại');
      if (!order.totalAmount.isInteger() || !Number.isSafeInteger(order.totalAmount.toNumber()) || order.totalAmount.lte(0)) throw new ConflictException('payOS yêu cầu số tiền nguyên VND dương');
      if (!order.payosOrderCode || order.payosStatus === 'CLOSED') await tx.serviceOrder.update({ where: { id }, data: { payosCheckoutUrl: null, payosQrCode: null, payosOrderCode: (2n << 48n) + BigInt(randomBytes(6).readUIntBE(0, 6)), payosStatus: 'PENDING', payosCreatedBy: actor.id } });
    });
    // Persist the order code before the external call so retries reuse it after a timeout.
    return this.prisma.client.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM hotel.bookings WHERE id=${target.bookingId}::uuid FOR UPDATE`;
      const order = await tx.serviceOrder.findUniqueOrThrow({ where: { id } });
      if (order.paymentMethod) return { paid: true };
      if (!order.payosOrderCode || order.payosStatus !== 'PENDING') throw new ConflictException('Giao dịch đã thay đổi');
      if (order.payosCheckoutUrl) return { paid: false, checkoutUrl: order.payosCheckoutUrl, qrCode: order.payosQrCode ?? order.payosCheckoutUrl };
      let qrCode: string | undefined;
      const checkoutUrl = await this.createLink(Number(order.payosOrderCode), order.totalAmount.toNumber(), actor.role === 'GUEST' ? '/guest/service-orders' : `/reception/service-orders/${id}`, undefined, qr => { qrCode = qr; });
      await tx.serviceOrder.update({ where: { id }, data: { payosCheckoutUrl: checkoutUrl, payosQrCode: qrCode ?? checkoutUrl } });
      return { paid: false, checkoutUrl, qrCode: qrCode ?? checkoutUrl };
    }, { timeout: 25000 });
  }

  async syncServiceOrder(id: string, actor?: PublicUser) {
    const target = await this.serviceOrder(id, actor);
    if (!target.payosOrderCode || target.payosStatus !== 'PENDING') return { paid: !!target.paymentMethod, closed: !target.payosOrderCode || target.payosStatus === 'CLOSED' };
    let remote;
    try { remote = await this.client().paymentRequests.get(Number(target.payosOrderCode)); }
    catch (error) {
      if (!target.payosCheckoutUrl && error instanceof PayosNotFoundError) return { paid: false, closed: false };
      throw new ServiceUnavailableException('Chưa thể kiểm tra giao dịch payOS');
    }
    this.validBookingRemote(remote, { payosOrderCode: target.payosOrderCode, amount: target.totalAmount });
    const closed = ['CANCELLED', 'EXPIRED', 'FAILED'].includes(remote.status) && remote.amountPaid === 0;
    await this.prisma.client.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM hotel.bookings WHERE id=${target.bookingId}::uuid FOR UPDATE`;
      const current = await tx.serviceOrder.findUniqueOrThrow({ where: { id } });
      if (current.payosStatus !== 'PENDING') return;
      if (remote.status === 'PAID') {
        if (current.paymentMethod || !current.payosCreatedBy || current.status === 'CANCELLED') throw new ConflictException('Khoản thanh toán cần đối soát');
        await tx.serviceOrder.update({ where: { id }, data: { payosStatus: 'PAID', status: 'COMPLETED', paymentMethod: 'BANK_TRANSFER', paidAt: new Date(), receivedBy: current.payosCreatedBy } });
      } else if (closed) await tx.serviceOrder.update({ where: { id }, data: { payosStatus: 'CLOSED' } });
    });
    return { paid: remote.status === 'PAID', closed };
  }

  async cancelServiceOrderPayment(id: string, actor: PublicUser) {
    const order = await this.serviceOrder(id, actor);
    if (order.payosOrderCode && order.payosStatus === 'PENDING') {
      try { await this.client().paymentRequests.cancel(Number(order.payosOrderCode), 'Huy thanh toan dich vu'); }
      catch { throw new ServiceUnavailableException('Chưa thể hủy giao dịch payOS. Vui lòng kiểm tra thanh toán'); }
    }
    return this.syncServiceOrder(id, actor);
  }

  private async createLink(orderCode: number, amount: number, path: string, expiredAt?: number, onQr?: (qr: string) => void) {
    const client = this.client();
    const origin = this.config.get<string>('PAYOS_RETURN_ORIGIN');
    let validOrigin = false;
    try { validOrigin = !!origin && ['http:', 'https:'].includes(new URL(origin).protocol) && new URL(origin).origin === origin; } catch { /* Invalid deployment configuration. */ }
    if (!validOrigin) throw new ServiceUnavailableException('PAYOS_RETURN_ORIGIN chưa hợp lệ');
    let checkoutUrl: string;
    let qrCode: string | undefined;
    try {
      const link = await client.paymentRequests.create({ orderCode, amount, description: `HOTEL ${orderCode}`,
        ...(expiredAt ? { expiredAt } : {}), returnUrl: `${origin}${path}?payos=return`, cancelUrl: `${origin}${path}?payos=cancel` });
      if (link.orderCode !== orderCode || link.amount !== amount || link.currency !== 'VND') throw new Error('Payment link mismatch');
      checkoutUrl = link.checkoutUrl;
      qrCode = link.qrCode;
    } catch {
      try {
        const existing = await client.paymentRequests.get(orderCode);
        if (!/^[a-f0-9]{32}$/i.test(existing.id) || !['PENDING', 'UNDERPAID', 'PROCESSING'].includes(existing.status) || existing.amount !== amount) throw new Error('Invalid link');
        checkoutUrl = `https://pay.payos.vn/web/${existing.id}`;
      } catch { throw new ServiceUnavailableException('Chưa thể tạo liên kết payOS. Vui lòng thử lại'); }
    }
    const url = new URL(checkoutUrl);
    if (url.protocol !== 'https:' || url.hostname !== 'pay.payos.vn' || url.username || url.password) throw new ServiceUnavailableException('Liên kết payOS không hợp lệ');
    if (qrCode) onQr?.(qrCode);
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
    const serviceOrder = await this.prisma.client.serviceOrder.findUnique({ where: { payosOrderCode: BigInt(data.orderCode) } });
    if (serviceOrder && data.code === '00') await this.syncServiceOrder(serviceOrder.id);
    return { success: true };
  }
}
