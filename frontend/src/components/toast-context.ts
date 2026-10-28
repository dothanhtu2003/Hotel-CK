import { createContext, useContext } from 'react';
export const ToastContext = createContext<((message: string, tone?: 'success' | 'error') => void) | null>(null);
export function useToast() { const toast = useContext(ToastContext); if (!toast) throw new Error('ToastProvider required'); return toast; }
