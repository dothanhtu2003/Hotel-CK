import { createContext, useContext } from 'react';
import type { LoginInput, User } from './contracts';

export interface AuthState {
  user: User | null;
  notice: string | null;
  login: (input: LoginInput) => Promise<User>;
  logout: () => void;
  updateUser: (user: User) => boolean;
}
export const AuthContext = createContext<AuthState | null>(null);
export function useAuth() {
  const value = useContext(AuthContext); if (!value) throw new Error('AuthProvider required'); return value;
}
