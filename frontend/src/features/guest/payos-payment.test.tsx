import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { PayosPayment } from './payos-payment';
import { api } from '../../lib/api';
import type { Invoice } from './contracts';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const invoice = { id: 'invoice', status: 'ISSUED', balance: '10000.00', payments: [], booking: { status: 'CHECKED_IN' } } as unknown as Invoice;
function show(value = invoice, path = '/') {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}><MemoryRouter initialEntries={[path]}><PayosPayment invoice={value} /></MemoryRouter></QueryClientProvider>);
}
it('requests a server-calculated payment without sending an amount', async () => {
  const request = vi.spyOn(api, 'request').mockRejectedValue(new Error('unavailable'));
  show(); fireEvent.click(screen.getByRole('button', { name: 'Thanh toán qua payOS' }));
  await screen.findByRole('alert');
  expect(request).toHaveBeenCalledWith('/invoices/invoice/payos', { method: 'POST' });
  expect(screen.queryByText(/Đã thanh toán đủ/)).toBeNull();
});
it('checks the backend on return instead of trusting a success URL parameter', async () => {
  const request = vi.spyOn(api, 'request').mockResolvedValue({ checked: true });
  show(invoice, '/?payos=return&status=PAID');
  await waitFor(() => expect(request).toHaveBeenCalledWith('/invoices/invoice/payos/sync', { method: 'POST' }));
  expect(screen.queryByText(/Đã thanh toán đủ/)).toBeNull();
});
it('hides the payment action for a fully paid invoice', () => {
  const request = vi.spyOn(api, 'request');
  show({ ...invoice, status: 'PAID', balance: '0.00' });
  expect(screen.getByRole('status').textContent).toContain('Đã thanh toán đủ');
  expect(screen.queryByRole('button', { name: 'Thanh toán qua payOS' })).toBeNull();
  expect(request).not.toHaveBeenCalled();
});
