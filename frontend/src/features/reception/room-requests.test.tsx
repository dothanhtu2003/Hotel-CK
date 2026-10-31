import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { api } from '../../lib/api';
import { RoomRequestsDrawer, useRoomRequests } from './room-requests';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('combines service and checkout requests in the existing room notification drawer', async () => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value() { this.setAttribute('open', ''); } });
  vi.spyOn(api, 'request').mockImplementation(async path => {
    if (path === '/bookings/checkout-requests') return [{ id: 'b1', reference: 'BK-001', roomNumber: '106', customerName: 'Khách A', checkoutRequestedAt: '2026-10-31T03:00:00Z' }];
    return { data: [{ id: 'o1', reference: 'DV-001', roomNumber: '106', customerName: 'Khách A', orderedAt: '2026-10-31T02:00:00Z', canProcess: false, items: [{ id: 'item', serviceName: 'Nước uống', quantity: 1, unitPrice: '10000', subtotal: '10000' }], totalAmount: '10000' }], meta: { totalPages: 1 } };
  });
  function Requests() {
    const query = useRoomRequests();
    return query.data ? <RoomRequestsDrawer roomNumber="106" orders={query.data} onClose={() => {}} /> : null;
  }
  render(<MemoryRouter initialEntries={['/reception']}><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><Requests /></QueryClientProvider></MemoryRouter>);
  expect(await screen.findByText('2 yêu cầu chờ xử lý')).toBeTruthy();
  expect(screen.getByText('Yêu cầu trả phòng')).toBeTruthy();
  expect(screen.getByText('Nước uống')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Xử lý trả phòng' }).getAttribute('href')).toBe('/reception/bookings/b1/billing');
});
