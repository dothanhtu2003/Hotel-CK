import { describe, expect, it, jest } from '@jest/globals';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { isCalendarDate, parseStay } from '../../src/common/validation/stay-dates.js';
import { EmptyBodyPipe } from '../../src/common/validation/empty-body.pipe.js';
import { postgresCode, throwBookingError } from '../../src/bookings/booking-errors.js';
import { BookingsService } from '../../src/bookings/bookings.service.js';
import type { PrismaService } from '../../src/database/prisma.service.js';

describe('Stay dates use strict calendar dates and UTC arithmetic', () => {
  it('counts multiple nights through leap days and month boundaries', () => {
    expect(parseStay('2028-02-28', '2028-03-01').nights).toBe(2);
    expect(parseStay('2026-01-30', '2026-02-02').nights).toBe(3);
    expect(parseStay('2026-03-07', '2026-03-10').nights).toBe(3);
  });
  it.each(['2026-02-29', '2026-02-30', '2026-13-01', '0000-01-01', '27/10/2026', '2026-10-27T00:00:00Z', '2026-1-01'])('rejects invalid/ambiguous calendar input %s', value => {
    expect(isCalendarDate(value)).toBe(false);
    expect(() => parseStay(value, '2029-01-01')).toThrow(BadRequestException);
  });
  it('rejects zero-length and reversed ranges', () => {
    expect(() => parseStay('2026-10-27', '2026-10-27')).toThrow(BadRequestException);
    expect(() => parseStay('2026-10-28', '2026-10-27')).toThrow(BadRequestException);
  });
});

describe('PostgreSQL/Prisma booking error boundary', () => {
  it('extracts actual Prisma 7.10.1 P2039 adapter metadata and returns safe 409', () => {
    const error = { code: 'P2039', meta: { modelName: 'Booking', driverAdapterError: { cause: { originalCode: '23P01', originalMessage: 'Private SQL, room IDs and query must not escape' } } } };
    expect(postgresCode(error)).toBe('23P01');
    let result: unknown;
    try { throwBookingError(error); } catch (caught) { result = caught; }
    expect(result).toBeInstanceOf(ConflictException);
    expect((result as ConflictException).getResponse()).toMatchObject({ statusCode: 409, message: 'Room is not available for the requested dates' });
    expect(JSON.stringify((result as ConflictException).getResponse())).not.toMatch(/Private|SQL|room IDs/);
  });
  it.each(['23514', '23505', '40P01', '40001'])('maps SQLSTATE %s to conflict', code => {
    expect(() => throwBookingError({ code })).toThrow(ConflictException);
  });
  it('maps missing/invalid references and preserves unknown exceptions', () => {
    expect(() => throwBookingError({ code: 'P2025' })).toThrow(NotFoundException);
    expect(() => throwBookingError({ code: '23503' })).toThrow(BadRequestException);
    const error = new Error('unexpected');
    expect(() => throwBookingError(error)).toThrow(error);
    const cyclic: { cause?: unknown } = {}; cyclic.cause = cyclic;
    expect(postgresCode(cyclic)).toBeUndefined();
  });
});

describe('Booking service trusted ownership and database pricing', () => {
  function fixture() {
    const record = { id: 'booking-id', reference: 'reference', userId: 'jwt-user', roomId: 'room-id', checkInDate: new Date('2099-01-01T00:00:00Z'), checkOutDate: new Date('2099-01-04T00:00:00Z'), guestCount: 2, status: 'PENDING', nightlyPrice: new Prisma.Decimal('100.25'), totalRoomAmount: new Prisma.Decimal('300.75'), createdAt: new Date(), updatedAt: new Date(), room: { roomNumber: '101' } };
    const create = jest.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue(record);
    const findFirst = jest.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue(null);
    const findRoom = jest.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue({ operationalStatus: 'ACTIVE', roomType: { maxGuests: 2 } });
    const tx = { booking: { create, findFirst }, $queryRaw: jest.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue([{ next: 1 }]) };
    const service = new BookingsService({ client: { ...tx, room: { findUnique: findRoom }, $transaction: async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx) } } as unknown as PrismaService);
    return { service, create, findFirst };
  }
  it('rejects a stale guest booking before writing to the database', async () => {
    const f = fixture();
    await expect(f.service.create({ id: 'jwt-user', role: 'GUEST' }, { roomId: 'room-id', checkIn: '2000-01-01', checkOut: '2000-01-02', guests: 2 })).rejects.toThrow(BadRequestException);
    expect(f.create).not.toHaveBeenCalled();
  });
  it('ignores forged owner/price fields even without the HTTP validation pipe', async () => {
    const f = fixture();
    const dto = { roomId: 'room-id', checkIn: '2099-01-01', checkOut: '2099-01-04', guests: 2, userId: 'attacker-selected-owner', nightlyPrice: 1, totalRoomAmount: 1 };
    const result = await f.service.create({ id: 'jwt-user', role: 'GUEST' }, dto);
    expect(f.create).toHaveBeenCalledWith(expect.objectContaining({ data: { reference: expect.stringMatching(/^CK-\d{6}-\d{4,}$/), userId: 'jwt-user', roomId: 'room-id', checkInDate: new Date('2099-01-01T00:00:00Z'), checkOutDate: new Date('2099-01-04T00:00:00Z'), guestCount: 2 } }));
    expect(result.nightlyPrice).toBe('100.25'); expect(result.totalRoomAmount).toBe('300.75');
  });
  it('scopes guest reads in SQL and fails closed for housekeeping at the service boundary', async () => {
    const f = fixture();
    await expect(f.service.get('booking-id', { id: 'jwt-user', role: 'GUEST' })).rejects.toBeInstanceOf(NotFoundException);
    expect(f.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'booking-id', userId: 'jwt-user' } }));
    await expect(f.service.get('booking-id', { id: 'staff', role: 'HOUSEKEEPING' })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(f.service.transition('booking-id', { id: 'jwt-user', role: 'GUEST' }, 'confirm')).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('Action bodies cannot carry generic update fields', () => {
  const pipe = new EmptyBodyPipe();
  it('accepts omitted/empty body and rejects all supplied fields', () => {
    expect(pipe.transform(undefined)).toBeUndefined(); expect(pipe.transform({})).toBeUndefined();
    expect(() => pipe.transform({ status: 'CHECKED_OUT' })).toThrow(BadRequestException);
    expect(() => pipe.transform([])).toThrow(BadRequestException);
  });
});
