import { t as tr, useLocale } from "../../i18n";
import { Trans } from "react-i18next";
import { BookingQr } from './booking-qr';
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { api } from '../../lib/api';
import { Button, Dialog } from '../../components/ui';
import { money, type Booking } from './contracts';

export type BookingPaymentState = { expiredAt?:string|null; serverNow?:string; holdState?:string|null; paymentReview?:boolean; receivedAmount?:string; required: boolean; paid: boolean; pending: boolean; totalAmount: string; paidAmount: string; bookingStatus: string };

export function BookingPayment({ booking }: { booking: Booking }) {
  useLocale();
  const cache = useQueryClient();
  const [qrOpen, setQrOpen] = useState(false);
  const [params] = useSearchParams();
  const state = useQuery({ queryKey: ['guest', 'booking-payment', booking.id],
    queryFn: () => api.request<BookingPaymentState>(`/bookings/${booking.id}/payment-state`), refetchInterval:5000,
  });
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    const data = state.data;
    if (!data?.expiredAt || !data.serverNow) return;
    const started = performance.now(), duration = Date.parse(data.expiredAt)-Date.parse(data.serverNow);
    const update = () => setRemaining(Math.max(0, Math.ceil((duration-(performance.now()-started))/1000)));
    update(); const timer = setInterval(update,1000); return () => clearInterval(timer);
  }, [state.data]);
  const expired = state.data?.holdState === 'EXPIRED';
  const checking = state.data?.holdState === 'CHECKING_PAYMENT' || remaining === 0;
  useEffect(() => { if (state.data?.bookingStatus === 'CANCELLED') void cache.invalidateQueries({ queryKey: ['guest'] }); }, [state.data?.bookingStatus, cache]);
  const sync = useQuery({ queryKey: ['booking-payos', booking.id],
    queryFn: () => api.request(`/bookings/${booking.id}/payos/sync`, { method: 'POST' }),
    enabled: !qrOpen && !state.data?.paid && booking.status === 'PENDING' && (state.data?.pending === true || params.has('payos')),
    refetchInterval: !state.data?.paid && state.data?.pending ? 5000 : false, retry: false,
  });
  useEffect(() => { if (sync.dataUpdatedAt) void cache.invalidateQueries({ queryKey: ['guest'] }); }, [sync.dataUpdatedAt, cache]);
  if (booking.status === 'CANCELLED' || state.data?.bookingStatus === 'CANCELLED') return <section className="panel guest-box" aria-label={tr("guest:bookingPayment.paymentInformationForACancelledReservation")}>
    <h2>{expired ? tr("guest:bookingPayment.reservationCancelledBecausePaymentExpired") : tr("guest:bookingPayment.reservationCancelled")}</h2>
    {state.isPending ? <p>{tr("guest:bookingPayment.checkingPaymentHistory")}</p> : state.error ? <p role="alert">{tr("guest:bookingPayment.unableToLoadPaymentHistoryPleaseTryAgainOrContactReception")}</p> : state.data?.paymentReview ? <p role="alert">{tr("guest:bookingPayment.receivedValueReceptionIsReviewingThisPaymentToArrangeARefundPlease", { value0: (money(state.data.receivedAmount ?? '0')) })}</p> : <p role="status">{expired ? tr("guest:bookingPayment.theReservationWasAutomaticallyCancelledAndTheRoomReleasedPleaseBookAgain") : tr("guest:bookingPayment.thisReservationHasEndedNoRoomPaymentIsNeededIfYouTransferred")}</p>}
  </section>;
  return <section className="panel guest-box booking-online-payment" aria-label={tr("guest:bookingPayment.roomPayment")}>
    <h2>{tr("guest:bookingPayment.payTheFullRoomCharge")}</h2>
    {state.data?.paymentReview && <p role="alert">{tr("guest:bookingPayment.receivedValueButPaymentVerificationOrARefundReviewIsRequiredReception", { value0: (money(state.data.receivedAmount ?? '0')) })}</p>}
    {expired ? <p role="status">{tr("guest:bookingPayment.thePaymentPeriodHasExpiredAndTheRoomHasBeenReleasedPlease")}</p> : !state.data?.paid && booking.status === 'PENDING' && <p role="status">{checking ? tr("guest:bookingPayment.thePaymentPeriodHasExpiredTheSystemIsVerifyingTransactionsBeforeCancelling") : remaining !== null ? tr("guest:bookingPayment.roomHoldRemainingValueValue", { value0: (Math.floor(remaining/60)), value1: (String(remaining%60).padStart(2,'0')) }) : tr("guest:bookingPayment.loadingRoomHoldDeadline")}</p>}
    {state.data?.paid ? <p role="status">{tr("guest:bookingPayment.roomPaymentReceivedValue", { value0: (money(state.data.paidAmount)) })}</p> : !checking && !expired && <>
      <p><Trans ns="guest" i18nKey="bookingPayment.payValueToConfirmYourReservation" values={{ value0: (money(booking.totalRoomAmount)) }} components={{ part0: <strong /> }} /></p>
      {booking.status === 'PENDING' && !expired && <div className="guest-actions">
        <Button disabled={sync.isFetching || checking || !!state.data?.paymentReview || state.isPending} onClick={() => setQrOpen(true)}>{tr("guest:bookingPayment.payNowWithPayos")}</Button>
        <Button variant="secondary" busy={sync.isFetching} disabled={qrOpen} onClick={() => void sync.refetch()}>{tr("guest:bookingPayment.checkPayment")}</Button>
      </div>}
    </>}
    {(sync.error || state.error) && <p role="alert">{tr("guest:bookingPayment.unableToConnectToPaymentsTryAgainOrContactReceptionTheReservation")}</p>}
    {qrOpen && <Dialog open onClose={() => setQrOpen(false)} title={tr("guest:bookingPayment.roomPayment")} className="desk-room-action-modal"><div className="drawer-body p-4 sm:p-6"><BookingQr bookingId={booking.id} /></div></Dialog>}
    {state.data?.paid && ['CONFIRMED', 'PENDING'].includes(booking.status) && <p>{tr("guest:bookingPayment.needToCancelOrChangeDatesContactReceptionForHelpAndA")}</p>}
  </section>;
}
