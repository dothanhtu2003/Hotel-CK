import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { useMutation } from '@tanstack/react-query';
import { Button } from '../../components/ui';
import { api } from '../../lib/api';
import { useToast } from '../../components/toast-context';
import { deskError, type DeskBooking } from './contracts';
import { useDeskBase, useRefreshDesk } from './queries';
import { hotelToday } from './room-state';

export function CheckInWizard({ bookingId, variant = 'secondary', className = '' }: {
  bookingId: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'light';
  className?: string;
}) {
  const lock = useRef(false), refresh = useRefreshDesk(), toast = useToast(), base = useDeskBase();
  const [room, setRoom] = useState<DeskBooking['room']>();
  const [error, setError] = useState('');
  const mutation = useMutation({
    retry: false,
    mutationFn: async () => {
      const b = await api.request<DeskBooking>('/front-desk/bookings/' + bookingId);
      setRoom(b.room);
      const today = hotelToday();
      if (!['PENDING', 'CONFIRMED'].includes(b.status)) throw new Error('Booking chưa ở trạng thái chờ nhận phòng.');
      if (b.checkIn > today) throw new Error('Chưa đến ngày nhận phòng.');
      if (b.checkOut <= today) throw new Error('Booking đã qua ngày trả phòng.');
      if (b.room?.operationalStatus !== 'ACTIVE') throw new Error(`Phòng ${b.roomNumber} đang ngừng phục vụ.`);
      if (b.room.housekeepingStatus !== 'CLEAN' || b.openTaskCount !== 0)
        throw new Error(`Phòng ${b.roomNumber} chưa dọn xong. Mở phòng để cập nhật vệ sinh hoặc điều phối dọn phòng.`);
      return api.request(`/bookings/${bookingId}/check-in`, { method: 'PATCH' });
    },
    onSuccess: async () => { setError(''); toast('Nhận phòng thành công.'); await refresh(); },
    onError: async error => { setError(deskError(error, 'check-in')); await refresh(); },
    onSettled: () => { lock.current = false; },
  });
  return <div className="space-y-2">
    <Button variant={variant} className={className} busy={mutation.isPending} onClick={() => {
      if (lock.current) return;
      lock.current = true;
      setError('');
      mutation.mutate();
    }}>Nhận phòng</Button>
    {error && <div role="alert" className="max-w-sm rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
      <p>{error}</p>
      {room?.id && <Link className="mt-2 inline-block font-semibold underline" to={`${base}?roomId=${room.id}`}>Mở phòng để xử lý</Link>}
    </div>}
  </div>;
}
