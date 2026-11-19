import { t as tr, useLocale } from "../../i18n";
import type { Booking } from './contracts';
import { GuestBadge } from './components';

export function bookingOverdue(booking: Pick<Booking, 'status' | 'checkIn' | 'checkOut'>, now = new Date()) {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
  if (['PENDING', 'CONFIRMED'].includes(booking.status) && booking.checkIn < today)
    return 'arrival';
  if (booking.status === 'CHECKED_IN' && booking.checkOut < today)
    return 'departure';
  return null;
}

export function BookingStatus({ booking, detail = false }: { booking: Booking; detail?: boolean }) {
  useLocale();
  const overdue = bookingOverdue(booking);
  return (
    <div className="stay-status-wrap">
      {overdue === 'arrival' ? (
        <span className="status-badge badge-overdue">
          <i aria-hidden="true" />
          {tr("guest:bookingStatus.checkInOverdue")}</span>
      ) : (
        <GuestBadge
          status={booking.status}
          label={booking.status === 'CANCELLED' ? tr("guest:bookingStatus.cancelled") : booking.holdState === 'CHECKING_PAYMENT' ? tr("guest:bookingStatus.paymentVerificationInProgress") : booking.status === 'PENDING' ? (booking.onlinePaymentRequired ? tr("guest:bookingStatus.awaitingPayment") : tr("guest:bookingStatus.awaitingConfirmation")) : undefined}
        />
      )}
      {overdue === 'departure' && (
        <span className="status-badge badge-overdue" role="status">
          <i aria-hidden="true" />
          {tr("guest:bookingStatus.checkOutOverdue")}</span>
      )}
      {detail && overdue && (
        <p className="pending-orders-alert">
          {overdue === 'arrival'
            ? tr("guest:bookingStatus.yourCheckInDateHasPassedContactReceptionToConfirmChangeDates")
            : tr("guest:bookingStatus.yourScheduledCheckOutDateHasPassedYourStayIsStillActive")}
        </p>
      )}
    </div>
  );
}
