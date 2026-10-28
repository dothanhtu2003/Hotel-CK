import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { AuthContext } from '../auth/auth-context';
import { ToastContext } from '../../components/toast-context';
import { PaymentForm } from './payment-form';
import type { Invoice } from '../guest/contracts';
import type { User } from '../auth/contracts';
afterEach(() => { cleanup(); sessionStorage.clear(); });
it('blocks an unverified or excessive payment before any receipt is reserved', async () => {
  const user = { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' } as User;
  render(<MemoryRouter><QueryClientProvider client={new QueryClient()}><AuthContext.Provider value={{ user, notice: null, login: vi.fn(), logout: vi.fn(), updateUser: vi.fn() }}><ToastContext.Provider value={vi.fn()}><PaymentForm invoice={{ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', status: 'ISSUED', balance: '100.25' } as Invoice} /></ToastContext.Provider></AuthContext.Provider></QueryClientProvider></MemoryRouter>);
  fireEvent.change(screen.getByLabelText('Số tiền (VND)'), { target: { value: '100.26' } }); fireEvent.click(screen.getByRole('button', { name: 'Xem lại khoản thu' }));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Xác nhận đã nhận'));
  fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(screen.getByRole('button', { name: 'Xem lại khoản thu' }));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('không được vượt số dư'));
  expect(sessionStorage.length).toBe(0);
});
