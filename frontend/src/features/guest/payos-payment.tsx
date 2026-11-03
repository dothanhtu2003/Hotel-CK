import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { api } from '../../lib/api';
import { Button } from '../../components/ui';
import { money, type Invoice } from './contracts';

export function PayosPayment({ invoice }: { invoice: Invoice }) {
  const cache = useQueryClient();
  const [params] = useSearchParams();
  const paid = invoice.status === 'PAID';
  const pending = invoice.payments.some(p => p.status === 'PENDING');
  const sync = useQuery({
    queryKey: ['payos', invoice.id],
    queryFn: () => api.request(`/invoices/${invoice.id}/payos/sync`, { method: 'POST' }),
    enabled: !paid && (pending || params.has('payos')),
    refetchInterval: !paid && pending ? 5000 : false,
    retry: false,
  });
  useEffect(() => {
    if (sync.dataUpdatedAt) void cache.invalidateQueries({ queryKey: ['guest'] });
  }, [sync.dataUpdatedAt, cache]);
  const start = useMutation({
    mutationFn: () => api.request<{ checkoutUrl: string }>(`/invoices/${invoice.id}/payos`, { method: 'POST' }),
    onSuccess: data => { window.location.assign(data.checkoutUrl); },
  });
  if (paid) return <p role="status" className="notice">Đã thanh toán đủ. Vui lòng liên hệ lễ tân để hoàn tất trả phòng.</p>;
  if (invoice.booking.status !== 'CHECKED_IN') return null;
  return <div className="guest-box" aria-label="Thanh toán trực tuyến">
    <h3>Thanh toán trực tuyến qua payOS</h3>
    <p>Thanh toán {money(invoice.balance)} bằng mã QR hoặc ứng dụng ngân hàng. Hóa đơn sẽ cập nhật sau khi giao dịch được xác minh.</p>
    {params.get('payos') === 'cancel' && <p role="status">Bạn đã quay lại từ trang thanh toán. Hệ thống đang kiểm tra trạng thái giao dịch.</p>}
    {(start.error || sync.error) && <p role="alert">Chưa thể kết nối payOS. Vui lòng thử lại hoặc liên hệ lễ tân.</p>}
    <div className="guest-actions">
      <Button busy={start.isPending} disabled={sync.isFetching} onClick={() => start.mutate()}>Thanh toán qua payOS</Button>
      <Button variant="secondary" busy={sync.isFetching} disabled={start.isPending} onClick={() => void sync.refetch()}>Kiểm tra thanh toán</Button>
    </div>
  </div>;
}
