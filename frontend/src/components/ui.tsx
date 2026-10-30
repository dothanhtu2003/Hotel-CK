import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router';
import { ArrowUpRight, CalendarDays, ChevronLeft, ChevronRight, CircleAlert, Eye, EyeOff, Inbox, LoaderCircle, X } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'light';
export function Button({ variant = 'primary', busy = false, className = '', children, disabled, ...props }: ComponentProps<'button'> & { variant?: Variant; busy?: boolean }) {
  return <button className={`button button-${variant} ${className}`} disabled={disabled || busy} aria-busy={busy || undefined} {...props}>{busy && <LoaderCircle size={17} className="spin" />}{children}</button>;
}
export function LinkButton({ variant = 'primary', className = '', ...props }: LinkProps & { variant?: Variant }) { return <Link className={`button button-${variant} ${className}`} {...props} />; }
export function Input({ className = '', ...props }: ComponentProps<'input'>) { return <input className={`input ${className}`} {...props} />; }
export function FormField({ name, label, error, hint, children }: { name: string; label: string; error?: string; hint?: string; children: ReactNode }) {
  return <div className="form-field"><label htmlFor={name}>{label}</label>{children}{hint && <p className="field-hint" id={`${name}-hint`}>{hint}</p>}{error && <p className="field-error" id={`${name}-error`} role="alert">{error}</p>}</div>;
}
export function PasswordInput(props: ComponentProps<'input'>) {
  const [visible, setVisible] = useState(false);
  return <div className="password-input"><Input {...props} type={visible ? 'text' : 'password'} /><button type="button" onClick={() => setVisible(v => !v)} aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} aria-pressed={visible}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>;
}
export function StatusBadge({ tone = 'muted', children }: { tone?: 'muted' | 'success' | 'gold'; children: ReactNode }) { return <span className={`status-badge badge-${tone}`}><i aria-hidden="true" />{children}</span>; }
export function DatePicker({ label, id, ...props }: ComponentProps<'input'> & { label: string; id: string }) {
  return <div className="date-picker"><label htmlFor={id}>{label}</label><div><CalendarDays size={19} /><input type="date" id={id} {...props} /></div></div>;
}
export function Dialog({ open, onClose, title, children, className = '' }: { open: boolean; onClose: () => void; title: string; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current; if (!dialog) return; if (open && !dialog.open) dialog.showModal(); else if (!open && dialog.open) dialog.close(); }, [open]);
  return <dialog ref={ref} className={`dialog ${className}`} aria-label={title} onCancel={event => { event.preventDefault(); onClose(); }} onClose={() => { if (open) onClose(); }} onClick={event => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose(); } }}>
    <div className="dialog-heading"><h2>{title}</h2><button aria-label="Đóng hộp thoại" onClick={onClose}><X size={22} /></button></div>{children}
  </dialog>;
}
export function LoadingState({ text = 'Đang tải thông tin…' }: { text?: string }) { return <div className="state-panel" role="status"><LoaderCircle className="spin" size={27} /><p>{text}</p></div>; }
export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) { return <div className="state-panel"><span className="state-icon"><Inbox size={28} /></span><h2>{title}</h2><p>{description}</p>{action}</div>; }
export function ErrorState({ title = 'Chưa thể tải thông tin', message, retry }: { title?: string; message: string; retry?: () => void }) { return <div className="state-panel" role="alert"><span className="state-icon error"><CircleAlert size={27} /></span><h2>{title}</h2><p>{message}</p>{retry && <Button onClick={retry} variant="secondary">Thử lại</Button>}</div>; }
export function Table<T>({ columns, rows, rowKey, caption, empty }: { columns: { title: string; render: (row: T) => ReactNode }[]; rows: T[]; rowKey: (row: T) => string; caption: string; empty?: ReactNode }) {
  if (!rows.length) return empty ?? <EmptyState title="Chưa có dữ liệu" description="Thông tin sẽ xuất hiện tại đây khi có dữ liệu." />;
  return <div className="table-scroll"><table><caption className="sr-only">{caption}</caption><thead><tr>{columns.map(column => <th key={column.title} scope="col">{column.title}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={rowKey(row)}>{columns.map(column => <td key={column.title}>{column.render(row)}</td>)}</tr>)}</tbody></table></div>;
}
export function Pagination({ page, pageSize, total, onChange }: { page: number; pageSize: number; total: number; onChange: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return <nav className="pagination" aria-label="Phân trang"><span>{total} kết quả · Trang {page}/{pages}</span><div><Button variant="secondary" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Trang trước"><ChevronLeft size={18} /></Button><Button variant="secondary" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Trang sau"><ChevronRight size={18} /></Button></div></nav>;
}
export function RoomCard({ image, name, description, onExplore }: { image: string; name: string; description: string; onExplore: () => void }) {
  return <article className="room-card"><div className="room-image"><img src={image} alt={name} loading="lazy" width="1000" height="670" /><span>KHÔNG GIAN CẢM HỨNG</span></div><div className="room-caption"><div><h3>{name}</h3><p>{description}</p></div><button aria-label={`Khám phá ${name}`} onClick={onExplore}><ArrowUpRight size={24} /></button></div></article>;
}
export function PageHeading({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="page-heading"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1>{description && <p>{description}</p>}</div>{action}</div>;
}
