import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Outlet } from 'react-router';
import { App } from './app';
import { AuthProvider } from './features/auth/auth-provider';
import { api } from './lib/api';

vi.mock('./layouts/public-layout', () => ({ PublicLayout: () => <Outlet /> }));
vi.mock('./layouts/workspace-layout', () => ({ WorkspaceLayout: () => <Outlet /> }));
vi.mock('./pages/home-page', () => ({ HomePage: () => <p>Public home</p> }));
vi.mock('./pages/front-desk-pages', () => ({ ReceptionDashboard: () => <p>Staff workspace</p> }));
vi.mock('./pages/housekeeping-pages', () => ({ HousekeepingDashboard: () => <p>Staff workspace</p> }));

afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); });

it.each([
  ['RECEPTIONIST', '/reception'],
  ['ADMIN', '/admin'],
  ['HOUSEKEEPING', '/housekeeping'],
  ['GUEST', '/'],
  [null, '/'],
])('opens the correct home after restoring a %s session', async (role, destination) => {
  window.history.replaceState(null, '', '/');
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  if (role) localStorage.setItem('an-nhien.auth-session', JSON.stringify({ accessToken: 'saved-token', expiresAt: Date.now() + 60000 }));
  vi.spyOn(api, 'request').mockResolvedValue({
    id: '00000000-0000-4000-8000-000000000001', fullName: 'Test',
    email: 'test@example.com', phone: null, role, status: 'ACTIVE', createdAt: '', updatedAt: '',
  });
  render(<QueryClientProvider client={new QueryClient()}><AuthProvider><App /></AuthProvider></QueryClientProvider>);
  const staff = role && role !== 'GUEST';
  if (staff) expect(screen.queryByText('Public home')).toBeNull();
  expect(await screen.findByText(staff ? 'Staff workspace' : 'Public home')).toBeTruthy();
  expect(window.location.pathname).toBe(destination);
  if (staff) expect(screen.queryByText('Public home')).toBeNull();
});
