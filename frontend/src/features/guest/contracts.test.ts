import { describe, expect, it } from 'vitest';
import { bookingSchema, calendarDate, cents, decimal, guestError, money, nightsBetween, readStay, searchParams, staySchema } from './contracts';
import { safeDestination } from '../auth/contracts';
import { ApiError } from '../../lib/api-client';

const stay = { checkIn: '2028-02-28', checkOut: '2028-03-01', guests: 2 };
describe('Guest booking boundaries', () => {
  it.each(['2027-02-29', '2028-02-30', '0000-01-01', '2028-1-01', '2028-01-01T00:00:00Z'])('rejects invalid date-only %s', value => expect(calendarDate(value)).toBe(false));
  it('counts nights across leap day, DST and year boundaries without local timezone', () => { expect(nightsBetween(stay.checkIn, stay.checkOut)).toBe(2); expect(nightsBetween('2027-03-13', '2027-03-15')).toBe(2); expect(nightsBetween('2026-12-31', '2027-01-01')).toBe(1); });
  it.each([{ checkOut: stay.checkIn }, { checkOut: '2028-02-27' }, { guests: 0 }, { guests: 1.5 }, { roomTypeId: 'bad' }])('validates search input %j', change => expect(staySchema.safeParse({ ...stay, ...change }).success).toBe(false));
  it('round trips only API search fields', () => { const p = new URLSearchParams(searchParams({ ...stay, roomTypeId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' })); p.set('userId', 'ignored'); const result = readStay(p); expect(result.success).toBe(true); if (result.success) expect(result.data).not.toHaveProperty('userId'); });
  it('requires a real room id and preserves date validation for booking', () => { expect(bookingSchema.safeParse({ ...stay, roomId: 'bad' }).success).toBe(false); expect(bookingSchema.safeParse({ ...stay, roomId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', checkOut: stay.checkIn }).success).toBe(false); });
  it('calculates Decimal totals without floating point rounding', () => { expect(decimal(cents('45000.25') * 3n + cents('0.10'))).toBe('135000.85'); expect(decimal(cents('99999999999999.99') * 3n)).toBe('299999999999999.97'); expect(money('45000.25')).toBe('45.000,25 ₫'); expect(() => cents('NaN')).toThrow(); });
  it('explains conflicts and uncertain writes separately', () => { expect(guestError(new ApiError(409, ''), 'booking')).toContain('Phòng không còn khả dụng'); expect(guestError(new ApiError(409, ''))).toContain('Trạng thái'); expect(guestError(new ApiError(0, ''), 'create')).toContain('kiểm tra danh sách'); });
  it('returns guests to room selection but preserves staff role boundaries', () => { const path = '/rooms/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa?' + searchParams(stay); expect(safeDestination(path, 'GUEST')).toBe(path); expect(safeDestination(path, 'ADMIN')).toBe('/admin'); expect(safeDestination('//evil.example', 'GUEST')).toBe('/guest'); });
});
