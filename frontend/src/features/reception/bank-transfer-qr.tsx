import { LocalizedError, t as tr, useLocale } from "../../i18n";

import { useEffect, useEffectEvent, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import QRCode from 'qrcode';
import { api } from '../../lib/api';
import { Button } from '../../components/ui';
import { money } from '../guest/contracts';
import { useRefreshDesk } from './queries';

type Link = { paid: boolean; checkoutUrl?: string; qrCode?: string; closed?: boolean; expired?: boolean };
export function BankTransferQr({ orderId, amount, onPaid, onClosed, guest = false, expiresAt, allowChangeAfterClose = false }: { orderId: string; amount: string; guest?: boolean; expiresAt?: number; onPaid: () => void; onClosed: () => void | Promise<void>; allowChangeAfterClose?: boolean }) {
  useLocale();
  const [now, setNow] = useState(Date.now);
  useEffect(() => { if (!expiresAt) return; const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, [expiresAt]);
  const refresh = useRefreshDesk();
  const link = useQuery({ queryKey: ['service-payos-link', orderId], queryFn: async () => { try { return await api.request<Link>(`/service-orders/${orderId}/payos`, { method: 'POST' }); } finally { void refresh(); } }, retry: false, staleTime: 0, refetchOnWindowFocus: false });
  const sync = useQuery({ queryKey: ['service-payos-sync', orderId, link.data?.checkoutUrl], queryFn: () => api.request<{ paid: boolean; closed: boolean; expired?: boolean }>(`/service-orders/${orderId}/payos/sync`, { method: 'POST' }), enabled: !!link.data && !link.data.paid, refetchInterval: query => query.state.data?.paid || query.state.data?.closed ? false : 5000, retry: false });
  const cancel = useMutation({ mutationFn: () => api.request<{ paid: boolean; closed: boolean; expired?: boolean }>(`/service-orders/${orderId}/payos/cancel`, { method: 'POST' }), onSuccess: async result => { await refresh(); if (result.paid) onPaid(); else if (result.closed) await onClosed(); else throw new LocalizedError("reception:bankTransferQr.theTransactionIsStillAwaitingVerificationPleaseCheckBeforeCollectingAnotherPayment"); } });
  const expired = link.data?.expired || sync.data?.expired || (!!expiresAt && now >= expiresAt);
  const paid = link.data?.paid || sync.data?.paid;
  const notifyPaid = useEffectEvent(() => { void refresh(); onPaid(); });
  useEffect(() => { if (paid) notifyPaid(); }, [paid]);
  const notifyExpired = useEffectEvent(() => { void refresh(); });
  useEffect(() => { if (expired) notifyExpired(); }, [expired]);
  const image = useQuery({ queryKey: ['service-payos-qr', link.data?.qrCode], queryFn: () => QRCode.toDataURL(link.data!.qrCode!, { width: 256, margin: 2, errorCorrectionLevel: 'M' }), enabled: !!link.data?.qrCode, retry: false });
  return <section aria-label={tr("reception:bankTransferQr.payosPaymentQr")} className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm space-y-2">
    {!expired && expiresAt && <p>{tr("reception:bankTransferQr.paymentTimeRemainingValueValue", { value0: (Math.floor(Math.max(0, expiresAt - now) / 60000)), value1: (String(Math.floor(Math.max(0, expiresAt - now) / 1000) % 60).padStart(2, '0')) })}</p>}
    <p className="font-semibold">{tr("reception:bankTransferQr.payValueWithPayos", { value0: (money(amount)) })}</p>
    {link.isPending && <p role="status">{tr("reception:bankTransferQr.creatingPayosQr")}</p>}
    {image.data && !expired && !sync.data?.closed && <img src={image.data} alt={tr("reception:bankTransferQr.payosQrForPaymentOfValue", { value0: (money(amount)) })} className="mx-auto w-56 max-w-full rounded-lg" />}
    {link.data?.checkoutUrl && !expired && !sync.data?.closed && <a href={link.data.checkoutUrl} target="_blank" rel="noopener noreferrer" className="underline text-brand-700">{tr("reception:bankTransferQr.openPayosPaymentPage")}</a>}
    {expired && <p role="status">{tr("reception:bankTransferQr.the15MinutePaymentPeriodHasExpiredUnpaidOrdersWillBeCancelled")}</p>}
    {!expired && sync.data?.closed && <p role="status">{tr("reception:bankTransferQr.theQrCodeIsNoLongerValid")}</p>}
    {(link.error || sync.error || image.error) && <p role="alert">{tr("reception:bankTransferQr.unableToLoadOrCheckPayosPaymentPleaseTryAgain")}</p>}
    {cancel.error && <p role="alert">{tr("reception:bankTransferQr.unableToChangePaymentMethodPleaseCheckTheTransactionAndTryAgain")}</p>}
    <div className="flex flex-wrap gap-2">
      {!expired && !cancel.isPending && (link.error || sync.data?.closed) && <Button type="button" variant="secondary" onClick={() => void link.refetch()}>{sync.data?.closed ? tr("reception:bankTransferQr.createNewQr") : tr("reception:bankTransferQr.reloadQr")}</Button>}
      {!expired && link.data && !paid && <Button type="button" variant="secondary" busy={sync.isFetching} onClick={() => void sync.refetch()}>{tr("reception:bankTransferQr.checkPayment")}</Button>}
      {!guest && !link.isPending && !paid && (!expired || allowChangeAfterClose) && (!sync.data?.closed || allowChangeAfterClose) && <Button type="button" variant="secondary" disabled={link.isFetching} busy={cancel.isPending} onClick={() => cancel.mutate()}>{tr("reception:bankTransferQr.changePaymentMethod")}</Button>}
    </div>
  </section>;
}
