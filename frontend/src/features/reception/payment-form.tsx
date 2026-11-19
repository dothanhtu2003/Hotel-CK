import { errorToken, message as uiMessage, resolveMessage, t as tr, useLocale } from "../../i18n";

import { Trans } from "react-i18next";
import { DeskLink } from "./navigation";
import { useEffect, useRef, useState } from 'react';
import { useForm } from "../../i18n/forms";
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
  useLocale();
  const { user } = useAuth(), base = useDeskBase(), toast = useToast(), queryClient = useQueryClient(), refresh = useRefreshDesk();
  const [initial] = useState(() => { try { return { attempt: readAttempt(user!.id), error: '' }; } catch { return { attempt: null, error: uiMessage("reception:paymentForm.unableToReadThePendingReceiptANewKeyCannotBeCreated") }; } });
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
        setMessage(uiMessage("reception:paymentForm.theTransactionIsStillAwaitingVerificationCheckPaymentBeforeCollectingMore"));
        return;
      }
      startQr.reset();
      setQrOpen(false);
      form.setValue('method', 'CASH');
    },
    onError: () => setMessage(uiMessage("reception:paymentForm.unableToCancelTheQrCodeCheckTheTransactionBeforeCollectingMore")),
  });
  const method = form.watch('method');
  function finish() { clearAttempt(user!.id); setAttempt(null); setReview('required'); setMessage(''); form.reset(); }
  const mutation = useMutation({ retry: false, mutationFn: (a: PaymentAttempt) => api.request<PaymentResult>(`/invoices/${a.invoiceId}/payments`, { method: 'POST', body: { amount: a.amount, method: a.method, ...(a.checkout ? { checkout: true } : {}) }, idempotencyKey: a.key }),
    onSuccess: async result => { queryClient.setQueryData(['reception', '/invoices/' + result.invoice.id], result.invoice); finish(); toast(() => (result.replayed ? tr("reception:paymentForm.theEarlierReceiptWasConfirmedNoAdditionalReceiptWasCreated") : tr("reception:paymentForm.fullyPaidAndCheckedOutTheRoomNowNeedsCleaning"))); await refresh(); },
    onError: error => { toast(() => (deskError(error, 'payment')), 'error'); setMessage(deskError(error, 'payment', true)); },
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
    } catch { setMessage(uiMessage("reception:paymentForm.unableToSavePendingReceiptInformationDoNotCreateANewRequest")); }
    finally { lock.current = false; }
  }
  async function reconcile() {
    if (!attempt || lock.current) return; lock.current = true; setChecking(true); setMessage('');
    try {
      const fresh = await api.request<Invoice>('/invoices/' + attempt.invoiceId);
      queryClient.setQueryData(['reception', '/invoices/' + fresh.id], fresh);
      const result = reconcileAttempt(attempt, fresh);
      if (result === 'recorded') { finish(); mutation.reset(); toast(() => (tr("reception:paymentForm.aReceiptMatchingTheRequestKeyAndPaymentDetailsWasFound"))); await refresh(); }
      else { setReview(result); setMessage(result === 'mismatch' ? uiMessage("reception:paymentForm.aReceiptHasTheSameKeyButDifferentDetailsStopAndCheck") : uiMessage("reception:paymentForm.noReceiptWithThisKeyWasFoundInTheLatestDataResubmitting")); }
    } catch (error) { setReview('required'); setMessage(error instanceof Error ? errorToken(error) : uiMessage("reception:paymentForm.unableToCheckTheInvoice")); }
    finally { lock.current = false; setChecking(false); }
  }
  if (initial.error) return <ErrorState message={initial.error} />;
  if (attempt && attempt.invoiceId !== invoice.id) return <section className="panel guest-box"><h2>{tr("reception:paymentForm.reviewThePreviousReceiptFirst")}</h2><p>{tr("reception:paymentForm.thisAccountHasARequestWithAnUncertainOutcomeResolveItBefore")}</p><DeskLink to={`${base}/invoices/${attempt.invoiceId}`}>{tr("reception:paymentForm.openInvoiceForReview")}</DeskLink></section>;
  if (attempt) return <section className="panel guest-box desk-payment" aria-label={tr("reception:paymentForm.pendingReceiptReview")}><h2>{tr("reception:paymentForm.pendingReceiptReview")}</h2><p>{money(attempt.amount)} · {attempt.method === 'CASH' ? tr("reception:cashier.cash") : tr("reception:cashier.bankTransfer")}</p><p><Trans ns="reception" i18nKey="paymentForm.requestKeyValue" values={{ value0: (attempt.key) }} components={{ part0: <code /> }} /></p><p>{tr("reception:paymentForm.informationIsPreservedAfterRefreshCheckInvoicePaymentsBeforeContinuing")}</p>{message && <p role="alert" className="notice">{resolveMessage(message)}</p>}<div className="guest-actions"><Button busy={checking} disabled={mutation.isPending} onClick={() => void reconcile()}>{tr("reception:paymentForm.checkInvoiceAgain")}</Button>{review === 'absent' && !attempt.rejected && <Button variant="secondary" busy={mutation.isPending} onClick={() => void send(attempt)}>{tr("reception:paymentForm.resubmitWithTheSameKey")}</Button>}{review === 'absent' && attempt.rejected && <Button variant="secondary" onClick={() => { finish(); mutation.reset(); }}>{tr("reception:paymentForm.closeRejectedRequest")}</Button>}</div></section>;
  if (invoice.status === 'PAID') return <p className="notice">{tr("reception:paymentForm.theInvoiceIsFullyPaid")}</p>;
  function openQr() {
    setQrOpen(true);
    if (!qr || syncQr.data === false) startQr.mutate();
  }

  const changeMethod = <Button type="button" variant="secondary" busy={cancelQr.isPending} disabled={startQr.isPending || checking} onClick={() => cancelQr.mutate()}>{tr("reception:bankTransferQr.changePaymentMethod")}</Button>;
  const qrDialog = <Dialog open={qrOpen} onClose={() => setQrOpen(false)} title={tr("reception:paymentForm.payValueByBankTransfer", { value0: (money(invoice.balance)) })}>
    {startQr.isPending && <p role="status">{tr("reception:paymentForm.creatingQrCode")}</p>}
    {startQr.error && <p role="alert">{deskError(startQr.error, 'payment')}</p>}
    {qr && !startQr.isPending && (syncQr.data === false ? <>
      <p role="status">{tr("reception:paymentForm.thePaymentCodeIsClosedCheckTheBalanceBeforeCollectingMore")}</p>
    </> : <>
      <img src={qr.image} alt={qr.qrCode ? tr("reception:paymentForm.bankTransferQr") : tr("reception:paymentForm.qrToOpenPaymentPage")} className="mx-auto w-56 max-w-full" />
      <a href={qr.checkoutUrl} target="_blank" rel="noopener noreferrer">{tr("reception:paymentForm.openPaymentPage")}</a>
      <p role="status">{tr("reception:paymentForm.awaitingConfirmationOfFullPayment")}</p>
      {syncQr.error && <p role="alert">{tr("reception:paymentForm.unableToCheckTheTransactionPleaseTryAgain")}</p>}
      <Button variant="secondary" busy={syncQr.isFetching} onClick={() => void syncQr.refetch()}>{tr("reception:bankTransferQr.checkPayment")}</Button>
    </>)}
    {message && <p role="alert">{resolveMessage(message)}</p>}
    <div className="dialog-actions">{(pendingOnline || (qr && syncQr.data !== false)) && changeMethod}<Button variant="secondary" onClick={() => setQrOpen(false)}>{tr("reception:paymentForm.close")}</Button></div>
  </Dialog>;
  if (pendingOnline || (qr && syncQr.data !== false)) return <section className="panel guest-box">
    <h2>{tr("reception:paymentForm.awaitingPaymentVerification")}</h2>
    <p>{tr("reception:paymentForm.theSystemChecksTransactionsAutomaticallyWaitForConfirmationBeforeCollectingMore")}</p>
    <div className="guest-actions">
      <Button busy={startQr.isPending} disabled={cancelQr.isPending} onClick={openQr}>{tr("reception:paymentForm.pay")}</Button>
      {changeMethod}
    </div>
    {message && <p role="alert">{resolveMessage(message)}</p>}
    {qrDialog}
  </section>;
  return <section className="panel guest-box desk-payment"><h2>{tr("reception:paymentForm.recordPaymentAtReception")}</h2><form noValidate onSubmit={event => { void form.handleSubmit(v => { if (v.amount !== invoice.balance) { form.setValue('amount', invoice.balance); return; } if (v.method === 'BANK_TRANSFER') { openQr(); return; } if (!lock.current) void send({ key: crypto.randomUUID(), invoiceId: invoice.id, userId: user!.id, amount: v.amount, method: v.method, checkout: true, rejected: false }); })(event); }}>
    <input type="hidden" {...form.register('amount')} />
    <div className="form-field"><span>{tr("reception:paymentForm.amountToCollectInFull")}</span><strong>{money(invoice.balance)}</strong><p className="field-hint">{tr("reception:paymentForm.collectTheEntireRemainingBalanceToCompletePaymentAndCheckOut")}</p></div>
    <FormField name="payment-method" label={tr("reception:paymentForm.method")}><select id="payment-method" className="input" disabled={startQr.isPending} {...form.register('method')}><option value="CASH">{tr("reception:cashier.cash")}</option><option value="BANK_TRANSFER">{tr("reception:paymentForm.bankTransfer")}</option></select></FormField>
    {message && <p role="alert" className="form-error">{resolveMessage(message)}</p>}
    <Button type="submit" busy={mutation.isPending || startQr.isPending}>{method === 'BANK_TRANSFER' ? tr("reception:paymentForm.pay") : tr("reception:paymentForm.payInFullCheckOut")}</Button>
  </form>{qrDialog}</section>;
}
