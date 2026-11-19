import { t as tr, useLocale } from "../../i18n";
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
  useLocale();
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
  const copy = async (field: string, value: string) => { try { await navigator.clipboard.writeText(value); setCopied(field); } catch { setCopied('failed'); } };
  const fieldLabels: Record<string, string> = {
    holder: tr('guest:bookingQr.accountHolder'), account: tr('guest:bookingQr.accountNumber'),
    bank: tr('guest:bookingQr.bankCode'), amount: tr('guest:bookingQr.amount'), description: tr('guest:bookingQr.transferDescription'),
  };
  if (paid) return <section className="py-8 text-center space-y-3" aria-label={tr("guest:bookingQr.paymentSuccessful")}>
    <CheckCircle2 className="mx-auto size-14 text-emerald-600" /><h3 className="text-xl font-bold text-emerald-900">{tr("guest:bookingQr.paymentSuccessful")}</h3>
    <p role="status">{tr("guest:bookingQr.receivedValueYourReservationIsConfirmed", { value0: (money(state.data!.paidAmount)) })}</p>
  </section>;
  return <section aria-label={tr("guest:bookingQr.roomPaymentQr")} className="space-y-4">
    <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 flex items-center justify-between gap-3">
      <div><p className="text-xs text-emerald-800">{tr("guest:bookingQr.totalRoomCharge")}</p><p className="text-2xl font-bold text-emerald-950">{state.data ? money(state.data.totalAmount) : tr("guest:bookingQr.loading")}</p></div>
      {remaining !== null && <span className="flex items-center gap-1.5 text-sm font-semibold text-emerald-900"><Clock className="size-4" />{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</span>}
    </div>
    {expired || state.data?.bookingStatus === 'CANCELLED' ? <p role="status" className="notice">{tr("guest:bookingQr.thePaymentCodeExpiredOrTheReservationWasCancelledTheSystemWill")}</p> : state.data?.paymentReview ? <p role="alert" className="notice">{tr("guest:bookingQr.thisTransactionNeedsReviewPleaseDoNotTransferMoreMoney")}</p> : <>
      {(state.isPending || (allowed && link.isPending) || (link.data?.qrCode && qr.isPending)) && <p role="status" className="py-8 text-center">{tr("guest:bookingQr.loadingPaymentQr")}</p>}
      {allowed && qr.data && <div className="text-center space-y-2"><div className="mx-auto w-fit rounded-2xl border border-zinc-200 bg-white p-2"><img src={qr.data} alt={tr("guest:bookingQr.vietqrCodeForRoomPaymentThroughPayos")} className="w-64 max-w-full" /></div><p className="text-sm text-zinc-600">{tr("guest:bookingQr.openYourBankingAppAndScanTheQrCode")}</p></div>}
      {allowed && link.data && !link.data.qrCode && <p role="alert">{tr("guest:bookingQr.thePreviousTransactionHasNoSavedQrCode")}<a className="underline" href={link.data.checkoutUrl} target="_blank" rel="noopener noreferrer">{tr("guest:bookingQr.continueWithTheExistingPaymentLink")}</a>.</p>}
      {allowed && link.data?.qrCode && <dl className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 px-4">
        {([['holder', link.data.accountName], ['account', link.data.accountNumber], ['bank', link.data.bankBin], ['amount', state.data?.totalAmount], ['description', link.data.description]] as const).map(([field, value]) => value && <div key={field} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><dt className="text-xs text-zinc-500">{fieldLabels[field]}</dt><dd className="break-all text-sm font-semibold text-zinc-900">{field === 'amount' ? money(value) : value}</dd></div>{['account', 'amount', 'description'].includes(field) && <button type="button" aria-label={tr('guest:bookingQr.copyValue', { value0: fieldLabels[field] })} className="rounded-lg p-2 text-emerald-700 hover:bg-emerald-50" onClick={() => void copy(field, value)}><Copy className="size-4" /></button>}</div>)}

      </dl>}
    </>}
    {copied && <p role="status" className="text-xs text-emerald-800">{copied === 'failed' ? tr('guest:bookingQr.unableToCopyPleaseCopyManually') : tr('guest:bookingQr.copiedValue', { value0: fieldLabels[copied] })}</p>}
    {(state.error || sync.error || link.error || qr.error) && <div role="alert" className="text-sm text-rose-800">{tr("guest:bookingQr.unableToLoadOrVerifyPaymentYourReservationIsStillSaved")}<Button variant="secondary" onClick={() => { void state.refetch(); void sync.refetch(); if (link.error) void link.refetch(); if (qr.error) void qr.refetch(); }}>{tr("guest:bookingQr.tryAgain")}</Button></div>}
    <div className="flex items-start gap-2 text-xs text-zinc-500"><ShieldCheck className="size-4 shrink-0" /><p>{tr("guest:bookingQr.theSystemUpdatesAutomaticallyWhenPayosConfirmsFullPaymentClosingThisWindow")}</p></div>
    <Button variant="secondary" busy={sync.isFetching} onClick={() => void sync.refetch()}>{tr("guest:bookingPayment.checkPayment")}</Button>
  </section>;
}
