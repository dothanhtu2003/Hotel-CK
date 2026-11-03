import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { api } from '../../lib/api';
import { Button } from '../../components/ui';
import { money, type Booking } from './contracts';

export type BookingPaymentState = { required: boolean; paid: boolean; pending: boolean; totalAmount: string; paidAmount: string; bookingStatus: string };

export function BookingPayment({ booking }: { booking: Booking }) {
  const cache = useQueryClient();
  const [params] = useSearchParams();
  const state = useQuery({ queryKey: ['guest', 'booking-payment', booking.id],
    queryFn: () => api.request<BookingPaymentState>(`/bookings/${booking.id}/payment-state`),
  });
  const sync = useQuery({ queryKey: ['booking-payos', booking.id],
    queryFn: () => api.request(`/bookings/${booking.id}/payos/sync`, { method: 'POST' }),
    enabled: !state.data?.paid && booking.status === 'PENDING' && (state.data?.pending === true || params.has('payos')),
    refetchInterval: !state.data?.paid && state.data?.pending ? 5000 : false, retry: false,
  });
  useEffect(() => { if (sync.dataUpdatedAt) void cache.invalidateQueries({ queryKey: ['guest'] }); }, [sync.dataUpdatedAt, cache]);
  const start = useMutation({ mutationFn: () => api.request<{ checkoutUrl: string }>(`/bookings/${booking.id}/payos`, { method: 'POST' }),
    onSuccess: data => window.location.assign(data.checkoutUrl),
  });
  return <section className="panel guest-box booking-online-payment" aria-label="Thanh toán tiền phòng">
    <h2>Thanh toán toàn bộ tiền phòng</h2>
    {state.data?.paid ? <p role="status">Đã thanh toán {money(state.data.paidAmount)} tiền phòng. Khoản này được trừ vào hóa đơn cuối kỳ. Dịch vụ phát sinh thanh toán riêng.</p> : <>
      <p>Thanh toán <strong>{money(booking.totalRoomAmount)}</strong> qua payOS để xác nhận đặt phòng. Booking chỉ được xác nhận sau khi nhận đủ tiền phòng.</p>
      <p>Dịch vụ phát sinh được tính riêng khi trả phòng.</p>
      {booking.status === 'PENDING' && <div className="guest-actions">
        <Button busy={start.isPending} disabled={sync.isFetching} onClick={() => start.mutate()}>Thanh toán ngay qua payOS</Button>
        <Button variant="secondary" busy={sync.isFetching} disabled={start.isPending} onClick={() => void sync.refetch()}>Kiểm tra thanh toán</Button>
      </div>}
    </>}
    {(start.error || sync.error || state.error) && <p role="alert">Chưa thể kết nối thanh toán. Vui lòng thử lại hoặc liên hệ lễ tân. Booking chưa được xác nhận nếu chưa thanh toán đủ.</p>}
    {state.data?.paid && ['CONFIRMED', 'PENDING'].includes(booking.status) && <p>Cần hủy hoặc đổi lịch? Vui lòng liên hệ lễ tân để được hỗ trợ và kiểm tra khoản hoàn tiền.</p>}
  </section>;
}
