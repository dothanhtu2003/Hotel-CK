import { describe, expect, it, jest } from '@jest/globals';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { BookingsService } from '../../src/bookings/bookings.service.js';
import type { PrismaService } from '../../src/database/prisma.service.js';

function fixture(status = 'CHECKED_IN', exists = true) {
  const timestamp = new Date('2026-10-31T03:00:00Z');
  const record = { id: 'booking', status, checkoutRequestedAt: timestamp, checkInDate: timestamp, checkOutDate: timestamp,
    room: { roomNumber: '106' }, nightlyPrice: new Prisma.Decimal(650000), totalRoomAmount: new Prisma.Decimal(650000) };
  const updateMany = jest.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue({ count: 0 });
  const findFirst = jest.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue(exists ? record : null);
  const tx = { booking: { updateMany, findFirst } };
  const service = new BookingsService({ client: { $transaction: async (fn: (db: typeof tx) => unknown) => fn(tx) } } as unknown as PrismaService);
  return { service, updateMany, timestamp };
}

describe('Guest checkout requests', () => {
  it('scopes writes to the owner and active stay, and preserves the original timestamp on repeat requests', async () => {
    const f = fixture();
    const result = await f.service.requestCheckout('booking', { id: 'guest', role: 'GUEST' });
    expect(f.updateMany).toHaveBeenCalledWith({ where: { id: 'booking', userId: 'guest', status: 'CHECKED_IN', checkoutRequestedAt: null }, data: { checkoutRequestedAt: expect.any(Date) } });
    expect(result.checkoutRequestedAt).toEqual(f.timestamp);
    expect(result.status).toBe('CHECKED_IN');
  });
  it.each(['PENDING', 'CONFIRMED', 'CHECKED_OUT', 'CANCELLED'])('rejects status %s', async status => {
    await expect(fixture(status).service.requestCheckout('booking', { id: 'guest', role: 'GUEST' })).rejects.toThrow(ConflictException);
  });
  it('hides inaccessible or nonexistent bookings', async () => {
    await expect(fixture('CHECKED_IN', false).service.requestCheckout('booking', { id: 'other', role: 'GUEST' })).rejects.toThrow(NotFoundException);
  });
  it('rejects staff requests before writing', async () => {
    const f = fixture();
    await expect(f.service.requestCheckout('booking', { id: 'staff', role: 'RECEPTIONIST' })).rejects.toThrow(ForbiddenException);
    expect(f.updateMany).not.toHaveBeenCalled();
  });
});
