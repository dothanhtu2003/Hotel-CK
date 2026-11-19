import { resolveMessage, t as tr, useLocale } from "../i18n";

import { useEffect, useState, type ReactNode } from 'react';
import { CheckCircle2, CircleAlert, X } from 'lucide-react';
import { ToastContext, type ToastMessage } from './toast-context';

type Toast = { id: string; message: ToastMessage; tone: 'success' | 'error' };
function ToastItem({ toast, remove }: { toast: Toast; remove: (id: string) => void }) {
  useLocale();
  useEffect(() => { const timer = window.setTimeout(() => remove(toast.id), 6000); return () => window.clearTimeout(timer); }, [toast.id, remove]);
  return <div className={`toast ${toast.tone}`} role={toast.tone === 'error' ? 'alert' : 'status'}>
    {toast.tone === 'success' ? <CheckCircle2 size={20} /> : <CircleAlert size={20} />}<span>{resolveMessage(typeof toast.message === 'function' ? toast.message() : toast.message)}</span>
    <button onClick={() => remove(toast.id)} aria-label={tr("common:toastProvider.dismissNotification")}><X size={17} /></button>
  </div>;
}
export function ToastProvider({ children }: { children: ReactNode }) {
  useLocale();
  const [items, setItems] = useState<Toast[]>([]);
  const remove = (id: string) => setItems(old => old.filter(item => item.id !== id));
  return <ToastContext.Provider value={(message, tone = 'success') => setItems(old => [...old.slice(-2), { id: crypto.randomUUID(), message, tone }])}>
    {children}<div className="toast-stack" aria-label={tr("common:toastProvider.notifications")}>{items.map(item => <ToastItem key={item.id} toast={item} remove={remove} />)}</div>
  </ToastContext.Provider>;
}
