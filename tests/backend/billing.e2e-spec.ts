import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { Prisma } from '../../generated/prisma/client.js';
import { PasswordService } from '../../src/auth/password.service.js';
import { createAuthTestApp } from './auth-test-app.js';

describe('Phase 7 billing and complete hotel workflow — hotel_test only', () => {
  let context: Awaited<ReturnType<typeof createAuthTestApp>>;
  const actors = {} as Record<'guest' | 'other' | 'receptionist' | 'admin' | 'housekeeping', { id: string; token: string }>;
  const api = () => request(context.app.getHttpServer());
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const end = new Date(`${today}T00:00:00Z`); end.setUTCDate(end.getUTCDate() + 3);
  let serviceId: string;
  const roomIds: string[] = [];
  beforeAll(async () => {
    context = await createAuthTestApp();
    const hash = await context.app.get(PasswordService).hash(`A1-${randomUUID()}`);
    for (const [name, role] of [['guest', 'GUEST'], ['other', 'GUEST'], ['receptionist', 'RECEPTIONIST'], ['admin', 'ADMIN'], ['housekeeping', 'HOUSEKEEPING']] as const) {
      const user = await context.prisma.client.user.create({ data: { email: `${randomUUID()}@billing-test.invalid`, fullName: `Billing ${name}`, passwordHash: hash, role } });
      actors[name] = { id: user.id, token: await context.app.get(JwtService).signAsync({ sub: user.id, tokenType: 'access' }) };
    }
    serviceId = (await context.prisma.client.service.create({ data: { name: `Billing service ${randomUUID()}`, currentPrice: '45000.25' } })).id;
  });
  afterAll(async () => { if (context) await context.app.close(); });

  // Only staff accounts/catalog/rooms require direct fixture writes. The final workflow
  // below uses actual register/login and HTTP for every business step, with real PostgreSQL.
  async function room(price = '100000.25') {
    const type = await context.prisma.client.roomType.create({ data: { name: `Billing ${randomUUID()}`, nightlyPrice: price, maxGuests: 2 } });
    const r = await context.prisma.client.room.create({ data: { roomNumber: randomUUID().replaceAll('-', '').slice(0, 12), roomTypeId: type.id, floor: 1 } });
    roomIds.push(r.id); return { room: r, type };
  }
  const bookingAction = (id: string, action: string, who: keyof typeof actors = 'receptionist', body = {}) => api().patch(`/api/bookings/${id}/${action}`).auth(actors[who].token, { type: 'bearer' }).send(body);
  async function stay(state: 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' = 'CHECKED_IN', price?: string) {
    const fixture = await room(price);
    const result = await api().post('/api/bookings').auth(actors.guest.token, { type: 'bearer' }).send({ roomId: fixture.room.id, checkIn: today, checkOut: end.toISOString().slice(0, 10), guests: 2 }).expect(201);
    if (state !== 'PENDING') await bookingAction(result.body.id, 'confirm').expect(200);
    if (state === 'CHECKED_IN') await bookingAction(result.body.id, 'check-in').expect(200);
    return { ...fixture, id: result.body.id as string };
  }
  const preview = (id: string, who: keyof typeof actors = 'guest') => api().get(`/api/bookings/${id}/billing-preview`).auth(actors[who].token, { type: 'bearer' });
  const issue = (id: string, who: keyof typeof actors = 'receptionist', body = {}) => api().post(`/api/bookings/${id}/invoice`).auth(actors[who].token, { type: 'bearer' }).send(body);
  const invoice = (id: string, who: keyof typeof actors = 'guest') => api().get(`/api/invoices/${id}`).auth(actors[who].token, { type: 'bearer' });
  const pay = (id: string, amount: unknown, method = 'CASH', key: string = randomUUID(), who: keyof typeof actors = 'receptionist') => api().post(`/api/invoices/${id}/payments`).auth(actors[who].token, { type: 'bearer' }).set('Idempotency-Key', key).send({ amount, method });
  const createOrder = (bookingId: string, service = serviceId) => api().post('/api/service-orders').auth(actors.guest.token, { type: 'bearer' }).send({ bookingId, items: [{ serviceId: service, quantity: 2 }] });
  const orderAction = (id: string, action = 'complete') => api().patch(`/api/service-orders/${id}/${action}`).auth(actors.receptionist.token, { type: 'bearer' }).send({});
  const safe = (body: unknown) => expect(JSON.stringify(body)).not.toMatch(/userId|password|email|phone|secret|driverAdapterError|SELECT /i);
  async function issued() { const b = await stay(); const i = await issue(b.id).expect(201); return { ...b, invoice: i.body }; }
  async function paid() { const b = await issued(); await pay(b.invoice.id, b.invoice.totalAmount).expect(201); return b; }
  const tasks = (roomId: string) => context.prisma.client.housekeepingTask.findMany({ where: { roomId } });

  it('01-05 preview counts 3 nights and completed snapshot services, excludes pending/cancelled and never writes', async () => {
    const b = await stay();
    const ownService = await context.prisma.client.service.create({ data: { name: randomUUID(), currentPrice: '45000.25' } });
    const completed = (await createOrder(b.id, ownService.id).expect(201)).body; await orderAction(completed.id).expect(200);
    const cancelled = (await createOrder(b.id).expect(201)).body; await orderAction(cancelled.id, 'cancel').expect(200);
    await createOrder(b.id).expect(201);
    await context.prisma.client.roomType.update({ where: { id: b.type.id }, data: { nightlyPrice: '999999.99' } });
    await context.prisma.client.service.update({ where: { id: ownService.id }, data: { currentPrice: '999999.99' } });
    const before = await context.prisma.client.booking.findUniqueOrThrow({ where: { id: b.id } });
    const response = await preview(b.id).expect(200); const view = response.body;
    expect(view.booking.nights).toBe(3); expect(view.booking.nightlyPrice).toBe('100000.25'); expect(view.roomAmount).toBe('300000.75');
    expect(view.serviceAmount).toBe('90000.50'); expect(view.totalAmount).toBe('390001.25'); expect(view.completedOrders).toHaveLength(1); expect(view.pendingOrderCount).toBe(1);
    expect(view.completedOrders[0].items[0].unitPrice).toBe('45000.25'); expect(response.headers['cache-control']).toBe('no-store'); safe(view);
    expect(await context.prisma.client.invoice.count({ where: { bookingId: b.id } })).toBe(0);
    expect(await context.prisma.client.booking.findUniqueOrThrow({ where: { id: b.id } })).toEqual(before);
    await issue(b.id).expect(409);
    const pending = await context.prisma.client.serviceOrder.findFirstOrThrow({ where: { bookingId: b.id, status: 'PENDING' } }); await orderAction(pending.id, 'cancel').expect(200);
    const final = await issue(b.id).expect(201); expect(final.body.roomAmount).toBe(view.roomAmount); expect(final.body.serviceAmount).toBe(view.serviceAmount); expect(final.body.totalAmount).toBe(view.totalAmount);
  });
  it('07/08 ownership hides other guest preview/invoice and allows both staff roles', async () => {
    const b = await issued();
    await preview(b.id, 'other').expect(404); await invoice(b.invoice.id, 'other').expect(404);
    await api().get(`/api/bookings/${b.id}/invoice`).auth(actors.other.token, { type: 'bearer' }).expect(404);
    for (const who of ['guest', 'receptionist', 'admin'] as const) {
      safe((await preview(b.id, who).expect(200)).body); safe((await invoice(b.invoice.id, who).expect(200)).body);
      const byBooking = await api().get(`/api/bookings/${b.id}/invoice`).auth(actors[who].token, { type: 'bearer' }).expect(200); expect(byBooking.body.id).toBe(b.invoice.id);
    }
  });
  it('09/10 valid invoice commits while CHECKED_IN, rejects duplicate and blocks later service orders', async () => {
    const b = await issued(); expect(b.invoice.status).toBe('ISSUED'); expect(b.invoice.balance).toBe('300000.75'); expect(b.invoice.payments).toEqual([]);
    expect((await context.prisma.client.booking.findUniqueOrThrow({ where: { id: b.id } })).status).toBe('CHECKED_IN');
    await issue(b.id).expect(409); await createOrder(b.id).expect(409);
    expect(await context.prisma.client.invoice.count({ where: { bookingId: b.id } })).toBe(1);
  });
  it.each(['PENDING', 'CONFIRMED'] as const)('11 invoice requires check-in, rejects %s', async state => {
    const b = await stay(state); await issue(b.id).expect(409); expect(await context.prisma.client.invoice.count({ where: { bookingId: b.id } })).toBe(0);
  });
  it('13/14/17/18 partial CASH then manual verified BANK_TRANSFER reaches PAID exactly', async () => {
    const b = await issued(); const first = await pay(b.invoice.id, '100000.10').expect(201);
    expect(first.body.invoice.status).toBe('ISSUED'); expect(first.body.invoice.paidAmount).toBe('100000.10'); expect(first.body.invoice.balance).toBe('200000.65');
    const final = await pay(b.invoice.id, '200000.65', 'BANK_TRANSFER', randomUUID(), 'admin').expect(201);
    expect(final.body.invoice.status).toBe('PAID'); expect(final.body.invoice.balance).toBe('0.00'); expect(final.body.payment.status).toBe('COMPLETED'); expect(final.body.payment.paidAt).toBeTruthy(); safe(final.body);
    expect((await invoice(b.invoice.id).expect(200)).body.payments).toHaveLength(2);
    await pay(b.invoice.id, '0.01').expect(409);
  });
  it('15 overpayment returns conflict and leaves invoice/payments unchanged', async () => {
    const b = await issued(); const before = (await invoice(b.invoice.id).expect(200)).body;
    const failed = await pay(b.invoice.id, '300000.76').expect(409); safe(failed.body);
    expect((await invoice(b.invoice.id).expect(200)).body).toEqual(before);
  });
  it('16 DTO rejects zero, negatives, imprecise numbers, unsupported method and mass assignment', async () => {
    const b = await issued();
    for (const amount of ['0', '0.00', '-1', '0.001', 'NaN', 'Infinity', '1e4', ' 1', '01.00', '1000000000000', 100, null]) await pay(b.invoice.id, amount).expect(400);
    await pay(b.invoice.id, '1.00', 'CARD').expect(400);
    for (const extra of [{ status: 'COMPLETED' }, { paidAt: new Date().toISOString() }, { invoiceId: randomUUID() }, { id: randomUUID() }, { userId: actors.other.id }]) await api().post(`/api/invoices/${b.invoice.id}/payments`).auth(actors.receptionist.token, { type: 'bearer' }).set('Idempotency-Key', randomUUID()).send({ amount: '1.00', method: 'CASH', ...extra }).expect(400);
    for (const extra of [{ roomAmount: '1.00' }, { totalAmount: '1.00' }, { serviceAmount: '1.00' }, { status: 'PAID' }]) await issue(b.id, 'receptionist', extra).expect(400);
    await bookingAction(b.id, 'check-out', 'receptionist', { status: 'CHECKED_OUT' }).expect(400);
    expect(await context.prisma.client.payment.count({ where: { invoiceId: b.invoice.id } })).toBe(0);
  });
  it('requires a UUID receipt key and rejects changed payload/cross-invoice reuse', async () => {
    const a = await issued(), b = await issued(), key = randomUUID();
    for (const key of [undefined, 'not-a-uuid']) {
      let call = api().post(`/api/invoices/${a.invoice.id}/payments`).auth(actors.receptionist.token, { type: 'bearer' }); if (key) call = call.set('Idempotency-Key', key);
      await call.send({ amount: '1.00', method: 'CASH' }).expect(400);
    }
    const first = await pay(a.invoice.id, '100.25', 'CASH', key).expect(201);
    const retry = await pay(a.invoice.id, '100.25', 'CASH', key.toUpperCase()).expect(201); expect(retry.body.replayed).toBe(true); expect(retry.body.payment).toEqual(first.body.payment);
    await pay(a.invoice.id, '100.26', 'CASH', key).expect(409); await pay(a.invoice.id, '100.25', 'BANK_TRANSFER', key).expect(409); await pay(b.invoice.id, '100.25', 'CASH', key).expect(409);
    expect(await context.prisma.client.payment.count({ where: { id: key } })).toBe(1);
  });
  it('two requests with the same receipt key record one payment, including retry after checkout', async () => {
    const b = await issued(), key = randomUUID(); const responses = await Promise.all([pay(b.invoice.id, b.invoice.totalAmount, 'CASH', key), pay(b.invoice.id, b.invoice.totalAmount, 'CASH', key)]);
    expect(responses.map(r => r.status)).toEqual([201, 201]); expect(responses.map(r => r.body.replayed).sort()).toEqual([false, true]);
    await bookingAction(b.id, 'check-out').expect(200); const retry = await pay(b.invoice.id, b.invoice.totalAmount, 'CASH', key).expect(201); expect(retry.body.replayed).toBe(true);
    expect(await context.prisma.client.payment.count({ where: { invoiceId: b.invoice.id } })).toBe(1);
  });
  it('19 concurrent different receipts cannot overpay and loser rolls back', async () => {
    const b = await issued(); const result = await Promise.all([pay(b.invoice.id, '250000.50'), pay(b.invoice.id, '250000.50')]);
    expect(result.map(r => r.status).sort()).toEqual([201, 409]);
    const view = (await invoice(b.invoice.id).expect(200)).body; expect(view.paidAmount).toBe('250000.50'); expect(view.balance).toBe('50000.25'); expect(view.payments).toHaveLength(1);
  });
  it('two concurrent invoice requests create one immutable invoice', async () => {
    const b = await stay(); const result = await Promise.all([issue(b.id), issue(b.id)]); expect(result.map(r => r.status).sort()).toEqual([201, 409]);
    expect(await context.prisma.client.invoice.count({ where: { bookingId: b.id } })).toBe(1);
  });
  it('service-order/invoice race has one winner and no partially created order', async () => {
    const b = await stay(); const [order, inv] = await Promise.all([createOrder(b.id), issue(b.id)]);
    expect([order.status, inv.status].sort()).toEqual([201, 409]);
    expect(await context.prisma.client.serviceOrder.count({ where: { bookingId: b.id } })).toBe(order.status === 201 ? 1 : 0);
    expect(await context.prisma.client.invoice.count({ where: { bookingId: b.id } })).toBe(inv.status === 201 ? 1 : 0);
    if (order.status === 201) { expect(await context.prisma.client.serviceOrderItem.count({ where: { serviceOrderId: order.body.id } })).toBe(1); await orderAction(order.body.id).expect(200); await issue(b.id).expect(201); }
  });
  it('20/24-27 checkout uses DB effects, preserves history and never duplicates the task', async () => {
    const b = await paid(); const result = await bookingAction(b.id, 'check-out').expect(200);
    expect(result.body.booking.status).toBe('CHECKED_OUT'); expect(result.body.room.housekeepingStatus).toBe('DIRTY'); expect(result.body.housekeepingTask.status).toBe('TODO'); safe(result.body);
    expect(result.body.invoice.booking.status).toBe('CHECKED_OUT');
    expect(await tasks(b.room.id)).toHaveLength(1); await bookingAction(b.id, 'check-out').expect(409); expect(await tasks(b.room.id)).toHaveLength(1);
    expect(await context.prisma.client.booking.count({ where: { id: b.id } })).toBe(1); expect((await invoice(b.invoice.id).expect(200)).body.payments).toHaveLength(1);
    expect((await preview(b.id).expect(200)).body.totalAmount).toBe(b.invoice.totalAmount);
  });
  it('21/22 checkout rejects unchecked-in, missing invoice and partially paid stays without task/room side effects', async () => {
    const pending = await stay('PENDING'), missing = await stay(), partial = await issued(); await pay(partial.invoice.id, '0.01').expect(201);
    for (const b of [pending, missing, partial]) { await bookingAction(b.id, 'check-out').expect(409); expect(await tasks(b.room.id)).toHaveLength(0); expect((await context.prisma.client.room.findUniqueOrThrow({ where: { id: b.room.id } })).housekeepingStatus).toBe('CLEAN'); }
  });
  it('23 simultaneous checkouts have one winner and create exactly one task', async () => {
    const b = await paid(); const result = await Promise.all([bookingAction(b.id, 'check-out'), bookingAction(b.id, 'check-out')]);
    expect(result.map(r => r.status).sort()).toEqual([200, 409]); expect(await tasks(b.room.id)).toHaveLength(1);
  });
  it('payment/check-out race is serializable by parent locks, with safe explicit retry of checkout only', async () => {
    const b = await issued(); const [payment, checkout] = await Promise.all([pay(b.invoice.id, b.invoice.totalAmount), bookingAction(b.id, 'check-out')]);
    expect(payment.status).toBe(201); expect([200, 409]).toContain(checkout.status); if (checkout.status === 409) await bookingAction(b.id, 'check-out').expect(200);
    expect(await context.prisma.client.payment.count({ where: { invoiceId: b.invoice.id } })).toBe(1); expect(await tasks(b.room.id)).toHaveLength(1);
  });
  it('checkout reuses an existing TODO housekeeping task', async () => {
    const b = await paid(); const task = await api().post('/api/housekeeping/tasks').auth(actors.admin.token, { type: 'bearer' }).send({ roomId: b.room.id }).expect(201);
    const result = await bookingAction(b.id, 'check-out', 'admin').expect(200); expect(result.body.housekeepingTask.id).toBe(task.body.id); expect(await tasks(b.room.id)).toHaveLength(1);
  });
  it('29 real trigger conflict during checkout rolls back booking, room and task changes', async () => {
    const b = await paid(); const task = await api().post('/api/housekeeping/tasks').auth(actors.admin.token, { type: 'bearer' }).send({ roomId: b.room.id }).expect(201);
    await api().patch(`/api/housekeeping/tasks/${task.body.id}/assign`).auth(actors.admin.token, { type: 'bearer' }).send({ assignedStaffId: actors.housekeeping.id }).expect(200);
    await api().patch(`/api/housekeeping/tasks/${task.body.id}/start`).auth(actors.housekeeping.token, { type: 'bearer' }).send({}).expect(200);
    const failed = await bookingAction(b.id, 'check-out').expect(409); safe(failed.body);
    expect((await context.prisma.client.booking.findUniqueOrThrow({ where: { id: b.id } })).status).toBe('CHECKED_IN');
    expect((await context.prisma.client.room.findUniqueOrThrow({ where: { id: b.room.id } })).housekeepingStatus).toBe('CLEANING');
    expect((await tasks(b.room.id)).map(t => t.status)).toEqual(['IN_PROGRESS']); expect((await invoice(b.invoice.id).expect(200)).body.status).toBe('PAID');
  });
  it('zero total invoices are already PAID, require no invented payment and can check out', async () => {
    const b = await stay('CHECKED_IN', '0.00'), inv = await issue(b.id).expect(201); expect(inv.body.status).toBe('PAID'); expect(inv.body.balance).toBe('0.00');
    await pay(inv.body.id, '0').expect(400); await bookingAction(b.id, 'check-out').expect(200); expect(await context.prisma.client.payment.count({ where: { invoiceId: inv.body.id } })).toBe(0);
  });
  it('28 guests cannot mutate billing and HOUSEKEEPING cannot access any billing route', async () => {
    const b = await issued();
    for (const who of ['guest', 'other', 'housekeeping'] as const) {
      await issue(b.id, who).expect(403); await pay(b.invoice.id, '1.00', 'CASH', randomUUID(), who).expect(403); await bookingAction(b.id, 'check-out', who).expect(403);
    }
    await preview(b.id, 'housekeeping').expect(403); await invoice(b.invoice.id, 'housekeeping').expect(403);
    await api().get(`/api/bookings/${b.id}/invoice`).auth(actors.housekeeping.token, { type: 'bearer' }).expect(403);
    await api().get(`/api/invoices/${b.invoice.id}`).expect(401); await api().post(`/api/bookings/${b.id}/invoice`).send({}).expect(401);
  });
  it('UUID validation and missing resource errors are safe', async () => {
    await preview('invalid').expect(400); await invoice('invalid').expect(400); await issue('invalid').expect(400); await bookingAction('invalid', 'check-out').expect(400);
    await preview(randomUUID()).expect(404); await invoice(randomUUID()).expect(404); await issue(randomUUID()).expect(404); await pay(randomUUID(), '1.00').expect(404); await bookingAction(randomUUID(), 'check-out').expect(404);
  });
  it('complete real API workflow: register/login -> availability -> book -> service -> invoice/pay -> checkout -> assigned housekeeping -> CLEAN', async () => {
    // Bind an actual loopback TCP listener as well as using real Nest routes/PostgreSQL.
    await context.app.listen(0, '127.0.0.1'); const http = request(await context.app.getUrl());
    const email = `${randomUUID()}@workflow-test.invalid`, password = `A1-${randomUUID()}`;
    await http.post('/api/auth/register').send({ fullName: 'Workflow Guest', email, password }).expect(201);
    const login = await http.post('/api/auth/login').send({ email, password }).expect(200); const token = login.body.accessToken;
    const fixture = await room();
    const available = await http.get('/api/rooms/available').query({ checkIn: today, checkOut: end.toISOString().slice(0, 10), guests: 2, roomTypeId: fixture.type.id }).expect(200); expect(available.body.data.some((r: { id: string }) => r.id === fixture.room.id)).toBe(true);
    const b = await http.post('/api/bookings').auth(token, { type: 'bearer' }).send({ roomId: fixture.room.id, checkIn: today, checkOut: end.toISOString().slice(0, 10), guests: 2 }).expect(201);
    await bookingAction(b.body.id, 'confirm').expect(200); await bookingAction(b.body.id, 'check-in').expect(200);
    const order = await http.post('/api/service-orders').auth(token, { type: 'bearer' }).send({ bookingId: b.body.id, items: [{ serviceId, quantity: 2 }] }).expect(201); await orderAction(order.body.id).expect(200);
    const bill = await http.get(`/api/bookings/${b.body.id}/billing-preview`).auth(token, { type: 'bearer' }).expect(200); expect(bill.body.totalAmount).toBe('390001.25');
    const inv = await issue(b.body.id).expect(201); await pay(inv.body.id, inv.body.totalAmount, 'BANK_TRANSFER').expect(201);
    const checkout = await bookingAction(b.body.id, 'check-out').expect(200); expect(checkout.body.room.housekeepingStatus).toBe('DIRTY'); const taskId = checkout.body.housekeepingTask.id;
    await http.patch(`/api/housekeeping/tasks/${taskId}/assign`).auth(actors.receptionist.token, { type: 'bearer' }).send({ assignedStaffId: actors.housekeeping.id }).expect(200);
    await http.get(`/api/housekeeping/tasks/${taskId}`).auth(actors.housekeeping.token, { type: 'bearer' }).expect(200);
    await http.patch(`/api/housekeeping/tasks/${taskId}/start`).auth(actors.housekeeping.token, { type: 'bearer' }).send({}).expect(200);
    expect((await context.prisma.client.room.findUniqueOrThrow({ where: { id: fixture.room.id } })).housekeepingStatus).toBe('CLEANING');
    await http.patch(`/api/housekeeping/tasks/${taskId}/complete`).auth(actors.housekeeping.token, { type: 'bearer' }).send({}).expect(200);
    const final = await http.get(`/api/rooms/${fixture.room.id}`).expect(200); expect(final.body.housekeepingStatus).toBe('CLEAN');
    expect((await http.get(`/api/invoices/${inv.body.id}`).auth(token, { type: 'bearer' }).expect(200)).body.status).toBe('PAID');
    const docs = await http.get('/api/docs-json').expect(200); expect(docs.body.paths).toHaveProperty('/api/bookings/{id}/billing-preview'); expect(docs.body.paths['/api/invoices/{id}/payments'].post.parameters.some((p: { name: string; required: boolean }) => p.name === 'Idempotency-Key' && p.required)).toBe(true);
    await http.get('/api/docs/').expect(200); await http.get('/api/health').expect(200);
    const cors = await http.options(`/api/invoices/${inv.body.id}/payments`).set('Origin', 'http://localhost:5173').set('Access-Control-Request-Method', 'POST').set('Access-Control-Request-Headers', 'Authorization,Content-Type,Idempotency-Key').expect(204); expect(cors.headers['access-control-allow-headers']).toContain('Idempotency-Key');
  });
  it('final invoice reconciliation and retention in hotel_test', async () => {
    const mismatches = await context.prisma.client.$queryRaw<{ n: bigint }[]>`SELECT count(*) n FROM hotel.invoices i JOIN hotel.bookings b ON b.id=i.booking_id WHERE b.room_id IN (${Prisma.join(roomIds)}) AND (i.room_amount<>b.total_room_amount OR i.service_amount<>(SELECT coalesce(sum(x.subtotal),0) FROM hotel.service_orders o JOIN hotel.service_order_items x ON x.service_order_id=o.id WHERE o.booking_id=b.id AND o.status='COMPLETED') OR i.total_amount<>i.room_amount+i.service_amount OR (i.status='PAID')<>(i.total_amount=(SELECT coalesce(sum(p.amount),0) FROM hotel.payments p WHERE p.invoice_id=i.id AND p.status='COMPLETED')))`;
    expect(Number(mismatches[0].n)).toBe(0);
    // No reset, truncate, trigger disabling or immutable test-history deletion.
  });
});
