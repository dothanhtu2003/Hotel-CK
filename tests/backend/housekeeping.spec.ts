import { describe, expect, it, jest } from '@jest/globals';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { PrismaService } from '../../src/database/prisma.service.js';
import { HousekeepingService } from '../../src/housekeeping/housekeeping.service.js';
import { throwHousekeepingError } from '../../src/housekeeping/housekeeping-errors.js';
import { CreateTaskDto, AssignTaskDto } from '../../src/housekeeping/dto/create-task.dto.js';
import { createValidationPipe } from '../../src/configure-app.js';

describe('Housekeeping DTO boundaries', () => {
  const pipe = createValidationPipe(); const roomId = randomUUID();
  it('trims optional notes without accepting client state or timestamps', async () => {
    const metadata = { type: 'body' as const, metatype: CreateTaskDto };
    const dto = await pipe.transform({ roomId, notes: '  Routine clean  ' }, metadata) as CreateTaskDto;
    expect(dto.notes).toBe('Routine clean');
    for (const extra of [{ status: 'DONE' }, { housekeepingStatus: 'CLEAN' }, { completedAt: new Date().toISOString() }]) await expect(pipe.transform({ roomId, ...extra }, metadata)).rejects.toBeInstanceOf(BadRequestException);
    await expect(pipe.transform({ roomId, notes: null }, metadata)).rejects.toBeInstanceOf(BadRequestException);
  });
  it('assignment accepts only a staff UUID, with no role/identity injection', async () => {
    const metadata = { type: 'body' as const, metatype: AssignTaskDto };
    await expect(pipe.transform({ assignedStaffId: randomUUID(), role: 'ADMIN' }, metadata)).rejects.toBeInstanceOf(BadRequestException);
    await expect(pipe.transform({ assignedStaffId: null }, metadata)).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('Housekeeping SQLSTATE boundary', () => {
  it('maps partial-index UNIQUE violation to safe duplicate conflict', () => {
    expect(() => throwHousekeepingError({ code: 'P2002', meta: { driverAdapterError: { cause: { originalCode: '23505' } } } })).toThrow('Room already has an open housekeeping task');
  });
  it('maps nested trigger 23514 to 409 without leaking driver detail', () => {
    let exception: unknown;
    try { throwHousekeepingError({ code: 'P2039', meta: { driverAdapterError: { cause: { originalCode: '23514', originalMessage: 'private SQL/assignee details' } } } }); } catch (caught) { exception = caught; }
    expect(exception).toBeInstanceOf(ConflictException); expect(JSON.stringify((exception as ConflictException).getResponse())).not.toMatch(/private|SQL|23514/);
  });
  it.each(['40P01', '40001'])('maps concurrent SQLSTATE %s to retryable 409', code => { expect(() => throwHousekeepingError({ code })).toThrow(ConflictException); });
  it('maps missing/invalid references and preserves controlled HTTP errors', () => {
    expect(() => throwHousekeepingError({ code: '23503' })).toThrow(BadRequestException);
    expect(() => throwHousekeepingError({ code: 'P2025' })).toThrow(NotFoundException);
    const error = new ForbiddenException('controlled'); expect(() => throwHousekeepingError(error)).toThrow(error);
  });
});

describe('Housekeeping service trust and atomic updates', () => {
  function fixture() {
    const first = jest.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue(null);
    const findUnique = jest.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue({ roomId: 'room-id', assignedStaffId: 'previous-worker' });
    const create = jest.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue({ id: 'task-id' });
    const update = jest.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue({ count: 1 });
    const result = jest.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue({ id: 'task-id', status: 'DONE' });
    const staff = jest.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue({ role: 'HOUSEKEEPING', status: 'ACTIVE' });
    const roomMany = jest.fn<(...args: unknown[]) => Promise<unknown[]>>().mockResolvedValue([]);
    const tx = { $queryRaw: jest.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue([{ id: 'room-id' }]),
      housekeepingTask: { findFirst: first, findUnique, create, updateMany: update, findUniqueOrThrow: result }, user: { findUnique: staff } };
    const service = new HousekeepingService({ client: {
      $transaction: async (input: unknown) => Array.isArray(input) ? Promise.all(input) : (input as (client: unknown) => Promise<unknown>)(tx),
      housekeepingTask: { findFirst: first }, room: { findMany: roomMany, count: jest.fn<() => Promise<number>>().mockResolvedValue(0) },
    } } as unknown as PrismaService);
    return { service, first, findUnique, create, update, staff, roomMany };
  }
  it('creates with a room/notes allowlist, leaving task state and room status to DB', async () => {
    const f = fixture(); const forged = { roomId: 'room-id', notes: 'clean', status: 'DONE', completedAt: new Date(), housekeepingStatus: 'CLEAN', assignedStaffId: 'attacker' };
    await f.service.create(forged, { id: 'staff', role: 'RECEPTIONIST' });
    expect(f.create).toHaveBeenCalledWith(expect.objectContaining({ data: { roomId: 'room-id', notes: 'clean' } }));
  });
  it('fails closed for GUEST and does not provide receptionist/admin physical-work override', async () => {
    const f = fixture();
    await expect(f.service.create({ roomId: 'room-id' }, { id: 'guest', role: 'GUEST' })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(f.service.transition('task-id', { id: 'admin', role: 'ADMIN' }, 'complete')).rejects.toBeInstanceOf(ForbiddenException);
    expect(f.update).not.toHaveBeenCalled();
  });
  it('board scopes housekeeping to self-assigned open tasks and rejects a forged staff filter', async () => {
    const f = fixture();
    await f.service.board({ page: 1, pageSize: 20 }, { id: 'own-id', role: 'HOUSEKEEPING' });
    expect(f.roomMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tasks: { some: { assignedStaffId: 'own-id', status: { not: 'DONE' } } } } }));
    await expect(f.service.board({ page: 1, pageSize: 20, assignedStaffId: 'another-id' }, { id: 'own-id', role: 'HOUSEKEEPING' })).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('scopes task reads/updates by current assignee in the database predicate', async () => {
    const f = fixture();
    await expect(f.service.get('task-id', { id: 'own-id', role: 'HOUSEKEEPING' })).rejects.toBeInstanceOf(NotFoundException);
    expect(f.first).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'task-id', assignedStaffId: 'own-id' } }));
    f.first.mockResolvedValue({ roomId: 'room-id' });
    await f.service.transition('task-id', { id: 'own-id', role: 'HOUSEKEEPING' }, 'complete');
    expect(f.update).toHaveBeenCalledWith({ where: { id: 'task-id', assignedStaffId: 'own-id', status: 'IN_PROGRESS' }, data: { status: 'DONE' } });
  });
  it('returns 409 after a conditional update loses its state race', async () => {
    const f = fixture(); f.first.mockResolvedValue({ roomId: 'room-id' }); f.update.mockResolvedValueOnce({ count: 0 });
    await expect(f.service.transition('task-id', { id: 'own-id', role: 'HOUSEKEEPING' }, 'start')).rejects.toBeInstanceOf(ConflictException);
  });
  it('assignment pins TODO plus observed assignee and revalidates HOUSEKEEPING ACTIVE', async () => {
    const f = fixture();
    await f.service.assign('task-id', { assignedStaffId: 'new-worker' }, { id: 'admin', role: 'ADMIN' });
    expect(f.update).toHaveBeenCalledWith({ where: { id: 'task-id', status: 'TODO', assignedStaffId: 'previous-worker' }, data: { assignedStaffId: 'new-worker' } });
    f.staff.mockResolvedValueOnce({ role: 'GUEST', status: 'ACTIVE' });
    await expect(f.service.assign('task-id', { assignedStaffId: 'guest' }, { id: 'admin', role: 'ADMIN' })).rejects.toBeInstanceOf(BadRequestException);
  });
});
