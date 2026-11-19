import { act, cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { changeLanguage } from './index';
import { catalogDescription, catalogName } from './catalog';
import { BookingQr } from '../features/guest/booking-qr';
import { BookingStatus } from '../features/guest/booking-status';
import type { Booking } from '../features/guest/contracts';
import { api } from '../lib/api';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('switches Guest QR instructions without recreating payment or altering provider data', async () => {
  const request = vi.spyOn(api, 'request').mockImplementation(async path => {
    if (path.endsWith('/payment-state')) return { paid: false, bookingStatus: 'PENDING', holdState: 'ACTIVE', totalAmount: '5000.75' };
    if (path.endsWith('/payos/qr')) return { qrCode: 'PROVIDER-QR', description: 'HOTEL 12345', accountName: 'NGUYEN VAN AN', accountNumber: '0123456', bankBin: '970422', amount: 5000, checkoutUrl: 'https://pay.payos.vn/web/test' };
    return { checked: true };
  });
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(<QueryClientProvider client={cache}><BookingQr bookingId="reservation" /></QueryClientProvider>);
  const image = await screen.findByRole('img', { name: 'Mã VietQR thanh toán tiền phòng qua payOS' });
  const source = image.getAttribute('src');
  await act(() => changeLanguage('en'));
  expect(await screen.findByRole('img', { name: 'VietQR code for room payment through payOS' })).toBe(image);
  expect(image.getAttribute('src')).toBe(source);
  expect(screen.getByText('NGUYEN VAN AN')).toBeTruthy();
  expect(screen.getByText('HOTEL 12345')).toBeTruthy();
  expect(screen.getByText('Open your banking app and scan the QR code')).toBeTruthy();
  expect(request.mock.calls.filter(([path]) => path.endsWith('/payos/qr'))).toHaveLength(1);
  await act(() => changeLanguage('vi'));
  expect(screen.getByRole('img', { name: 'Mã VietQR thanh toán tiền phòng qua payOS' })).toBe(image);
  expect(request.mock.calls.filter(([path]) => path.endsWith('/payos/qr'))).toHaveLength(1);
});

it('translates booking states and retains reservation state', async () => {
  const booking = { status: 'CHECKED_IN', checkIn: '2090-01-01', checkOut: '2090-01-02' } as Booking;
  render(<BookingStatus booking={booking} />);
  expect(screen.getByText('Đang lưu trú')).toBeTruthy();
  await act(() => changeLanguage('en'));
  expect(screen.getByText('In house')).toBeTruthy(); expect(booking.status).toBe('CHECKED_IN');
});

it('translates only the approved catalog and preserves unknown authored content', async () => {
  expect(catalogName('Bữa sáng')).toBe('Bữa sáng');
  await changeLanguage('en');
  expect(catalogName('Bữa sáng')).toBe('Breakfast'); expect(catalogName('Cà phê')).toBe('Coffee');
  expect(catalogDescription('Phòng Standard', 'Standard')).toBe('Standard room');
  expect(catalogDescription('Dịch vụ tại khách sạn', 'Bữa sáng')).toBe('Hotel service');
  expect(catalogName('Standard')).toBe('Standard');
  expect(catalogName('constructor')).toBe('constructor'); expect(catalogName('toString')).toBe('toString');
  expect(catalogName('Deluxe')).toBe('Deluxe'); expect(catalogName('Suite')).toBe('Suite');
  expect(catalogDescription('Dịch vụ tại khách sạn', 'Dịch vụ riêng')).toBe('Dịch vụ tại khách sạn');
  expect(catalogDescription('Phòng Standard', 'Hạng riêng')).toBe('Phòng Standard');
  expect(catalogName('Dịch vụ riêng của cô Mai')).toBe('Dịch vụ riêng của cô Mai');
  expect(catalogDescription('Phòng do chủ khách sạn viết', 'Standard')).toBe('Phòng do chủ khách sạn viết');
});
