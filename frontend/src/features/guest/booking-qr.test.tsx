import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { BookingQr } from './booking-qr';
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it('keeps the QR visible when payOS reconciliation temporarily fails', async () => {
  vi.spyOn(api, 'request').mockImplementation(async path => {
    if (path.endsWith('/payment-state')) return { paid: false, bookingStatus: 'PENDING', holdState: 'ACTIVE', totalAmount: '5000.00' };
    if (path.endsWith('/payos/qr')) return { qrCode: 'TEST-QR', checkoutUrl: 'https://pay.payos.vn/web/test' };
    throw new Error('temporary gateway failure');
  });
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><BookingQr bookingId="test" /></QueryClientProvider>);
  expect(await screen.findByRole('img', { name: 'Mã VietQR thanh toán tiền phòng qua payOS' })).toBeTruthy();
  expect(await screen.findByRole('alert')).toBeTruthy();
});
it('replaces the QR with confirmed success only after the backend verifies receipt', async () => {
  let paid = false;
  vi.spyOn(api, 'request').mockImplementation(async path => {
    if (path.endsWith('/payment-state')) return { paid, paidAmount: paid ? '5000.00' : '0.00', bookingStatus: paid ? 'CONFIRMED' : 'PENDING', holdState: paid ? 'PAID' : 'ACTIVE', totalAmount: '5000.00' };
    if (path.endsWith('/payos/qr')) return { qrCode: 'TEST-QR', checkoutUrl: 'https://pay.payos.vn/web/test' };
    return { checked: true };
  });
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><BookingQr bookingId="test" /></QueryClientProvider>);
  await screen.findByRole('img'); paid = true;
  fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra thanh toán' }));
  expect(await screen.findByRole('heading', { name: 'Thanh toán thành công' })).toBeTruthy();
  expect(screen.queryByRole('img')).toBeNull();
});
