import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { TapeChart } from './tape-chart';
import { hotelToday, shiftDate } from './room-state';
import { useDeskGet } from './queries';

vi.mock('./queries', () => ({ useDeskGet: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });

it('exposes overdue guest today, opens original booking, and labels unprocessed historical arrivals', () => {
  const today = hotelToday();
  const checkIn = shiftDate(today, -4), checkOut = shiftDate(today, -3);
  const booking = { id: 'stay', reference: 'BK-OVERDUE', status: 'CHECKED_IN', checkIn, checkOut, nights: 1, customer: { fullName: 'Khách quá hạn' } };
  const pending = { ...booking, id: 'pending', status: 'PENDING', customer: { fullName: 'Khách chưa đến' } };
  vi.mocked(useDeskGet).mockImplementation((path: string) => ({
    isPending: false, error: null,
    data: path.includes('room-filters') ? { types: [] } : {
      data: [{ id: 'room', roomNumber: '106', floor: 1, operationalStatus: 'ACTIVE', housekeepingStatus: 'CLEAN', roomType: { name: 'Standard' }, bookings: [booking, pending] }],
      meta: { total: 1, totalPages: 1 },
    },
  }) as ReturnType<typeof useDeskGet>);
  const select = vi.fn();
  render(<MemoryRouter><TapeChart base="/reception" onSelectBooking={select} /></MemoryRouter>);
  const marker = screen.getByRole('button', { name: /Khách quá hạn.*Quá hạn trả phòng/ });
  expect(screen.queryByRole('button', { name: /Khách chưa đến/ })).toBeNull();
  fireEvent.click(marker);
  expect(select).toHaveBeenCalledWith(booking);
  fireEvent.change(screen.getByLabelText('Ngày bắt đầu lịch'), { target: { value: checkIn } });
  expect(screen.getByRole('button', { name: /Khách chưa đến.*Quá hạn nhận phòng/ })).toBeTruthy();
  expect(screen.getByRole('button', { name: /Khách quá hạn.*Đang lưu trú/ }).title).toContain(`${checkIn} → ${checkOut}`);
});
