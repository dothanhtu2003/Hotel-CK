import { formatDate as localizedDate } from "../../i18n/format";
import { errorToken, message as uiMessage, resolveMessage, t as tr, useLocale } from "../../i18n";


import { Trans } from "react-i18next";
import { DeskLink } from "./navigation";
import { useRef, useState } from 'react';
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
const dateLabel = (value: string) => localizedDate(value);
export function ExtendStayDialog({ booking, onClose, checkoutToday = false }: { booking: DeskBooking; onClose: () => void; checkoutToday?: boolean }) {
  useLocale();
  const base = useDeskBase(), refresh = useRefreshDesk();
  const earliest = shiftDate(booking.checkOut > hotelToday() ? booking.checkOut : hotelToday(), 1);
  const [date, setDate] = useState(checkoutToday ? hotelToday() : earliest), [quote, setQuote] = useState<Quote | null>(null);
  const [target, setTarget] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const lock = useRef(false), requestId = useRef<string | null>(null);
  const preview = async () => {
    if (lock.current) return; lock.current = true; setBusy(true); setError('');
    try {
      const result = await api.request<Quote>(`/bookings/${booking.id}/extension-preview`, { method: 'POST', body: { checkOut: date, expectedCheckOut: booking.checkOut } });
      setQuote(result); setTarget(result.conflict ? '' : result.currentRoomId); requestId.current = crypto.randomUUID();
    } catch (caught) { setQuote(null); setError(caught instanceof Error ? errorToken(caught) : uiMessage("reception:extendStayDialog.unableToCheckRoomAvailability")); }
    finally { lock.current = false; setBusy(false); }
  };
  const confirm = async () => {
    if (!quote || !target || lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      await api.request(`/bookings/${booking.id}/extend`, { method: 'PATCH', body: { checkOut: quote.checkOut, expectedCheckOut: quote.expectedCheckOut, targetRoomId: target, requestId: requestId.current, quoteToken: quote.quoteToken } });
      await refresh(); onClose();
    } catch (caught) { setError(caught instanceof Error ? errorToken(caught) : uiMessage("reception:extendStayDialog.unableToExtendStay")); }
    finally { lock.current = false; setBusy(false); }
  };
  return <Dialog open onClose={() => { if (!busy) onClose(); }} title={tr("reception:extendStayDialog.roomValueValue", { value0: (booking.roomNumber), value1: (checkoutToday ? tr("common:supplement.calculateOverdueChargesThroughToday") : tr("common:supplement.extendStay")) })} className="extend-stay-dialog">
    <div className="extend-stay-content space-y-4">
      <div><strong>{booking.customer?.fullName ?? tr("reception:extendStayDialog.inHouseGuest")}</strong><p className="text-xs text-zinc-500">{tr("reception:extendStayDialog.currentCheckOutDateValue", { value0: (dateLabel(booking.checkOut)) })}</p></div>
      <form className="flex flex-wrap items-end gap-3" onSubmit={event => { event.preventDefault(); void preview(); }}>
        {checkoutToday ? <p className="text-sm">{tr("reception:extendStayDialog.throughValueAdditionalChargeOfVnd1000NightNoNightsAfter", { value0: (dateLabel(date)) })}</p> : <label className="flex-1 text-sm">{tr("reception:extendStayDialog.newCheckOutDate")}<input className="input w-full mt-1" aria-label={tr("reception:extendStayDialog.newCheckOutDate")} type="date" min={earliest} required value={date} disabled={busy} onChange={event => { setDate(event.target.value); setQuote(null); setError(''); }} /></label>}
        <Button type="submit" variant="secondary" busy={busy} disabled={!date}>{checkoutToday ? tr("reception:extendStayDialog.viewOverdueCharges") : tr("reception:extendStayDialog.checkRooms")}</Button>
      </form>
      {quote && <>
        {quote.conflict ? <section>
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{tr("reception:extendStayDialog.roomValueHasAReservationFromValueToValueARoomTransfer", { value0: (quote.currentRoomNumber), value1: (dateLabel(quote.conflict.checkIn)), value2: (dateLabel(quote.conflict.checkOut)) })}</p>
          {!quote.rooms.length ? <p role="status" className="mt-3 text-sm font-semibold">{tr("reception:extendStayDialog.noSuitableRoomsAvailable")}</p> : <fieldset className="mt-3 space-y-2 max-h-56 overflow-y-auto"><legend className="text-sm font-semibold mb-2">{tr("reception:extendStayDialog.replacementRoomTransferToday")}</legend>
            {quote.rooms.map(room => <label key={room.id} className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer ${target === room.id ? 'border-emerald-600 bg-emerald-50' : 'border-zinc-200'}`}>
              <input type="radio" name="transfer-room" value={room.id} checked={target === room.id} disabled={busy} onChange={() => { setTarget(room.id); }} />
              <span className="flex-1"><Trans ns="reception" i18nKey="extendStayDialog.roomValueValueValueGuestsValueReady" values={{ value0: (room.roomNumber), value1: (room.roomType), value2: (room.capacity), value3: (room.sameType ? tr("common:supplement.sameRoomType") : '') }} components={{ part0: <strong />, part1: <small className="block text-zinc-500" /> }} /></span><span className="text-sm">{tr("reception:extendStayDialog.valueNight", { value0: (money(room.nightlyPrice)) })}</span>
            </label>)}
          </fieldset>}
        </section> : <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">{checkoutToday ? tr("reception:extendStayDialog.confirmTheUpdatedRoomChargesThenCollectPaymentAndCheckOut") : tr("reception:extendStayDialog.roomValueIsAvailableForAnExtendedStay", { value0: (quote.currentRoomNumber) })}</p>}
        {target && <div className="rounded-xl bg-zinc-50 p-4 text-sm space-y-3">
          {target !== quote.currentRoomId && <p className="font-semibold">{tr("reception:components.room2")}{quote.currentRoomNumber} → {quote.rooms.find(r => r.id === target)?.roomNumber} · {dateLabel(quote.transferDate)} → {dateLabel(quote.checkOut)}</p>}
          <dl className="space-y-2">{[
            [tr("reception:extendStayDialog.overdueChargesValueNights", { value0: (quote.overdueNights) }), quote.overdueAmount], [tr("reception:extendStayDialog.extensionChargesValueNights", { value0: (quote.extensionNights) }), quote.extensionAmount],
            [tr("reception:extendStayDialog.roomPriceDifference"), quote.priceDifference], [tr("reception:extendStayDialog.totalAdditionalCharges"), quote.additionalAmount], [checkoutToday ? tr("reception:extendStayDialog.totalRoomChargesThroughToday") : tr("reception:extendStayDialog.totalRoomChargesAfterExtension"), quote.totalRoomAmount],
            [tr("reception:extendStayDialog.roomPaymentsReceived"), quote.paidAmount], [tr("reception:extendStayDialog.roomBalanceDue"), quote.balance],
          ].map(([label, amount]) => <div key={label} className="flex justify-between gap-3"><dt>{label}</dt><dd className="font-semibold tabular-nums">{money(amount)}</dd></div>)}</dl>
        </div>}
      </>}
      {error && <p role="alert" className="text-sm text-red-700">{resolveMessage(error)}</p>}
    </div>
      <div className="extend-stay-actions flex flex-wrap justify-end gap-2 pt-2">
        {!checkoutToday && <DeskLink className="button button-secondary" to={`${base}/bookings/${booking.id}/billing`} onClick={onClose}>{tr("reception:extendStayDialog.payCheckOut")}</DeskLink>}
        {quote && <Button busy={busy} disabled={!target || !!(quote.conflict && !quote.rooms.length)} onClick={() => void confirm()}>{checkoutToday ? tr("reception:extendStayDialog.confirmOverdueCharges") : quote.conflict ? tr("reception:extendStayDialog.confirmTransferExtension") : tr("reception:extendStayDialog.confirmExtension")}</Button>}
      </div>
  </Dialog>;
}
