import { t as tr, useLocale } from "../../i18n";
import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { api } from '../../lib/api';
import { Button } from '../../components/ui';
import { money, type Invoice } from './contracts';

export function PayosPayment({ invoice }: { invoice: Invoice }) {
  useLocale();
  const cache = useQueryClient();
  const [params] = useSearchParams();
  const paid = invoice.status === 'PAID';
  const pending = invoice.payments.some(p => p.status === 'PENDING');
  const sync = useQuery({
    queryKey: ['payos', invoice.id],
    queryFn: () => api.request(`/invoices/${invoice.id}/payos/sync`, { method: 'POST' }),
    enabled: !paid && (pending || params.has('payos')),
    refetchInterval: !paid && pending ? 5000 : false,
    retry: false,
  });
  useEffect(() => {
    if (sync.dataUpdatedAt) void cache.invalidateQueries({ queryKey: ['guest'] });
  }, [sync.dataUpdatedAt, cache]);
  const start = useMutation({
    mutationFn: () => api.request<{ checkoutUrl: string }>(`/invoices/${invoice.id}/payos`, { method: 'POST' }),
    onSuccess: data => { window.location.assign(data.checkoutUrl); },
  });
  if (paid) return <p role="status" className="notice">{invoice.booking.status === 'CHECKED_OUT' ? tr("guest:payosPayment.fullyPaidAndCheckedOut") : tr("guest:payosPayment.fullyPaidPleaseContactReceptionToCompleteCheckOut")}</p>;
  if (invoice.booking.status !== 'CHECKED_IN') return null;
  return <div className="guest-box" aria-label={tr("guest:payosPayment.onlinePayment")}>
    <h3>{tr("guest:payosPayment.onlinePaymentWithPayos")}</h3>
    <p>{tr("guest:payosPayment.payValueUsingAQrCodeOrBankingAppTheInvoiceWill", { value0: (money(invoice.balance)) })}</p>
    {params.get('payos') === 'cancel' && <p role="status">{tr("guest:payosPayment.youHaveReturnedFromThePaymentPageTheSystemIsCheckingThe")}</p>}
    {(start.error || sync.error) && <p role="alert">{tr("guest:payosPayment.unableToConnectToPayosPleaseTryAgainOrContactReception")}</p>}
    <div className="guest-actions">
      <Button busy={start.isPending} disabled={sync.isFetching} onClick={() => start.mutate()}>{tr("guest:payosPayment.payWithPayos")}</Button>
      <Button variant="secondary" busy={sync.isFetching} disabled={start.isPending} onClick={() => void sync.refetch()}>{tr("guest:bookingPayment.checkPayment")}</Button>
    </div>
  </div>;
}
