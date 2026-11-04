import { useDeskGet } from './queries';
type Segment = { id: string; roomNumber: string; startedAt: string; endedAt: string | null; estimatedStart: boolean };
export function StayHistory({ bookingId }: { bookingId: string }) {
  const query = useDeskGet<Segment[]>(`/bookings/${bookingId}/stay-history`);
  const rows = Array.isArray(query.data) ? query.data : [];
  if (rows.length < 2) return null;
  const time = (value: string) => new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  return <details className="mt-3 border-t border-zinc-100 pt-2 text-xs"><summary className="cursor-pointer font-semibold">Lịch sử lưu trú · {rows.length} chặng</summary>
    <ol className="mt-2 space-y-2">{rows.map(row => <li key={row.id}><strong>Phòng {row.roomNumber}</strong><span className="block text-zinc-500">{time(row.startedAt)}{row.estimatedStart ? ' (ước tính)' : ''} → {row.endedAt ? time(row.endedAt) : 'Đang ở'}</span></li>)}</ol>
  </details>;
}
