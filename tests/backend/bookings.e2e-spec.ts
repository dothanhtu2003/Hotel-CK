import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { Prisma } from '../../generated/prisma/client.js';
import type { Role } from '../../generated/prisma/enums.js';
import { PasswordService } from '../../src/auth/password.service.js';
import { checkoutFixture } from './billing-fixtures.js';
import { createAuthTestApp } from './auth-test-app.js';

describe('Phase 4 rooms and multi-night booking engine — hotel_test only', () => {
  let context: Awaited<ReturnType<typeof createAuthTestApp>>;
  const actors = {} as Record<'guest' | 'other' | 'receptionist' | 'housekeeping' | 'admin', { id: string; token: string }>;
  let typeId: string;
  const roomIds: string[] = [];
  const runId = randomUUID();
  const api = () => request(context.app.getHttpServer());
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  function day(offset: number) { const date = new Date(`${today}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + offset); return date.toISOString().slice(0, 10); }

  beforeAll(async () => {
    context = await createAuthTestApp();
    const hash = await context.app.get(PasswordService).hash(`A1-${randomUUID()}`);
    for (const [key, role] of [['guest', 'GUEST'], ['other', 'GUEST'], ['receptionist', 'RECEPTIONIST'], ['housekeeping', 'HOUSEKEEPING'], ['admin', 'ADMIN']] as const) {
      const user = await context.prisma.client.user.create({ data: { email: `${key}-${runId}@booking-test.invalid`, fullName: `Booking Test ${key}`, passwordHash: hash, role: role as Role } });
      actors[key] = { id: user.id, token: await context.app.get(JwtService).signAsync({ sub: user.id, tokenType: 'access' }) };
    }
    typeId = (await context.prisma.client.roomType.create({ data: { name: `Booking test ${runId}`, nightlyPrice: '650000.25', maxGuests: 2 } })).id;
  });
  afterAll(async () => { if (context) await context.app.close(); });

  async function room(options: { dirty?: boolean; inactive?: boolean } = {}) {
    const created = await context.prisma.client.room.create({ data: { roomNumber: randomUUID().replaceAll('-', '').slice(0, 12), floor: 1, roomTypeId: typeId,
      housekeepingStatus: options.dirty ? 'DIRTY' : 'CLEAN', operationalStatus: options.inactive ? 'OUT_OF_SERVICE' : 'ACTIVE' } });
    roomIds.push(created.id); return created.id;
  }
  const payload = (roomId: string, start = 10, end = 13) => ({ roomId, checkIn: day(start), checkOut: day(end), guests: 2 });
  async function create(roomId: string, start = 10, end = 13, who: keyof typeof actors = 'guest') {
    return (await api().post('/api/bookings').auth(actors[who].token, { type: 'bearer' }).send(payload(roomId, start, end)).expect(201)).body;
  }
  async function action(id: string, name: string, who: keyof typeof actors = 'receptionist', expected = 200) {
    return api().patch(`/api/bookings/${id}/${name}`).auth(actors[who].token, { type: 'bearer' }).send({}).expect(expected);
  }
  async function available(start: number, end: number, guests = 2) {
    return (await api().get('/api/rooms/available').query({ checkIn: day(start), checkOut: day(end), guests, roomTypeId: typeId }).expect(200)).body;
  }

  it('allocates distinct daily sequential references for simultaneous bookings', async () => {
    const ids = await Promise.all([room(), room(), room()]);
    const bookings = await Promise.all(ids.map(async (id, index) => index === 0
      ? (await api().post('/api/front-desk/walk-in').auth(actors.receptionist.token, { type: 'bearer' })
        .send({ ...payload(id, 40, 41), customerId: actors.guest.id, receiveNow: false }).expect(201)).body
      : create(id, 40, 41)));
    const prefix = `CK-${today.slice(2).replaceAll('-', '')}-`;
    for (const booking of bookings) expect(booking.reference).toMatch(new RegExp(`^${prefix}\\d{4,}$`));
    const numbers = bookings.map(b => Number(b.reference.slice(prefix.length))).sort((a, b) => a - b);
    expect(new Set(numbers).size).toBe(3);
    expect(numbers[2] - numbers[0]).toBe(2);
  });

  it('01 public room list/detail include type and separate housekeeping/operational state, no guest data', async () => {
    const id = await room({ dirty: true });
    const list = await api().get('/api/rooms').query({ pageSize: 100 }).expect(200);
    expect(list.body.meta.pageSize).toBe(100); expect(Array.isArray(list.body.data)).toBe(true);
    const detail = await api().get(`/api/rooms/${id}`).expect(200);
    expect(detail.body.roomType.id).toBe(typeId); expect(detail.body.roomType.nightlyPrice).toBe('650000.25');
    expect(detail.body.housekeepingStatus).toBe('DIRTY'); expect(detail.body.operationalStatus).toBe('ACTIVE');
    expect(detail.body).not.toHaveProperty('bookings'); expect(detail.text).not.toMatch(/password|email|phone|userId/);
    await api().get(`/api/rooms/${randomUUID()}`).expect(404);
    await api().get('/api/rooms/not-a-uuid').expect(400);
  });

  it('02 available route precedes :id, includes dirty future rooms and calculates decimal estimates', async () => {
    const id = await room({ dirty: true }); const result = await available(20, 23);
    expect(result.nights).toBe(3);
    expect(result.data.find((value: { id: string }) => value.id === id).estimatedTotalAmount).toBe('1950000.75');
    expect(result.data.every((value: { roomType: { id: string } }) => value.roomType.id === typeId)).toBe(true);
    const noFilter = await api().get('/api/rooms/available').query({ checkIn: day(20), checkOut: day(23), guests: 2 }).expect(200);
    expect(noFilter.body.data.some((value: { id: string }) => value.id === id)).toBe(true);
  });

  it('03 rejects invalid/ambiguous dates, nonpositive guests, unknown filters and invalid UUIDs', async () => {
    for (const changes of [{ checkOut: day(10) }, { checkOut: day(9) }, { checkIn: '2026-02-30' }, { checkIn: `${day(10)}T00:00:00Z` }, { guests: 0 }, { guests: -1 }, { guests: 1.5 }, { roomTypeId: 'invalid' }, { userId: randomUUID() }]) {
      await api().get('/api/rooms/available').query({ checkIn: day(10), checkOut: day(13), guests: 2, ...changes }).expect(400);
    }
    await api().get('/api/rooms/available').expect(400);
    await api().get('/api/rooms').query({ page: 0 }).expect(400);
  });

  it('04 capacity filter removes rooms; booking above capacity is rejected', async () => {
    const id = await room(); expect((await available(10, 13, 3)).data).toEqual([]);
    await api().post('/api/bookings').auth(actors.guest.token, { type: 'bearer' }).send({ ...payload(id), guests: 3 }).expect(400);
  });

  it('05 OUT_OF_SERVICE rooms are excluded and cannot be booked', async () => {
    const id = await room({ inactive: true });
    expect((await available(10, 13)).data.some((r: { id: string }) => r.id === id)).toBe(false);
    await api().post('/api/bookings').auth(actors.guest.token, { type: 'bearer' }).send(payload(id)).expect(409);
  });

  it('06/07 creates a multi-night booking using authenticated user and DB snapshots', async () => {
    const id = await room(), booking = await create(id);
    expect(booking.userId).toBe(actors.guest.id); expect(booking.status).toBe('PENDING'); expect(booking.nights).toBe(3);
    expect(booking.checkIn).toBe(day(10)); expect(booking.checkOut).toBe(day(13));
    expect(booking.nightlyPrice).toBe('650000.25'); expect(booking.totalRoomAmount).toBe('1950000.75'); expect(booking.reference).toBeTruthy();
    const stored = await context.prisma.client.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(stored.totalRoomAmount.toFixed(2)).toBe(booking.totalRoomAmount);
    expect(JSON.stringify(booking)).not.toMatch(/passwordHash|password_hash|email|phone/);
  });

  it('rejects anonymous/staff booking creation, forged owner/prices/status and invalid creation input', async () => {
    const id = await room();
    await api().post('/api/bookings').send(payload(id)).expect(401);
    for (const who of ['receptionist', 'housekeeping', 'admin'] as const) await api().post('/api/bookings').auth(actors[who].token, { type: 'bearer' }).send(payload(id)).expect(403);
    for (const extra of [{ userId: actors.other.id }, { nightlyPrice: 1 }, { nightly_price: 1 }, { totalRoomAmount: 1 }, { reference: 'ATTACK' }, { status: 'CONFIRMED' }]) await api().post('/api/bookings').auth(actors.guest.token, { type: 'bearer' }).send({ ...payload(id), ...extra }).expect(400);
    for (const change of [{ guests: 0 }, { guests: '2' }, { roomId: 'invalid' }, { checkOut: day(10) }, { checkIn: '2099-02-30' }]) await api().post('/api/bookings').auth(actors.guest.token, { type: 'bearer' }).send({ ...payload(id), ...change }).expect(400);
    await api().post('/api/bookings').auth(actors.guest.token, { type: 'bearer' }).send(payload(randomUUID())).expect(404);
  });

  it('08 catalog changes do not change an existing booking price snapshot', async () => {
    const id = await room(), booking = await create(id);
    await context.prisma.client.roomType.update({ where: { id: typeId }, data: { nightlyPrice: '800000.50' } });
    try {
      const detail = await api().get(`/api/bookings/${booking.id}`).auth(actors.guest.token, { type: 'bearer' }).expect(200);
      expect(detail.body.nightlyPrice).toBe('650000.25'); expect(detail.body.totalRoomAmount).toBe('1950000.75');
      const fresh = await create(await room()); expect(fresh.nightlyPrice).toBe('800000.50');
    } finally { await context.prisma.client.roomType.update({ where: { id: typeId }, data: { nightlyPrice: '650000.25' } }); }
  });

  it('09 rejects all overlap shapes via 409, excludes them in search, permits adjacent stays', async () => {
    const id = await room(); await create(id, 10, 13);
    for (const [start, end] of [[10, 13], [9, 11], [12, 15], [11, 12], [9, 14]]) {
      expect((await available(start, end)).data.some((r: { id: string }) => r.id === id)).toBe(false);
      const conflict = await api().post('/api/bookings').auth(actors.other.token, { type: 'bearer' }).send(payload(id, start, end)).expect(409);
      expect(conflict.body.message).toBe('Room is not available for the requested dates');
      expect(conflict.text).not.toMatch(/23P01|P2039|postgres|constraint|SQL/);
    }
    expect((await available(13, 15)).data.some((r: { id: string }) => r.id === id)).toBe(true);
    await create(id, 13, 15, 'other');
  });

  it('10 simultaneous HTTP requests produce exactly one 201 and one 409', async () => {
    const id = await room();
    const results = await Promise.all(['guest', 'other'].map(who => api().post('/api/bookings').auth(actors[who as 'guest' | 'other'].token, { type: 'bearer' }).send(payload(id, 30, 34))));
    expect(results.map(result => result.status).sort()).toEqual([201, 409]);
    expect(await context.prisma.client.booking.count({ where: { roomId: id, status: { not: 'CANCELLED' } } })).toBe(1);
  });

  it('11 my list is owner-scoped with pagination/status; staff list requires appropriate role', async () => {
    const mine = await api().get('/api/bookings/my').auth(actors.guest.token, { type: 'bearer' }).query({ page: 1, pageSize: 2, status: 'PENDING' }).expect(200);
    expect(mine.body.data.length).toBeLessThanOrEqual(2); expect(mine.body.meta.total).toBeGreaterThan(0);
    expect(mine.body.data.every((b: { userId: string; status: string }) => b.userId === actors.guest.id && b.status === 'PENDING')).toBe(true);
    await api().get('/api/bookings').auth(actors.guest.token, { type: 'bearer' }).expect(403);
    await api().get('/api/bookings').auth(actors.housekeeping.token, { type: 'bearer' }).expect(403);
    for (const who of ['receptionist', 'admin'] as const) {
      const list = await api().get('/api/bookings').auth(actors[who].token, { type: 'bearer' }).query({ page: 1, pageSize: 1, status: 'PENDING' }).expect(200);
      expect(list.body.data).toHaveLength(1); expect(list.body.data[0].status).toBe('PENDING');
    }
    await api().get('/api/bookings').auth(actors.admin.token, { type: 'bearer' }).query({ pageSize: 101 }).expect(400);
    await api().get('/api/bookings/my').auth(actors.guest.token, { type: 'bearer' }).query({ userId: actors.other.id }).expect(400);
    await api().get('/api/bookings/my').auth(actors.guest.token, { type: 'bearer' }).query({ status: 'UNKNOWN' }).expect(400);
  });

  it('12 a guest cannot read/cancel another booking; staff can view, housekeeping cannot', async () => {
    const booking = await create(await room());
    await api().get(`/api/bookings/${booking.id}`).auth(actors.other.token, { type: 'bearer' }).expect(404);
    await action(booking.id, 'cancel', 'other', 404);
    await api().get(`/api/bookings/${booking.id}`).auth(actors.housekeeping.token, { type: 'bearer' }).expect(403);
    for (const who of ['receptionist', 'admin'] as const) await api().get(`/api/bookings/${booking.id}`).auth(actors[who].token, { type: 'bearer' }).expect(200);
    await api().get('/api/bookings/not-a-uuid').auth(actors.guest.token, { type: 'bearer' }).expect(400);
    await api().get(`/api/bookings/${randomUUID()}`).auth(actors.guest.token, { type: 'bearer' }).expect(404);
  });

  it('13 cancellation releases the calendar without deleting the booking', async () => {
    const id = await room(), booking = await create(id);
    expect((await action(booking.id, 'cancel', 'guest')).body.status).toBe('CANCELLED');
    expect((await available(10, 13)).data.some((r: { id: string }) => r.id === id)).toBe(true);
    await create(id, 10, 13, 'other'); expect(await context.prisma.client.booking.count({ where: { roomId: id } })).toBe(2);
  });

  it('14 repeated cancellation and cancellation after check-in are rejected', async () => {
    const cancelled = await create(await room()); await action(cancelled.id, 'cancel', 'guest'); await action(cancelled.id, 'cancel', 'guest', 409);
    const checked = await create(await room(), 0, 2); await action(checked.id, 'confirm'); await action(checked.id, 'check-in');
    await action(checked.id, 'cancel', 'guest', 409);
  });

  it('15 receptionist/admin confirm only pending bookings; guests/housekeeping cannot confirm', async () => {
    const booking = await create(await room());
    await action(booking.id, 'confirm', 'guest', 403); await action(booking.id, 'confirm', 'housekeeping', 403);
    expect((await action(booking.id, 'confirm')).body.status).toBe('CONFIRMED'); await action(booking.id, 'confirm', 'admin', 409);
    const adminBooking = await create(await room()); expect((await action(adminBooking.id, 'confirm', 'admin')).body.status).toBe('CONFIRMED');
    expect((await action(adminBooking.id, 'cancel', 'receptionist')).body.status).toBe('CANCELLED');
    const mutation = await api().patch(`/api/bookings/${booking.id}/cancel`).auth(actors.guest.token, { type: 'bearer' }).send({ status: 'CHECKED_OUT', nightlyPrice: 1 }).expect(400);
    expect(mutation.body.message).toBe('This action does not accept body fields');
  });

  it('16 checks in a pending web booking directly during its date window', async () => {
    const booking = await create(await room(), 0, 2);
    expect((await action(booking.id, 'check-in')).body.status).toBe('CHECKED_IN'); await action(booking.id, 'check-in', 'guest', 403);
    const future = await create(await room(), 10, 12); await action(future.id, 'confirm'); await action(future.id, 'check-in', 'admin', 409);
  });

  it('17 dirty/out-of-service rooms fail the actual DB check-in trigger without partial status change', async () => {
    for (const condition of ['DIRTY', 'OUT_OF_SERVICE']) {
      const id = await room(), booking = await create(id, 0, 2);
      await context.prisma.client.room.update({ where: { id }, data: condition === 'DIRTY' ? { housekeepingStatus: 'DIRTY' } : { operationalStatus: 'OUT_OF_SERVICE' } });
      await action(booking.id, 'check-in', 'receptionist', 409);
      expect((await context.prisma.client.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe('PENDING');
    }
  });

  it('18 unbilled checkout is rejected; no generic booking update/delete or invoice-list route', async () => {
    const booking = await create(await room());
    await action(booking.id, 'check-out', 'receptionist', 409);
    await api().patch(`/api/bookings/${booking.id}`).auth(actors.receptionist.token, { type: 'bearer' }).send({ status: 'CHECKED_OUT' }).expect(404);
    await api().delete(`/api/bookings/${booking.id}`).auth(actors.admin.token, { type: 'bearer' }).expect(404);
    await api().get('/api/invoices').auth(actors.admin.token, { type: 'bearer' }).expect(404);
  });

  it('CHECKED_OUT preserves its original range and blocks another booking over that history', async () => {
    // Historical booking fixture only; Phase 7 separately tests actual checkout/payment APIs.
    const id = await room(), booking = await create(id, 0, 2); await action(booking.id, 'confirm'); await action(booking.id, 'check-in');
    await context.prisma.client.$transaction(async tx => {
      await checkoutFixture(tx, booking.id);
    });
    expect((await available(0, 2)).data.some((r: { id: string }) => r.id === id)).toBe(false);
    await api().post('/api/bookings').auth(actors.other.token, { type: 'bearer' }).send(payload(id, 0, 2)).expect(409);
    await action(booking.id, 'cancel', 'admin', 409);
  });

  it('final fixture verification finds no effective overlaps and all room totals match DB arithmetic', async () => {
    const overlaps = await context.prisma.client.$queryRaw<{ count: bigint }[]>`SELECT count(*) FROM hotel.bookings a JOIN hotel.bookings b ON a.room_id=b.room_id AND a.id<b.id AND a.check_in_date<b.check_out_date AND a.check_out_date>b.check_in_date WHERE a.room_id IN (${Prisma.join(roomIds)}) AND a.status<>'CANCELLED' AND b.status<>'CANCELLED'`;
    expect(Number(overlaps[0].count)).toBe(0);
    const bookings = await context.prisma.client.booking.findMany({ where: { roomId: { in: roomIds } } });
    for (const booking of bookings) expect(booking.totalRoomAmount.equals(booking.nightlyPrice.mul((booking.checkOutDate.getTime() - booking.checkInDate.getTime()) / 86400000))).toBe(true);
    // Immutable booking history is retained in dedicated hotel_test; never DELETE/TRUNCATE/reset.
  });
});
