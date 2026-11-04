import { useState } from 'react';
import { Button, Dialog } from '../../components/ui';
import { BookingQr } from '../guest/booking-qr';

export function DeskBookingPayment({ bookingId, embedded = false }: { bookingId: string; embedded?: boolean }) {
  const [open, setOpen] = useState(false);
  if (embedded) return <BookingQr bookingId={bookingId} />;
  return <section className="panel guest-box space-y-3" aria-label="Thanh toán booking tại quầy">
    <h2 className="font-semibold">Thanh toán chuyển khoản payOS</h2>
    <Button onClick={() => setOpen(true)}>Mở mã QR thanh toán</Button>
    {open && <Dialog open onClose={() => setOpen(false)} title="Thanh toán tiền phòng" className="desk-room-action-modal">
      <div className="drawer-body p-4 sm:p-6"><BookingQr bookingId={bookingId} /></div>
    </Dialog>}
  </section>;
}
