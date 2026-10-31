import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router';
import { Button, DatePicker, FormField, Input, StatusBadge } from '../../components/ui';
import { staySchema, statusLabels, type Stay, type RoomType } from './contracts';
import { searchParams } from './contracts';

export function SearchForm({ initial, roomTypes = [], compact = false }: { initial?: Partial<Stay>; roomTypes?: RoomType[]; compact?: boolean }) {
  const navigate = useNavigate();
  const form = useForm<Stay>({ resolver: zodResolver(staySchema), defaultValues: { checkIn: '', checkOut: '', guests: 2, roomTypeId: '', ...initial } });
  return <form className={compact ? 'stay-planner site-container' : 'search-form'} noValidate onSubmit={form.handleSubmit(v => navigate('/rooms?' + searchParams(v)))}>
    {compact && <div className="planner-intro"><span className="eyebrow">KỲ NGHỈ CỦA BẠN</span><strong>Tìm một chốn<br />thật an nhiên.</strong></div>}
    <div><DatePicker label="NGÀY NHẬN PHÒNG" id="check-in" required {...form.register('checkIn')} aria-invalid={!!form.formState.errors.checkIn} />{form.formState.errors.checkIn && <p className="field-error" role="alert">{form.formState.errors.checkIn.message}</p>}</div>
    <div><DatePicker label="NGÀY TRẢ PHÒNG" id="check-out" required {...form.register('checkOut')} aria-invalid={!!form.formState.errors.checkOut} />{form.formState.errors.checkOut && <p className="field-error" role="alert">{form.formState.errors.checkOut.message}</p>}</div>
    <FormField name="guests" label="SỐ KHÁCH" error={form.formState.errors.guests?.message}><Input id="guests" type="number" min="1" step="1" {...form.register('guests', { valueAsNumber: true })} /></FormField>
    {!compact && <FormField name="roomTypeId" label="Loại phòng"><select id="roomTypeId" className="input" {...form.register('roomTypeId')}><option value="">Tất cả loại phòng</option>{roomTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></FormField>}
    <div className="planner-action"><Button type="submit">Tìm phòng</Button></div>
  </form>;
}
export function GuestBadge({ status, label }: { status: string; label?: string }) { return <StatusBadge tone={['CHECKED_IN', 'CONFIRMED', 'PAID', 'COMPLETED'].includes(status) ? 'success' : status === 'PENDING' ? 'gold' : 'muted'}>{label ?? statusLabels[status] ?? status}</StatusBadge>; }
export function Skeleton() { return <div role="status" aria-label="Đang tải thông tin" className="guest-skeleton"><div /><div /><div /><span className="sr-only">Đang tải thông tin…</span></div>; }
