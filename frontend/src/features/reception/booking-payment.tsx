import { useEffect, useRef } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Button } from '../../components/ui';
import { money } from '../guest/contracts';
import type { BookingPaymentState } from '../guest/booking-payment';
import { useRefreshDesk } from './queries';

export function DeskBookingPayment({ bookingId }: { bookingId: string }) {
  const refresh = useRefreshDesk();
  const refreshed = useRef(false);
  const state = useQuery({ queryKey: ['reception', 'booking-payment', bookingId],
    queryFn: async () => {
      await api.request(`/bookings/${bookingId}/payos/sync`, { method: 'POST' });
      return api.request<BookingPaymentState>(`/bookings/${bookingId}/payment-state`);
    }, refetchInterval: query => query.state.data?.paid || query.state.data?.bookingStatus === 'CANCELLED' ? false : 5000,
  });
  const start = useMutation({ mutationFn: () => api.request<{ checkoutUrl: string }>(`/bookings/${bookingId}/payos`, { method: 'POST' }) });
  useEffect(() => { if (state.data?.paid && !refreshed.current) { refreshed.current = true; void refresh(); } }, [state.data?.paid, refresh]);
  const terminal = state.data?.bookingStatus === 'CANCELLED' || state.data?.holdState === 'EXPIRED';
  return <section className="panel guest-box space-y-3" aria-label="Thanh toán booking tại quầy">
    <h2 className="font-semibold">Thanh toán chuyển khoản payOS</h2>
    {state.data?.paid ? <p role="status">Đã thanh toán {money(state.data.paidAmount)}. Booking đã được xác nhận; có thể thực hiện nhận phòng.</p> : <>
      <p>Booking đang chờ thanh toán. Chỉ xác nhận sau khi payOS ghi nhận đủ tiền.</p>
      {state.data && <p>Tổng tiền: <strong>{money(state.data.totalAmount)}</strong>{state.data.expiredAt && <> · Hạn thanh toán: {new Date(state.data.expiredAt).toLocaleString('vi-VN')}</>}</p>}
      {terminal ? <p role="alert">Booking đã hủy hoặc hết hạn giữ phòng. Vui lòng kiểm tra trước khi đặt lại.</p> : state.data?.paymentReview ? <p role="alert">Giao dịch cần đối soát. Không thu thêm tiền.</p> : <div className="flex flex-wrap gap-2">
        <Button busy={start.isPending} disabled={!state.data || state.isFetching || state.data.holdState !== 'ACTIVE'} onClick={() => start.mutate()}>Tạo / lấy lại liên kết payOS</Button>
        {start.data && <a className="button button-primary" href={start.data.checkoutUrl} target="_blank" rel="noopener noreferrer">Mở trang thanh toán payOS ↗</a>}
      </div>}
    </>}
    <Button variant="secondary" busy={state.isFetching} onClick={() => void state.refetch()}>Kiểm tra thanh toán</Button>
    {(start.error || state.error) && <p role="alert">Chưa kết nối được payOS. Booking vẫn được lưu; hãy thử lại hoặc mở lại từ chi tiết đặt phòng.</p>}
  </section>;
}
