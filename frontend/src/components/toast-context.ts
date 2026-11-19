import { createContext, useContext } from 'react';
export type ToastMessage = string | (() => string);
export const ToastContext = createContext<((message: ToastMessage, tone?: 'success' | 'error') => void) | null>(null);
export function useToast() { const toast = useContext(ToastContext); if (!toast) throw new Error('ToastProvider required'); return toast; }
