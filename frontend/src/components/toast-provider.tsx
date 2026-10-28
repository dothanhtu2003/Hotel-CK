import { useEffect, useState, type ReactNode } from 'react';
import { CheckCircle2, CircleAlert, X } from 'lucide-react';
import { ToastContext } from './toast-context';

type Toast = { id: string; message: string; tone: 'success' | 'error' };
function ToastItem({ toast, remove }: { toast: Toast; remove: (id: string) => void }) {
  useEffect(() => { const timer = window.setTimeout(() => remove(toast.id), 6000); return () => window.clearTimeout(timer); }, [toast.id, remove]);
  return <div className={`toast ${toast.tone}`} role={toast.tone === 'error' ? 'alert' : 'status'}>
    {toast.tone === 'success' ? <CheckCircle2 size={20} /> : <CircleAlert size={20} />}<span>{toast.message}</span>
    <button onClick={() => remove(toast.id)} aria-label="Đóng thông báo"><X size={17} /></button>
  </div>;
}
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const remove = (id: string) => setItems(old => old.filter(item => item.id !== id));
  return <ToastContext.Provider value={(message, tone = 'success') => setItems(old => [...old.slice(-2), { id: crypto.randomUUID(), message, tone }])}>
    {children}<div className="toast-stack" aria-label="Thông báo">{items.map(item => <ToastItem key={item.id} toast={item} remove={remove} />)}</div>
  </ToastContext.Provider>;
}
