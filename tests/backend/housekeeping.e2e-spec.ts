import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { Prisma } from '../../generated/prisma/client.js';
import { PasswordService } from '../../src/auth/password.service.js';
import { createAuthTestApp } from './auth-test-app.js';
import { checkoutFixture } from './billing-fixtures.js';

describe('Phase 6 housekeeping — every write uses hotel_test', () => {
  let context: Awaited<ReturnType<typeof createAuthTestApp>>;
  const actors = {} as Record<'guest' | 'receptionist' | 'h1' | 'h2' | 'admin' | 'disabled', { id: string; token: string }>;
  const runId = randomUUID();
  const roomIds: string[] = [];
  let typeId: string;
  const api = () => request(context.app.getHttpServer());
  const safe = (body: unknown) => expect(JSON.stringify(body)).not.toMatch(/password|email|phone|booking|invoice|payment|userId/i);

  beforeAll(async () => {
    context = await createAuthTestApp();
    const hash = await context.app.get(PasswordService).hash(`A1-${randomUUID()}`);
    for (const [name, role] of [['guest', 'GUEST'], ['receptionist', 'RECEPTIONIST'], ['h1', 'HOUSEKEEPING'], ['h2', 'HOUSEKEEPING'], ['admin', 'ADMIN'], ['disabled', 'HOUSEKEEPING']] as const) {
      const user = await context.prisma.client.user.create({ data: { email: `${name}-${runId}@housekeeping-test.invalid`, fullName: `HK Test ${name}`, passwordHash: hash, role, status: name === 'disabled' ? 'DISABLED' : 'ACTIVE' } });
      actors[name] = { id: user.id, token: await context.app.get(JwtService).signAsync({ sub: user.id, tokenType: 'access' }) };
    }
    typeId = (await context.prisma.client.roomType.create({ data: { name: `Housekeeping ${runId}`, nightlyPrice: '650000.25', maxGuests: 2 } })).id;
  });
  afterAll(async () => { if (context) await context.app.close(); });

  async function room(outOfService = false) {
    const r = await context.prisma.client.room.create({ data: { roomNumber: randomUUID().replaceAll('-', '').slice(0, 12), floor: 1, roomTypeId: typeId, operationalStatus: outOfService ? 'OUT_OF_SERVICE' : 'ACTIVE' } });
    roomIds.push(r.id); return r.id;
  }
  const createRequest = (roomId: string, who: keyof typeof actors = 'receptionist', extra = {}) => api().post('/api/housekeeping/tasks').auth(actors[who].token, { type: 'bearer' }).send({ roomId, ...extra });
  async function create(roomId: string, who: keyof typeof actors = 'receptionist') { return (await createRequest(roomId, who).expect(201)).body; }
  const assign = (id: string, staff: keyof typeof actors = 'h1', who: keyof typeof actors = 'receptionist') => api().patch(`/api/housekeeping/tasks/${id}/assign`).auth(actors[who].token, { type: 'bearer' }).send({ assignedStaffId: actors[staff].id });
  const action = (id: string, name: 'start' | 'complete', who: keyof typeof actors = 'h1') => api().patch(`/api/housekeeping/tasks/${id}/${name}`).auth(actors[who].token, { type: 'bearer' }).send({});
  async function assigned(roomId?: string) { const t = await create(roomId ?? await room()); await assign(t.id).expect(200); return t; }
  const detail = (id: string, who: keyof typeof actors = 'receptionist') => api().get(`/api/housekeeping/tasks/${id}`).auth(actors[who].token, { type: 'bearer' });
  const board = (query: Record<string, unknown> = {}, who: keyof typeof actors = 'receptionist') => api().get('/api/housekeeping/board').auth(actors[who].token, { type: 'bearer' }).query({ roomTypeId: typeId, ...query });

  it('01/23 board contains room/type/status, nullable open task and assignee with no sensitive data', async () => {
    const clean = await room(), dirty = await room(); const task = await create(dirty); await assign(task.id).expect(200);
    const response = await board({ pageSize: 100 }).expect(200); safe(response.body);
    expect(response.headers['cache-control']).toBe('no-store');
    const cleanRow = response.body.data.find((r: { id: string }) => r.id === clean); expect(cleanRow.openTask).toBeNull(); expect(cleanRow.housekeepingStatus).toBe('CLEAN');
    const dirtyRow = response.body.data.find((r: { id: string }) => r.id === dirty);
    expect(dirtyRow.roomType.id).toBe(typeId); expect(dirtyRow.openTask.id).toBe(task.id); expect(dirtyRow.openTask.assignedStaff).toEqual({ id: actors.h1.id, fullName: 'HK Test h1' });
  });
  it('02 board filters CLEAN/DIRTY/CLEANING and operational/room/assignee scope with pagination', async () => {
    await room(); const todo = await create(await room()); const progress = await assigned(); await action(progress.id, 'start').expect(200);
    for (const status of ['CLEAN', 'DIRTY', 'CLEANING']) {
      const result = await board({ housekeepingStatus: status, pageSize: 100 }).expect(200);
      expect(result.body.data.length).toBeGreaterThan(0); expect(result.body.data.every((r: { housekeepingStatus: string }) => r.housekeepingStatus === status)).toBe(true);
    }
    const filtered = await board({ roomId: todo.roomId }).expect(200); expect(filtered.body.data).toHaveLength(1);
    const out = await room(true); await create(out, 'admin');
    const inactive = await board({ operationalStatus: 'OUT_OF_SERVICE' }).expect(200); expect(inactive.body.data.every((r: { operationalStatus: string }) => r.operationalStatus === 'OUT_OF_SERVICE')).toBe(true);
    const paged = await board({ page: 1, pageSize: 1 }).expect(200); expect(paged.body.data).toHaveLength(1); expect(paged.body.meta.total).toBeGreaterThan(1);
    await board({ housekeepingStatus: 'CHECKED_IN' }).expect(400); await board({ pageSize: 101 }).expect(400);
  });
  it('03 task list filters status/room/assignee and paginates for receptionist/admin', async () => {
    const t = await assigned();
    for (const who of ['receptionist', 'admin'] as const) {
      const response = await api().get('/api/housekeeping/tasks').auth(actors[who].token, { type: 'bearer' }).query({ status: 'TODO', roomId: t.roomId, assignedStaffId: actors.h1.id, pageSize: 1 }).expect(200);
      expect(response.body.data).toHaveLength(1); expect(response.body.data[0].id).toBe(t.id); safe(response.body);
    }
    await api().get('/api/housekeeping/tasks').auth(actors.admin.token, { type: 'bearer' }).query({ status: 'CLEAN' }).expect(400);
  });
  it('04 task detail is scoped, validates UUID and returns 404 for missing resources', async () => {
    const t = await create(await room()); const result = await detail(t.id).expect(200); expect(result.body.room.id).toBe(t.roomId); safe(result.body);
    await detail(randomUUID()).expect(404); await detail('invalid').expect(400);
  });
  it('05 creates TODO without direct room-status writes, trims notes and rejects mass assignment', async () => {
    const rid = await room(); const result = await createRequest(rid, 'admin', { notes: '  Routine cleaning  ' }).expect(201);
    expect(result.body.status).toBe('TODO'); expect(result.body.notes).toBe('Routine cleaning'); expect(result.body.completedAt).toBeNull(); expect(result.body.assignedStaffId).toBeNull(); expect(result.body.room.housekeepingStatus).toBe('DIRTY');
    const otherRoom = await room();
    for (const extra of [{ status: 'DONE' }, { completedAt: new Date().toISOString() }, { housekeepingStatus: 'CLEAN' }, { assignedStaffId: actors.h1.id }, { userId: actors.h1.id }, { notes: 'x'.repeat(2001) }]) await createRequest(otherRoom, 'receptionist', extra).expect(400);
    expect(await context.prisma.client.housekeepingTask.count({ where: { roomId: otherRoom } })).toBe(0);
  });
  it('06 missing room returns 404 and invalid room UUID returns 400', async () => { await createRequest(randomUUID()).expect(404); await createRequest('invalid').expect(400); });
  it('07 cannot duplicate an open task; concurrent creators produce one 201 and one 409', async () => {
    const rid = await room(); const t = await create(rid); await createRequest(rid).expect(409);
    const raceRoom = await room(); const results = await Promise.all([createRequest(raceRoom), createRequest(raceRoom, 'admin')]);
    expect(results.map(r => r.status).sort()).toEqual([201, 409]); expect(await context.prisma.client.housekeepingTask.count({ where: { roomId: raceRoom, status: { not: 'DONE' } } })).toBe(1);
    expect(await context.prisma.client.housekeepingTask.count({ where: { id: t.id } })).toBe(1);
  });
  it('08 assignment accepts active housekeeping and permits reassignment only while TODO', async () => {
    const t = await create(await room()); const result = await assign(t.id, 'h1', 'admin').expect(200); expect(result.body.assignedStaffId).toBe(actors.h1.id);
    await assign(t.id, 'h2').expect(200); await detail(t.id, 'h1').expect(404); await detail(t.id, 'h2').expect(200);
    await action(t.id, 'start', 'h2').expect(200); await assign(t.id, 'h1').expect(409);
    await action(t.id, 'complete', 'h2').expect(200); await assign(t.id, 'h1').expect(409);
  });
  it.each(['guest', 'receptionist', 'admin'] as const)('09 refuses assignee role %s', async who => { const t = await create(await room()); await assign(t.id, who).expect(400); });
  it('10 rejects disabled/missing staff and malformed/mass-assigned bodies', async () => {
    const t = await create(await room()); await assign(t.id, 'disabled').expect(400);
    await api().patch(`/api/housekeeping/tasks/${t.id}/assign`).auth(actors.admin.token, { type: 'bearer' }).send({ assignedStaffId: randomUUID() }).expect(404);
    for (const body of [{ assignedStaffId: null }, { assignedStaffId: 'invalid' }, { assignedStaffId: actors.h1.id, status: 'IN_PROGRESS' }]) await api().patch(`/api/housekeeping/tasks/${t.id}/assign`).auth(actors.admin.token, { type: 'bearer' }).send(body).expect(400);
    await assign(randomUUID()).expect(404);
  });
  it('11 own task list and board are limited to assigned work; completed history remains in tasks', async () => {
    const mine = await assigned(); const other = await create(await room()); await assign(other.id, 'h2').expect(200);
    const list = await api().get('/api/housekeeping/tasks').auth(actors.h1.token, { type: 'bearer' }).query({ pageSize: 100 }).expect(200);
    expect(list.body.data.every((t: { assignedStaffId: string }) => t.assignedStaffId === actors.h1.id)).toBe(true);
    const mineBoard = await board({ pageSize: 100 }, 'h1').expect(200); expect(mineBoard.body.data.every((r: { openTask: { assignedStaffId: string } }) => r.openTask.assignedStaffId === actors.h1.id)).toBe(true);
    expect(mineBoard.body.data.some((r: { id: string }) => r.id === other.roomId)).toBe(false);
    await board({ assignedStaffId: actors.h2.id }, 'h1').expect(403);
    await api().get('/api/housekeeping/tasks').auth(actors.h1.token, { type: 'bearer' }).query({ assignedStaffId: actors.h2.id }).expect(403);
    await action(mine.id, 'start').expect(200); await action(mine.id, 'complete').expect(200);
    expect((await board({ roomId: mine.roomId }, 'h1').expect(200)).body.data).toEqual([]);
    const done = await api().get('/api/housekeeping/tasks').auth(actors.h1.token, { type: 'bearer' }).query({ roomId: mine.roomId, status: 'DONE' }).expect(200); expect(done.body.data[0].id).toBe(mine.id);
  });
  it('12 housekeeping cannot read, reassign, start or complete another staff task', async () => {
    const t = await assigned(); await detail(t.id, 'h2').expect(404); await action(t.id, 'start', 'h2').expect(404); await action(t.id, 'complete', 'h2').expect(404);
    await assign(t.id, 'h2', 'h1').expect(403); await createRequest(await room(), 'h1').expect(403);
  });
  it('13/19 start sets IN_PROGRESS and DB synchronizes CLEANING', async () => {
    const t = await assigned(); const result = await action(t.id, 'start').expect(200); expect(result.body.status).toBe('IN_PROGRESS'); expect(result.body.room.housekeepingStatus).toBe('CLEANING'); expect(result.body.completedAt).toBeNull();
    expect((await context.prisma.client.room.findUniqueOrThrow({ where: { id: t.roomId } })).housekeepingStatus).toBe('CLEANING');
  });
  it('14 unassigned work cannot be started; receptionist/admin have no physical-work override', async () => {
    const t = await create(await room()); await action(t.id, 'start').expect(404);
    for (const who of ['receptionist', 'admin'] as const) { await action(t.id, 'start', who).expect(403); await action(t.id, 'complete', who).expect(403); }
  });
  it('15/16/18/20 completion sets DONE/database timestamp/CLEAN and final work cannot restart', async () => {
    const t = await assigned(); await action(t.id, 'start').expect(200); const before = Date.now();
    const result = await action(t.id, 'complete').expect(200); expect(result.body.status).toBe('DONE'); expect(result.body.room.housekeepingStatus).toBe('CLEAN'); expect(Date.parse(result.body.completedAt)).toBeGreaterThanOrEqual(before - 1000);
    const saved = await context.prisma.client.housekeepingTask.findUniqueOrThrow({ where: { id: t.id } }); expect(saved.completedAt?.toISOString()).toBe(result.body.completedAt);
    await action(t.id, 'start').expect(409); await action(t.id, 'complete').expect(409);
  });
  it('17 cannot complete TODO or inject status/room fields into start/complete actions', async () => {
    const t = await assigned(); await action(t.id, 'complete').expect(409);
    await api().patch(`/api/housekeeping/tasks/${t.id}/start`).auth(actors.h1.token, { type: 'bearer' }).send({ status: 'DONE', housekeepingStatus: 'CLEAN' }).expect(400);
    expect((await detail(t.id).expect(200)).body.status).toBe('TODO');
  });
  it('21 concurrent start and concurrent complete each yield exactly one 200 and one 409', async () => {
    const t = await assigned();
    const starts = await Promise.all([action(t.id, 'start'), action(t.id, 'start')]); expect(starts.map(r => r.status).sort()).toEqual([200, 409]);
    const completes = await Promise.all([action(t.id, 'complete'), action(t.id, 'complete')]); expect(completes.map(r => r.status).sort()).toEqual([200, 409]);
    expect((await detail(t.id).expect(200)).body.room.housekeepingStatus).toBe('CLEAN');
  });
  it('a racing reassignment/start cannot leave an unauthorized worker updating the task', async () => {
    const t = await assigned(); const result = await Promise.all([action(t.id, 'start'), assign(t.id, 'h2', 'admin')]);
    const state = await context.prisma.client.housekeepingTask.findUniqueOrThrow({ where: { id: t.id } });
    if (state.status === 'IN_PROGRESS') { expect(result.map(r => r.status)).toEqual([200, 409]); expect(state.assignedStaffId).toBe(actors.h1.id); }
    else { expect(result.map(r => r.status)).toEqual([404, 200]); expect(state.assignedStaffId).toBe(actors.h2.id); }
  });
  it('22 guest has no housekeeping rights and anonymous requests require auth', async () => {
    const t = await assigned();
    for (const path of ['/api/housekeeping/board', '/api/housekeeping/tasks', `/api/housekeeping/tasks/${t.id}`]) { await api().get(path).auth(actors.guest.token, { type: 'bearer' }).expect(403); await api().get(path).expect(401); }
    await createRequest(t.roomId, 'guest').expect(403); await assign(t.id, 'h1', 'guest').expect(403); await action(t.id, 'start', 'guest').expect(403); await action(t.id, 'complete', 'guest').expect(403);
  });
  it('disabled workers are blocked by JWT ACTIVE checking, without altering task state', async () => {
    const t = await assigned(); await context.prisma.client.user.update({ where: { id: actors.h1.id }, data: { status: 'DISABLED' } });
    try { await action(t.id, 'start').expect(401); expect((await detail(t.id).expect(200)).body.status).toBe('TODO'); }
    finally { await context.prisma.client.user.update({ where: { id: actors.h1.id }, data: { status: 'ACTIVE' } }); }
  });
  it('24 existing checkout fixture automatically creates one TODO/DIRTY task; manual duplicate is rejected', async () => {
    const rid = await room(); const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const end = new Date(`${today}T00:00:00Z`); end.setUTCDate(end.getUTCDate() + 2);
    const b = await context.prisma.client.booking.create({ data: { userId: actors.guest.id, roomId: rid, checkInDate: new Date(`${today}T00:00:00Z`), checkOutDate: end, guestCount: 1 } });
    await context.prisma.client.booking.update({ where: { id: b.id }, data: { status: 'CONFIRMED' } }); await context.prisma.client.booking.update({ where: { id: b.id }, data: { status: 'CHECKED_IN' } });
    await context.prisma.client.$transaction(async tx => { await checkoutFixture(tx, b.id); });
    const tasks = await context.prisma.client.housekeepingTask.findMany({ where: { roomId: rid } }); expect(tasks).toHaveLength(1); expect(tasks[0].status).toBe('TODO'); expect(tasks[0].assignedStaffId).toBeNull();
    expect((await context.prisma.client.room.findUniqueOrThrow({ where: { id: rid } })).housekeepingStatus).toBe('DIRTY'); await createRequest(rid).expect(409);
    await api().patch(`/api/bookings/${b.id}/check-out`).auth(actors.receptionist.token, { type: 'bearer' }).send({}).expect(409);
  });
  it('check-in remains blocked while dirty/open task, and succeeds after cleaning completes', async () => {
    const rid = await room(); const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const end = new Date(`${today}T00:00:00Z`); end.setUTCDate(end.getUTCDate() + 2);
    const b = await api().post('/api/bookings').auth(actors.guest.token, { type: 'bearer' }).send({ roomId: rid, checkIn: today, checkOut: end.toISOString().slice(0, 10), guests: 1 }).expect(201);
    await api().patch(`/api/bookings/${b.body.id}/confirm`).auth(actors.receptionist.token, { type: 'bearer' }).send({}).expect(200);
    const t = await assigned(rid); await api().patch(`/api/bookings/${b.body.id}/check-in`).auth(actors.receptionist.token, { type: 'bearer' }).send({}).expect(409);
    await action(t.id, 'start').expect(200); await action(t.id, 'complete').expect(200);
    await api().patch(`/api/bookings/${b.body.id}/check-in`).auth(actors.receptionist.token, { type: 'bearer' }).send({}).expect(200);
  });
  it('does not expose task DELETE/generic PATCH, room-status mutation or billing endpoints', async () => {
    const t = await assigned(); await api().delete(`/api/housekeeping/tasks/${t.id}`).auth(actors.admin.token, { type: 'bearer' }).expect(404);
    await api().patch(`/api/housekeeping/tasks/${t.id}`).auth(actors.admin.token, { type: 'bearer' }).send({ status: 'DONE' }).expect(404);
    await api().patch(`/api/rooms/${t.roomId}`).auth(actors.admin.token, { type: 'bearer' }).send({ housekeepingStatus: 'CLEAN' }).expect(404);
    await api().get('/api/invoices').auth(actors.admin.token, { type: 'bearer' }).expect(404);
  });
  it('restricted DML role can run trigger workflow; temporary role/data are rolled back', async () => {
    const rid = await room(), role = `hk_runtime_${randomUUID().replaceAll('-', '')}`; const rollback = new Error('rollback restricted role fixture');
    await expect(context.prisma.client.$transaction(async tx => {
      await tx.$executeRaw(Prisma.sql`CREATE ROLE ${Prisma.raw(role)} NOLOGIN`);
      await tx.$executeRaw(Prisma.sql`GRANT USAGE ON SCHEMA hotel TO ${Prisma.raw(role)}`);
      await tx.$executeRaw(Prisma.sql`GRANT SELECT ON hotel.rooms,hotel.room_types,hotel.housekeeping_tasks,hotel.users TO ${Prisma.raw(role)}`);
      await tx.$executeRaw(Prisma.sql`GRANT INSERT,UPDATE ON hotel.housekeeping_tasks TO ${Prisma.raw(role)}`);
      await tx.$executeRaw(Prisma.sql`GRANT UPDATE ON hotel.rooms,hotel.users TO ${Prisma.raw(role)}`);
      await tx.$executeRaw(Prisma.sql`SET LOCAL ROLE ${Prisma.raw(role)}`);
      const t = await tx.housekeepingTask.create({ data: { roomId: rid, assignedStaffId: actors.h1.id } });
      await tx.housekeepingTask.update({ where: { id: t.id }, data: { status: 'IN_PROGRESS' } });
      await tx.housekeepingTask.update({ where: { id: t.id }, data: { status: 'DONE' } });
      expect((await tx.room.findUniqueOrThrow({ where: { id: rid } })).housekeepingStatus).toBe('CLEAN');
      throw rollback;
    })).rejects.toThrow(rollback);
    expect(await context.prisma.client.housekeepingTask.count({ where: { roomId: rid } })).toBe(0);
  });
  it('final fixture reconciliation has one open task maximum and room states match open work', async () => {
    const tasks = await context.prisma.client.housekeepingTask.findMany({ where: { roomId: { in: roomIds } }, include: { room: true } });
    const open = new Set<string>(); for (const t of tasks) {
      if (t.status !== 'DONE') { expect(open.has(t.roomId)).toBe(false); open.add(t.roomId); expect(t.room.housekeepingStatus).toBe(t.status === 'TODO' ? 'DIRTY' : 'CLEANING'); }
      expect(t.completedAt !== null).toBe(t.status === 'DONE');
    }
    // Immutable task/booking history stays in hotel_test; no reset/delete/truncate.
  });
});
