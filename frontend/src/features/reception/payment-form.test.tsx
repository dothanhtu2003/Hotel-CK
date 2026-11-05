import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { AuthContext } from '../auth/auth-context';
import { ToastContext } from '../../components/toast-context';
import { api } from '../../lib/api';
import { PaymentForm } from './payment-form';
import type { Invoice } from '../guest/contracts';
import type { User } from '../auth/contracts';
vi.mock('qrcode', () => ({ default: { toDataURL: vi.fn(async () => 'data:image/png;base64,qr') } }));
afterEach(() => { cleanup(); sessionStorage.clear(); vi.restoreAllMocks(); });
it('records the full cash balance and requests checkout in one action', async () => {
  const request = vi.spyOn(api, 'request').mockResolvedValue({ invoice: { id: 'invoice' }, replayed: false });
  renderPaymentForm();
  expect(screen.queryByRole('textbox')).toBeNull(); fireEvent.click(screen.getByRole('button', { name: 'Thanh toán đủ & trả phòng' }));
  await waitFor(() => expect(request).toHaveBeenCalledWith(expect.stringMatching(/\/payments$/), expect.objectContaining({ body: { amount: '100.25', method: 'CASH', checkout: true } })));
  expect(screen.queryByRole('dialog')).toBeNull();
});

function renderPaymentForm() {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  const user = { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' } as User;
  render(<MemoryRouter><QueryClientProvider client={new QueryClient()}><AuthContext.Provider value={{ user, notice: null, login: vi.fn(), logout: vi.fn(), updateUser: vi.fn() }}><ToastContext.Provider value={vi.fn()}><PaymentForm invoice={{ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', status: 'ISSUED', balance: '100.25' } as Invoice} /></ToastContext.Provider></AuthContext.Provider></QueryClientProvider></MemoryRouter>);
}

it('shows the payOS QR and checks payment without recording a manual transfer', async () => {
  const request = vi.spyOn(api, 'request').mockImplementation(async path => {
    if (path.endsWith('/payos')) return { checkoutUrl: 'https://pay.payos.vn/web/test', qrCode: 'payment-qr' };
    if (path.endsWith('/payos/sync')) return { checked: true };
    return { payments: [{ status: 'PENDING' }] };
  });
  renderPaymentForm();
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'BANK_TRANSFER' } });
  fireEvent.click(screen.getByRole('button', { name: 'Thanh toán' }));
  const dialog = await screen.findByRole('dialog', { name: /bằng chuyển khoản/ });
  expect(await within(dialog).findByRole('img', { name: 'Mã QR chuyển khoản' })).toBeTruthy();
  await waitFor(() => expect(request).toHaveBeenCalledWith(expect.stringMatching(/\/payos\/sync$/), { method: 'POST' }));
  expect(request.mock.calls.some(([path]) => path.endsWith('/payments'))).toBe(false);
});
