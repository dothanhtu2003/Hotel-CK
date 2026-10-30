import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { LoadingState } from '../../components/ui';
import { AuthContext } from './auth-context';
import { loginResponseSchema, userSchema, type LoginInput, type User } from './contracts';

const sessionKey = 'an-nhien.auth-session';
function clearSavedSession() { try { localStorage.removeItem(sessionKey); } catch { /* Storage may be disabled. */ } }

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [restoring, setRestoring] = useState(true);
  const generation = useRef(0);
  const currentUserId = useRef<string | null>(null);
  const updateUser = useCallback((profile: User) => {
    if (currentUserId.current !== profile.id) return false;
    setUser(previous => previous?.id === profile.id ? profile : previous); return true;
  }, []);
  const endSession = useCallback((reason: string | null) => {
    clearSavedSession();
    generation.current++; currentUserId.current = null; api.setToken(null); setUser(null); setExpiresAt(null); setNotice(reason);
    void queryClient.cancelQueries(); queryClient.clear();
  }, [queryClient]);
  useEffect(() => {
    api.onUnauthorized(() => endSession('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'));
    return () => api.onUnauthorized(undefined);
  }, [endSession]);
  useEffect(() => {
    let active = true;
    const current = generation.current;
    async function restore() {
      try {
        const saved = localStorage.getItem(sessionKey);
        if (!saved) return;
        const session: unknown = JSON.parse(saved);
        if (!session || typeof session !== 'object' || !('accessToken' in session) || typeof session.accessToken !== 'string' || !session.accessToken || !('expiresAt' in session) || typeof session.expiresAt !== 'number' || !Number.isFinite(session.expiresAt) || session.expiresAt <= Date.now()) {
          clearSavedSession(); return;
        }
        api.setToken(session.accessToken);
        const profile = userSchema.parse(await api.request('/auth/me'));
        if (!active || current !== generation.current) return;
        currentUserId.current = profile.id;
        setUser(profile); setExpiresAt(session.expiresAt);
      } catch {
        if (active && current === generation.current) endSession(null);
      } finally { if (active) setRestoring(false); }
    }
    void restore();
    return () => { active = false; };
  }, [endSession]);
  useEffect(() => {
    if (!expiresAt) return;
    const timer = window.setTimeout(() => endSession('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'), Math.max(0, expiresAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [expiresAt, endSession]);

  async function login(input: LoginInput) {
    const current = ++generation.current;
    const response = loginResponseSchema.parse(await api.request('/auth/login', { method: 'POST', body: { email: input.email, password: input.password }, authenticated: false }));
    if (current !== generation.current) throw new Error('Yêu cầu đăng nhập đã bị hủy.');
    await queryClient.cancelQueries(); queryClient.clear(); api.setToken(response.accessToken);
    try {
      // Role/profile from a fresh backend request, never decoded from the JWT.
      const profile = userSchema.parse(await api.request('/auth/me'));
      if (current !== generation.current) throw new Error('Yêu cầu đăng nhập đã bị hủy.');
      const expiration = Date.now() + response.expiresIn * 1000;
      try { localStorage.setItem(sessionKey, JSON.stringify({ accessToken: response.accessToken, expiresAt: expiration })); } catch { /* Keep this tab signed in if storage is unavailable. */ }
      currentUserId.current = profile.id; setUser(profile); setNotice(null); setExpiresAt(expiration);
      return profile;
    } catch (error) { if (current === generation.current) endSession(null); throw error; }
  }
  if (restoring) return <LoadingState text="Đang khôi phục phiên đăng nhập…" />;
  return <AuthContext.Provider value={{ user, notice, login, logout: () => endSession(null), updateUser }}>{children}</AuthContext.Provider>;
}
