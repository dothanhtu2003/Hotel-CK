import { describe, expect, it } from '@jest/globals';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '../../generated/prisma/client.js';
import { invoiceView, paymentAmount, paymentKey, type InvoiceRecord } from '../../src/billing/billing-view.js';
import { throwBillingError } from '../../src/billing/billing-errors.js';

describe('Billing exact money, receipt keys and safe database errors', () => {
  it.each(['0', '0.00', '-1', '1e3', 'NaN', 'Infinity', '1.001', '01', ' 1', '1 ', '1,00', '1000000000000', 1, null])('rejects invalid/zero amount %s', input => {
    expect(() => paymentAmount(input as string)).toThrow(BadRequestException);
  });
  it('keeps decimal precision up to the numeric(14,2) boundary', () => {
    expect(paymentAmount('999999999999.99').sub('0.01').toFixed(2)).toBe('999999999999.98');
    expect(paymentAmount('0.10').add('0.20').toFixed(2)).toBe('0.30');
  });
  it('normalizes UUID keys and rejects missing/non-UUID values', () => {
    const key = randomUUID(); expect(paymentKey(key.toUpperCase())).toBe(key);
    for (const bad of [undefined, null, '', 'receipt-1', [key]]) expect(() => paymentKey(bad)).toThrow(BadRequestException);
  });
  it('counts only completed payments and exposes no user identifier/PII', () => {
    const date = new Date('2026-01-01T00:00:00Z');
    const invoice: InvoiceRecord = {
      id: randomUUID(), bookingId: randomUUID(), roomAmount: new Prisma.Decimal('0.30'), serviceAmount: new Prisma.Decimal(0), totalAmount: new Prisma.Decimal('0.30'), status: 'ISSUED', issuedAt: date,
      booking: { id: randomUUID(), reference: 'Test', userId: randomUUID(), roomId: randomUUID(), checkInDate: date, checkOutDate: new Date('2026-01-04T00:00:00Z'), guestCount: 1, status: 'CHECKED_IN', nightlyPrice: new Prisma.Decimal('0.10'), totalRoomAmount: new Prisma.Decimal('0.30'), createdAt: date, updatedAt: date, room: { roomNumber: '101' } },
      payments: ['COMPLETED', 'PENDING', 'FAILED'].map((status, i) => ({ id: randomUUID(), invoiceId: randomUUID(), amount: new Prisma.Decimal(i ? '0.20' : '0.10'), method: 'CASH', status: status as 'COMPLETED' | 'PENDING' | 'FAILED', paidAt: i ? null : date })),
    };
    const view = invoiceView(invoice); expect(view.paidAmount).toBe('0.10'); expect(view.balance).toBe('0.20');
    expect(view.booking.nights).toBe(3); expect(JSON.stringify(view)).not.toMatch(/userId|email|password/);
  });
  it.each(['23514', '23505', '40001', '40P01'])('maps structured SQLSTATE %s to conflict', code => {
    expect(() => throwBillingError({ code: 'P2039', meta: { driverAdapterError: { cause: { originalCode: code } } } })).toThrow(ConflictException);
  });
  it.each(['23503', '22003'])('maps structured SQLSTATE %s to invalid input', code => {
    expect(() => throwBillingError({ code })).toThrow(BadRequestException);
  });
  it('maps Prisma uniqueness and missing rows without parsing messages', () => {
    expect(() => throwBillingError({ code: 'P2002' })).toThrow(ConflictException);
    expect(() => throwBillingError({ code: 'P2025' })).toThrow(NotFoundException);
    const unknown = new Error('23514 in untrusted message'); expect(() => throwBillingError(unknown)).toThrow(unknown);
  });
});
