import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { Order } from './contracts';
import { pendingQrPayment, ServicePaymentBadge, ServicePaymentNotice, usePendingServicePayments } from './service-payment-notice';
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const order = { id: 'qr', bookingId: 'stay', status: 'PENDING', requestedPaymentMethod: 'BANK_TRANSFER', paymentMethod: null, orderedAt: new Date().toISOString(), payosStatus: 'PENDING' } as Order;
it('counts only active unpaid QR orders', () => {
  expect(pendingQrPayment(order)).toBe(true);
  expect(pendingQrPayment({ ...order, paymentMethod: 'BANK_TRANSFER' })).toBe(false);
  expect(pendingQrPayment({ ...order, status: 'CANCELLED' })).toBe(false);
  expect(pendingQrPayment({ ...order, requestedPaymentMethod: 'CASH' })).toBe(false);
  expect(pendingQrPayment({ ...order, payosStatus: 'CLOSED' })).toBe(false);
  expect(pendingQrPayment(order, Date.parse(order.orderedAt) + 15 * 60_000)).toBe(false);
});
it('offers a payment link and clears the notice after the order is paid', async () => {
  let paid = false;
  vi.spyOn(api, 'request').mockImplementation(async () => ({ data: [{ ...order, paymentMethod: paid ? 'BANK_TRANSFER' : null }], meta: { totalPages: 1 } }));
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function View() { const orders = usePendingServicePayments(); return <><ServicePaymentBadge count={orders.length} /><ServicePaymentNotice count={orders.length} /></>; }
  render(<QueryClientProvider client={cache}><MemoryRouter><View /></MemoryRouter></QueryClientProvider>);
  expect(await screen.findByLabelText('1 đơn dịch vụ chưa thanh toán QR')).toBeTruthy();
  expect(screen.getByRole('link', { name: /Tiếp tục thanh toán/ }).getAttribute('href')).toBe('/guest/service-orders?status=PENDING');
  paid = true;
  await act(async () => { await cache.invalidateQueries({ queryKey: ['guest'] }); });
  await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
  expect(screen.queryByLabelText('1 đơn dịch vụ chưa thanh toán QR')).toBeNull();
});
