import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ServicesPage, MyServiceOrdersPage } from './service-pages';
import { AuthContext } from '../features/auth/auth-context';
import { ToastContext } from '../components/toast-context';
import { api } from '../lib/api';
import { ApiError } from '../lib/api-client';
import type { Booking, Order, Page, Service } from '../features/guest/contracts';

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
  id: 'b-checkedin',
  reference: 'CK-STAY-01',
  roomId: 'r-101',
  roomNumber: '302',
  checkIn: '2026-11-01',
  checkOut: '2026-11-03',
  nights: 2,
  guestCount: 2,
  nightlyPrice: '1000000.00',
  totalRoomAmount: '2000000.00',
  status: 'CHECKED_IN',
};

const mockServices: Service[] = [
  {
    id: 's-coffee',
    name: 'Cà phê Phin An Nhiên',
    description: 'Cà phê Robusta & Arabica nguyên chất thơm đậm đà.',
    currentPrice: '45000.00',
    isActive: true,
  },
  {
    id: 's-breakfast',
    name: 'Bữa sáng kiểu Âu',
    description: 'Bánh sừng bò, mứt dâu tây, trứng ốp la và nước ép.',
    currentPrice: '120000.00',
    isActive: true,
  },
];

const mockOrder: Order = {
  id: 'order-12345678-abcd',
  bookingId: 'b-checkedin',
  status: 'PENDING',
  totalAmount: '165000.00',
  orderedAt: '2026-11-02T08:00:00Z',
  items: [
    {
      id: 'item-1',
      serviceId: 's-coffee',
      serviceName: 'Cà phê Phin An Nhiên',
      quantity: 1,
      unitPrice: '45000.00',
      subtotal: '45000.00',
    },
    {
      id: 'item-2',
      serviceId: 's-breakfast',
      serviceName: 'Bữa sáng kiểu Âu',
      quantity: 1,
      unitPrice: '120000.00',
      subtotal: '120000.00',
    },
  ],
};

function renderServices(ui: React.ReactNode) {
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
              fullName: 'Khách Thử Nghiệm',
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
          <MemoryRouter>{ui}</MemoryRouter>
        </AuthContext.Provider>
      </QueryClientProvider>
    </ToastContext.Provider>
  );
}

it('ServicesPage renders room service catalog, allows stepper increment, and enables review button', async () => {
  // Mock stays, services, and invoice check
  vi.spyOn(api, 'request').mockImplementation((path: string) => {
    if (path.includes('/bookings/my?status=CHECKED_IN')) {
      return Promise.resolve({ data: [mockBooking], meta: { page: 1, pageSize: 100, total: 1, totalPages: 1 } });
    }
    if (path.includes('/services')) {
      return Promise.resolve({ data: mockServices, meta: { page: 1, pageSize: 100, total: 2, totalPages: 1 } });
    }
    if (path.includes('/invoice')) {
      return Promise.reject(new ApiError(404, 'Not found'));
    }
    return Promise.resolve({ data: [], meta: { page: 1, pageSize: 10, total: 0, totalPages: 1 } });
  });

  renderServices(<ServicesPage />);

  // Service item titles
  expect(await screen.findByText('Cà phê Phin An Nhiên')).toBeTruthy();
  expect(screen.getByText('Bữa sáng kiểu Âu')).toBeTruthy();
  expect(screen.getAllByText('45.000 ₫').length).toBeGreaterThanOrEqual(1);

  // Review button starts disabled
  const reviewBtn = screen.getByRole('button', { name: 'Xem lại đơn dịch vụ' });
  expect(reviewBtn.hasAttribute('disabled')).toBe(true);

  // Stepper increment coffee quantity
  const increaseCoffee = await screen.findByRole('button', { name: 'Tăng số lượng Cà phê Phin An Nhiên' });
  fireEvent.click(increaseCoffee);

  // Cart summary updates
  expect(screen.getByText(/Đã chọn:/)).toBeTruthy();
  expect(screen.getAllByText('45.000 ₫').length).toBeGreaterThanOrEqual(2);
  await waitFor(() => expect(reviewBtn.hasAttribute('disabled')).toBe(false));

  // Open review dialog
  fireEvent.click(reviewBtn);
  expect(screen.getByText('Xác nhận đơn dịch vụ')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Xác nhận đặt dịch vụ' })).toBeTruthy();
});

it('MyServiceOrdersPage renders order cards with clean heading, items breakdown and cancel button for pending orders', async () => {
  const ordersPage: Page<Order> = {
    data: [mockOrder],
    meta: { page: 1, pageSize: 6, total: 1, totalPages: 1 },
  };

  vi.spyOn(api, 'request').mockImplementation((path: string) => {
    if (path.includes('/invoice')) {
      return Promise.reject(new ApiError(404, 'Not found'));
    }
    if (path.includes('/service-orders/my')) {
      return Promise.resolve(ordersPage);
    }
    if (path.includes('/bookings/')) {
      return Promise.resolve(mockBooking);
    }
    return Promise.resolve(ordersPage);
  });

  renderServices(<MyServiceOrdersPage />);

  // Heading matching E2E expectation: Đơn {o.id.slice(0, 8)}
  expect(await screen.findByRole('heading', { name: 'Đơn order-12' })).toBeTruthy();
  expect(screen.getByText(/Cà phê Phin An Nhiên × 1/)).toBeTruthy();
  expect(screen.getByText(/Bữa sáng kiểu Âu × 1/)).toBeTruthy();
  expect(screen.getByText('165.000 ₫')).toBeTruthy();
  expect(await screen.findByRole('button', { name: 'Hủy đơn dịch vụ' })).toBeTruthy();
});
