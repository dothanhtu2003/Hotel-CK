import { z } from 'zod';
import { cents, type Invoice } from '../guest/contracts';
import { paymentSchema } from './contracts';

const attemptSchema = z.object({ key: z.string().uuid(), invoiceId: z.string().uuid(), userId: z.string().uuid(), amount: paymentSchema.shape.amount, method: paymentSchema.shape.method, checkout: z.boolean().optional(), rejected: z.boolean() });
export type PaymentAttempt = z.infer<typeof attemptSchema>;
const prefix = 'an-nhien:pending-receipt:';
// Store receipt metadata only, never JWTs. A reload must not silently generate a new key.
export function readAttempt(userId: string, storage: Storage = sessionStorage): PaymentAttempt | null {
  const raw = storage.getItem(prefix + userId); if (raw === null) return null;
  const parsed = attemptSchema.parse(JSON.parse(raw));
  if (parsed.userId !== userId) throw new Error('Khoản thu chờ kiểm tra không khớp tài khoản.');
  return parsed;
}
export function saveAttempt(a: PaymentAttempt, storage: Storage = sessionStorage) { storage.setItem(prefix + a.userId, JSON.stringify(attemptSchema.parse(a))); }
export function clearAttempt(userId: string, storage: Storage = sessionStorage) { storage.removeItem(prefix + userId); }
export function reconcileAttempt(a: PaymentAttempt, invoice: Invoice): 'recorded' | 'absent' | 'mismatch' {
  if (invoice.id !== a.invoiceId) return 'mismatch';
  const p = invoice.payments.find(p => p.id === a.key);
  if (!p) return 'absent';
  return p.status === 'COMPLETED' && p.method === a.method && cents(p.amount) === cents(a.amount) ? 'recorded' : 'mismatch';
}
