import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { PasswordService } from '../../src/auth/password.service.js';
import { createAuthTestApp } from './auth-test-app.js';
import { createPrismaClient } from '../../src/database/client.js';

describe('Phase 9 timestamp, security and transition regressions — local hotel_test', () => {
  let context: Awaited<ReturnType<typeof createAuthTestApp>>;
  beforeAll(async () => { context = await createAuthTestApp(100); });
  afterAll(async () => { await context?.app.close(); });
  it('Prisma preserves timestamp instants for positive/negative offsets and date-only values', async () => {
    const url = new URL(process.env.TEST_DATABASE_URL!);
    url.searchParams.set('options', '-c timezone=Asia/Bangkok -c statement_timeout=10000');
    const db = createPrismaClient(url.toString()), direct = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
    await direct.connect();
    try {
      const result = await db.$queryRaw<{ instant: Date; date_only: Date; zone: string }[]>`SELECT TIMESTAMPTZ '2026-10-28 09:12:13.123+07' instant, DATE '2026-10-28' date_only, current_setting('TimeZone') zone`;
      expect(result[0].zone).toBe('UTC'); expect(result[0].instant.toISOString()).toBe('2026-10-28T02:12:13.123Z'); expect(result[0].date_only.toISOString().slice(0, 10)).toBe('2026-10-28');
      const rows = await direct.query("SELECT TIMESTAMPTZ '2026-10-28 09:12:13.123-05' instant");
      const viaPrisma = await db.$queryRaw<{ instant: Date }[]>`SELECT TIMESTAMPTZ '2026-10-28 09:12:13.123-05' instant`;
      expect(viaPrisma[0].instant.toISOString()).toBe(rows.rows[0].instant.toISOString());
    } finally { await db.$disconnect(); await direct.end(); }
  });
  it('DB-trigger timestamps match stored instants after insert/update', async () => {
    const user = await context.prisma.client.user.create({ data: { fullName: 'Timestamp regression', email: `${randomUUID()}@release-test.invalid`, passwordHash: `scrypt$${'a'.repeat(32)}$${'b'.repeat(128)}` } });
    await context.prisma.client.user.update({ where: { id: user.id }, data: { fullName: 'Timestamp regression updated' } });
    const stored = await context.prisma.client.user.findUniqueOrThrow({ where: { id: user.id } });
    const c = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL }); await c.connect();
    try { const { rows } = await c.query('SELECT created_at,updated_at FROM hotel.users WHERE id=$1', [user.id]); expect(stored.createdAt.toISOString()).toBe(rows[0].created_at.toISOString()); expect(stored.updatedAt.toISOString()).toBe(rows[0].updated_at.toISOString()); } finally { await c.end(); }
  });
  it('SQL injection strings and role/status mass assignment are rejected without disclosure', async () => {
    const http = request(context.app.getHttpServer());
    const bad = await http.get('/api/rooms/available').query({ checkIn: '2026-10-28', checkOut: '2026-10-30', guests: 1, roomTypeId: "' OR 1=1 --" }).expect(400);
    expect(bad.text).not.toMatch(/SELECT|passwordHash|postgresql:\/\//);
    await http.post('/api/auth/register').send({ email: `${randomUUID()}@release-test.invalid`, password: 'Release-validation-A123', fullName: 'Guest', role: 'ADMIN', status: 'ACTIVE' }).expect(400);
  });
  it('confirm/check-in and duplicate check-in races preserve a valid booking state', async () => {
    const db = context.prisma.client, tag = randomUUID().slice(0, 8), password = 'Release-validation-A123';
    const http = request(context.app.getHttpServer());
    const email = `${randomUUID()}@release-test.invalid`;
    const guest = await http.post('/api/auth/register').send({ fullName: 'Race guest', email, password }).expect(201);
    const login = await http.post('/api/auth/login').send({ email, password }).expect(200);
    const type = await db.roomType.create({ data: { name: `Release ${tag}`, nightlyPrice: '100.25', maxGuests: 2 } });
    const room = await db.room.create({ data: { roomNumber: `R9${tag}`, floor: 1, roomTypeId: type.id } });
    const staff = await db.user.create({ data: { email: `${randomUUID()}@release-test.invalid`, fullName: 'Race staff', role: 'RECEPTIONIST', passwordHash: (await db.user.findUniqueOrThrow({ where: { id: guest.body.id } })).passwordHash } });
    const staffLogin = await http.post('/api/auth/login').send({ email: staff.email, password }).expect(200);
    const checkIn = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()), checkOut = new Date(Date.parse(checkIn + 'T00:00:00Z') + 2 * 86400000).toISOString().slice(0, 10);
    const b = await http.post('/api/bookings').auth(login.body.accessToken, { type: 'bearer' }).send({ roomId: room.id, checkIn, checkOut, guests: 1 }).expect(201);
    const action = (name: string) => http.patch(`/api/bookings/${b.body.id}/${name}`).auth(staffLogin.body.accessToken, { type: 'bearer' }).send({});
    const results = await Promise.all([action('confirm'), action('check-in')]);
    expect(results[0].status).toBe(200); expect([200, 409]).toContain(results[1].status);
    const current = await db.booking.findUniqueOrThrow({ where: { id: b.body.id } });
    if (current.status === 'CONFIRMED') { const concurrent = await Promise.all([action('check-in'), action('check-in')]); expect(concurrent.map(r => r.status).sort()).toEqual([200, 409]); }
    else { expect(current.status).toBe('CHECKED_IN'); expect((await action('check-in')).status).toBe(409); }
    expect((await db.booking.findUniqueOrThrow({ where: { id: b.body.id } })).status).toBe('CHECKED_IN');
  });
  it('checkout racing with assigned housekeeping start preserves task/room state and rolls back conflicts', async () => {
    const db = context.prisma.client, http = request(context.app.getHttpServer()), suffix = randomUUID().slice(0, 8);
    const passwordHash = await context.app.get(PasswordService).hash(randomUUID());
    const guest = await db.user.create({ data: { fullName: 'Race guest', email: `${randomUUID()}@release-test.invalid`, passwordHash } });
    const staff = await db.user.create({ data: { fullName: 'Race staff', email: `${randomUUID()}@release-test.invalid`, role: 'RECEPTIONIST', passwordHash } });
    const worker = await db.user.create({ data: { fullName: 'Race worker', email: `${randomUUID()}@release-test.invalid`, role: 'HOUSEKEEPING', passwordHash } });
    const token = async (id: string) => context.app.get(JwtService).signAsync({ sub: id, tokenType: 'access' });
    const staffToken = await token(staff.id), workerToken = await token(worker.id);
    const type = await db.roomType.create({ data: { name: `Checkout race ${suffix}`, nightlyPrice: '10.25', maxGuests: 2 } });
    const room = await db.room.create({ data: { roomNumber: `RC${suffix}`, floor: 1, roomTypeId: type.id } });
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const b = await db.booking.create({ data: { userId: guest.id, roomId: room.id, checkInDate: new Date(today), checkOutDate: new Date(Date.parse(today) + 2 * 86400000), guestCount: 1 } });
    const checkout = () => http.patch(`/api/bookings/${b.id}/check-out`).auth(staffToken, { type: 'bearer' }).send({});
    for (const status of ['CONFIRMED', 'CHECKED_IN'] as const) await db.booking.update({ where: { id: b.id }, data: { status } });
    const invoice = await http.post(`/api/bookings/${b.id}/invoice`).auth(staffToken, { type: 'bearer' }).expect(201);
    await http.post(`/api/invoices/${invoice.body.id}/payments`).auth(staffToken, { type: 'bearer' }).set('Idempotency-Key', randomUUID()).send({ amount: invoice.body.totalAmount, method: 'CASH' }).expect(201);
    const task = await db.housekeepingTask.create({ data: { roomId: room.id, assignedStaffId: worker.id } });
    const [out, started] = await Promise.all([checkout(), http.patch(`/api/housekeeping/tasks/${task.id}/start`).auth(workerToken, { type: 'bearer' }).send({})]);
    expect(started.status).toBe(200); expect([200, 409]).toContain(out.status);
    expect((await db.booking.findUniqueOrThrow({ where: { id: b.id } })).status).toBe(out.status === 200 ? 'CHECKED_OUT' : 'CHECKED_IN');
    expect((await db.room.findUniqueOrThrow({ where: { id: room.id } })).housekeepingStatus).toBe('CLEANING');
    expect(await db.housekeepingTask.count({ where: { roomId: room.id, status: { not: 'DONE' } } })).toBe(1);
    await http.patch(`/api/housekeeping/tasks/${task.id}/complete`).auth(workerToken, { type: 'bearer' }).send({}).expect(200);
    if (out.status === 409) {
      await checkout().expect(200);
      expect(await db.housekeepingTask.count({ where: { roomId: room.id, status: 'TODO' } })).toBe(1);
      expect((await db.room.findUniqueOrThrow({ where: { id: room.id } })).housekeepingStatus).toBe('DIRTY');
    } else expect((await db.room.findUniqueOrThrow({ where: { id: room.id } })).housekeepingStatus).toBe('CLEAN');
    expect((await db.housekeepingTask.findUniqueOrThrow({ where: { id: task.id } })).status).toBe('DONE');
    expect((await db.invoice.findUniqueOrThrow({ where: { id: invoice.body.id } })).status).toBe('PAID');
  });
  it('serves real health over a wildcard listener locally for the Render binding contract', async () => {
    await context.app.listen(0, '0.0.0.0');
    const address = context.app.getHttpServer().address() as { address: string; port: number };
    expect(address.address).toBe('0.0.0.0');
    await request(`http://127.0.0.1:${address.port}`).get('/api/health').expect(200);
  });
});
