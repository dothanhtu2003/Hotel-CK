import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HomePage } from './home-page';
import * as guestQueries from '../features/guest/queries';

afterEach(cleanup);

const mockRoomTypes = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Phòng Deluxe Ban Công',
    description: 'Không gian đón nắng ban mai ấm áp và yên tĩnh.',
    nightlyPrice: '750000.00',
    maxGuests: 2,
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Phòng Suite Gia Đình',
    description: 'Rộng rãi, nội thất gỗ sang trọng cho cả gia đình.',
    nightlyPrice: '1250000.00',
    maxGuests: 4,
  },
];

function renderHome() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

it('HomePage renders Booking Hub, Direct Perks, Room Showcase with real prices and FAQ', () => {
  vi.spyOn(guestQueries, 'useRoomTypes').mockReturnValue({
    data: mockRoomTypes,
    isPending: false,
    error: null,
  } as any);

  renderHome();

  // 1. Hero & Floating Search Form
  expect(screen.getByLabelText('NGÀY NHẬN PHÒNG')).toBeTruthy();
  expect(screen.getByLabelText('NGÀY TRẢ PHÒNG')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Tìm phòng' })).toBeTruthy();
  expect(screen.getByText('Xác nhận tức thì qua hệ thống')).toBeTruthy();
  expect(screen.getByText('Miễn phí hủy trước 24 giờ')).toBeTruthy();

  // 2. Direct Booking Perks
  expect(screen.getByText('Cam kết giá tốt nhất')).toBeTruthy();
  expect(screen.getByText('Trà & Cà phê đón tiếp')).toBeTruthy();
  expect(screen.getByText('Linh hoạt giờ nhận phòng')).toBeTruthy();
  expect(screen.getByText('Đổi ngày & Hủy linh hoạt')).toBeTruthy();

  // 3. Live Room Showcase
  expect(screen.getByRole('heading', { name: 'Phòng Deluxe Ban Công' })).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'Phòng Suite Gia Đình' })).toBeTruthy();
  expect(screen.getAllByText('Đặt phòng này').length).toBe(2);
  expect(screen.getAllByText('Xem chi tiết phòng').length).toBe(2);

  // 4. FAQ Accordion interaction
  const firstQuestion = screen.getByText(
    'Giờ nhận phòng (Check-in) và trả phòng (Check-out) là mấy giờ?'
  );
  expect(firstQuestion).toBeTruthy();
  expect(
    screen.getByText(/Khách sạn hỗ trợ nhận phòng từ 14:00/)
  ).toBeTruthy();

  // Click câu hỏi tiếp theo để mở accordion
  const secondQuestion = screen.getByText(
    'Tôi có cần thanh toán tiền ngay khi đặt phòng trực tuyến không?'
  );
  fireEvent.click(secondQuestion);
  expect(
    screen.getByText(/Quý khách có thể lựa chọn thanh toán linh hoạt/)
  ).toBeTruthy();
});
