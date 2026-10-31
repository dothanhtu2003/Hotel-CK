import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { GuestPortalLayout } from './guest-portal-layout';
import { AuthContext } from '../features/auth/auth-context';
import { ToastContext } from '../components/toast-context';
import type { User } from '../features/auth/contracts';

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.open = true;
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.open = false;
  });
});

afterEach(cleanup);

const mockGuest: User = {
  id: '00000000-0000-4000-8000-000000000002',
  fullName: 'Trần Khách Hàng',
  email: 'guest@an-nhien.invalid',
  phone: '0901234567',
  role: 'GUEST',
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

function renderWithGuest(user: User | null = mockGuest, initialPath = '/guest/bookings') {
  return render(
    <ToastContext.Provider value={vi.fn()}>
      <AuthContext.Provider
        value={{
          user,
          notice: null,
          login: vi.fn(),
          logout: vi.fn(),
          updateUser: vi.fn().mockReturnValue(true),
        }}
      >
        <MemoryRouter initialEntries={[initialPath]}>
          <Routes>
            <Route path="/guest" element={<GuestPortalLayout />}>
              <Route path="bookings" element={<div>Trang kỳ nghỉ của tôi</div>} />
              <Route path="services" element={<div>Trang dịch vụ phòng</div>} />
              <Route path="billing" element={<div>Trang hóa đơn</div>} />
              <Route path="profile" element={<div>Trang hồ sơ cá nhân</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </ToastContext.Provider>
  );
}

it('GuestPortalLayout renders hospitable guest navigation and brand without admin sidebar', () => {
  renderWithGuest();

  // Branding & guest badge
  expect(screen.getAllByText('AN NHIÊN').length).toBeGreaterThanOrEqual(1);
  expect(screen.getByText('Không gian khách lưu trú')).toBeTruthy();

  // Hospitable Guest Navigation (present across desktop, drawer and bottom bar)
  expect(screen.getAllByText('Kỳ nghỉ của tôi').length).toBeGreaterThanOrEqual(1);
  expect(screen.getAllByText('Dịch vụ phòng').length).toBeGreaterThanOrEqual(1);
  expect(screen.getAllByText('Chi phí & Hóa đơn').length).toBeGreaterThanOrEqual(1);
  expect(screen.getAllByText('Hồ sơ cá nhân').length).toBeGreaterThanOrEqual(1);

  // Quick Action
  expect(screen.getByText('Đặt thêm phòng')).toBeTruthy();

  // Greeting & Name
  expect(screen.getAllByText('Trần Khách Hàng').length).toBeGreaterThanOrEqual(1);
  expect(screen.getAllByText('T').length).toBeGreaterThanOrEqual(1); // Avatar initial

  // Content outlet
  expect(screen.getByText('Trang kỳ nghỉ của tôi')).toBeTruthy();

  // Ensure no reception/admin operational terminology exists in this layout
  expect(screen.queryByText('VẬN HÀNH (FRONT DESK)')).toBeNull();
  expect(screen.queryByText('TÀI CHÍNH & THU NGÂN')).toBeNull();
  expect(screen.queryByText('Tape Chart')).toBeNull();
});

it('opens logout confirmation dialog when clicking the logout action', () => {
  renderWithGuest();

  const logoutBtn = screen.getByTitle('Đăng xuất');
  fireEvent.click(logoutBtn);

  expect(screen.getByText('Đăng xuất tài khoản?')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Xác nhận đăng xuất' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Ở lại' })).toBeTruthy();
});
