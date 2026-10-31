import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MyBookingsPage, BookingDetailPage } from './booking-pages';
import { InvoicePage } from './billing-pages';
import { AuthContext } from '../features/auth/auth-context';
import { ToastContext } from '../components/toast-context';
import { api } from '../lib/api';
import type { Booking, Invoice, Page } from '../features/guest/contracts';

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.open = true;
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.open = false;
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const mockBooking: Booking = {
  id: 'b-101',
  reference: 'CK-20261101-001',
  roomId: 'r-101',
  roomNumber: '201',
  checkIn: '2026-11-01',
  checkOut: '2026-11-04',
  nights: 3,
  guestCount: 2,
  nightlyPrice: '1500000.00',
  totalRoomAmount: '4500000.00',
  status: 'CONFIRMED',
};

const mockInvoice: Invoice = {
  id: 'inv-8888-9999',
  bookingId: 'b-101',
  status: 'PAID',
  roomAmount: '4500000.00',
  serviceAmount: '300000.00',
  totalAmount: '4800000.00',
  paidAmount: '4800000.00',
  balance: '0.00',
  issuedAt: '2026-11-04T10:00:00Z',
  booking: mockBooking,
  payments: [
    {
      id: 'pay-001',
      amount: '4800000.00',
      method: 'BANK_TRANSFER',
      status: 'SUCCESS',
      paidAt: '2026-11-04T10:05:00Z',
    },
  ],
};

function renderComponent(ui: React.ReactNode, initialPath = '/') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <ToastContext.Provider value={vi.fn()}>
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider
          value={{
            user: {
              id: 'u-1',
              fullName: 'Nguyễn Khách',
              email: 'guest@an-nhien.invalid',
              phone: '0901234567',
              role: 'GUEST',
              status: 'ACTIVE',
              createdAt: '',
              updatedAt: '',
            },
            notice: null,
            login: vi.fn(),
            logout: vi.fn(),
            updateUser: vi.fn().mockReturnValue(true),
          }}
        >
          <MemoryRouter initialEntries={[initialPath]}>{ui}</MemoryRouter>
        </AuthContext.Provider>
      </QueryClientProvider>
    </ToastContext.Provider>
  );
}

it('MyBookingsPage renders stay passes with reference, dates and action button', async () => {
  const pageResult: Page<Booking> = {
    data: [mockBooking],
    meta: { page: 1, pageSize: 6, total: 1, totalPages: 1 },
  };

  vi.spyOn(api, 'request').mockResolvedValueOnce(pageResult);

  renderComponent(<MyBookingsPage />);

  expect(await screen.findByText('CK-20261101-001')).toBeTruthy();
  expect(screen.getByText('Phòng 201')).toBeTruthy();
  expect(screen.getByText('3 đêm nghỉ dưỡng')).toBeTruthy();
  expect(screen.getByText('4.500.000 ₫')).toBeTruthy();
  expect(screen.getByRole('link', { name: /Chi tiết booking/i })).toBeTruthy();
});

it('BookingDetailPage renders stay stepper, exact night/guest text and cancel action for confirmed booking', async () => {
  vi.spyOn(api, 'request').mockResolvedValueOnce(mockBooking).mockResolvedValueOnce({
    booking: mockBooking,
    roomAmount: '4500000.00',
    serviceAmount: '300000.00',
    totalAmount: '4800000.00',
    counterPaidAmount: '100000.00',
    pendingOrderCount: 1,
    completedOrders: [{
      id: 'order-1',
      items: [{ id: 'item-1', serviceName: 'Giặt ủi', quantity: 2, unitPrice: '150000.00', subtotal: '300000.00' }],
    }],
  });

  renderComponent(
    <Routes>
      <Route path="/guest/bookings/:id" element={<BookingDetailPage />} />
    </Routes>,
    '/guest/bookings/b-101'
  );

  const h1 = await screen.findByRole('heading', { level: 1 });
  expect(h1.textContent).toContain('CK-20261101-001');
  // Match E2E expectation
  expect(screen.getByText('3 đêm · 2 khách')).toBeTruthy();
  expect(screen.getByText('Chờ xác nhận')).toBeTruthy();
  expect(screen.getAllByText('Đã xác nhận').length).toBeGreaterThanOrEqual(1);
  expect(screen.getByRole('link', { name: /Xem chi phí & hóa đơn/i })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Hủy booking' })).toBeTruthy();
  expect(await screen.findByText('4.800.000 ₫')).toBeTruthy();
  expect(screen.getByText('Giặt ủi × 2 · 150.000 ₫ / đơn vị')).toBeTruthy();
  expect(screen.getByText('100.000 ₫')).toBeTruthy();
  expect(screen.getByText('1 đơn dịch vụ đang chờ, chưa tính vào tổng tiền.')).toBeTruthy();
});

it('InvoiceView formats clean folio bill without raw UUIDs or unformatted enums', async () => {
  vi.spyOn(api, 'request').mockResolvedValueOnce(mockInvoice);

  renderComponent(
    <Routes>
      <Route path="/guest/invoices/:id" element={<InvoicePage />} />
    </Routes>,
    '/guest/invoices/inv-8888-9999'
  );

  expect(await screen.findByRole('heading', { name: 'Hóa đơn đã phát hành' })).toBeTruthy();
  // Exact 0 d balance match for E2E
  expect(screen.getByText('0 ₫')).toBeTruthy();
  // Clean friendly labels
  expect(screen.getByText('Chuyển khoản')).toBeTruthy();
  expect(screen.getByText('Đã xác nhận')).toBeTruthy();
  // Booking reference link/text
  expect(screen.getByText('Booking CK-20261101-001')).toBeTruthy();
  expect(screen.getAllByText('4.800.000 ₫').length).toBeGreaterThanOrEqual(1);
});
