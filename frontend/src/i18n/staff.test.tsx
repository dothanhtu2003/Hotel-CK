import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import { changeLanguage, safeError } from './index';
import { createApiClient } from '../lib/api-client';
import { api } from '../lib/api';
import { roomStateLabels } from '../features/reception/room-state';
import { RoomBoard, WorkAction } from '../features/housekeeping/components';
import { formatTaskNotes } from '../features/housekeeping/contracts';
import type { BoardRoom, Task } from '../features/housekeeping/contracts';
import { AuthContext } from '../features/auth/auth-context';
import type { User } from '../features/auth/contracts';
import { ToastProvider } from '../components/toast-provider';
import { revenueSource } from './revenue';
import { PaymentForm } from '../features/reception/payment-form';
import type { Invoice } from '../features/guest/contracts';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const room: BoardRoom = { id: 'room', roomNumber: '301', floor: 3, roomType: { id: 'type', name: 'Standard' }, housekeepingStatus: 'DIRTY', operationalStatus: 'ACTIVE', openTask: null };

it('switches housekeeping room cards and receptionist room labels in both directions', async () => {
  const create = vi.fn(); render(<MemoryRouter><RoomBoard rooms={[room]} onCreate={create} /></MemoryRouter>);
  expect(screen.getByText('Cần dọn')).toBeTruthy();
  await act(() => changeLanguage('en'));
  expect(screen.getByText('Needs cleaning')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Create task' }));
  expect(create).toHaveBeenCalledWith(room);
  expect(roomStateLabels.ready).toBe('Clean & vacant');
  await act(() => changeLanguage('vi'));
  expect(screen.getByRole('button', { name: 'Tạo công việc' })).toBeTruthy();
  expect(roomStateLabels.ready).toBe('Trống sạch');
});

it('retains an open housekeeping confirmation and sends only the original transition', async () => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  const request = vi.spyOn(api, 'request').mockResolvedValue({});
  const task: Task = { id: 'task', roomId: room.id, room, assignedStaffId: 'worker', status: 'TODO', notes: null, createdAt: '2026-11-18T00:00:00Z', completedAt: null, assignedStaff: null };
  const user = { id: 'worker', role: 'HOUSEKEEPING' } as User;
  render(<MemoryRouter><QueryClientProvider client={new QueryClient()}><AuthContext.Provider value={{ user, notice: null, login: vi.fn(), logout: vi.fn(), updateUser: vi.fn() }}><ToastProvider><WorkAction task={task} action="start" /></ToastProvider></AuthContext.Provider></QueryClientProvider></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Bắt đầu dọn phòng' }));
  const dialog = screen.getByRole('dialog');
  await act(() => changeLanguage('en'));
  expect(screen.getByRole('dialog', { name: 'Start cleaning?' })).toBe(dialog);
  expect(request).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Confirm start cleaning' }));
  await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
  expect(request).toHaveBeenCalledWith('/housekeeping/tasks/task/start', { method: 'PATCH' });
});

it('uses stable error codes, translates cached API errors and hides unknown provider details', async () => {
  const client = createApiClient('http://localhost/api', vi.fn<typeof fetch>().mockResolvedValue(new Response('{"code":"ROOM_UNAVAILABLE","message":"SQL password"}', { status: 409 })));
  const error: unknown = await client.request('/bookings').catch(value => value);
  expect(safeError(error)).toContain('Phòng không còn khả dụng');
  await changeLanguage('en');
  expect(safeError(error)).toBe('The room is no longer available. Please search again for your stay.');
  expect(safeError(new Error('SQL password'))).toBe('Unable to connect to the service. Please try again later.');
  const invalid = createApiClient('http://localhost/api', vi.fn<typeof fetch>().mockResolvedValue(new Response('not JSON')));
  await expect(invalid.request('/users/me')).rejects.toThrow('Unable to connect to the service.');
});

it('translates bounded system notes and revenue source codes while retaining unknown content', async () => {
  await changeLanguage('en');
  expect(formatTaskNotes('Check-out cleaning')).toBe('Check-out cleaning');
  expect(formatTaskNotes('Dọn phòng sau chuyển phòng gia hạn')).toBe('Cleaning after an extension room transfer');
  expect(formatTaskNotes('Ghi chú của nhân viên')).toBe('Ghi chú của nhân viên');
  expect(revenueSource({ sourceCode: 'PAYOS_ROOM', source: 'payOS · Tiền phòng' })).toBe('payOS · Room charges');
  expect(revenueSource({ sourceCode: 'UNKNOWN', source: 'Private internal text' })).toBe('Other payment source');
  expect(revenueSource({ sourceCode: 'constructor', source: 'Private internal text' })).toBe('Other payment source');
});

it('keeps the reception QR and method while switching languages without another payment request', async () => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  const request = vi.spyOn(api, 'request').mockImplementation(async path => {
    if (path.endsWith('/payos')) return { checkoutUrl: 'https://pay.payos.vn/web/test', qrCode: 'UNCHANGED-PROVIDER-QR' };
    if (path.endsWith('/payos/sync')) return { checked: true };
    return { payments: [{ status: 'PENDING' }] };
  });
  const user = { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', role: 'RECEPTIONIST' } as User;
  render(<MemoryRouter><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><AuthContext.Provider value={{ user, notice: null, login: vi.fn(), logout: vi.fn(), updateUser: vi.fn() }}><ToastProvider><PaymentForm invoice={{ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', status: 'ISSUED', balance: '100.25', payments: [] } as unknown as Invoice} /></ToastProvider></AuthContext.Provider></QueryClientProvider></MemoryRouter>);
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'BANK_TRANSFER' } });
  fireEvent.click(screen.getByRole('button', { name: 'Thanh toán' }));
  const image = await screen.findByRole('img', { name: 'Mã QR chuyển khoản' });
  const dialog = screen.getByRole('dialog');
  await act(() => changeLanguage('en'));
  expect(screen.getByRole('dialog', { name: 'Pay ₫100.25 by bank transfer' })).toBe(dialog);
  expect(screen.getByRole('img', { name: 'Bank transfer QR' })).toBe(image);
  expect(request.mock.calls.filter(([path]) => path.endsWith('/payos'))).toHaveLength(1);
  expect(request.mock.calls.some(([path]) => path.endsWith('/payments'))).toBe(false);
});
