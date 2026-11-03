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

it('rechecks funds after quantity changes and retries creation with the same request id', async () => {
  let posts = 0;
  const request = vi.spyOn(api, 'request').mockImplementation(async (path, options) => {
    if (options?.method === 'POST') {
      posts++;
      if (posts === 1) throw new Error('Mất kết nối');
      return order;
    }
    if (path.startsWith('/services?')) return { data: [{ id: 'coffee', name: 'Cà phê', currentPrice: '45000.00', isActive: true }], meta: { page: 1, pageSize: 100, total: 1, totalPages: 1 } };
    return { data: [{ id: 'booking-1', roomNumber: '101', reference: 'BK-1', customer: { fullName: 'Khách A' } }], meta: { page: 1, pageSize: 100, total: 1, totalPages: 1 } };
  });
  const created = vi.fn();
  mount(<CreateServiceOrder onClose={vi.fn()} onCreated={created} />);
  fireEvent.click(await screen.findByRole('button', { name: /Thêm vào đơn/ }));
  fireEvent.change(screen.getByRole('combobox', { name: 'Phòng nhận dịch vụ' }), { target: { value: 'booking-1' } });
  fireEvent.change(screen.getByRole('combobox', { name: 'Cách thanh toán' }), { target: { value: 'CASH' } });
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByTitle('Tăng 1'));
  expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(false);
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: /Tạo đơn ·/ }));
  await screen.findByText('Mất kết nối');
  fireEvent.click(screen.getByRole('button', { name: /Tạo đơn ·/ }));
  await waitFor(() => expect(created).toHaveBeenCalledTimes(1));
  const calls = request.mock.calls.filter(([, options]) => options?.method === 'POST');
  expect(calls).toHaveLength(2);
  expect(calls[0][1]?.body).toEqual(calls[1][1]?.body);
  expect(calls[0][1]?.body).toMatchObject({ settlement: 'CASH', expectedAmount: '90000.00', paymentVerified: true, requestId: expect.any(String) });
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
  fireEvent.click(screen.getByRole('button', { name: 'Nhận tiền và giao hàng' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  await waitFor(() => expect(request).toHaveBeenCalledWith('/service-orders/order-1/collect-and-deliver', { method: 'PATCH', body: { settlement: 'CASH', paymentVerified: true, expectedAmount: '45000.00' } }));
});

it('keeps paid guest services actionable until delivery is confirmed', async () => {
  const request = vi.spyOn(api, 'request').mockResolvedValue(order);
  mount(<ServiceOrderActions order={{ ...order, requestedPaymentMethod: 'BANK_TRANSFER', paymentMethod: 'BANK_TRANSFER', paidAt: '2026-11-03T01:00:00Z' }} />);
  expect(screen.getByText('Cần giao dịch vụ cho khách')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Thu tiền ngay' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Giao hàng' }));
  await waitFor(() => expect(request).toHaveBeenCalledWith('/service-orders/order-1/deliver', { method: 'PATCH' }));
});
