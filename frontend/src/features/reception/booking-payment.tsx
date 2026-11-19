import { t as tr, useLocale } from "../../i18n";
import { useState } from 'react';
import { Button, Dialog } from '../../components/ui';
import { BookingQr } from '../guest/booking-qr';

export function DeskBookingPayment({ bookingId, embedded = false }: { bookingId: string; embedded?: boolean }) {
  useLocale();
  const [open, setOpen] = useState(false);
  if (embedded) return <BookingQr bookingId={bookingId} />;
  return <section className="panel guest-box space-y-3" aria-label={tr("reception:bookingPayment.reservationPaymentAtReception")}>
    <h2 className="font-semibold">{tr("reception:bookingPayment.payosBankTransferPayment")}</h2>
    <Button onClick={() => setOpen(true)}>{tr("reception:bookingPayment.openPaymentQr")}</Button>
    {open && <Dialog open onClose={() => setOpen(false)} title={tr("reception:bookingPayment.roomPayment")} className="desk-room-action-modal">
      <div className="drawer-body p-4 sm:p-6"><BookingQr bookingId={bookingId} /></div>
    </Dialog>}
  </section>;
}
