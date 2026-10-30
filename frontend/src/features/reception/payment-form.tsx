import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Dialog, ErrorState, FormField } from '../../components/ui';
import { useToast } from '../../components/toast-context';
import { useAuth } from '../auth/auth-context';
import { money, type Invoice } from '../guest/contracts';
import { api } from '../../lib/api';
import { ApiError } from '../../lib/api-client';
import { deskError, paymentSchema, type PaymentInput, type PaymentResult } from './contracts';
import { clearAttempt, readAttempt, reconcileAttempt, saveAttempt, type PaymentAttempt } from './payment-attempt';
import { useDeskBase, useRefreshDesk } from './queries';

export function PaymentForm({ invoice }: { invoice: Invoice }) {
  const { user } = useAuth(), base = useDeskBase(), toast = useToast(), queryClient = useQueryClient(), refresh = useRefreshDesk();
  const [initial] = useState(() => { try { return { attempt: readAttempt(user!.id), error: '' }; } catch { return { attempt: null, error: 'Không đọc được khoản thu đang chờ. Không thể tạo khóa mới; hãy kiểm tra dữ liệu phiên trình duyệt trước khi tiếp tục.' }; } });
  const [attempt, setAttempt] = useState<PaymentAttempt | null>(initial.attempt), [review, setReview] = useState<'required' | 'absent' | 'mismatch'>('required'), [message, setMessage] = useState(initial.error), [checking, setChecking] = useState(false), [confirmation, setConfirmation] = useState<PaymentInput | null>(null);
  const lock = useRef(false), form = useForm<PaymentInput>({ resolver: zodResolver(paymentSchema), defaultValues: { amount: invoice.balance, method: 'CASH', verified: false } });
  useEffect(() => { form.setValue('amount', invoice.balance); setConfirmation(null); }, [invoice.balance, form]);
  function finish() { clearAttempt(user!.id); setAttempt(null); setReview('required'); setMessage(''); form.reset(); }
  const mutation = useMutation({ retry: false, mutationFn: (a: PaymentAttempt) => api.request<PaymentResult>(`/invoices/${a.invoiceId}/payments`, { method: 'POST', body: { amount: a.amount, method: a.method, ...(a.checkout ? { checkout: true } : {}) }, idempotencyKey: a.key }),
    onSuccess: async result => { queryClient.setQueryData(['reception', '/invoices/' + result.invoice.id], result.invoice); finish(); toast(result.replayed ? 'Đã xác nhận khoản thu trước đó, không tạo thêm biên nhận.' : 'Đã thanh toán đủ và trả phòng. Phòng chuyển sang Cần dọn.'); await refresh(); },
    onError: error => { toast(deskError(error, 'payment'), 'error'); setMessage(deskError(error, 'payment')); },
  });
  async function send(a: PaymentAttempt) {
    if (lock.current) return; lock.current = true;
    try {
      // Persist before dispatch: navigating away/reloading cannot replace the UUID.
      saveAttempt(a); setAttempt(a); setReview('required'); setMessage(''); setConfirmation(null);
      try { await mutation.mutateAsync(a); } catch (error) {
        const rejected = error instanceof ApiError && [400, 403, 404, 409, 429].includes(error.status);
        const pending = { ...a, rejected }; saveAttempt(pending); setAttempt(pending);
      }
    } catch { setMessage('Không thể lưu thông tin khoản thu chờ kiểm tra. Chưa được phép tạo yêu cầu mới; hãy giữ trang và kiểm tra hóa đơn.'); }
    finally { lock.current = false; }
  }
  async function reconcile() {
    if (!attempt || lock.current) return; lock.current = true; setChecking(true); setMessage('');
    try {
      const fresh = await api.request<Invoice>('/invoices/' + attempt.invoiceId);
      queryClient.setQueryData(['reception', '/invoices/' + fresh.id], fresh);
      const result = reconcileAttempt(attempt, fresh);
      if (result === 'recorded') { finish(); mutation.reset(); toast('Đã tìm thấy biên nhận trùng khóa và thông tin khoản thu.'); await refresh(); }
      else { setReview(result); setMessage(result === 'mismatch' ? 'Biên nhận có cùng khóa nhưng thông tin không khớp. Dừng thao tác và đối chiếu với người phụ trách.' : 'Chưa thấy biên nhận theo khóa này trong dữ liệu vừa tải. Nếu gửi lại, hệ thống sẽ giữ nguyên khóa và nội dung khoản thu.'); }
    } catch (error) { setReview('required'); setMessage(error instanceof Error ? error.message : 'Chưa thể kiểm tra hóa đơn.'); }
    finally { lock.current = false; setChecking(false); }
  }
  if (initial.error) return <ErrorState message={initial.error} />;
  if (attempt && attempt.invoiceId !== invoice.id) return <section className="panel guest-box"><h2>Cần đối chiếu khoản thu trước</h2><p>Tài khoản này còn một yêu cầu chưa rõ kết quả. Hãy xử lý khoản thu đó trước khi ghi nhận thêm.</p><Link to={`${base}/invoices/${attempt.invoiceId}`}>Mở hóa đơn cần kiểm tra</Link></section>;
  if (attempt) return <section className="panel guest-box desk-payment" aria-label="Khoản thu chờ kiểm tra"><h2>Khoản thu chờ kiểm tra</h2><p>{money(attempt.amount)} · {attempt.method === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản'}</p><p>Khóa yêu cầu: <code>{attempt.key}</code></p><p>Thông tin được giữ khi tải lại trang. Hãy kiểm tra invoice/payments trước khi tiếp tục.</p>{message && <p role="alert" className="notice">{message}</p>}<div className="guest-actions"><Button busy={checking} disabled={mutation.isPending} onClick={() => void reconcile()}>Kiểm tra lại hóa đơn</Button>{review === 'absent' && !attempt.rejected && <Button variant="secondary" busy={mutation.isPending} onClick={() => void send(attempt)}>Gửi lại cùng khóa</Button>}{review === 'absent' && attempt.rejected && <Button variant="secondary" onClick={() => { finish(); mutation.reset(); }}>Đóng yêu cầu đã bị từ chối</Button>}</div></section>;
  if (invoice.status === 'PAID') return <p className="notice">Hóa đơn đã được thanh toán đủ.</p>;
  return <section className="panel guest-box desk-payment"><h2>Ghi nhận thanh toán tại quầy</h2><p>Chỉ ghi nhận tiền đã nhận và được lễ tân kiểm tra. Chuyển khoản cần được xác minh ngoài hệ thống; trang này không xác nhận giao dịch ngân hàng.</p><form noValidate onSubmit={form.handleSubmit(v => { if (v.amount !== invoice.balance) { form.setValue('amount', invoice.balance); return; } setConfirmation(v); })}>
    <input type="hidden" {...form.register('amount')} />
    <div className="form-field"><span>Số tiền thu đủ</span><strong>{money(invoice.balance)}</strong><p className="field-hint">Thu toàn bộ số tiền còn lại để hoàn tất thanh toán và trả phòng.</p></div>
    <FormField name="payment-method" label="Phương thức"><select id="payment-method" className="input" {...form.register('method')}><option value="CASH">Tiền mặt</option><option value="BANK_TRANSFER">Chuyển khoản ngân hàng</option></select></FormField>
    <label className="desk-checkbox"><input type="checkbox" {...form.register('verified')} />Tôi đã nhận đủ tiền và xác minh khoản thanh toán này.</label>{form.formState.errors.verified && <p role="alert" className="field-error">{form.formState.errors.verified.message}</p>}{message && <p role="alert" className="form-error">{message}</p>}<Button type="submit" busy={mutation.isPending}>Thanh toán đủ & trả phòng</Button>
  </form><Dialog open={!!confirmation} onClose={() => { if (!lock.current) setConfirmation(null); }} title="Xác nhận thanh toán & trả phòng"><p>{confirmation && money(confirmation.amount)} · {confirmation?.method === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản ngân hàng'}</p><p>Bạn xác nhận khoản tiền đã được nhận và kiểm tra? Hệ thống sẽ ghi nhận đủ tiền, kết thúc lưu trú và chuyển phòng sang Cần dọn.</p><div className="dialog-actions"><Button variant="secondary" onClick={() => setConfirmation(null)}>Quay lại</Button><Button busy={mutation.isPending} onClick={() => { if (confirmation && confirmation.amount === invoice.balance && !lock.current) void send({ key: crypto.randomUUID(), invoiceId: invoice.id, userId: user!.id, amount: confirmation.amount, method: confirmation.method, checkout: true, rejected: false }); }}>Xác nhận thanh toán & trả phòng</Button></div></Dialog></section>;
}
