import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { Prisma } from '../../generated/prisma/client.js';
import { PasswordService } from '../../src/auth/password.service.js';
import { createAuthTestApp } from './auth-test-app.js';
import { checkoutFixture, settleInvoiceFixture } from './billing-fixtures.js';

describe('Phase 5 Room Service Ordering — writes restricted to hotel_test', () => {
  let context: Awaited<ReturnType<typeof createAuthTestApp>>;
  const actors = {} as Record<'guest' | 'other' | 'receptionist' | 'housekeeping' | 'admin', { id: string; token: string }>;
  const runId = randomUUID();
  const createdBookings: string[] = [];
  let typeId: string, serviceA: string, serviceB: string, inactive: string;
  const api = () => request(context.app.getHttpServer());
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const end = new Date(`${today}T00:00:00Z`); end.setUTCDate(end.getUTCDate() + 3);

  beforeAll(async () => {
    context = await createAuthTestApp();
    const hash = await context.app.get(PasswordService).hash(`A1-${randomUUID()}`);
    for (const [name, role] of [['guest', 'GUEST'], ['other', 'GUEST'], ['receptionist', 'RECEPTIONIST'], ['housekeeping', 'HOUSEKEEPING'], ['admin', 'ADMIN']] as const) {
      const user = await context.prisma.client.user.create({ data: { email: `${name}-${runId}@service-test.invalid`, fullName: `Service Test ${name}`, passwordHash: hash, role } });
      actors[name] = { id: user.id, token: await context.app.get(JwtService).signAsync({ sub: user.id, tokenType: 'access' }) };
    }
    typeId = (await context.prisma.client.roomType.create({ data: { name: `Service Test ${runId}`, nightlyPrice: '700000.25', maxGuests: 2 } })).id;
    serviceA = (await context.prisma.client.service.create({ data: { name: `Service A ${runId}`, currentPrice: '45000.25' } })).id;
    serviceB = (await context.prisma.client.service.create({ data: { name: `Service B ${runId}`, currentPrice: '120000.10' } })).id;
    inactive = (await context.prisma.client.service.create({ data: { name: `Inactive ${runId}`, currentPrice: '50000.00', isActive: false } })).id;
  });
  afterAll(async () => { if (context) await context.app.close(); });

  async function booking(status: 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' = 'CHECKED_IN', who: 'guest' | 'other' = 'guest') {
    const room = await context.prisma.client.room.create({ data: { roomNumber: randomUUID().replaceAll('-', '').slice(0, 12), roomTypeId: typeId, floor: 1 } });
    const b = await context.prisma.client.booking.create({ data: { userId: actors[who].id, roomId: room.id, checkInDate: new Date(`${today}T00:00:00Z`), checkOutDate: end, guestCount: 2 } });
    createdBookings.push(b.id);
    if (status !== 'PENDING') await context.prisma.client.booking.update({ where: { id: b.id }, data: { status: 'CONFIRMED' } });
    if (status === 'CHECKED_IN' || status === 'CHECKED_OUT') await context.prisma.client.booking.update({ where: { id: b.id }, data: { status: 'CHECKED_IN' } });
    if (status === 'CHECKED_OUT') await context.prisma.client.$transaction(async tx => {
      await checkoutFixture(tx, b.id);
    });
    return b.id;
  }
  const post = (bookingId: string, items = [{ serviceId: serviceA, quantity: 2 }], who: keyof typeof actors = 'guest') => api().post('/api/service-orders').auth(actors[who].token, { type: 'bearer' }).send({ bookingId, items });
  async function create(bookingId: string, items = [{ serviceId: serviceA, quantity: 2 }]) { return (await post(bookingId, items).expect(201)).body; }
  const action = (id: string, name: 'complete' | 'cancel', who: keyof typeof actors = 'receptionist') => api().patch(`/api/service-orders/${id}/${name}`).auth(actors[who].token, { type: 'bearer' }).send({});
  const safe = (value: unknown) => expect(JSON.stringify(value)).not.toMatch(/passwordHash|password_hash|email|phone|userId|currentPrice/);

  it('01/03 public catalog paginates active services only', async () => {
    const list = await api().get('/api/services').query({ page: 1, pageSize: 2 }).expect(200);
    expect(list.body.data.length).toBeLessThanOrEqual(2); expect(list.body.meta.pageSize).toBe(2);
    expect(list.body.data.every((s: { isActive: boolean }) => s.isActive)).toBe(true);
    await api().get('/api/services').query({ page: 0 }).expect(400);
    await api().get('/api/services').query({ pageSize: 101 }).expect(400);
    await api().get('/api/services').query({ isActive: false }).expect(400);
  });
  it('02/03 service detail returns price strings; inactive and missing IDs return 404', async () => {
    const detail = await api().get(`/api/services/${serviceA}`).expect(200); expect(detail.body.currentPrice).toBe('45000.25');
    await api().get(`/api/services/${inactive}`).expect(404); await api().get(`/api/services/${randomUUID()}`).expect(404); await api().get('/api/services/not-a-uuid').expect(400);
  });
  it('04/16/17 creates one service with snapshot subtotal and DB-maintained total', async () => {
    const bid = await booking(), result = await create(bid);
    expect(result.bookingId).toBe(bid); expect(result.status).toBe('PENDING'); expect(result.totalAmount).toBe('90000.50');
    expect(result.items).toHaveLength(1); expect(result.items[0].unitPrice).toBe('45000.25'); expect(result.items[0].subtotal).toBe('90000.50'); safe(result);
    const stored = await context.prisma.client.serviceOrder.findUniqueOrThrow({ where: { id: result.id } }); expect(stored.totalAmount.toFixed(2)).toBe(result.totalAmount);
  });
  it('05/16/17 creates multiple services in one order and calculates exact decimal totals', async () => {
    const result = await create(await booking(), [{ serviceId: serviceA, quantity: 2 }, { serviceId: serviceB, quantity: 3 }]);
    expect(result.items).toHaveLength(2); expect(result.totalAmount).toBe('450000.80');
    expect(result.items.find((i: { serviceId: string }) => i.serviceId === serviceB).subtotal).toBe('360000.30');
  });
  it.each([0, -1, 1.5, '2', 2147483648])('06 rejects invalid quantity %s without storing an order', async quantity => {
    const bid = await booking();
    await api().post('/api/service-orders').auth(actors.guest.token, { type: 'bearer' }).send({ bookingId: bid, items: [{ serviceId: serviceA, quantity }] }).expect(400);
    expect(await context.prisma.client.serviceOrder.count({ where: { bookingId: bid } })).toBe(0);
  });
  it('rejects empty/duplicate/null/oversized items and nested/top-level mass assignment', async () => {
    const bid = await booking();
    for (const items of [[], [null], [{ serviceId: serviceA, quantity: 1 }, { serviceId: serviceA.toUpperCase(), quantity: 2 }], Array.from({ length: 51 }, () => ({ serviceId: serviceA, quantity: 1 })), [{ serviceId: 'invalid', quantity: 1 }], [{ serviceId: serviceA, quantity: 1, unitPrice: 1 }], [{ serviceId: serviceA, quantity: 1, subtotal: 1 }]]) {
      await api().post('/api/service-orders').auth(actors.guest.token, { type: 'bearer' }).send({ bookingId: bid, items }).expect(400);
    }
    for (const extra of [{ userId: actors.other.id }, { totalAmount: 1 }, { total_amount: 1 }, { status: 'COMPLETED' }]) await api().post('/api/service-orders').auth(actors.guest.token, { type: 'bearer' }).send({ bookingId: bid, items: [{ serviceId: serviceA, quantity: 1 }], ...extra }).expect(400);
    expect(await context.prisma.client.serviceOrder.count({ where: { bookingId: bid } })).toBe(0);
  });
  it('07 missing service returns 404 and the transaction leaves no order', async () => {
    const bid = await booking(); await post(bid, [{ serviceId: randomUUID(), quantity: 1 }]).expect(404);
    expect(await context.prisma.client.serviceOrder.count({ where: { bookingId: bid } })).toBe(0);
  });
  it('08 inactive service cannot be ordered', async () => {
    const bid = await booking(); await post(bid, [{ serviceId: inactive, quantity: 1 }]).expect(409);
    expect(await context.prisma.client.serviceOrder.count({ where: { bookingId: bid } })).toBe(0);
  });
  it.each(['PENDING', 'CONFIRMED'] as const)('09 %s booking cannot order services', async status => {
    await post(await booking(status)).expect(409);
  });
  it('10 CHECKED_OUT booking cannot order services', async () => { await post(await booking('CHECKED_OUT')).expect(409); });
  it('11 booking must exist and belong to the authenticated GUEST', async () => {
    const bid = await booking('CHECKED_IN', 'other'); await post(bid).expect(404); await post(randomUUID()).expect(404);
    await api().post('/api/service-orders').send({ bookingId: bid, items: [{ serviceId: serviceA, quantity: 1 }] }).expect(401);
    for (const who of ['receptionist', 'admin', 'housekeeping'] as const) await post(bid, [{ serviceId: serviceA, quantity: 1 }], who).expect(403);
  });
  it('12 owner can read their order and paginated filtered my-list', async () => {
    const result = await create(await booking());
    const detail = await api().get(`/api/service-orders/${result.id}`).auth(actors.guest.token, { type: 'bearer' }).expect(200); safe(detail.body);
    const mine = await api().get('/api/service-orders/my').auth(actors.guest.token, { type: 'bearer' }).query({ pageSize: 100, status: 'PENDING' }).expect(200);
    expect(mine.body.data.some((o: { id: string }) => o.id === result.id)).toBe(true);
    const owned = await context.prisma.client.booking.findMany({ where: { userId: actors.guest.id }, select: { id: true } }); const ids = new Set(owned.map(b => b.id));
    expect(mine.body.data.every((o: { bookingId: string; status: string }) => ids.has(o.bookingId) && o.status === 'PENDING')).toBe(true); safe(mine.body);
    await api().get('/api/service-orders/my').auth(actors.guest.token, { type: 'bearer' }).query({ userId: actors.other.id }).expect(400);
  });
  it('13 another guest gets 404 for GET/cancel without learning ownership', async () => {
    const result = await create(await booking());
    await api().get(`/api/service-orders/${result.id}`).auth(actors.other.token, { type: 'bearer' }).expect(404);
    await action(result.id, 'cancel', 'other').expect(404);
    await api().get(`/api/service-orders/${randomUUID()}`).auth(actors.guest.token, { type: 'bearer' }).expect(404);
    await api().get('/api/service-orders/invalid').auth(actors.guest.token, { type: 'bearer' }).expect(400);
  });
  it('14 receptionist/admin view orders; guest cannot use the staff list', async () => {
    const result = await create(await booking());
    for (const who of ['receptionist', 'admin'] as const) {
      const list = await api().get('/api/service-orders').auth(actors[who].token, { type: 'bearer' }).query({ pageSize: 1, status: 'PENDING' }).expect(200);
      expect(list.body.data).toHaveLength(1); expect(list.body.data[0].status).toBe('PENDING'); safe(list.body);
      await api().get(`/api/service-orders/${result.id}`).auth(actors[who].token, { type: 'bearer' }).expect(200);
    }
    await api().get('/api/service-orders').auth(actors.guest.token, { type: 'bearer' }).expect(403);
    await api().get('/api/service-orders').auth(actors.admin.token, { type: 'bearer' }).query({ status: 'CHECKED_IN' }).expect(400);
    await api().get('/api/service-orders').expect(401);
  });
  it('15 housekeeping has no order access or mutation privileges', async () => {
    const result = await create(await booking());
    for (const path of ['/api/service-orders', '/api/service-orders/my', `/api/service-orders/${result.id}`]) await api().get(path).auth(actors.housekeeping.token, { type: 'bearer' }).expect(403);
    await action(result.id, 'complete', 'housekeeping').expect(403); await action(result.id, 'cancel', 'housekeeping').expect(403);
  });
  it('18 catalog price change/deactivation preserves prior snapshots and historical visibility', async () => {
    const bid = await booking(), old = await create(bid);
    await context.prisma.client.service.update({ where: { id: serviceA }, data: { currentPrice: '80000.50' } });
    try {
      const current = await api().get(`/api/service-orders/${old.id}`).auth(actors.guest.token, { type: 'bearer' }).expect(200);
      expect(current.body.items[0].unitPrice).toBe('45000.25'); expect(current.body.totalAmount).toBe('90000.50');
      const fresh = await create(bid); expect(fresh.items[0].unitPrice).toBe('80000.50'); expect(fresh.totalAmount).toBe('160001.00');
      await context.prisma.client.service.update({ where: { id: serviceA }, data: { isActive: false } });
      await api().get(`/api/service-orders/${old.id}`).auth(actors.guest.token, { type: 'bearer' }).expect(200);
      await post(bid).expect(409);
    } finally { await context.prisma.client.service.update({ where: { id: serviceA }, data: { currentPrice: '45000.25', isActive: true } }); }
  });
  it('19/20 completion is staff-only and can occur once', async () => {
    const result = await create(await booking());
    await action(result.id, 'complete', 'guest').expect(403);
    const completed = await action(result.id, 'complete').expect(200); expect(completed.body.status).toBe('COMPLETED'); expect(completed.body.totalAmount).toBe('90000.50');
    await action(result.id, 'complete', 'admin').expect(409);
    const adminOrder = await create(await booking()); expect((await action(adminOrder.id, 'complete', 'admin').expect(200)).body.status).toBe('COMPLETED');
  });
  it('21 pending orders may be cancelled by owner or staff; history and totals are retained', async () => {
    for (const who of ['guest', 'receptionist', 'admin'] as const) {
      const result = await create(await booking()); const cancelled = await action(result.id, 'cancel', who).expect(200);
      expect(cancelled.body.status).toBe('CANCELLED'); expect(cancelled.body.totalAmount).toBe('90000.50'); expect(cancelled.body.items).toHaveLength(1);
      await action(result.id, 'cancel', who).expect(409);
    }
  });
  it('22 a completed order cannot be cancelled or edited through any generic endpoint', async () => {
    const result = await create(await booking()); await action(result.id, 'complete').expect(200);
    for (const who of ['guest', 'admin'] as const) await action(result.id, 'cancel', who).expect(409);
    await api().patch(`/api/service-orders/${result.id}`).auth(actors.admin.token, { type: 'bearer' }).send({ totalAmount: 0 }).expect(404);
    await api().delete(`/api/service-orders/${result.id}`).auth(actors.admin.token, { type: 'bearer' }).expect(404);
    const pending = await create(await booking()); await api().patch(`/api/service-orders/${pending.id}/complete`).auth(actors.admin.token, { type: 'bearer' }).send({ status: 'COMPLETED', totalAmount: 1 }).expect(400);
  });
  it('23 competing complete/cancel HTTP requests commit exactly one terminal transition', async () => {
    const result = await create(await booking());
    const results = await Promise.all([action(result.id, 'complete', 'receptionist'), action(result.id, 'cancel', 'guest')]);
    expect(results.map(r => r.status).sort()).toEqual([200, 409]);
    const stored = await context.prisma.client.serviceOrder.findUniqueOrThrow({ where: { id: result.id } });
    expect(stored.status).toBe(results.find(r => r.status === 200)?.body.status); expect(stored.totalAmount.toFixed(2)).toBe('90000.50');
  });
  it('24 invoice/checkout transaction locks out a racing service order', async () => {
    const bid = await booking(); let ready!: () => void, release!: () => void;
    const locked = new Promise<void>(resolve => { ready = resolve; }); const finish = new Promise<void>(resolve => { release = resolve; });
    const billingFixture = context.prisma.client.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM hotel.bookings WHERE id=${bid}::uuid FOR UPDATE`;
      const invoice = await tx.invoice.create({ data: { bookingId: bid } }); await settleInvoiceFixture(tx, invoice); ready(); await finish;
      await tx.booking.update({ where: { id: bid }, data: { status: 'CHECKED_OUT' } });
    }, { timeout: 10000 });
    let pending: Promise<request.Response> | undefined;
    try {
      await locked; pending = post(bid).then(response => response);
      let observed = false;
      for (let attempt = 0; attempt < 50; attempt++) {
        const waits = await context.prisma.client.$queryRaw<{ count: bigint }[]>`SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%FROM hotel.bookings%FOR UPDATE%'`;
        if (Number(waits[0].count) > 0) { observed = true; break; }
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      expect(observed).toBe(true);
    } finally { release(); await billingFixture; }
    expect((await pending)?.status).toBe(409); expect(await context.prisma.client.serviceOrder.count({ where: { bookingId: bid } })).toBe(0);
  });
  it('25 invalid second item rolls back both the new order and its first valid item', async () => {
    for (const badId of [randomUUID(), inactive]) {
      const bid = await booking(); await post(bid, [{ serviceId: serviceA, quantity: 1 }, { serviceId: badId, quantity: 1 }]).expect(badId === inactive ? 409 : 404);
      expect(await context.prisma.client.serviceOrder.count({ where: { bookingId: bid } })).toBe(0);
      expect(await context.prisma.client.serviceOrderItem.count({ where: { serviceOrder: { bookingId: bid } } })).toBe(0);
    }
  });
  it('cancelled orders are excluded by the existing invoice trigger, with no billing API added', async () => {
    const bid = await booking(), completed = await create(bid), cancelled = await create(bid, [{ serviceId: serviceB, quantity: 3 }]);
    await action(completed.id, 'complete').expect(200); await action(cancelled.id, 'cancel', 'guest').expect(200);
    const invoice = await context.prisma.client.$transaction(async tx => {
      return checkoutFixture(tx, bid);
    });
    expect(invoice.serviceAmount.toFixed(2)).toBe('90000.50');
    await api().get('/api/invoices').auth(actors.admin.token, { type: 'bearer' }).expect(404);
  });
  it('actual guard_order rejects completing an empty legacy order through structured SQLSTATE 23514', async () => {
    const bid = await booking(); const order = await context.prisma.client.serviceOrder.create({ data: { bookingId: bid } });
    const response = await action(order.id, 'complete').expect(409);
    expect(response.body.message).toBe('Order state, service availability or stay conditions do not allow this action');
    expect(response.text).not.toMatch(/23514|P2039|trigger|postgres/);
    expect((await context.prisma.client.serviceOrder.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('PENDING');
    await action(order.id, 'cancel').expect(200);
  });
  it('actual numeric overflow rolls back and returns controlled 400', async () => {
    const expensive = await context.prisma.client.service.create({ data: { name: `Overflow ${runId}`, currentPrice: '999999999999.99' } });
    const bid = await booking(); await post(bid, [{ serviceId: expensive.id, quantity: 2 }]).expect(400);
    expect(await context.prisma.client.serviceOrder.count({ where: { bookingId: bid } })).toBe(0);
  });
  it('create/complete service operations do not update booking/invoice/payment data', async () => {
    const bid = await booking(); const before = await context.prisma.client.booking.findUniqueOrThrow({ where: { id: bid } });
    const result = await create(bid); await action(result.id, 'complete').expect(200);
    expect(await context.prisma.client.booking.findUniqueOrThrow({ where: { id: bid } })).toEqual(before);
    expect(await context.prisma.client.invoice.count({ where: { bookingId: bid } })).toBe(0);
    expect(await context.prisma.client.payment.count({ where: { invoice: { bookingId: bid } } })).toBe(0);
  });
  it('final DB reconciliation matches every new order total to stored item subtotals', async () => {
    const orders = await context.prisma.client.serviceOrder.findMany({ where: { bookingId: { in: createdBookings } }, include: { items: true } });
    for (const order of orders) {
      expect(order.totalAmount.equals(order.items.reduce((sum, item) => sum.add(item.subtotal), new Prisma.Decimal(0)))).toBe(true);
      for (const item of order.items) expect(item.subtotal.equals(item.unitPrice.mul(item.quantity))).toBe(true);
    }
    // Keep immutable test history in hotel_test. Never DELETE/TRUNCATE/disable triggers.
  });
});
