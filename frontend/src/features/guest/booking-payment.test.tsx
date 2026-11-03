import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { BookingPayment } from './booking-payment';
import type { Booking } from './contracts';
import { api } from '../../lib/api';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const booking = { id: 'booking', status: 'PENDING', totalRoomAmount: '650000.00', onlinePaymentRequired: true } as Booking;
const unpaid = { required: true, paid: false, pending: false, paidAmount: '0.00', totalAmount: '650000.00', bookingStatus: 'PENDING' };
function show(value = booking, path = '/') {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}><MemoryRouter initialEntries={[path]}><BookingPayment booking={value} /></MemoryRouter></QueryClientProvider>);
}
it('shows full room payment on a newly created booking before check-in', async () => {
  vi.spyOn(api, 'request').mockResolvedValue(unpaid);
  show();
  expect(screen.getByText('650.000 ₫')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Thanh toán ngay qua payOS' })).toBeTruthy();
  expect(await screen.findByText(/Booking chỉ được xác nhận sau khi nhận đủ tiền phòng/)).toBeTruthy();
});
it('keeps an unpaid booking payable and allows retry if the gateway fails', async () => {
  const request = vi.spyOn(api, 'request').mockImplementation(async path => {
    if (path.endsWith('/payment-state')) return unpaid;
    throw new Error('offline');
  });
  show(); await waitFor(() => expect((screen.getByRole('button', { name: 'Thanh toán ngay qua payOS' }) as HTMLButtonElement).disabled).toBe(false)); fireEvent.click(screen.getByRole('button', { name: 'Thanh toán ngay qua payOS' }));
  await screen.findByRole('alert');
  expect(request).toHaveBeenCalledWith('/bookings/booking/payos', { method: 'POST' });
  expect(screen.queryByText(/Đã thanh toán/)).toBeNull();
});
it('verifies a payOS return without trusting the PAID URL parameter', async () => {
  const request = vi.spyOn(api, 'request').mockImplementation(async path => path.endsWith('/payment-state') ? unpaid : { checked: true });
  show(booking, '/?payos=return&status=PAID');
  await waitFor(() => expect(request).toHaveBeenCalledWith('/bookings/booking/payos/sync', { method: 'POST' }));
  expect(screen.queryByText(/Đã thanh toán/)).toBeNull();
});
it('shows the verified room prepayment and prevents paying it again', async () => {
  vi.spyOn(api, 'request').mockResolvedValue({ ...unpaid, paid: true, paidAmount: '650000.00', bookingStatus: 'CONFIRMED' });
  show({ ...booking, status: 'CONFIRMED' });
  expect((await screen.findByRole('status')).textContent).toContain('Đã thanh toán 650.000 ₫ tiền phòng');
  expect(screen.queryByRole('button', { name: 'Thanh toán ngay qua payOS' })).toBeNull();
});
