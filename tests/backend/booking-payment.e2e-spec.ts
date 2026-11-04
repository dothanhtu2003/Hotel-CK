import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createAuthTestApp } from './auth-test-app.js';
import { migrateTestDatabase } from '../database/helpers.js';
import { PayosService } from '../../src/billing/payos.service.js';
import { PasswordService } from '../../src/auth/password.service.js';

describe('Full online booking payment with PostgreSQL and simulated payOS', () => {
  let ctx: Awaited<ReturnType<typeof createAuthTestApp>>;
  const actors = {} as Record<'guest' | 'other' | 'staff', { id: string; token: string }>;
  type Link = { id: string; orderCode: number; amount: number; amountPaid: number; amountRemaining: number; status: string };
  const links = new Map<number, Link>();
  const api = () => request(ctx.app.getHttpServer());
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const end = new Date(`${today}T00:00:00Z`); end.setUTCDate(end.getUTCDate() + 2);
  beforeAll(async () => {
    migrateTestDatabase();
    ctx = await createAuthTestApp();
    ctx.app.get(ConfigService).set('PAYOS_RETURN_ORIGIN', 'http://localhost:5173');
    const passwordHash = await ctx.app.get(PasswordService).hash(randomUUID());
    for (const [name, role] of [['guest', 'GUEST'], ['other', 'GUEST'], ['staff', 'RECEPTIONIST']] as const) {
      const user = await ctx.prisma.client.user.create({ data: { fullName: `Payment ${name}`, passwordHash, role } });
      actors[name] = { id: user.id, token: await ctx.app.get(JwtService).signAsync({ sub: user.id, tokenType: 'access' }) };
    }
    Object.defineProperty(ctx.app.get(PayosService), 'client', { value: () => ({ paymentRequests: {
      create: async (data: { orderCode: number; amount: number }) => {
        const link = { ...data, id: randomUUID().replaceAll('-', ''), amountPaid: 0, amountRemaining: data.amount, status: 'PENDING' };
        links.set(data.orderCode, link);
        return { ...link, currency: 'VND', checkoutUrl: `https://pay.payos.vn/web/${link.id}` };
      },
      get: async (code: number) => { const link = links.get(code); if (!link) throw new Error('Not created'); return link; },
      cancel: async (code: number) => { const link = links.get(code)!; if (link.status !== 'PAID') link.status = 'CANCELLED'; return link; },
    } }) });
  });
  afterAll(async () => { if (ctx) await ctx.app.close(); });

  async function booking() {
    const type = await ctx.prisma.client.roomType.create({ data: { name: `Online ${randomUUID()}`, nightlyPrice: 100000, maxGuests: 2 } });
    const room = await ctx.prisma.client.room.create({ data: { roomNumber: randomUUID().slice(0, 12), roomTypeId: type.id, floor: 1 } });
    const response = await api().post('/api/bookings').auth(actors.guest.token, { type: 'bearer' }).send({ roomId: room.id, checkIn: today, checkOut: end.toISOString().slice(0, 10), guests: 1 }).expect(201);
    return response.body as { id: string; onlinePaymentRequired: boolean; status: string };
  }
  const start = (id: string, who: keyof typeof actors = 'guest') => api().post(`/api/bookings/${id}/payos`).auth(actors[who].token, { type: 'bearer' });
  const sync = (id: string) => api().post(`/api/bookings/${id}/payos/sync`).auth(actors.guest.token, { type: 'bearer' });
  const action = (id: string, name: string) => api().patch(`/api/bookings/${id}/${name}`).auth(actors.staff.token, { type: 'bearer' });
  async function remote(id: string) {
    const attempt = await ctx.prisma.client.bookingPayment.findFirstOrThrow({ where: { bookingId: id } });
    return links.get(Number(attempt.payosOrderCode))!;
  }
  async function deskBooking(method: 'CASH' | 'BANK_TRANSFER', extra = {}) {
    const type = await ctx.prisma.client.roomType.create({ data: { name: randomUUID(), nightlyPrice: 100000, maxGuests: 2 } });
    const room = await ctx.prisma.client.room.create({ data: { roomNumber: randomUUID().slice(0, 12), roomTypeId: type.id, floor: 1 } });
    return api().post('/api/front-desk/walk-in').auth(actors.staff.token, { type: 'bearer' }).send({
      roomId: room.id, customerId: actors.other.id, checkIn: today, checkOut: end.toISOString().slice(0, 10), guests: 1,
      paymentMethod: method, expectedAmount: '200000.00', ...extra,
    });
  }
  it('requires cash receipt confirmation, credits the invoice once with CASH, and rejects stale prices', async () => {
    const rejected = await deskBooking('CASH'); expect(rejected.status).toBe(400);
    const stale = await deskBooking('CASH', { paymentVerified: true, expectedAmount: '1.00' }); expect(stale.status).toBe(409);
    const response = await deskBooking('CASH', { paymentVerified: true }); expect(response.status).toBe(201);
    const id = response.body.id; expect(response.body.status).toBe('CHECKED_IN');
    const receipt = await ctx.prisma.client.bookingPayment.findFirstOrThrow({ where: { bookingId: id } });
    expect(receipt).toMatchObject({ method: 'CASH', status: 'COMPLETED', collectedById: actors.staff.id, payosOrderCode: null });
    const invoice = await api().post(`/api/bookings/${id}/invoice`).auth(actors.staff.token, { type: 'bearer' }).send({}).expect(201);
    expect(invoice.body.balance).toBe('0.00'); expect(invoice.body.payments).toHaveLength(1);
    expect(invoice.body.payments[0].method).toBe('CASH');
  });
  it('confirms a future cash reservation without check-in and blocks cancellation of collected money', async () => {
    const next = new Date(`${today}T00:00:00Z`); next.setUTCDate(next.getUTCDate() + 1);
    const response = await deskBooking('CASH', { checkIn: next.toISOString().slice(0, 10), expectedAmount: '100000.00', paymentVerified: true, receiveNow: false });
    expect(response.status).toBe(201); expect(response.body.status).toBe('CONFIRMED');
    await action(response.body.id, 'cancel').expect(409);
  });
  it('keeps a desk transfer pending until payOS confirms, then allows check-in', async () => {
    const response = await deskBooking('BANK_TRANSFER'); expect(response.status).toBe(201);
    const id = response.body.id; expect(response.body.status).toBe('PENDING');
    await action(id, 'check-in').expect(409);
    await start(id, 'staff').expect(201);
    const state = await api().get(`/api/bookings/${id}/payment-state`).auth(actors.staff.token, { type: 'bearer' }).expect(200);
    expect(state.body.paid).toBe(false);
    const link = await remote(id); link.status = 'PAID'; link.amountPaid = 200000; link.amountRemaining = 0;
    await api().post(`/api/bookings/${id}/payos/sync`).auth(actors.staff.token, { type: 'bearer' }).expect(201);
    await action(id, 'check-in').expect(200);
  });
  it('requires full payment, verifies ownership, confirms once, and credits the final invoice', async () => {
    const b = await booking();
    expect(b.onlinePaymentRequired).toBe(true); expect(b.status).toBe('PENDING');
    await action(b.id, 'confirm').expect(409); await action(b.id, 'check-in').expect(409);
    await start(b.id, 'other').expect(404); await start(b.id, 'staff').expect(201);
    const first = await start(b.id).expect(201);
    const second = await start(b.id).expect(201);
    expect(second.body.checkoutUrl).toBe(first.body.checkoutUrl);
    expect(await ctx.prisma.client.bookingPayment.count({ where: { bookingId: b.id } })).toBe(1);
    const link = await remote(b.id); expect(link.amount).toBe(200000);
    link.status = 'UNDERPAID'; link.amountPaid = 100000; link.amountRemaining = 100000;
    await sync(b.id).expect(201); await action(b.id, 'confirm').expect(409);
    link.status = 'PAID'; link.amountPaid = 200000; link.amountRemaining = 0;
    await Promise.all([sync(b.id).expect(201), sync(b.id).expect(201)]);
    expect((await ctx.prisma.client.booking.findUniqueOrThrow({ where: { id: b.id } })).status).toBe('CONFIRMED');
    await action(b.id, 'check-in').expect(200);
    const service = await ctx.prisma.client.service.create({ data: { name: randomUUID(), currentPrice: 45000 } });
    const order = await api().post('/api/service-orders').auth(actors.guest.token, { type: 'bearer' }).send({ bookingId: b.id, items: [{ serviceId: service.id, quantity: 1 }] }).expect(201);
    await api().patch(`/api/service-orders/${order.body.id}/complete`).auth(actors.staff.token, { type: 'bearer' }).send({}).expect(200);
    const beforeInvoice = await api().get(`/api/bookings/${b.id}/billing-preview`).auth(actors.staff.token, { type: 'bearer' }).expect(200);
    expect(beforeInvoice.body.paidAmount).toBe('200000.00'); expect(beforeInvoice.body.balance).toBe('45000.00');
    expect(beforeInvoice.body.roomPayments).toHaveLength(1); expect(beforeInvoice.body.roomPayments[0].paidAt).toBeTruthy();
    const invoice = await api().post(`/api/bookings/${b.id}/invoice`).auth(actors.staff.token, { type: 'bearer' }).send({}).expect(201);
    expect(invoice.body.totalAmount).toBe('245000.00'); expect(invoice.body.paidAmount).toBe('200000.00'); expect(invoice.body.balance).toBe('45000.00');
    expect(invoice.body.payments).toHaveLength(1);
    const afterInvoice = await api().get(`/api/bookings/${b.id}/billing-preview`).auth(actors.staff.token, { type: 'bearer' }).expect(200);
    expect(afterInvoice.body.paidAmount).toBe('200000.00'); expect(afterInvoice.body.balance).toBe('45000.00');
    await sync(b.id).expect(201);
    expect(await ctx.prisma.client.payment.count({ where: { invoiceId: invoice.body.id } })).toBe(1);
  });
  it('cancels an unpaid link before releasing the room and allows retry after a cancelled link', async () => {
    const b = await booking(); await start(b.id).expect(201);
    const link = await remote(b.id); link.status = 'CANCELLED';
    await start(b.id).expect(201);
    expect(await ctx.prisma.client.bookingPayment.count({ where: { bookingId: b.id } })).toBe(2);
    await api().post(`/api/bookings/${b.id}/payos/cancel`).auth(actors.guest.token, { type: 'bearer' }).expect(201);
    expect((await ctx.prisma.client.booking.findUniqueOrThrow({ where: { id: b.id } })).status).toBe('CANCELLED');
  });
  it('preserves a paid booking when payment wins a cancellation race', async () => {
    const b = await booking(); await start(b.id).expect(201);
    const link = await remote(b.id); link.status = 'PAID'; link.amountPaid = link.amount; link.amountRemaining = 0;
    await api().post(`/api/bookings/${b.id}/payos/cancel`).auth(actors.guest.token, { type: 'bearer' }).expect(409);
    expect((await ctx.prisma.client.booking.findUniqueOrThrow({ where: { id: b.id } })).status).toBe('CONFIRMED');
    await api().patch(`/api/bookings/${b.id}/cancel`).auth(actors.guest.token, { type: 'bearer' }).expect(409);
  });
  it('shows a fully paid invoice immediately when no extra services were used', async () => {
    const b = await booking(); await start(b.id).expect(201);
    const link = await remote(b.id); link.status = 'PAID'; link.amountPaid = link.amount; link.amountRemaining = 0;
    await sync(b.id).expect(201);
    const state = await api().get(`/api/bookings/${b.id}/payment-state`).auth(actors.guest.token, { type: 'bearer' }).expect(200);
    expect(state.body.paid).toBe(true); expect(state.body.paidAmount).toBe('200000.00');
    await api().get(`/api/bookings/${b.id}/payment-state`).auth(actors.other.token, { type: 'bearer' }).expect(404);
    await action(b.id, 'check-in').expect(200);
    const invoice = await api().post(`/api/bookings/${b.id}/invoice`).auth(actors.staff.token, { type: 'bearer' }).send({}).expect(201);
    expect(invoice.body.status).toBe('PAID'); expect(invoice.body.balance).toBe('0.00');
    await api().post(`/api/invoices/${invoice.body.id}/payments`).auth(actors.staff.token, { type: 'bearer' }).set('Idempotency-Key', randomUUID()).send({ amount: '200000', method: 'CASH' }).expect(409);
  });
  it('honors grace, closes links, releases the room, then restores a late payment exactly once if still available', async () => {
    const b=await booking(); await start(b.id).expect(201);
    const stored=await ctx.prisma.client.booking.findUniqueOrThrow({where:{id:b.id}});
    const deadline=stored.holdExpiresAt!;
    const link=await remote(b.id);
    expect((link as unknown as {expiredAt:number}).expiredAt).toBe(Math.floor(deadline.getTime()/1000));
    const service=ctx.app.get(PayosService);
    await service.expireBooking(b.id,new Date(deadline.getTime()+119999));
    expect((await ctx.prisma.client.booking.findUniqueOrThrow({where:{id:b.id}})).holdState).toBe('ACTIVE');
    await Promise.all([service.expireBooking(b.id,new Date(deadline.getTime()+120001)),service.expireBooking(b.id,new Date(deadline.getTime()+120001))]);
    expect(link.status).toBe('CANCELLED');
    expect((await ctx.prisma.client.booking.findUniqueOrThrow({where:{id:b.id}}))).toMatchObject({status:'CANCELLED',holdState:'EXPIRED'});
    link.status='PAID'; link.amountPaid=link.amount; link.amountRemaining=0;
    await Promise.all([sync(b.id).expect(201),sync(b.id).expect(201)]);
    expect((await ctx.prisma.client.booking.findUniqueOrThrow({where:{id:b.id}}))).toMatchObject({status:'CONFIRMED',holdState:'PAID'});
  });
  it('keeps the room held on gateway errors and retries safely',async()=>{
    const b=await booking(); await start(b.id).expect(201);
    const stored=await ctx.prisma.client.booking.findUniqueOrThrow({where:{id:b.id}});
    const attempt=await ctx.prisma.client.bookingPayment.findFirstOrThrow({where:{bookingId:b.id}});
    const link=links.get(Number(attempt.payosOrderCode))!; links.delete(Number(attempt.payosOrderCode));
    await expect(ctx.app.get(PayosService).expireBooking(b.id,new Date(stored.holdExpiresAt!.getTime()+120001))).rejects.toThrow();
    expect((await ctx.prisma.client.booking.findUniqueOrThrow({where:{id:b.id}}))).toMatchObject({status:'PENDING',holdState:'CHECKING_PAYMENT'});
    links.set(Number(attempt.payosOrderCode),link);
    await ctx.app.get(PayosService).expireBooking(b.id,new Date(stored.holdExpiresAt!.getTime()+190001));
    expect((await ctx.prisma.client.booking.findUniqueOrThrow({where:{id:b.id}})).status).toBe('CANCELLED');
  });
  it('routes late money to review if the expired room was sold again',async()=>{
    const b=await booking(); await start(b.id).expect(201);
    const stored=await ctx.prisma.client.booking.findUniqueOrThrow({where:{id:b.id}});
    await ctx.app.get(PayosService).expireBooking(b.id,new Date(stored.holdExpiresAt!.getTime()+120001));
    await ctx.prisma.client.booking.create({data:{reference:randomUUID(),userId:actors.other.id,roomId:stored.roomId,checkInDate:stored.checkInDate,checkOutDate:stored.checkOutDate,guestCount:1}});
    const link=await remote(b.id);link.status='PAID';link.amountPaid=link.amount;link.amountRemaining=0;
    await sync(b.id).expect(201);await sync(b.id).expect(201);
    expect((await ctx.prisma.client.booking.findUniqueOrThrow({where:{id:b.id}})).status).toBe('CANCELLED');
    expect(await ctx.prisma.client.bookingPayment.findFirstOrThrow({where:{bookingId:b.id}})).toMatchObject({reviewReason:'LATE_PAYMENT_ROOM_UNAVAILABLE'});
    const review=await api().get('/api/payments/booking-reviews').auth(actors.staff.token,{type:'bearer'}).expect(200);
    expect(review.body.payments.some((p:{bookingId:string})=>p.bookingId===b.id)).toBe(true);
  });

  it('expires a hold without a link, and keeps a paid booking when payment wins expiry',async()=>{
    const b=await booking();
    const stored=await ctx.prisma.client.booking.findUniqueOrThrow({where:{id:b.id}});
    await ctx.app.get(PayosService).expireBooking(b.id,new Date(stored.holdExpiresAt!.getTime()+120001));
    expect((await ctx.prisma.client.booking.findUniqueOrThrow({where:{id:b.id}})).holdState).toBe('EXPIRED');
    const paid=await booking();await start(paid.id).expect(201);
    const value=await ctx.prisma.client.booking.findUniqueOrThrow({where:{id:paid.id}});
    const link=await remote(paid.id);link.status='PAID';link.amountPaid=link.amount;link.amountRemaining=0;
    await Promise.all([ctx.app.get(PayosService).expireBooking(paid.id,new Date(value.holdExpiresAt!.getTime()+120001)),sync(paid.id).expect(201)]);
    expect((await ctx.prisma.client.booking.findUniqueOrThrow({where:{id:paid.id}})).status).toBe('CONFIRMED');
  });

  it('lets reception cancel an unpaid online booking through the normal cancel action',async()=>{
    const b=await booking();await start(b.id).expect(201);
    await action(b.id,'cancel').expect(200);
    expect((await remote(b.id)).status).toBe('CANCELLED');
    expect((await ctx.prisma.client.booking.findUniqueOrThrow({where:{id:b.id}})).status).toBe('CANCELLED');
  });

});
