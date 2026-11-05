import { DeskLink } from "./navigation";
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import QRCode from 'qrcode';
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
  const [attempt, setAttempt] = useState<PaymentAttempt | null>(initial.attempt), [review, setReview] = useState<'required' | 'absent' | 'mismatch'>('required'), [message, setMessage] = useState(initial.error), [checking, setChecking] = useState(false);
  const lock = useRef(false), form = useForm<PaymentInput>({ resolver: zodResolver(paymentSchema), defaultValues: { amount: invoice.balance, method: 'CASH' } });
  useEffect(() => { form.setValue('amount', invoice.balance); }, [invoice.balance, form]);
  const pendingOnline = invoice.payments?.some(p => p.status === 'PENDING');
  const [qrOpen, setQrOpen] = useState(false);
  const startQr = useMutation({
    mutationFn: async () => {
      const link = await api.request<{ checkoutUrl: string; qrCode?: string }>(`/invoices/${invoice.id}/payos`, { method: 'POST' });
      return { ...link, image: await QRCode.toDataURL(link.qrCode ?? link.checkoutUrl, { width: 256, margin: 2 }) };
    },
    onSettled: () => refresh(),
  });
  const qr = startQr.data;
  const syncQr = useQuery({
    queryKey: ['invoice-payos-sync', invoice.id, qr?.checkoutUrl],
    enabled: !attempt && !!(qr || pendingOnline) && invoice.status !== 'PAID',
    queryFn: async () => {
      await api.request(`/invoices/${invoice.id}/payos/sync`, { method: 'POST' });
      const current = await api.request<Invoice>(`/invoices/${invoice.id}`);
      const pending = current.payments.some(p => p.status === 'PENDING');
      if (!pending) await refresh();
      return pending;
    },
    refetchInterval: query => query.state.data === false ? false : 5000,
    retry: false,
  });
  const cancelQr = useMutation({
    mutationFn: () => api.request<{ pending: boolean }>(`/invoices/${invoice.id}/payos/cancel`, { method: 'POST' }),
    onMutate: () => { setMessage(''); },
    onSuccess: async result => {
      await refresh();
      if (result.pending) {
        setMessage('Giao dịch vẫn đang chờ xác minh. Vui lòng kiểm tra thanh toán trước khi thu thêm.');
        return;
      }
      startQr.reset();
      setQrOpen(false);
      form.setValue('method', 'CASH');
    },
    onError: () => setMessage('Chưa thể hủy mã QR. Vui lòng kiểm tra giao dịch trước khi thu thêm.'),
  });
  const method = form.watch('method');
  function finish() { clearAttempt(user!.id); setAttempt(null); setReview('required'); setMessage(''); form.reset(); }
  const mutation = useMutation({ retry: false, mutationFn: (a: PaymentAttempt) => api.request<PaymentResult>(`/invoices/${a.invoiceId}/payments`, { method: 'POST', body: { amount: a.amount, method: a.method, ...(a.checkout ? { checkout: true } : {}) }, idempotencyKey: a.key }),
    onSuccess: async result => { queryClient.setQueryData(['reception', '/invoices/' + result.invoice.id], result.invoice); finish(); toast(result.replayed ? 'Đã xác nhận khoản thu trước đó, không tạo thêm biên nhận.' : 'Đã thanh toán đủ và trả phòng. Phòng chuyển sang Cần dọn.'); await refresh(); },
    onError: error => { toast(deskError(error, 'payment'), 'error'); setMessage(deskError(error, 'payment')); },
  });
  async function send(a: PaymentAttempt) {
    if (lock.current) return; lock.current = true;
    try {
      // Persist before dispatch: navigating away/reloading cannot replace the UUID.
      saveAttempt(a); setAttempt(a); setReview('required'); setMessage('');
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
  if (attempt && attempt.invoiceId !== invoice.id) return <section className="panel guest-box"><h2>Cần đối chiếu khoản thu trước</h2><p>Tài khoản này còn một yêu cầu chưa rõ kết quả. Hãy xử lý khoản thu đó trước khi ghi nhận thêm.</p><DeskLink to={`${base}/invoices/${attempt.invoiceId}`}>Mở hóa đơn cần kiểm tra</DeskLink></section>;
  if (attempt) return <section className="panel guest-box desk-payment" aria-label="Khoản thu chờ kiểm tra"><h2>Khoản thu chờ kiểm tra</h2><p>{money(attempt.amount)} · {attempt.method === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản'}</p><p>Khóa yêu cầu: <code>{attempt.key}</code></p><p>Thông tin được giữ khi tải lại trang. Hãy kiểm tra invoice/payments trước khi tiếp tục.</p>{message && <p role="alert" className="notice">{message}</p>}<div className="guest-actions"><Button busy={checking} disabled={mutation.isPending} onClick={() => void reconcile()}>Kiểm tra lại hóa đơn</Button>{review === 'absent' && !attempt.rejected && <Button variant="secondary" busy={mutation.isPending} onClick={() => void send(attempt)}>Gửi lại cùng khóa</Button>}{review === 'absent' && attempt.rejected && <Button variant="secondary" onClick={() => { finish(); mutation.reset(); }}>Đóng yêu cầu đã bị từ chối</Button>}</div></section>;
  if (invoice.status === 'PAID') return <p className="notice">Hóa đơn đã được thanh toán đủ.</p>;
  function openQr() {
    setQrOpen(true);
    if (!qr || syncQr.data === false) startQr.mutate();
  }

  const changeMethod = <Button type="button" variant="secondary" busy={cancelQr.isPending} disabled={startQr.isPending || checking} onClick={() => cancelQr.mutate()}>Đổi cách thanh toán</Button>;
  const qrDialog = <Dialog open={qrOpen} onClose={() => setQrOpen(false)} title={`Thanh toán ${money(invoice.balance)} bằng chuyển khoản`}>
    {startQr.isPending && <p role="status">Đang tạo mã QR…</p>}
    {startQr.error && <p role="alert">{deskError(startQr.error, 'payment')}</p>}
    {qr && !startQr.isPending && (syncQr.data === false ? <>
      <p role="status">Mã thanh toán đã đóng. Kiểm tra số dư trước khi thu tiếp.</p>
    </> : <>
      <img src={qr.image} alt={qr.qrCode ? 'Mã QR chuyển khoản' : 'Mã QR mở trang thanh toán'} className="mx-auto w-56 max-w-full" />
      <a href={qr.checkoutUrl} target="_blank" rel="noopener noreferrer">Mở trang thanh toán</a>
      <p role="status">Đang chờ xác nhận đã nhận đủ tiền.</p>
      {syncQr.error && <p role="alert">Chưa thể kiểm tra giao dịch. Vui lòng thử lại.</p>}
      <Button variant="secondary" busy={syncQr.isFetching} onClick={() => void syncQr.refetch()}>Kiểm tra thanh toán</Button>
    </>)}
    {message && <p role="alert">{message}</p>}
    <div className="dialog-actions">{(pendingOnline || (qr && syncQr.data !== false)) && changeMethod}<Button variant="secondary" onClick={() => setQrOpen(false)}>Đóng</Button></div>
  </Dialog>;
  if (pendingOnline || (qr && syncQr.data !== false)) return <section className="panel guest-box">
    <h2>Đang chờ đối soát thanh toán</h2>
    <p>Hệ thống tự kiểm tra giao dịch. Vui lòng chờ xác nhận trước khi thu thêm.</p>
    <div className="guest-actions">
      <Button busy={startQr.isPending} disabled={cancelQr.isPending} onClick={openQr}>Thanh toán</Button>
      {changeMethod}
    </div>
    {message && <p role="alert">{message}</p>}
    {qrDialog}
  </section>;
  return <section className="panel guest-box desk-payment"><h2>Ghi nhận thanh toán tại quầy</h2><form noValidate onSubmit={form.handleSubmit(v => { if (v.amount !== invoice.balance) { form.setValue('amount', invoice.balance); return; } if (v.method === 'BANK_TRANSFER') { openQr(); return; } if (!lock.current) void send({ key: crypto.randomUUID(), invoiceId: invoice.id, userId: user!.id, amount: v.amount, method: v.method, checkout: true, rejected: false }); })}>
    <input type="hidden" {...form.register('amount')} />
    <div className="form-field"><span>Số tiền thu đủ</span><strong>{money(invoice.balance)}</strong><p className="field-hint">Thu toàn bộ số tiền còn lại để hoàn tất thanh toán và trả phòng.</p></div>
    <FormField name="payment-method" label="Phương thức"><select id="payment-method" className="input" disabled={startQr.isPending} {...form.register('method')}><option value="CASH">Tiền mặt</option><option value="BANK_TRANSFER">Chuyển khoản ngân hàng</option></select></FormField>
    {message && <p role="alert" className="form-error">{message}</p>}
    <Button type="submit" busy={mutation.isPending || startQr.isPending}>{method === 'BANK_TRANSFER' ? 'Thanh toán' : 'Thanh toán đủ & trả phòng'}</Button>
  </form>{qrDialog}</section>;
}
