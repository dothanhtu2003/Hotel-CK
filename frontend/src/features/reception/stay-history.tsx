import { displayLocale, t as tr, useLocale } from "../../i18n";

import { useDeskGet } from './queries';
type Segment = { id: string; roomNumber: string; startedAt: string; endedAt: string | null; estimatedStart: boolean };
export function StayHistory({ bookingId }: { bookingId: string }) {
  useLocale();
  const query = useDeskGet<Segment[]>(`/bookings/${bookingId}/stay-history`);
  const rows = Array.isArray(query.data) ? query.data : [];
  if (rows.length < 2) return null;
  const time = (value: string) => new Date(value).toLocaleString(displayLocale(), { timeZone: 'Asia/Ho_Chi_Minh' });
  return <details className="mt-3 border-t border-zinc-100 pt-2 text-xs"><summary className="cursor-pointer font-semibold">{tr("reception:stayHistory.stayHistoryValueSegments", { value0: (rows.length) })}</summary>
    <ol className="mt-2 space-y-2">{rows.map(row => <li key={row.id}><strong>{tr("reception:cashier.roomValue", { value0: (row.roomNumber) })}</strong><span className="block text-zinc-500">{time(row.startedAt)}{row.estimatedStart ? tr("reception:stayHistory.estimated") : ''} → {row.endedAt ? time(row.endedAt) : tr("reception:roomState.occupied")}</span></li>)}</ol>
  </details>;
}
