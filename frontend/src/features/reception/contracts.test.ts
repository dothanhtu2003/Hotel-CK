import { describe, expect, it } from 'vitest';
import { canCheckout, canIssue, deskError, pageNumber, paymentSchema, paymentWithinBalance } from './contracts';
import { ApiError } from '../../lib/api-client';
import type { Booking, Invoice } from '../guest/contracts';
import { clearAttempt, readAttempt, reconcileAttempt, saveAttempt, type PaymentAttempt } from './payment-attempt';

const booking = { status: 'CHECKED_IN' } as Booking;
const invoice = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', status: 'PAID', balance: '0.00', payments: [] } as unknown as Invoice;
const attempt: PaymentAttempt = { key: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', userId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', invoiceId: invoice.id, amount: '100.25', method: 'CASH', rejected: false };
describe('Front desk business conditions', () => {
  it.each(['0', '-1', '1e3', '01', '1,25', '1.001', '1000000000000', 'NaN', ''])('rejects unsafe payment amount %s', amount => expect(paymentSchema.safeParse({ amount, method: 'CASH', verified: true }).success).toBe(false));
  it('requires verified funds and a supported method', () => { expect(paymentSchema.safeParse({ amount: '1', method: 'CARD', verified: true }).success).toBe(false); expect(paymentSchema.safeParse({ amount: '1', method: 'CASH', verified: false }).success).toBe(false); });
  it('compares full Decimal values without rounding or float coercion', () => { expect(paymentWithinBalance('100.26', '100.25')).toBe(false); expect(paymentWithinBalance('999999999999.99', '999999999999.99')).toBe(true); expect(paymentWithinBalance('0.10', '0.09')).toBe(false); });
  it('requires a checked-in stay, no pending order and no prior invoice before issue', () => { expect(canIssue(booking, 0, null)).toBe(true); expect(canIssue(booking, 1, null)).toBe(false); expect(canIssue({ ...booking, status: 'CONFIRMED' }, 0, null)).toBe(false); expect(canIssue(booking, 0, invoice)).toBe(false); });
  it('requires PAID and zero balance for checkout', () => { expect(canCheckout(booking, 0, invoice)).toBe(true); expect(canCheckout(booking, 1, invoice)).toBe(false); expect(canCheckout(booking, 0, { ...invoice, status: 'ISSUED' })).toBe(false); expect(canCheckout(booking, 0, { ...invoice, balance: '0.01' })).toBe(false); expect(canCheckout({ ...booking, status: 'CHECKED_OUT' }, 0, invoice)).toBe(false); });
  it.each(['-1', '1.5', 'Infinity', '1000001', null])('normalizes invalid page %s', p => expect(pageNumber(p)).toBe(1));
  it('maps conflicts to their business operation and preserves RBAC errors', () => { expect(deskError(new ApiError(409, ''), 'check-in')).toContain('CLEAN'); expect(deskError(new ApiError(409, ''), 'payment')).toContain('số dư'); expect(deskError(new ApiError(409, ''), 'check-out')).toContain('thanh toán đủ'); expect(deskError(new ApiError(0, ''))).toContain('Chưa xác định'); expect(deskError(new ApiError(403, 'Không có quyền'))).toBe('Không có quyền'); });
});
describe('Payment attempt recovery', () => {
  it('retains one UUID and immutable payload across reload/navigation, without tokens', () => { sessionStorage.clear(); saveAttempt(attempt); expect(readAttempt(attempt.userId)).toEqual(attempt); expect(sessionStorage.getItem('an-nhien:pending-receipt:' + attempt.userId)).not.toMatch(/Bearer|accessToken|password/); expect(readAttempt('other-user')).toBeNull(); clearAttempt(attempt.userId); expect(readAttempt(attempt.userId)).toBeNull(); });
  it('blocks malformed storage instead of silently replacing an unresolved attempt', () => { sessionStorage.setItem('an-nhien:pending-receipt:' + attempt.userId, 'invalid'); expect(() => readAttempt(attempt.userId)).toThrow(); sessionStorage.clear(); });
  it('only accepts the same receipt key with matching amount/method/status', () => { expect(reconcileAttempt(attempt, invoice)).toBe('absent'); const withPayment = { ...invoice, payments: [{ id: attempt.key, amount: attempt.amount, method: attempt.method, status: 'COMPLETED', paidAt: null }] }; expect(reconcileAttempt(attempt, withPayment)).toBe('recorded'); expect(reconcileAttempt({ ...attempt, amount: '100.26' }, withPayment)).toBe('mismatch'); expect(reconcileAttempt({ ...attempt, method: 'BANK_TRANSFER' }, withPayment)).toBe('mismatch'); expect(reconcileAttempt({ ...attempt, invoiceId: 'other' }, withPayment)).toBe('mismatch'); });
});
