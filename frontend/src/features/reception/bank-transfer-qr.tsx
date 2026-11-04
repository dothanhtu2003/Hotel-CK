import { useEffect, useEffectEvent, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import QRCode from 'qrcode';
import { api } from '../../lib/api';
import { Button } from '../../components/ui';
import { money } from '../guest/contracts';
import { useRefreshDesk } from './queries';

type Link = { paid: boolean; checkoutUrl?: string; qrCode?: string; closed?: boolean; expired?: boolean };
export function BankTransferQr({ orderId, amount, onPaid, onClosed, guest = false, expiresAt }: { orderId: string; amount: string; guest?: boolean; expiresAt?: number; onPaid: () => void; onClosed: () => void }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => { if (!expiresAt) return; const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, [expiresAt]);
  const refresh = useRefreshDesk();
  const link = useQuery({ queryKey: ['service-payos-link', orderId], queryFn: async () => { try { return await api.request<Link>(`/service-orders/${orderId}/payos`, { method: 'POST' }); } finally { void refresh(); } }, retry: false, staleTime: 0, refetchOnWindowFocus: false });
  const sync = useQuery({ queryKey: ['service-payos-sync', orderId, link.data?.checkoutUrl], queryFn: () => api.request<{ paid: boolean; closed: boolean; expired?: boolean }>(`/service-orders/${orderId}/payos/sync`, { method: 'POST' }), enabled: !!link.data && !link.data.paid, refetchInterval: query => query.state.data?.paid || query.state.data?.closed ? false : 5000, retry: false });
  const cancel = useMutation({ mutationFn: () => api.request<{ paid: boolean; closed: boolean; expired?: boolean }>(`/service-orders/${orderId}/payos/cancel`, { method: 'POST' }), onSuccess: async result => { await refresh(); if (result.paid) onPaid(); else if (result.closed) onClosed(); else void sync.refetch(); } });
  const expired = link.data?.expired || sync.data?.expired || (!!expiresAt && now >= expiresAt);
  const paid = link.data?.paid || sync.data?.paid;
  const notifyPaid = useEffectEvent(() => { void refresh(); onPaid(); });
  useEffect(() => { if (paid) notifyPaid(); }, [paid]);
  const notifyExpired = useEffectEvent(() => { void refresh(); });
  useEffect(() => { if (expired) notifyExpired(); }, [expired]);
  const image = useQuery({ queryKey: ['service-payos-qr', link.data?.qrCode], queryFn: () => QRCode.toDataURL(link.data!.qrCode!, { width: 256, margin: 2, errorCorrectionLevel: 'M' }), enabled: !!link.data?.qrCode, retry: false });
  return <section aria-label="QR thanh toán payOS" className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm space-y-2">
    {!expired && expiresAt && <p>Thời gian thanh toán còn lại: {Math.floor(Math.max(0, expiresAt - now) / 60000)}:{String(Math.floor(Math.max(0, expiresAt - now) / 1000) % 60).padStart(2, '0')}</p>}
    <p className="font-semibold">Thanh toán {money(amount)} qua payOS</p>
    {link.isPending && <p role="status">Đang tạo mã QR payOS…</p>}
    {image.data && !expired && !sync.data?.closed && <img src={image.data} alt={`Mã QR payOS thanh toán ${money(amount)}`} className="mx-auto w-56 max-w-full rounded-lg" />}
    {link.data?.checkoutUrl && !expired && !sync.data?.closed && <a href={link.data.checkoutUrl} target="_blank" rel="noopener noreferrer" className="underline text-brand-700">Mở trang thanh toán payOS</a>}
    {expired && <p role="status">Đã quá hạn thanh toán 15 phút. Đơn chưa thanh toán sẽ được hủy sau khi đối soát.</p>}
    {!expired && sync.data?.closed && <p role="status">Mã QR đã hết hiệu lực.</p>}
    {(link.error || sync.error || cancel.error || image.error) && <p role="alert">Chưa thể tải hoặc kiểm tra thanh toán payOS. Vui lòng thử lại.</p>}
    <div className="flex flex-wrap gap-2">
      {!expired && (link.error || sync.data?.closed) && <Button type="button" variant="secondary" onClick={() => void link.refetch()}>{sync.data?.closed ? 'Tạo QR mới' : 'Tải lại QR'}</Button>}
      {!expired && link.data && !paid && <Button type="button" variant="secondary" busy={sync.isFetching} onClick={() => void sync.refetch()}>Kiểm tra thanh toán</Button>}
      {!guest && !link.isPending && !paid && !expired && !sync.data?.closed && <Button type="button" variant="secondary" busy={cancel.isPending} onClick={() => cancel.mutate()}>Đổi cách thanh toán</Button>}
    </div>
  </section>;
}
