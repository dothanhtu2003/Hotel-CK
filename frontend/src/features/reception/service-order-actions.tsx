import { useRef, useState } from 'react';
import { Button, Dialog } from '../../components/ui';
import { api } from '../../lib/api';
import { money, type Order } from '../guest/contracts';
import { deskError } from './contracts';
import { useRefreshDesk } from './queries';

export function ServiceOrderActions({ order }: { order: Order }) {
  const [action, setAction] = useState<'settle' | 'cancel' | null>(null);
  const [settlement, setSettlement] = useState<'ROOM' | 'CASH' | 'BANK_TRANSFER'>('ROOM');
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const refresh = useRefreshDesk();
  if (order.status === 'CANCELLED') return null;
  const refund = action === 'cancel' && !!order.paymentMethod;
  const verificationRequired = refund || (action === 'settle' && settlement !== 'ROOM');
  return <>
    {!order.paymentMethod && <Button variant="secondary" onClick={() => { setAction('settle'); setSettlement(order.status === 'PENDING' ? 'ROOM' : 'CASH'); setVerified(false); setError(''); }}>{order.status === 'PENDING' ? 'Ghi nhận đơn' : 'Thu tiền ngay'}</Button>}
    <Button variant="secondary" onClick={() => { setAction('cancel'); setVerified(false); setError(''); }}>{order.paymentMethod ? 'Hủy & hoàn tiền' : 'Hủy đơn'}</Button>
    <Dialog open={action !== null} title={action === 'cancel' ? (refund ? 'Hủy đơn và ghi nhận hoàn tiền' : 'Hủy đơn dịch vụ') : 'Thanh toán đơn dịch vụ'} onClose={() => { if (!lock.current) setAction(null); }}>
      <form className="space-y-4" onSubmit={async event => {
        event.preventDefault();
        if (lock.current || (verificationRequired && !verified)) return;
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
            {order.status === 'PENDING' && <option value="ROOM">Ghi vào hóa đơn phòng</option>}
            <option value="CASH">Thanh toán ngay · Tiền mặt</option>
            <option value="BANK_TRANSFER">Thanh toán ngay · Chuyển khoản</option>
          </select>
        </label>}
        {verificationRequired ? <label className="flex items-start gap-2 text-sm"><input type="checkbox" required disabled={busy} checked={verified} onChange={event => setVerified(event.target.checked)} />{refund ? `Tôi đã hoàn đủ ${money(order.totalAmount)} cho khách. Thao tác này chỉ ghi nhận, không tự chuyển tiền.` : `Tôi đã nhận và kiểm tra đủ ${money(order.totalAmount)}. Khoản này sẽ không thu lại khi trả phòng.`}</label> : <p className="text-sm text-zinc-500">{action === 'cancel' ? 'Đơn sẽ được hủy và không tính phí vào hóa đơn phòng.' : 'Khoản dịch vụ sẽ được ghi vào hóa đơn phòng để thanh toán sau.'}</p>}
        {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" disabled={busy} onClick={() => setAction(null)}>Đóng</Button><Button type="submit" busy={busy} disabled={verificationRequired && !verified}>{action === 'cancel' ? (refund ? 'Xác nhận đã hoàn tiền & hủy' : 'Xác nhận hủy') : 'Lưu thanh toán'}</Button></div>
      </form>
    </Dialog>
  </>;
}
