import { describe, expect, it } from '@jest/globals';
import { HttpException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { throwBookingError } from '../../src/bookings/booking-errors.js';
import { RevenueController } from '../../src/billing/revenue.controller.js';
import type { PrismaService } from '../../src/database/prisma.service.js';

describe('Additive i18n API contracts', () => {
  it('preserves the legacy room conflict response and adds a stable code', () => {
    expect.assertions(3);
    try { throwBookingError({ code: '23P01' }); } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(409);
      expect((error as HttpException).getResponse()).toEqual({ statusCode: 409, error: 'Conflict', message: 'Room is not available for the requested dates', code: 'ROOM_UNAVAILABLE' });
    }
  });

  it('adds revenue source codes without changing source strings, signed amounts or allocations', async () => {
    const amount = new Prisma.Decimal('100.25'), date = new Date('2026-11-18T01:00:00Z');
    const booking = { id: 'booking', reference: 'BK-UNCHANGED', room: { roomNumber: '101' }, user: { id: 'guest', fullName: 'Original guest' }, invoice: null };
    const tx = {
      bookingPayment: { findMany: async () => [{ id: 'receipt', amount, paidAt: date, method: 'CASH', payosOrderCode: null, collectedById: null, booking }], count: async () => 0 },
      payment: { findMany: async () => [] }, invoice: { findMany: async () => [] }, user: { findMany: async () => [] },
      serviceOrder: { findMany: async () => [{ id: 'service', totalAmount: new Prisma.Decimal('50.75'), paymentMethod: 'BANK_TRANSFER', payosOrderCode: 123n, paidAt: date, refundedAt: date, booking, collector: null, refunder: null }] },
    };
    const prisma = { client: { $transaction: async (fn: (client: typeof tx) => unknown) => fn(tx) } } as unknown as PrismaService;
    const result = await new RevenueController(prisma).report('2026-11-18', '2026-11-18');
    expect(result.transactions).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'receipt', source: 'Tiền phòng', sourceCode: 'ROOM', amount: '100.25', roomAmount: '100.25', serviceAmount: '0.00' }),
      expect.objectContaining({ id: 'service', source: 'payOS · Dịch vụ', sourceCode: 'PAYOS_SERVICE', amount: '50.75', roomAmount: '0.00', serviceAmount: '50.75' }),
      expect.objectContaining({ id: 'service-refund', source: 'Dịch vụ', sourceCode: 'SERVICE', amount: '-50.75', refund: true }),
    ]));
    expect(result.transactions).toHaveLength(3);
  });
});
