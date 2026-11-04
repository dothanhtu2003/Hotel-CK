import { BookingQr } from './booking-qr';
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { api } from '../../lib/api';
import { Button, Dialog } from '../../components/ui';
import { money, type Booking } from './contracts';

export type BookingPaymentState = { expiredAt?:string|null; serverNow?:string; holdState?:string|null; paymentReview?:boolean; receivedAmount?:string; required: boolean; paid: boolean; pending: boolean; totalAmount: string; paidAmount: string; bookingStatus: string };

export function BookingPayment({ booking }: { booking: Booking }) {
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
  if (booking.status === 'CANCELLED' || state.data?.bookingStatus === 'CANCELLED') return <section className="panel guest-box" aria-label="Thông tin thanh toán booking đã hủy">
    <h2>{expired ? 'Booking đã hủy do hết hạn thanh toán' : 'Booking đã hủy'}</h2>
    {state.isPending ? <p>Đang kiểm tra lịch sử thanh toán…</p> : state.error ? <p role="alert">Chưa tải được lịch sử thanh toán. Vui lòng thử lại hoặc liên hệ lễ tân.</p> : state.data?.paymentReview ? <p role="alert">Đã nhận {money(state.data.receivedAmount ?? '0')}. Khoản tiền đang được lễ tân đối soát để xử lý hoàn tiền. Vui lòng không thanh toán thêm.</p> : <p role="status">{expired ? 'Booking đã tự động hủy và phòng đã được giải phóng. Vui lòng đặt lại nếu bạn vẫn muốn lưu trú.' : 'Booking đã kết thúc. Không cần thanh toán tiền phòng cho booking này. Nếu bạn đã chuyển tiền nhưng chưa được ghi nhận, vui lòng liên hệ lễ tân.'}</p>}
  </section>;
  return <section className="panel guest-box booking-online-payment" aria-label="Thanh toán tiền phòng">
    <h2>Thanh toán toàn bộ tiền phòng</h2>
    {state.data?.paymentReview && <p role="alert">Đã nhận {money(state.data.receivedAmount ?? '0')} nhưng cần đối soát/hoàn tiền. Lễ tân đã có thông tin để xử lý. Vui lòng không thanh toán thêm.</p>}
    {expired ? <p role="status">Đã hết hạn thanh toán, phòng đã được giải phóng. Vui lòng đặt lại nếu bạn vẫn muốn lưu trú.</p> : !state.data?.paid && booking.status === 'PENDING' && <p role="status">{checking ? 'Đã hết hạn thanh toán. Hệ thống đang xác minh giao dịch để tự động hủy booking chưa thanh toán.' : remaining !== null ? `Thời gian giữ phòng còn lại: ${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')}` : 'Đang tải hạn giữ phòng…'}</p>}
    {state.data?.paid ? <p role="status">Đã thanh toán tiền phòng: {money(state.data.paidAmount)}.</p> : !checking && !expired && <>
      <p>Thanh toán <strong>{money(booking.totalRoomAmount)}</strong> để xác nhận đặt phòng.</p>
      {booking.status === 'PENDING' && !expired && <div className="guest-actions">
        <Button disabled={sync.isFetching || checking || !!state.data?.paymentReview || state.isPending} onClick={() => setQrOpen(true)}>Thanh toán ngay qua payOS</Button>
        <Button variant="secondary" busy={sync.isFetching} disabled={qrOpen} onClick={() => void sync.refetch()}>Kiểm tra thanh toán</Button>
      </div>}
    </>}
    {(sync.error || state.error) && <p role="alert">Chưa thể kết nối thanh toán. Vui lòng thử lại hoặc liên hệ lễ tân. Booking chưa được xác nhận nếu chưa thanh toán đủ.</p>}
    {qrOpen && <Dialog open onClose={() => setQrOpen(false)} title="Thanh toán tiền phòng" className="desk-room-action-modal"><div className="drawer-body p-4 sm:p-6"><BookingQr bookingId={booking.id} /></div></Dialog>}
    {state.data?.paid && ['CONFIRMED', 'PENDING'].includes(booking.status) && <p>Cần hủy hoặc đổi lịch? Vui lòng liên hệ lễ tân để được hỗ trợ và kiểm tra khoản hoàn tiền.</p>}
  </section>;
}
