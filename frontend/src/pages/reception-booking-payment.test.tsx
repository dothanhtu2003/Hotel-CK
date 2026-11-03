import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { ReceptionBookingDetailPage } from './reception-booking-pages';

const mocks = vi.hoisted(() => ({ useDeskGet: vi.fn(), useDeskInvoice: vi.fn() }));
vi.mock('../features/reception/queries', () => ({ ...mocks, useDeskBase: () => '/reception' }));
vi.mock('../features/reception/check-in', () => ({ CheckInWizard: () => null }));
vi.mock('../features/reception/components', () => ({ DeskAction: () => null }));
const booking = { id: 'b1', reference: 'CK-0004', status: 'CHECKED_IN', roomNumber: '106', nights: 1, guestCount: 2,
  checkIn: '2026-11-03', checkOut: '2026-11-04', nightlyPrice: '5000.00', totalRoomAmount: '5000.00', customer: { fullName: 'Khách test' } };
const preview = { booking, serviceAmount: '0.00', totalAmount: '5000.00', paidAmount: '5000.00', balance: '0.00',
  roomPayments: [{ id: 'p1', amount: '5000.00', paidAt: '2026-11-03T03:57:00Z' }] };
afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); });
function show(options: { serviceAmount?: string; balance?: string; invoice?: object; status?: string; error?: Error } = {}) {
  const b = { ...booking, status: options.status ?? booking.status };
  mocks.useDeskGet.mockImplementation((path: string) => ({ data: path.endsWith('/billing-preview')
    ? { ...preview, serviceAmount: options.serviceAmount ?? '0.00', totalAmount: options.serviceAmount ? '7000.00' : '5000.00', balance: options.balance ?? '0.00' }
    : path.includes('/orders?') ? { data: [], meta: { total: 0 } } : b,
    error: path.endsWith('/billing-preview') ? options.error : null, isPending: false, refetch: vi.fn(),
  }));
  mocks.useDeskInvoice.mockReturnValue({ data: options.invoice ?? null, isPending: false, error: null, refetch: vi.fn() });
  render(<MemoryRouter initialEntries={['/reception/bookings/b1']}><Routes><Route path="/reception/bookings/:id" element={<ReceptionBookingDetailPage />} /></Routes></MemoryRouter>);
}
it('subtracts the payOS prepayment before issuing an invoice', () => {
  show();
  expect(screen.getByText('ĐÃ THANH TOÁN ĐỦ CHI PHÍ HIỆN TẠI:')).toBeTruthy();
  expect(screen.getByLabelText('Biên nhận payOS').textContent).toContain('5.000 ₫');
  expect(screen.getByText('0 ₫', { selector: '.font-extrabold' })).toBeTruthy();
  expect(screen.getByRole('link', { name: /Trả phòng & Chốt hóa đơn · Không thu thêm/ })).toBeTruthy();
  expect(screen.queryByRole('link', { name: /Thu tiền.*5.000/ })).toBeNull();
});
it('asks only for extra service charges after room prepayment', () => {
  show({ serviceAmount: '2000.00', balance: '2000.00' });
  expect(screen.getByRole('link', { name: 'Trả phòng & Thu phần còn lại (2.000 ₫)' })).toBeTruthy();
});
it('uses the issued invoice balance after additional receipts', () => {
  show({ serviceAmount: '2000.00', balance: '2000.00', invoice: { balance: '0.00', paidAmount: '7000.00' } });
  expect(screen.getByText(/Đã thu.*7.000 ₫/)).toBeTruthy();
  expect(screen.getByRole('link', { name: /Không thu thêm/ })).toBeTruthy();
});
it('shows payment information before check-in too', () => {
  show({ status: 'CONFIRMED' });
  expect(screen.getByLabelText('Thanh toán tiền phòng').textContent).toContain('Đã thanh toán qua payOS');
  expect(screen.getByLabelText('Thanh toán tiền phòng').textContent).toContain('0 ₫');
});
it('does not suggest collection when financial data cannot be loaded', () => {
  show({ error: new Error('offline') });
  expect(screen.getByText('Chưa tải được thông tin thanh toán.')).toBeTruthy();
  expect(screen.queryByRole('link', { name: /Thu phần còn lại/ })).toBeNull();
});
