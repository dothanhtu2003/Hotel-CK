import { BankTransferQr } from './bank-transfer-qr';
import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Dialog } from '../../components/ui';
import { api } from '../../lib/api';
import { money, type Order } from '../guest/contracts';
import { deskError } from './contracts';
import { useRefreshDesk } from './queries';

export function ServiceOrderActions({ order }: { order: Order }) {
  const [delivering, setDelivering] = useState(false);
  const [action, setAction] = useState<'settle' | 'cancel' | null>(null);
  const [settlement, setSettlement] = useState<'ROOM' | 'CASH' | 'BANK_TRANSFER'>('ROOM');
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const refresh = useRefreshDesk();
  useQuery({
    queryKey: ['reception', 'service-payment-sync', order.id],
    enabled: order.requestedPaymentMethod === 'BANK_TRANSFER' && !order.paymentMethod && order.payosStatus === 'PENDING' && order.status !== 'CANCELLED',
    queryFn: async () => {
      const result = await api.request<{ paid: boolean }>(`/service-orders/${order.id}/payos/sync`, { method: 'POST' });
      if (result.paid) void refresh();
      return result;
    },
    refetchInterval: 5000, retry: false,
  });
  if (order.status === 'CANCELLED') return null;
  if (order.requestedPaymentMethod) {
    const cash = order.requestedPaymentMethod === 'CASH' && !order.paymentMethod;
    const canComplete = !!order.paymentMethod || (cash && order.payosStatus !== 'PENDING');
    return <>
      {order.deliveredAt ? <span className="text-sm text-emerald-700">Hoàn thành</span> : canComplete ? (
        <Button busy={delivering} onClick={async () => {
          if (lock.current) return;
          lock.current = true; setDelivering(true); setError('');
          try {
            await api.request(`/service-orders/${order.id}/${cash ? 'collect-and-deliver' : 'deliver'}`, { method: 'PATCH', ...(cash ? { body: { settlement: 'CASH', paymentVerified: true, expectedAmount: order.totalAmount } } : {}) });
            await refresh();
          } catch (caught) { setError(deskError(caught instanceof Error ? caught : new Error('Không thể hoàn tất đơn.'))); }
          finally { lock.current = false; setDelivering(false); }
        }}>{cash ? 'Nhận tiền và hoàn tất' : 'Đã giao'}</Button>
      ) : <span className="text-sm text-zinc-600">Chờ khách thanh toán chuyển khoản</span>}
      {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
    </>;
  }
  const refund = action === 'cancel' && !!order.paymentMethod;
  const verificationRequired = refund || (action === 'settle' && settlement === 'CASH');
  return <>
    {!order.paymentMethod && <Button variant={order.status === 'PENDING' ? 'primary' : 'secondary'} className="text-xs px-3 py-1.5 rounded-lg shadow-2xs" onClick={() => { setAction('settle'); setSettlement(order.payosStatus === 'PENDING' ? 'BANK_TRANSFER' : (order.status === 'PENDING' ? 'ROOM' : 'CASH')); setVerified(false); setError(''); }}>{order.status === 'PENDING' ? 'Ghi nhận đơn' : 'Thu tiền ngay'}</Button>}
    <Button variant="secondary" className="text-xs px-3 py-1.5 rounded-lg" onClick={() => { setAction('cancel'); setVerified(false); setError(''); }}>{order.paymentMethod ? 'Hủy & hoàn tiền' : 'Hủy đơn'}</Button>
    <Dialog open={action !== null} title={action === 'cancel' ? (refund ? 'Hủy đơn và ghi nhận hoàn tiền' : 'Hủy đơn dịch vụ') : 'Thanh toán đơn dịch vụ'} onClose={() => { if (!lock.current) setAction(null); }}>
      <form className="space-y-4" onSubmit={async event => {
        event.preventDefault();
        if (lock.current || (verificationRequired && !verified) || (action === 'settle' && settlement === 'BANK_TRANSFER')) return;
        lock.current = true; setBusy(true); setError('');
        try {
          await api.request(`/service-orders/${order.id}/${action}`, { method: 'PATCH', body: action === 'cancel' ? { ...(refund ? { refundConfirmed: verified } : {}) } : { settlement, ...(settlement !== 'ROOM' ? { paymentVerified: verified, expectedAmount: order.totalAmount } : {}) } });
          setAction(null);
          await refresh();
        } catch (caught) { setError(deskError(caught instanceof Error ? caught : new Error('Không thể ghi nhận.'))); }
        finally { lock.current = false; setBusy(false); }
      }}>
        <p>Đơn #{order.id.slice(0, 8)} · <strong>{money(order.totalAmount)}</strong></p>
        {action === 'settle' && <label className="block text-sm space-y-1">Cách thanh toán
          <select aria-label="Cách thanh toán" className="input w-full" value={settlement} disabled={busy} onChange={event => { setSettlement(event.target.value as typeof settlement); setVerified(false); }}>
            {order.status === 'PENDING' && !order.requestedPaymentMethod && <option value="ROOM" disabled={order.payosStatus === 'PENDING'}>Ghi vào hóa đơn phòng</option>}
            <option value="CASH" disabled={order.payosStatus === 'PENDING'}>Thanh toán ngay · Tiền mặt</option>
            <option value="BANK_TRANSFER">Thanh toán ngay · Chuyển khoản</option>
          </select>
        </label>}
        {action === 'settle' && settlement === 'BANK_TRANSFER' && <BankTransferQr orderId={order.id} amount={order.totalAmount} onPaid={() => setAction(null)} onClosed={() => setSettlement('CASH')} />}
        {verificationRequired ? <label className="flex items-start gap-2 text-sm"><input type="checkbox" required disabled={busy} checked={verified} onChange={event => setVerified(event.target.checked)} />{refund ? `Tôi đã hoàn đủ ${money(order.totalAmount)} cho khách. Thao tác này chỉ ghi nhận, không tự chuyển tiền.` : `Tôi đã nhận và kiểm tra đủ ${money(order.totalAmount)}. Khoản này sẽ không thu lại khi trả phòng.`}</label> : settlement === 'BANK_TRANSFER' && action === 'settle' ? null : <p className="text-sm text-zinc-500">{action === 'cancel' ? 'Đơn sẽ được hủy và không tính phí vào hóa đơn phòng.' : 'Khoản dịch vụ sẽ được ghi vào hóa đơn phòng để thanh toán sau.'}</p>}
        {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" disabled={busy} onClick={() => setAction(null)}>Đóng</Button><Button type="submit" busy={busy} disabled={(verificationRequired && !verified) || (action === 'settle' && settlement === 'BANK_TRANSFER')}>{action === 'cancel' ? (refund ? 'Xác nhận đã hoàn tiền & hủy' : 'Xác nhận hủy') : 'Lưu thanh toán'}</Button></div>
      </form>
    </Dialog>
  </>;
}
