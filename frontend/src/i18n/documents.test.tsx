import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import { changeLanguage, t } from './index';
import { buildRevenueCsv, type RevenueReceipt } from './revenue';
import { api } from '../lib/api';
import { InvoicePage } from '../pages/billing-pages';
import { ReceptionInvoicePage } from '../pages/reception-billing-pages';
import { ReceptionOrderDetailPage } from '../pages/reception-service-pages';
import type { Booking, Invoice, Order } from '../features/guest/contracts';
import { AuthContext } from '../features/auth/auth-context';
import type { User } from '../features/auth/contracts';
import { ToastProvider } from '../components/toast-provider';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const booking: Booking = { id: 'booking', reference: 'BK-ORIGINAL', roomId: 'room', roomNumber: '101', checkIn: '2026-11-17', checkOut: '2026-11-18', nights: 1, guestCount: 1, status: 'CHECKED_OUT', nightlyPrice: '1000.25', totalRoomAmount: '1000.25' };
const invoice: Invoice = { id: 'invoice', bookingId: booking.id, booking, roomAmount: '1000.25', serviceAmount: '50.50', totalAmount: '1050.75', paidAmount: '1050.75', balance: '0.00', status: 'PAID', issuedAt: '2026-11-18T01:00:00Z', payments: [{ id: 'receipt', amount: '1050.75', method: 'CASH', status: 'COMPLETED', paidAt: '2026-11-18T01:00:00Z' }] };
const order: Order = { id: 'order', bookingId: booking.id, status: 'COMPLETED', totalAmount: '50.50', orderedAt: '2026-11-18T01:00:00Z', deliveredAt: '2026-11-18T01:00:00Z', paymentMethod: 'CASH', paidAt: '2026-11-18T01:00:00Z', items: [{ id: 'item', serviceId: 'coffee', serviceName: 'Cà phê', quantity: 1, unitPrice: '50.50', subtotal: '50.50' }] };

for (const view of ['guestInvoice', 'receptionInvoice', 'serviceTicket'] as const) it(`${view} prints in the current language without changing financial data`, async () => {
  const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
  vi.spyOn(api, 'request').mockImplementation(async path => {
    if (path.includes('billing-preview')) return { booking, completedOrders: [order], roomAmount: invoice.roomAmount, serviceAmount: invoice.serviceAmount, totalAmount: invoice.totalAmount, pendingOrderCount: 0 };
    if (path.startsWith('/front-desk/bookings/')) return { ...booking, customer: { fullName: 'Original Guest', email: null, phone: null } };
    if (path.startsWith('/service-orders/')) return order;
    return invoice;
  });
  const ui = view === 'guestInvoice' ? <InvoicePage /> : view === 'receptionInvoice' ? <ReceptionInvoicePage /> : <ReceptionOrderDetailPage />;
  const path = view === 'serviceTicket' ? '/reception/service-orders/order' : view === 'guestInvoice' ? '/guest/invoices/invoice' : '/reception/invoices/invoice';
  const route = view === 'serviceTicket' ? '/reception/service-orders/:id' : view === 'guestInvoice' ? '/guest/invoices/:id' : '/reception/invoices/:id';
  render(<MemoryRouter initialEntries={[path]}><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><AuthContext.Provider value={{ user: { id: 'staff', role: 'ADMIN' } as User, notice: null, login: vi.fn(), logout: vi.fn(), updateUser: vi.fn() }}><ToastProvider><Routes><Route path={route} element={ui} /></Routes></ToastProvider></AuthContext.Provider></QueryClientProvider></MemoryRouter>);
  const viName = view === 'serviceTicket' ? 'In phiếu dịch vụ phòng (Ticket)' : 'In hóa đơn';
  const initial = await screen.findByRole('button', { name: viName });
  await act(() => changeLanguage('en'));
  const english = screen.getByRole('button', { name: view === 'serviceTicket' ? 'Print room service ticket' : 'Print invoice' });
  expect(english).toBe(initial); fireEvent.click(english); expect(print).toHaveBeenCalledTimes(1);
  expect(screen.queryByText(/\b(?:guest|reception|common):[a-z]/)).toBeNull();
  expect(invoice.totalAmount).toBe('1050.75'); expect(order.totalAmount).toBe('50.50');
  await act(() => changeLanguage('vi'));
  fireEvent.click(screen.getByRole('button', { name: viName })); expect(print).toHaveBeenCalledTimes(2);
});

it('exports translated CSV while preserving exact numbers and formula escaping', async () => {
  const row: RevenueReceipt = { id: 'r', bookingId: 'b', reference: 'BK-UNCHANGED', room: '101', guestId: 'g', guest: '=1+1', date: '2026-11-18T01:00:00Z', amount: '-1050.75', roomAmount: '1000.25', serviceAmount: '50.50', method: 'BANK_TRANSFER', sourceCode: 'PAYOS_INVOICE', source: 'payOS · Hóa đơn', collector: null, refund: true };
  const viCsv = buildRevenueCsv([row]); expect(viCsv).toContain('"Mã booking"'); expect(viCsv).toContain('"Chuyển khoản"');
  await changeLanguage('en');
  const enCsv = buildRevenueCsv([row]); expect(enCsv).toContain('"Reservation code"'); expect(enCsv).toContain('"Bank transfer"'); expect(enCsv).toContain('"payOS · Invoice"');
  expect(enCsv).toContain('"\'=1+1"');
  expect(enCsv.split('\r\n')[1].endsWith(',1000.25,50.50,-1050.75')).toBe(true);
  expect(viCsv.split('\r\n')[1].endsWith(',1000.25,50.50,-1050.75')).toBe(true);
});

it('pluralizes independent counts within complete English messages', async () => {
  await changeLanguage('en');
  expect(t('guest:bookingPages.valueNightsValueGuests', { value0: 1, value1: 2 })).toBe('1 night · 2 guests');
  expect(t('guest:bookingPages.valueNightsValueGuests', { value0: 2, value1: 1 })).toBe('2 nights · 1 guest');
});
