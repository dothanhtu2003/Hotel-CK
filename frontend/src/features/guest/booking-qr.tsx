import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import QRCode from 'qrcode';
import { CheckCircle2, Clock, Copy, ShieldCheck } from 'lucide-react';
import { api } from '../../lib/api';
import { Button } from '../../components/ui';
import { money } from './contracts';
import type { BookingPaymentState } from './booking-payment';

type Checkout = { checkoutUrl: string; qrCode?: string; accountNumber?: string; accountName?: string; bankBin?: string; description?: string; amount?: number };
export function BookingQr({ bookingId }: { bookingId: string }) {
  const cache = useQueryClient(), notified = useRef(false);
  const [now, setNow] = useState(Date.now), [copied, setCopied] = useState('');
  const state = useQuery({ queryKey: ['booking-qr-state', bookingId], queryFn: async () => {
    return api.request<BookingPaymentState>(`/bookings/${bookingId}/payment-state`);
  }, refetchInterval: q => q.state.data?.paid || q.state.data?.bookingStatus === 'CANCELLED' ? false : 5000, retry: false });
  const sync = useQuery({ queryKey: ['booking-qr-sync', bookingId], queryFn: async () => {
    const result = await api.request(`/bookings/${bookingId}/payos/sync`, { method: 'POST' });
    await state.refetch();
    return result;
  }, enabled: !!state.data && !state.data.paid && state.data.bookingStatus !== 'CANCELLED', refetchInterval: 5000, retry: false });
  const remaining = state.data?.expiredAt ? Math.max(0, Math.ceil((Date.parse(state.data.expiredAt) - (state.data.serverNow ? Date.parse(state.data.serverNow) + now - state.dataUpdatedAt : now)) / 1000)) : null;
  const expired = remaining === 0 || state.data?.holdState === 'EXPIRED';
  const paid = state.data?.paid;
  const allowed = !!state.data && !paid && !expired && state.data.bookingStatus === 'PENDING' && state.data.holdState === 'ACTIVE' && !state.data.paymentReview;
  const link = useQuery({ queryKey: ['booking-qr-link', bookingId], queryFn: () => api.request<Checkout>(`/bookings/${bookingId}/payos/qr`, { method: 'POST' }), enabled: allowed, retry: false, staleTime: Infinity, refetchOnWindowFocus: false });
  const qr = useQuery({ queryKey: ['booking-qr-image', link.data?.qrCode], queryFn: () => QRCode.toDataURL(link.data!.qrCode!, { width: 320, margin: 2, errorCorrectionLevel: 'M' }), enabled: !!link.data?.qrCode && allowed, retry: false });
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    if (paid && !notified.current) {
      notified.current = true;
      for (const key of ['guest', 'reception', 'housekeeping']) void cache.invalidateQueries({ queryKey: [key] });
    }
  }, [paid, cache]);
  const copy = async (label: string, value: string) => { try { await navigator.clipboard.writeText(value); setCopied(label); } catch { setCopied('Không sao chép được. Vui lòng sao chép thủ công.'); } };
  if (paid) return <section className="py-8 text-center space-y-3" aria-label="Thanh toán thành công">
    <CheckCircle2 className="mx-auto size-14 text-emerald-600" /><h3 className="text-xl font-bold text-emerald-900">Thanh toán thành công</h3>
    <p role="status">Đã nhận {money(state.data!.paidAmount)}. Đặt phòng đã được xác nhận.</p>
  </section>;
  return <section aria-label="QR thanh toán tiền phòng" className="space-y-4">
    <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 flex items-center justify-between gap-3">
      <div><p className="text-xs text-emerald-800">Tổng tiền phòng</p><p className="text-2xl font-bold text-emerald-950">{state.data ? money(state.data.totalAmount) : 'Đang tải…'}</p></div>
      {remaining !== null && <span className="flex items-center gap-1.5 text-sm font-semibold text-emerald-900"><Clock className="size-4" />{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</span>}
    </div>
    {expired || state.data?.bookingStatus === 'CANCELLED' ? <p role="status" className="notice">Mã thanh toán đã hết hạn hoặc booking đã hủy. Hệ thống sẽ đối soát giao dịch trước khi giải phóng phòng.</p> : state.data?.paymentReview ? <p role="alert" className="notice">Giao dịch cần đối soát. Vui lòng không chuyển thêm tiền.</p> : <>
      {(state.isPending || (allowed && link.isPending) || (link.data?.qrCode && qr.isPending)) && <p role="status" className="py-8 text-center">Đang tải mã QR thanh toán…</p>}
      {allowed && qr.data && <div className="text-center space-y-2"><div className="mx-auto w-fit rounded-2xl border border-zinc-200 bg-white p-2"><img src={qr.data} alt="Mã VietQR thanh toán tiền phòng qua payOS" className="w-64 max-w-full" /></div><p className="text-sm text-zinc-600">Mở ứng dụng ngân hàng và quét mã QR</p></div>}
      {allowed && link.data && !link.data.qrCode && <p role="alert">Giao dịch cũ chưa lưu mã QR. <a className="underline" href={link.data.checkoutUrl} target="_blank" rel="noopener noreferrer">Tiếp tục thanh toán liên kết hiện tại</a>.</p>}
      {allowed && link.data?.qrCode && <dl className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 px-4">
        {([['Chủ tài khoản', link.data.accountName], ['Số tài khoản', link.data.accountNumber], ['Mã ngân hàng', link.data.bankBin], ['Số tiền', state.data?.totalAmount], ['Nội dung', link.data.description]] as const).map(([label, value]) => value && <div key={label} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><dt className="text-xs text-zinc-500">{label}</dt><dd className="break-all text-sm font-semibold text-zinc-900">{label === 'Số tiền' ? money(value) : value}</dd></div>{['Số tài khoản', 'Số tiền', 'Nội dung'].includes(label) && <button type="button" aria-label={`Sao chép ${label.toLowerCase()}`} className="rounded-lg p-2 text-emerald-700 hover:bg-emerald-50" onClick={() => void copy(label, value)}><Copy className="size-4" /></button>}</div>)}
      </dl>}
    </>}
    {copied && <p role="status" className="text-xs text-emerald-800">{copied.startsWith('Không') ? copied : `Đã sao chép ${copied.toLowerCase()}.`}</p>}
    {(state.error || sync.error || link.error || qr.error) && <div role="alert" className="text-sm text-rose-800">Chưa tải hoặc xác minh được thanh toán. Booking vẫn được lưu. <Button variant="secondary" onClick={() => { void state.refetch(); void sync.refetch(); if (link.error) void link.refetch(); if (qr.error) void qr.refetch(); }}>Thử lại</Button></div>}
    <div className="flex items-start gap-2 text-xs text-zinc-500"><ShieldCheck className="size-4 shrink-0" /><p>Hệ thống tự cập nhật khi payOS xác nhận nhận đủ tiền. Đóng cửa sổ không hủy booking.</p></div>
    <Button variant="secondary" busy={sync.isFetching} onClick={() => void sync.refetch()}>Kiểm tra thanh toán</Button>
  </section>;
}
