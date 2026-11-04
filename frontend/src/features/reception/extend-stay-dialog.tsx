import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { api } from '../../lib/api';
import { Button, Dialog } from '../../components/ui';
import { money } from '../guest/contracts';
import type { DeskBooking } from './contracts';
import { hotelToday, shiftDate } from './room-state';
import { useDeskBase, useRefreshDesk } from './queries';
type Quote = {
  quoteToken: string; checkOut: string; expectedCheckOut: string; transferDate: string;
  currentRoomId: string; currentRoomNumber: string;
  conflict: { reference: string; checkIn: string; checkOut: string } | null;
  rooms: { id: string; roomNumber: string; roomType: string; sameType: boolean; capacity: number; nightlyPrice: string }[];
  overdueNights: number; extensionNights: number; overdueAmount: string; extensionAmount: string; priceDifference: string;
  additionalAmount: string; totalRoomAmount: string; paidAmount: string; balance: string;
};
const dateLabel = (value: string) => value.split('-').reverse().join('/');
export function ExtendStayDialog({ booking, onClose }: { booking: DeskBooking; onClose: () => void }) {
  const base = useDeskBase(), refresh = useRefreshDesk();
  const earliest = shiftDate(booking.checkOut > hotelToday() ? booking.checkOut : hotelToday(), 1);
  const [date, setDate] = useState(earliest), [quote, setQuote] = useState<Quote | null>(null);
  const [target, setTarget] = useState(''), [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const lock = useRef(false), requestId = useRef<string | null>(null);
  const preview = async () => {
    if (lock.current) return; lock.current = true; setBusy(true); setError(''); setVerified(false);
    try {
      const result = await api.request<Quote>(`/bookings/${booking.id}/extension-preview`, { method: 'POST', body: { checkOut: date, expectedCheckOut: booking.checkOut } });
      setQuote(result); setTarget(result.conflict ? '' : result.currentRoomId); requestId.current = crypto.randomUUID();
    } catch (caught) { setQuote(null); setError(caught instanceof Error ? caught.message : 'Không thể kiểm tra lịch phòng'); }
    finally { lock.current = false; setBusy(false); }
  };
  const confirm = async () => {
    if (!quote || !verified || !target || lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      await api.request(`/bookings/${booking.id}/extend`, { method: 'PATCH', body: { checkOut: quote.checkOut, expectedCheckOut: quote.expectedCheckOut, targetRoomId: target, requestId: requestId.current, quoteToken: quote.quoteToken } });
      await refresh(); onClose();
    } catch (caught) { setVerified(false); setError(caught instanceof Error ? caught.message : 'Không thể gia hạn'); }
    finally { lock.current = false; setBusy(false); }
  };
  return <Dialog open onClose={() => { if (!busy) onClose(); }} title={`Phòng ${booking.roomNumber} · Gia hạn lưu trú`} className="extend-stay-dialog">
    <div className="extend-stay-content space-y-4">
      <div><strong>{booking.customer?.fullName ?? 'Khách đang lưu trú'}</strong><p className="text-xs text-zinc-500">Ngày trả hiện tại: {dateLabel(booking.checkOut)}</p></div>
      <form className="flex flex-wrap items-end gap-3" onSubmit={event => { event.preventDefault(); void preview(); }}>
        <label className="flex-1 text-sm">Ngày trả mới<input className="input w-full mt-1" aria-label="Ngày trả mới" type="date" min={earliest} required value={date} disabled={busy} onChange={event => { setDate(event.target.value); setQuote(null); setVerified(false); setError(''); }} /></label>
        <Button type="submit" variant="secondary" busy={busy} disabled={!date}>Kiểm tra phòng</Button>
      </form>
      {quote && <>
        {quote.conflict ? <section>
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Phòng {quote.currentRoomNumber} có booking từ {dateLabel(quote.conflict.checkIn)} đến {dateLabel(quote.conflict.checkOut)}. Cần chuyển phòng.</p>
          {!quote.rooms.length ? <p role="status" className="mt-3 text-sm font-semibold">Không còn phòng trống phù hợp</p> : <fieldset className="mt-3 space-y-2 max-h-56 overflow-y-auto"><legend className="text-sm font-semibold mb-2">Phòng thay thế · chuyển hôm nay</legend>
            {quote.rooms.map(room => <label key={room.id} className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer ${target === room.id ? 'border-emerald-600 bg-emerald-50' : 'border-zinc-200'}`}>
              <input type="radio" name="transfer-room" value={room.id} checked={target === room.id} disabled={busy} onChange={() => { setTarget(room.id); setVerified(false); }} />
              <span className="flex-1"><strong>Phòng {room.roomNumber}</strong><small className="block text-zinc-500">{room.roomType} · {room.capacity} khách{room.sameType ? ' · Cùng hạng' : ''} · Sẵn sàng</small></span><span className="text-sm">{money(room.nightlyPrice)}/đêm</span>
            </label>)}
          </fieldset>}
        </section> : <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">Phòng {quote.currentRoomNumber} còn trống, có thể ở tiếp.</p>}
        {target && <div className="rounded-xl bg-zinc-50 p-4 text-sm space-y-3">
          {target !== quote.currentRoomId && <p className="font-semibold">Phòng {quote.currentRoomNumber} → {quote.rooms.find(r => r.id === target)?.roomNumber} · {dateLabel(quote.transferDate)} → {dateLabel(quote.checkOut)}</p>}
          <dl className="space-y-2">{[
            [`Tiền quá hạn · ${quote.overdueNights} đêm`, quote.overdueAmount], [`Tiền gia hạn · ${quote.extensionNights} đêm`, quote.extensionAmount],
            ['Chênh lệch giá phòng', quote.priceDifference], ['Tổng phát sinh', quote.additionalAmount], ['Tổng tiền phòng sau gia hạn', quote.totalRoomAmount],
            ['Tiền phòng đã thanh toán', quote.paidAmount], ['Còn phải thu tiền phòng', quote.balance],
          ].map(([label, amount]) => <div key={label} className="flex justify-between gap-3"><dt>{label}</dt><dd className="font-semibold tabular-nums">{money(amount)}</dd></div>)}</dl>
          <p className="text-xs text-zinc-500">Giá thử nghiệm 1.000đ/đêm · Trả phòng trước 12:00.</p>
          <label className="flex items-start gap-2"><input aria-label="Xác nhận phương án gia hạn" type="checkbox" checked={verified} disabled={busy} onChange={event => setVerified(event.target.checked)} />Xác nhận phòng, ngày trả và tiền phát sinh</label>
        </div>}
      </>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </div>
      <div className="extend-stay-actions flex flex-wrap justify-end gap-2 pt-2">
        <Link className="button button-secondary" to={`${base}/bookings/${booking.id}/billing`} onClick={onClose}>Thanh toán & trả phòng</Link>
        {quote && <Button busy={busy} disabled={!target || !verified || !!(quote.conflict && !quote.rooms.length)} onClick={() => void confirm()}>{quote.conflict ? 'Xác nhận chuyển phòng & gia hạn' : 'Xác nhận gia hạn'}</Button>}
      </div>
  </Dialog>;
}
