import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './auth-provider';
import { useAuth } from './auth-context';
import { api } from '../../lib/api';

const key = 'an-nhien.auth-session';
const user = { id: '00000000-0000-4000-8000-000000000001', fullName: 'Test', email: 'test@example.com', phone: null, role: 'RECEPTIONIST', status: 'ACTIVE', createdAt: '', updatedAt: '' };
function Session() { const auth = useAuth(); return <><p>{auth.user?.fullName ?? 'Signed out'}</p><button onClick={auth.logout}>Logout</button><button onClick={() => void auth.login({ email: 'test@example.com', password: '1' })}>Login</button></>; }
function mount() { return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><AuthProvider><Session /></AuthProvider></QueryClientProvider>); }
afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); });
it('restores a saved token and validates the user before showing the workspace', async () => {
  localStorage.setItem(key, JSON.stringify({ accessToken: 'saved-token', expiresAt: Date.now() + 60000 }));
  const token = vi.spyOn(api, 'setToken');
  const request = vi.spyOn(api, 'request').mockResolvedValue(user);
  mount();
  expect(await screen.findByText('Test')).toBeTruthy();
  expect(token).toHaveBeenCalledWith('saved-token'); expect(request).toHaveBeenCalledWith('/auth/me');
  fireEvent.click(screen.getByText('Logout'));
  expect(localStorage.getItem(key)).toBeNull(); expect(screen.getByText('Signed out')).toBeTruthy();
});
it('discards expired sessions without requesting a profile', async () => {
  localStorage.setItem(key, JSON.stringify({ accessToken: 'expired', expiresAt: Date.now() - 1 }));
  const request = vi.spyOn(api, 'request'); mount();
  expect(await screen.findByText('Signed out')).toBeTruthy(); expect(request).not.toHaveBeenCalled(); expect(localStorage.getItem(key)).toBeNull();
});
it('persists the token after login without persisting the password', async () => {
  vi.spyOn(api, 'request').mockResolvedValueOnce({ accessToken: 'new-token', tokenType: 'Bearer', expiresIn: 900 }).mockResolvedValueOnce(user);
  mount(); fireEvent.click(await screen.findByText('Login'));
  await waitFor(() => expect(screen.getByText('Test')).toBeTruthy());
  const saved = JSON.parse(localStorage.getItem(key)!); expect(saved.accessToken).toBe('new-token'); expect(saved.password).toBeUndefined();
});
