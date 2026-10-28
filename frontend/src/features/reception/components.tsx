import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { useMutation } from '@tanstack/react-query';
import { Button, Dialog, EmptyState, Table } from '../../components/ui';
import { GuestBadge } from '../guest/components';
import { money, type Booking, type Order } from '../guest/contracts';
import { api } from '../../lib/api';
import { useToast } from '../../components/toast-context';
import { deskError } from './contracts';
import { useDeskBase, useRefreshDesk } from './queries';

export function DeskAction({ path, label, description, action, onDone }: { path: string; label: string; description: string; action: string; onDone?: (result: unknown) => void }) {
  const [open, setOpen] = useState(false), lock = useRef(false), refresh = useRefreshDesk(), toast = useToast();
  const mutation = useMutation({ retry: false, mutationFn: () => api.request(path, { method: action === 'invoice' ? 'POST' : 'PATCH' }),
    onSuccess: async data => { toast(`${label} thành công.`); setOpen(false); await refresh(); onDone?.(data); },
    onError: async error => { toast(deskError(error, action), 'error'); await refresh(); }, onSettled: () => { lock.current = false; } });
  return <><Button variant="secondary" busy={mutation.isPending} onClick={() => { mutation.reset(); setOpen(true); }}>{label}</Button><Dialog open={open} onClose={() => { if (!lock.current) setOpen(false); }} title={label + '?'}><p>{description}</p>{mutation.error && <p className="form-error" role="alert">{deskError(mutation.error, action)}</p>}<div className="dialog-actions"><Button variant="secondary" disabled={mutation.isPending} onClick={() => setOpen(false)}>Quay lại</Button><Button busy={mutation.isPending} disabled={!!mutation.error} onClick={() => { if (lock.current) return; lock.current = true; mutation.mutate(); }}>Xác nhận {label.toLocaleLowerCase('vi-VN')}</Button></div></Dialog></>;
}
export function BookingTable({ rows, billing = false }: { rows: Booking[]; billing?: boolean }) {
  const base = useDeskBase();
  return <Table caption="Danh sách booking" rows={rows} rowKey={b => b.id} empty={<EmptyState title="Chưa có booking phù hợp" description="Hãy thử trạng thái khác hoặc quay lại sau." />} columns={[
    { title: 'BOOKING / PHÒNG', render: b => <div className="desk-reference"><Link to={`${base}/bookings/${b.id}`}>{b.reference}</Link><small>Phòng {b.roomNumber}</small></div> },
    { title: 'LƯU TRÚ', render: b => <><span>{b.checkIn} → {b.checkOut}</span><small className="desk-subline">{b.nights} đêm · {b.guestCount} khách</small></> },
    { title: 'TIỀN PHÒNG', render: b => money(b.totalRoomAmount) }, { title: 'TRẠNG THÁI', render: b => <GuestBadge status={b.status} /> },
    { title: 'THAO TÁC', render: b => <div className="desk-inline-actions"><Link to={`${base}/bookings/${b.id}${billing ? '/billing' : ''}`}>{billing ? 'Xem chi phí' : 'Xem chi tiết'}</Link>{!billing && b.status === 'PENDING' && <DeskAction path={`/bookings/${b.id}/confirm`} action="confirm" label="Xác nhận booking" description={`Xác nhận booking ${b.reference}, phòng ${b.roomNumber}?`} />}{!billing && b.status === 'CONFIRMED' && <DeskAction path={`/bookings/${b.id}/check-in`} action="check-in" label="Nhận phòng" description="Chỉ nhận phòng trong ngày lưu trú hợp lệ, khách đang hoạt động, phòng ACTIVE và CLEAN, không có công việc buồng phòng còn mở." />}{!billing && ['PENDING', 'CONFIRMED'].includes(b.status) && <DeskAction path={`/bookings/${b.id}/cancel`} action="cancel" label="Hủy booking" description={`Hủy booking ${b.reference}? Phòng có thể được khách khác đặt lại.`} />}</div> },
  ]} />;
}
export function Amounts({ room, services, total }: { room: string; services: string; total: string }) { return <dl className="guest-facts"><div><dt>Tiền phòng</dt><dd>{money(room)}</dd></div><div><dt>Dịch vụ hoàn thành</dt><dd>{money(services)}</dd></div><div><dt>Tổng tiền</dt><dd><strong>{money(total)}</strong></dd></div></dl>; }
export function OrderItems({ order }: { order: Order }) { return <Table caption="Chi tiết dịch vụ và giá snapshot" rows={order.items} rowKey={i => i.id} columns={[{ title: 'DỊCH VỤ', render: i => i.serviceName }, { title: 'SỐ LƯỢNG', render: i => i.quantity }, { title: 'GIÁ ĐÃ CHỐT', render: i => money(i.unitPrice) }, { title: 'THÀNH TIỀN', render: i => money(i.subtotal) }]} />; }
