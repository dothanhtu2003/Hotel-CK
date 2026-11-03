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
  const overdue = bookingOverdue(booking);
  return (
    <div className="stay-status-wrap">
      {overdue === 'arrival' ? (
        <span className="status-badge badge-overdue">
          <i aria-hidden="true" />
          Quá hạn nhận phòng
        </span>
      ) : (
        <GuestBadge
          status={booking.status}
          label={booking.status === 'PENDING' ? (booking.onlinePaymentRequired ? 'Chờ thanh toán' : 'Chờ xác nhận') : undefined}
        />
      )}
      {overdue === 'departure' && (
        <span className="status-badge badge-overdue" role="status">
          <i aria-hidden="true" />
          Quá hạn trả phòng
        </span>
      )}
      {detail && overdue && (
        <p className="pending-orders-alert">
          {overdue === 'arrival'
            ? 'Đã qua ngày nhận phòng. Vui lòng liên hệ lễ tân để xác nhận, đổi lịch hoặc hủy booking.'
            : 'Đã qua ngày trả phòng dự kiến. Bạn vẫn đang lưu trú; vui lòng liên hệ lễ tân để gia hạn hoặc hoàn tất trả phòng.'}
        </p>
      )}
    </div>
  );
}
