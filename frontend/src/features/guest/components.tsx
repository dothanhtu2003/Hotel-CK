import { catalogName } from "../../i18n/catalog";
import { t as tr, useLocale } from "../../i18n";
import { Trans } from "react-i18next";
import { useForm } from "../../i18n/forms";
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router';
import { Button, DatePicker, FormField, Input, StatusBadge } from '../../components/ui';
import { searchParams, statusLabels, staySchema, type RoomType, type Stay } from './contracts';


export function SearchForm({ initial, roomTypes = [], compact = false }: { initial?: Partial<Stay>; roomTypes?: RoomType[]; compact?: boolean }) {
  useLocale();
  const navigate = useNavigate();
  const form = useForm<Stay>({ resolver: zodResolver(staySchema), defaultValues: { checkIn: '', checkOut: '', guests: 2, roomTypeId: '', ...initial } });
  return <form className={compact ? 'stay-planner site-container' : 'search-form'} noValidate onSubmit={form.handleSubmit(v => navigate('/rooms?' + searchParams(v)))}>
    {compact && <div className="planner-intro"><span className="eyebrow">{tr("guest:components.yourGetaway")}</span><strong><Trans ns="guest" i18nKey="components.findAPlaceToFeelAtPeace" components={{ part0: <br /> }} /></strong></div>}
    <div><DatePicker label={tr("guest:components.checkInDate")} id="check-in" required {...form.register('checkIn')} aria-invalid={!!form.formState.errors.checkIn} />{form.formState.errors.checkIn && <p className="field-error" role="alert">{form.formState.errors.checkIn.message}</p>}</div>
    <div><DatePicker label={tr("guest:components.checkOutDate")} id="check-out" required {...form.register('checkOut')} aria-invalid={!!form.formState.errors.checkOut} />{form.formState.errors.checkOut && <p className="field-error" role="alert">{form.formState.errors.checkOut.message}</p>}</div>
    <FormField name="guests" label={tr("guest:components.guests")} error={form.formState.errors.guests?.message}><Input id="guests" type="number" min="1" step="1" {...form.register('guests', { valueAsNumber: true })} /></FormField>
    {!compact && <FormField name="roomTypeId" label={tr("guest:components.roomType")}><select id="roomTypeId" className="input" {...form.register('roomTypeId')}><option value="">{tr("guest:components.allRoomTypes")}</option>{roomTypes.map(t => <option key={t.id} value={t.id}>{catalogName(t.name)}</option>)}</select></FormField>}
    <div className="planner-action"><Button type="submit">{tr("guest:components.findRooms")}</Button></div>
  </form>;
}
export function GuestBadge({ status, label }: { status: string; label?: string }) {
  useLocale(); return <StatusBadge tone={['CHECKED_IN', 'CONFIRMED', 'PAID', 'COMPLETED'].includes(status) ? 'success' : status === 'PENDING' ? 'gold' : 'muted'}>{label ?? statusLabels[status] ?? tr("common:status.unknown")}</StatusBadge>; }
export function Skeleton() {
  useLocale(); return <div role="status" aria-label={tr("guest:components.loadingInformation")} className="guest-skeleton"><div /><div /><div /><span className="sr-only">{tr("guest:components.loadingInformation2")}</span></div>; }
