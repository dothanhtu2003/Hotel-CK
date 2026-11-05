import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import type { ReactNode } from 'react';
import { api } from '../../lib/api';
import type { Order } from '../guest/contracts';
import { ServiceOrderActions } from './service-order-actions';
import { CreateServiceOrder } from './create-service-order';

vi.mock('../../components/ui', async importOriginal => ({
  ...await importOriginal<typeof import('../../components/ui')>(),
  Dialog: ({ open, title, children }: { open: boolean; title: string; children: ReactNode }) => open ? <div role="dialog" aria-label={title}>{children}</div> : null,
}));
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllEnvs(); });
const order: Order = { id: 'order-1', bookingId: 'booking-1', status: 'COMPLETED', totalAmount: '45000.00', orderedAt: '2026-10-30T00:00:00Z', items: [] };
function mount(element: ReactNode) {
  return render(<MemoryRouter><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{element}</QueryClientProvider></MemoryRouter>);
}

it('requires verified funds before collecting an existing room charge', async () => {
  const request = vi.spyOn(api, 'request').mockResolvedValue(order);
  mount(<ServiceOrderActions order={order} />);
  expect(screen.queryByRole('button', { name: /Hoàn thành/ })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Thu tiền ngay' }));
  const save = screen.getByRole('button', { name: 'Lưu thanh toán' }) as HTMLButtonElement;
  expect(save.disabled).toBe(true);
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(save);
  await waitFor(() => expect(request).toHaveBeenCalledWith('/service-orders/order-1/settle', { method: 'PATCH', body: { settlement: 'CASH', paymentVerified: true, expectedAmount: '45000.00' } }));
});

it('requires a full refund confirmation before cancelling a paid order', async () => {
  const request = vi.spyOn(api, 'request').mockResolvedValue({ ...order, status: 'CANCELLED' });
  mount(<ServiceOrderActions order={{ ...order, paymentMethod: 'BANK_TRANSFER', paidAt: '2026-10-30T00:00:00Z' }} />);
  expect(screen.queryByRole('button', { name: 'Thu tiền ngay' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Hủy & hoàn tiền' }));
  const save = screen.getByRole('button', { name: 'Xác nhận đã hoàn tiền & hủy' }) as HTMLButtonElement;
  expect(save.disabled).toBe(true);
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(save);
  await waitFor(() => expect(request).toHaveBeenCalledWith('/service-orders/order-1/cancel', { method: 'PATCH', body: { refundConfirmed: true } }));
});

it.each(['CASH', 'BANK_TRANSFER'])('records %s with the current total and retries with the same request id', async settlement => {
  let posts = 0;
  const request = vi.spyOn(api, 'request').mockImplementation(async (path, options) => {
    if (path.endsWith('/payos/sync')) return { paid: true, closed: false };
    if (path.endsWith('/payos')) return { paid: false, checkoutUrl: 'https://pay.payos.vn/web/test', qrCode: 'payload' };
    if (options?.method === 'POST') {
      posts++;
      if (posts === 1) throw new Error('Mất kết nối');
      return settlement === 'CASH' ? order : { ...order, status: 'PENDING', orderedAt: new Date().toISOString() };
    }
    if (path.startsWith('/services?')) return { data: [{ id: 'coffee', name: 'Cà phê', currentPrice: '45000.00', isActive: true }], meta: { page: 1, pageSize: 100, total: 1, totalPages: 1 } };
    return { data: [{ id: 'booking-1', roomNumber: '101', reference: 'BK-1', customer: { fullName: 'Khách A' } }], meta: { page: 1, pageSize: 100, total: 1, totalPages: 1 } };
  });
  const created = vi.fn();
  mount(<CreateServiceOrder onClose={vi.fn()} onCreated={created} />);
  fireEvent.click(await screen.findByRole('button', { name: /Thêm vào đơn/ }));
  fireEvent.change(screen.getByRole('combobox', { name: 'Phòng nhận dịch vụ' }), { target: { value: 'booking-1' } });
  fireEvent.change(screen.getByRole('combobox', { name: 'Cách thanh toán' }), { target: { value: settlement } });
  fireEvent.click(screen.getByTitle('Tăng 1'));
  expect(screen.queryByRole('checkbox')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: settlement === 'CASH' ? /Tạo đơn ·/ : /^Thanh toán ·/ }));
  await screen.findByText('Mất kết nối');
  fireEvent.click(screen.getByRole('button', { name: settlement === 'CASH' ? /Tạo đơn ·/ : /^Thanh toán ·/ }));
  await waitFor(() => expect(created).toHaveBeenCalledTimes(1));
  const calls = request.mock.calls.filter(([path]) => path === '/service-orders');
  expect(calls).toHaveLength(2);
  expect(calls[0][1]?.body).toEqual(calls[1][1]?.body);
  expect(calls[0][1]?.body).toMatchObject({ expectedAmount: '90000.00', requestId: expect.any(String), ...(settlement === 'CASH' ? { settlement, paymentVerified: true } : { requestedPaymentMethod: settlement }) });
  if (settlement === 'BANK_TRANSFER') {
    expect(calls[0][1]?.body).not.toHaveProperty('paymentVerified');
    expect(request).toHaveBeenCalledWith('/service-orders/order-1/payos', { method: 'POST' });
  }
});


it('creates a payOS QR and waits for gateway verification without manual collection', async () => {
  const request = vi.spyOn(api, 'request').mockImplementation(async path => {
    if (path.endsWith('/payos/sync')) return { paid: false, closed: false };
    return { paid: false, checkoutUrl: 'https://pay.payos.vn/web/test', qrCode: 'payos-qr-payload' };
  });
  mount(<ServiceOrderActions order={order} />);
  fireEvent.click(screen.getByRole('button', { name: 'Thu tiền ngay' }));
  fireEvent.change(screen.getByRole('combobox', { name: 'Cách thanh toán' }), { target: { value: 'BANK_TRANSFER' } });
  expect(await screen.findByRole('link', { name: 'Mở trang thanh toán payOS' })).toBeTruthy();
  expect(request).toHaveBeenCalledWith('/service-orders/order-1/payos', { method: 'POST' });
  expect(screen.queryByRole('checkbox')).toBeNull();
  expect((screen.getByRole('button', { name: 'Lưu thanh toán' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByRole('combobox', { name: 'Cách thanh toán' }), { target: { value: 'CASH' } });
  expect(screen.queryByRole('region', { name: 'QR thanh toán payOS' })).toBeNull();
});

it('closes the payment dialog after payOS confirms funds', async () => {
  vi.spyOn(api, 'request').mockImplementation(async path => path.endsWith('/payos/sync') ? { paid: true, closed: false } : { paid: false, checkoutUrl: 'https://pay.payos.vn/web/test', qrCode: 'payload' });
  mount(<ServiceOrderActions order={order} />);
  fireEvent.click(screen.getByRole('button', { name: 'Thu tiền ngay' }));
  fireEvent.change(screen.getByRole('combobox', { name: 'Cách thanh toán' }), { target: { value: 'BANK_TRANSFER' } });
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
});


it('collects cash and records delivery with one click', async () => {
  const request = vi.spyOn(api, 'request').mockResolvedValue(order);
  mount(<ServiceOrderActions order={{ ...order, requestedPaymentMethod: 'CASH' }} />);
  expect(screen.queryByText('Chờ thu tiền mặt')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Nhận tiền và hoàn tất' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  await waitFor(() => expect(request).toHaveBeenCalledWith('/service-orders/order-1/collect-and-deliver', { method: 'PATCH', body: { settlement: 'CASH', paymentVerified: true, expectedAmount: '45000.00' } }));
});

it('keeps paid guest services actionable until delivery is confirmed', async () => {
  const request = vi.spyOn(api, 'request').mockResolvedValue(order);
  mount(<ServiceOrderActions order={{ ...order, requestedPaymentMethod: 'BANK_TRANSFER', paymentMethod: 'BANK_TRANSFER', paidAt: '2026-11-03T01:00:00Z' }} />);
  expect(screen.getAllByRole('button')).toHaveLength(1);
  expect(screen.queryByRole('button', { name: 'Thu tiền ngay' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Đã giao' }));
  await waitFor(() => expect(request).toHaveBeenCalledWith('/service-orders/order-1/deliver', { method: 'PATCH' }));
});


it('never opens a payment dialog for guest transfer requests awaiting payOS', async () => {
  vi.spyOn(api, 'request').mockResolvedValue({ paid: false });
  mount(<ServiceOrderActions order={{ ...order, status: 'PENDING', requestedPaymentMethod: 'BANK_TRANSFER', payosStatus: 'PENDING' }} />);
  expect(screen.getByText('Chờ khách thanh toán chuyển khoản')).toBeTruthy();
  expect(screen.queryByRole('button')).toBeNull();
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.queryByRole('combobox')).toBeNull();
});


it('closes an unpaid QR and preserves the cart when changing to cash', async () => {
  const request = vi.spyOn(api, 'request').mockImplementation(async (path, options) => {
    if (path.endsWith('/payos/cancel')) return { paid: false, closed: true };
    if (path.endsWith('/payos/sync')) return { paid: false, closed: false };
    if (path.endsWith('/payos')) return { paid: false, checkoutUrl: 'https://pay.payos.vn/web/test', qrCode: 'payload' };
    if (path.endsWith('/cancel')) return { ...order, status: 'CANCELLED' };
    if (path === '/service-orders' && options?.method === 'POST') {
      return { ...order, status: 'PENDING', orderedAt: new Date().toISOString() };
    }
    if (path.startsWith('/services?')) return { data: [{ id: 'coffee', name: 'Cà phê', currentPrice: '45000.00', isActive: true }], meta: { page: 1, pageSize: 100, total: 1, totalPages: 1 } };
    return { data: [{ id: 'booking-1', roomNumber: '101', reference: 'BK-1' }], meta: { page: 1, pageSize: 100, total: 1, totalPages: 1 } };
  });
  const created = vi.fn();
  const close = vi.fn();
  mount(<CreateServiceOrder onClose={close} onCreated={created} />);
  fireEvent.click(await screen.findByRole('button', { name: /Thêm vào đơn/ }));
  fireEvent.change(screen.getByRole('combobox', { name: 'Phòng nhận dịch vụ' }), { target: { value: 'booking-1' } });
  fireEvent.change(screen.getByRole('combobox', { name: 'Cách thanh toán' }), { target: { value: 'BANK_TRANSFER' } });
  expect(screen.getByRole('dialog', { name: 'Thêm đơn dịch vụ phòng' })).toBeTruthy();
  expect(close).not.toHaveBeenCalled();
  expect(request.mock.calls.some(([path]) => path === '/service-orders')).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: /^Thanh toán ·/ }));
  await screen.findByRole('link', { name: 'Mở trang thanh toán payOS' });
  fireEvent.click(screen.getByRole('button', { name: 'Đổi cách thanh toán' }));
  const method = await screen.findByRole<HTMLSelectElement>('combobox', { name: 'Cách thanh toán' });
  expect(method.value).toBe('CASH');
  expect(request).toHaveBeenCalledWith('/service-orders/order-1/payos/cancel', { method: 'POST' });
  expect(request).toHaveBeenCalledWith('/service-orders/order-1/cancel', { method: 'PATCH', body: {} });
  expect(created).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: /Đã thu tiền · Tạo đơn/ }));
  await waitFor(() => expect(created).toHaveBeenCalledOnce());
  const orders = request.mock.calls.filter(([path]) => path === '/service-orders').map(([, options]) => options?.body as { requestId: string; items: unknown });
  expect(orders[1].items).toEqual(orders[0].items);
  expect(orders[1].requestId).not.toBe(orders[0].requestId);
});
