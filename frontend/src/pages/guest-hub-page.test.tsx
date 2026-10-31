import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GuestHubPage } from './guest-hub-page';
import { AuthContext } from '../features/auth/auth-context';
import type { User } from '../features/auth/contracts';

afterEach(cleanup);

const mockGuest: User = {
  id: '00000000-0000-4000-8000-000000000002',
  fullName: 'Nguyễn An Nhiên',
  email: 'annhien@example.com',
  phone: '0909999999',
  role: 'GUEST',
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

function renderGuestHub() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider
        value={{
          user: mockGuest,
          notice: null,
          login: vi.fn(),
          logout: vi.fn(),
          updateUser: vi.fn().mockReturnValue(true),
        }}
      >
        <MemoryRouter>
          <GuestHubPage />
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>
  );
}

it('GuestHubPage renders personalized hospitality welcome and 3 core pillars', () => {
  renderGuestHub();

  // Welcome greeting
  expect(screen.getByText('Nhiên.')).toBeTruthy();
  expect(screen.getByText('Khám phá phòng nghỉ')).toBeTruthy();
  expect(screen.getByText('Hành trình của tôi')).toBeTruthy();

  // 3 Core Pillars
  expect(screen.getByText('Kỳ nghỉ của tôi')).toBeTruthy();
  expect(screen.getByText('Dịch vụ phòng')).toBeTruthy();
  expect(screen.getByText('Chi phí & Hóa đơn')).toBeTruthy();

  // Hospitality Footer Banner
  expect(screen.getByText('Cần hỗ trợ bất kỳ điều gì trong kỳ nghỉ?')).toBeTruthy();
});
