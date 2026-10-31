import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { BellRing, CheckCircle2, Clock, ExternalLink, User } from 'lucide-react';
import { api } from '../../lib/api';
import { Dialog } from '../../components/ui';
import { money, type Booking, type Order, type Page } from '../guest/contracts';
import { ServiceOrderActions } from './service-order-actions';
import { useDeskBase } from './queries';

type RoomOrder = Order & { roomNumber: string; customerName: string; reference: string; canProcess: boolean; checkoutBookingId?: string };

export function useRoomRequests() {
  return useQuery({
    queryKey: ['reception', 'room-board-requests'],
    queryFn: async ({ signal }) => {
      const orders: RoomOrder[] = [];
      let page = 1;
      let pages: number;
      do {
        const result = await api.request<Page<RoomOrder>>(`/front-desk/orders?status=PENDING&pageSize=100&page=${page}`, { signal });
        orders.push(...result.data);
        pages = result.meta.totalPages;
        page++;
      } while (page <= pages);
      const checkouts = await api.request<(Booking & { customerName: string })[]>('/bookings/checkout-requests', { signal });
      orders.push(...checkouts.map((booking): RoomOrder => ({
        id: `checkout-${booking.id}`, bookingId: booking.id, checkoutBookingId: booking.id,
        roomNumber: booking.roomNumber, customerName: booking.customerName, reference: booking.reference,
        canProcess: false, status: 'PENDING', orderedAt: booking.checkoutRequestedAt!, items: [], totalAmount: '0',
      })));
      return orders.sort((a, b) => a.orderedAt.localeCompare(b.orderedAt));
    },
    refetchInterval: 30000,
  });
}

export function RoomRequestsDrawer({
  roomNumber,
  orders,
  onClose,
}: {
  roomNumber: string;
  orders: RoomOrder[];
  onClose: () => void;
}) {
  const base = useDeskBase();

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Phòng ${roomNumber} · Yêu cầu của khách`}
      className="desk-room-action-modal"
    >
      <div className="drawer-body p-4 sm:p-5 space-y-4">
        {/* Room & Requests Hero Header */}
        <div className="rounded-2xl bg-white p-4 border border-zinc-200/90 shadow-2xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white font-extrabold text-lg flex items-center justify-center shadow-md shadow-amber-900/20 ring-4 ring-amber-50 shrink-0">
              <BellRing className="size-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-zinc-900 tracking-tight">
                  Phòng {roomNumber}
                </h3>
                <span className="text-xs font-semibold text-amber-900 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-200">
                  {orders.length} yêu cầu chờ xử lý
                </span>
              </div>
              <p className="text-xs text-zinc-500 mt-1 flex items-center gap-1.5">
                <span className="inline-block size-2 rounded-full bg-emerald-500 animate-pulse" />
                Tự động đồng bộ mỗi 30s · Ưu tiên đơn gửi trước
              </p>
            </div>
          </div>
        </div>

        {/* Empty state if all processed */}
        {!orders.length ? (
          <div
            role="status"
            className="rounded-2xl bg-emerald-50/80 border border-emerald-200 p-6 text-center space-y-2"
          >
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-2xs">
              <CheckCircle2 className="size-6" />
            </div>
            <h4 className="text-sm font-bold text-emerald-950">Đã xử lý hết yêu cầu</h4>
            <p className="text-xs text-emerald-700 max-w-sm mx-auto">
              Hiện không còn yêu cầu nào đang chờ xử lý cho phòng {roomNumber}.
            </p>
          </div>
        ) : (
          <div className="space-y-3.5">
            {orders.map((order) => (
              <article
                key={order.id}
                className="rounded-2xl border border-zinc-200/90 bg-white p-4 space-y-3.5 shadow-xs hover:border-amber-300 transition-colors"
              >
                {/* Order Header */}
                <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-zinc-100">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-200 shadow-2xs">
                      <BellRing size={13} className="text-amber-700" />
                      Chờ xử lý
                    </span>
                    <span className="font-mono text-xs font-semibold text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded-md border border-zinc-200/80">
                      #{order.reference}
                    </span>
                  </div>
                  <time
                    className="text-xs text-zinc-500 flex items-center gap-1 tabular-nums"
                    dateTime={order.orderedAt}
                  >
                    <Clock size={13} className="text-zinc-400" />
                    {new Date(order.orderedAt).toLocaleString('vi-VN', {
                      timeZone: 'Asia/Bangkok',
                      hour: '2-digit',
                      minute: '2-digit',
                      day: '2-digit',
                      month: '2-digit',
                    })}
                  </time>
                </div>

                {/* Customer */}
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-zinc-500 flex items-center gap-1">
                    <User size={13} className="text-zinc-400" />
                    Khách hàng:
                  </span>
                  <strong className="text-zinc-900 font-semibold">{order.customerName}</strong>
                </div>

                {order.checkoutBookingId ? (
                  <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 space-y-3">
                    <h4 className="font-bold text-amber-900">Yêu cầu trả phòng</h4>
                    <p className="text-sm text-zinc-600">Khách đang chờ kiểm tra phòng và thanh toán. Yêu cầu được giữ đến khi hoàn tất trả phòng.</p>
                    <Link className="text-link" to={`${base}/bookings/${order.checkoutBookingId}/billing`} onClick={onClose}>Xử lý trả phòng</Link>
                  </div>
                ) : <>
                {/* Item details list */}
                <div className="rounded-xl bg-zinc-50 border border-zinc-200/70 p-3 space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                    Dịch vụ yêu cầu
                  </div>
                  <ul className="space-y-1.5">
                    {order.items.map((item) => (
                      <li key={item.id} className="flex items-center justify-between text-xs text-zinc-800">
                        <span className="flex items-center gap-1.5">
                          <span className="font-bold text-amber-800 bg-amber-100/80 px-1.5 py-0.5 rounded text-[11px]">
                            {item.quantity}×
                          </span>
                          <span className="font-medium">{item.serviceName}</span>
                        </span>
                        <span className="font-semibold tabular-nums text-zinc-700">
                          {money(item.subtotal || item.unitPrice)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="pt-2 border-t border-zinc-200/60 flex items-center justify-between text-xs">
                    <span className="font-semibold text-zinc-600">Tổng thanh toán:</span>
                    <strong className="text-sm font-bold text-emerald-800 tabular-nums">
                      {money(order.totalAmount)}
                    </strong>
                  </div>
                </div>

                {/* Actions & Warnings */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <Link
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-700 hover:text-zinc-900 bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 px-3 py-1.5 rounded-lg transition-colors"
                    to={`${base}/service-orders/${order.id}`}
                    onClick={onClose}
                  >
                    <ExternalLink size={13} />
                    Xem chi tiết đơn
                  </Link>

                  {order.canProcess && (
                    <ServiceOrderActions order={order} />
                  )}
                </div>

                {!order.canProcess && (
                  <div className="p-2.5 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-900 text-xs">
                    Không thể ghi nhận khi khách chưa nhận phòng, đã trả phòng hoặc đã lập hóa đơn.
                  </div>
                )}
                </>}
              </article>
            ))}
          </div>
        )}
      </div>
    </Dialog>
  );
}
