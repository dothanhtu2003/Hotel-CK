import { LocalizedError, resolveMessage, t as tr, useLocale } from "../../i18n";

import { DeskLink } from "./navigation";
import { useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '../../components/ui';
import { api } from '../../lib/api';
import { useToast } from '../../components/toast-context';
import { deskError, type DeskBooking } from './contracts';
import { useDeskBase, useRefreshDesk } from './queries';
import { hotelToday } from './room-state';

export function CheckInWizard({ bookingId, checkIn, checkOut, variant = 'secondary', className = '' }: {
  bookingId: string;
  checkIn?: string;
  checkOut?: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'light';
  className?: string;
}) {
  useLocale();
  const lock = useRef(false), refresh = useRefreshDesk(), toast = useToast(), base = useDeskBase();
  const [room, setRoom] = useState<DeskBooking['room']>();
  const [error, setError] = useState('');
  const today = hotelToday();
  const unavailableReason = checkIn && checkIn > today ? tr("reception:checkIn.notYetTheCheckInDate") :
    checkOut && checkOut <= today ? tr("reception:checkIn.checkOutDateHasPassed") : '';
  const mutation = useMutation({
    retry: false,
    mutationFn: async () => {
      const b = await api.request<DeskBooking>('/front-desk/bookings/' + bookingId);
      setRoom(b.room);
      const today = hotelToday();
      if (b.status === 'PENDING' && b.onlinePaymentRequired) throw new LocalizedError("reception:checkIn.theReservationIsAwaitingRoomPaymentThroughPayosCheckInIsNot");
      if (!['PENDING', 'CONFIRMED'].includes(b.status)) throw new LocalizedError("reception:checkIn.theReservationIsNotAwaitingCheckIn");
      if (b.checkIn > today) throw new LocalizedError("reception:checkIn.theCheckInDateHasNotArrived");
      if (b.checkOut <= today) throw new LocalizedError("reception:checkIn.theReservationSCheckOutDateHasPassed");
      if (b.room?.operationalStatus !== 'ACTIVE') throw new LocalizedError("reception:checkIn.roomValueIsOutOfService", { value0: (b.roomNumber) });
      if (b.room.housekeepingStatus !== 'CLEAN' || b.openTaskCount !== 0)
        throw new LocalizedError("reception:checkIn.roomValueHasNotFinishedCleaningOpenTheRoomToUpdateCleanliness", { value0: (b.roomNumber) });
      return api.request(`/bookings/${bookingId}/check-in`, { method: 'PATCH' });
    },
    onSuccess: async () => { setError(''); toast(() => (tr("reception:checkIn.checkedInSuccessfully"))); await refresh(); },
    onError: async error => { setError(deskError(error, 'check-in', true)); await refresh(); },
    onSettled: () => { lock.current = false; },
  });
  return <div className="space-y-2">
    <Button variant={variant} className={className} disabled={!!unavailableReason} title={unavailableReason || undefined} busy={mutation.isPending} onClick={() => {
      if (lock.current) return;
      lock.current = true;
      setError('');
      mutation.mutate();
    }}>{unavailableReason || tr("reception:checkIn.checkIn")}</Button>
    {error && <div role="alert" className="max-w-sm rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
      <p>{resolveMessage(error)}</p>
      {room?.id && <DeskLink className="mt-2 inline-block font-semibold underline" to={`${base}?roomId=${room.id}`}>{tr("reception:checkIn.openRoomToResolve")}</DeskLink>}
    </div>}
  </div>;
}
