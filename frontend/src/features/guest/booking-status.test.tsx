import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { bookingOverdue, BookingStatus } from './booking-status';
import type { Booking } from './contracts';

afterEach(cleanup);

it('uses hotel midnight and only flags unprocessed arrivals or ongoing stays', () => {
  const booking = { status: 'PENDING', checkIn: '2026-11-02', checkOut: '2026-11-03' } as Booking;
  expect(bookingOverdue(booking, new Date('2026-11-02T16:59:59Z'))).toBeNull();
  expect(bookingOverdue(booking, new Date('2026-11-02T17:00:00Z'))).toBe('arrival');
  for (const status of ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED'] as const) {
    expect(bookingOverdue({ ...booking, status }, new Date('2026-11-03T17:00:00Z')))
      .toBe(status === 'CHECKED_IN' ? 'departure' : ['PENDING', 'CONFIRMED'].includes(status) ? 'arrival' : null);
  }
  expect(bookingOverdue({ ...booking, status: 'CHECKED_IN' }, new Date('2026-11-03T05:00:00Z'))).toBeNull();
});

it.each(['PENDING', 'CONFIRMED'] as const)('shows overdue arrival and guidance for %s without changing booking', status => {
  const booking = { status, checkIn: '2000-01-01', checkOut: '2000-01-02' } as Booking;
  render(<BookingStatus booking={booking} detail />);
  expect(screen.getByText('Quá hạn nhận phòng')).toBeTruthy();
  expect(screen.getByText(/liên hệ lễ tân để xác nhận, đổi lịch/)).toBeTruthy();
  expect(booking.status).toBe(status);
});

it('keeps ongoing stay visible alongside overdue departure warning', () => {
  render(<BookingStatus booking={{ status: 'CHECKED_IN', checkIn: '2000-01-01', checkOut: '2000-01-02' } as Booking} detail />);
  expect(screen.getByText('Đang lưu trú')).toBeTruthy();
  expect(screen.getByText('Quá hạn trả phòng')).toBeTruthy();
  expect(screen.getByText(/gia hạn hoặc hoàn tất trả phòng/)).toBeTruthy();
});
