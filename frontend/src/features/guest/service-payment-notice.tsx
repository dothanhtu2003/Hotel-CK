import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { catalog } from './queries';
import type { Order } from './contracts';

export function pendingQrPayment(order: Order, now = Date.now()) {
  return order.status === 'PENDING' && order.requestedPaymentMethod === 'BANK_TRANSFER' && !order.paymentMethod &&
    order.payosStatus !== 'CLOSED' && Date.parse(order.orderedAt) + 15 * 60_000 > now;
}
export function usePendingServicePayments(enabled = true) {
  const query = useQuery({ queryKey: ['guest', 'unpaid-service-qr'],
    queryFn: ({ signal }) => catalog<Order>('/service-orders/my?status=PENDING', signal),
    enabled, refetchInterval: 5000,
  });
  return (query.data ?? []).filter(order => pendingQrPayment(order));
}
export function ServicePaymentBadge({ count }: { count: number }) {
  return count > 0 ? <span aria-label={`${count} đơn dịch vụ chưa thanh toán QR`} className="inline-flex min-w-5 items-center justify-center rounded-full bg-amber-600 px-1.5 py-0.5 text-[10px] font-bold text-white">{count}</span> : null;
}
export function ServicePaymentNotice({ count }: { count: number }) {
  if (!count) return null;
  return <div role="status" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
    <span>Bạn có <strong>{count} đơn dịch vụ chưa thanh toán QR</strong>. Hoàn tất thanh toán để khách sạn xử lý đơn.</span>
    <Link to="/guest/service-orders?status=PENDING" className="font-semibold underline">Tiếp tục thanh toán →</Link>
  </div>;
}
