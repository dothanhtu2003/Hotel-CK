import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarDays, Check, LockKeyhole, Mail, Pencil, Phone, ShieldCheck, UserRound } from 'lucide-react';
import { api } from '../lib/api';
import { ApiError } from '../lib/api-client';
import { useAuth } from '../features/auth/auth-context';
import { homeForRole, profileSchema, roleLabel, userSchema, type ProfileInput, type User } from '../features/auth/contracts';
import { Button, Dialog, ErrorState, FormField, Input, LinkButton, LoadingState, PageHeading, StatusBadge } from '../components/ui';
import { useToast } from '../components/toast-context';
import { useNavigate } from 'react-router';

function useProfile() {
  const { user, updateUser } = useAuth();
  const result = useQuery({ queryKey: ['profile', user?.id], queryFn: async ({ signal }) => userSchema.parse(await api.request('/users/me', { signal })), enabled: !!user, staleTime: 30_000 });
  useEffect(() => { if (result.data) updateUser(result.data); }, [result.data, updateUser]);
  return result;
}
function ProfileSummary({ user }: { user: User }) {
  return <aside className="panel profile-summary"><div className="profile-avatar">{user.fullName.slice(0, 1).toUpperCase()}</div><h2>{user.fullName}</h2><p>{user.email}</p><StatusBadge tone="success">{roleLabel[user.role]}</StatusBadge><div className="summary-divider" /><div className="summary-security"><ShieldCheck size={20} /><div><strong>Tài khoản được bảo vệ</strong><p>Thông tin cá nhân chỉ hiển thị trong tài khoản của bạn.</p></div></div></aside>;
}
function ProfileFailure({ error, retry }: { error: Error; retry: () => void }) { return <ErrorState title={error instanceof ApiError && error.status === 403 ? 'Không có quyền truy cập' : undefined} message={error instanceof ApiError ? error.message : 'Chưa thể tải hồ sơ. Vui lòng thử lại.'} retry={retry} />; }
export function ProfilePage() {
  const profile = useProfile();
  if (profile.isPending) return <LoadingState />;
  if (profile.error) return <ProfileFailure error={profile.error} retry={() => { void profile.refetch(); }} />;
  const user = profile.data;
  return <><PageHeading eyebrow="TÀI KHOẢN CỦA BẠN" title="Hồ sơ cá nhân" description="Một chút thông tin để chúng tôi chào đón bạn tốt hơn." action={<LinkButton to={`${homeForRole[user.role]}/profile/edit`} variant="secondary"><Pencil size={16} />Chỉnh sửa hồ sơ</LinkButton>} /><div className="profile-grid"><ProfileSummary user={user} /><section className="panel profile-details"><div className="panel-heading"><h2>Thông tin cá nhân</h2><UserRound size={20} /></div><dl>{[{ icon: UserRound, label: 'Họ và tên', value: user.fullName }, { icon: Mail, label: 'Địa chỉ email', value: user.email }, { icon: Phone, label: 'Số điện thoại', value: user.phone || 'Chưa cập nhật' }, { icon: ShieldCheck, label: 'Vai trò', value: roleLabel[user.role] }, { icon: CalendarDays, label: 'Ngày tham gia', value: new Intl.DateTimeFormat('vi-VN', { dateStyle: 'long' }).format(new Date(user.createdAt)) }].map(({ icon: Icon, label, value }) => <div key={label}><dt><Icon size={17} />{label}</dt><dd>{value}</dd></div>)}</dl><div className="profile-info"><LockKeyhole size={19} /><p>Email và vai trò được quản lý bởi hệ thống. Bạn có thể cập nhật họ tên và số điện thoại.</p></div></section></div></>;
}
export function EditProfilePage() {
  const profile = useProfile();
  if (profile.isPending) return <LoadingState />;
  if (profile.error) return <ProfileFailure error={profile.error} retry={() => { void profile.refetch(); }} />;
  return <EditProfileForm user={profile.data} />;
}
function EditProfileForm({ user }: { user: User }) {
  const { updateUser } = useAuth(), query = useQueryClient(), toast = useToast(), navigate = useNavigate();
  const [cancelOpen, setCancelOpen] = useState(false);
  const home = homeForRole[user.role];
  const form = useForm<ProfileInput>({ resolver: zodResolver(profileSchema), defaultValues: { fullName: user.fullName, phone: user.phone ?? '' } });
  const mutation = useMutation({ mutationFn: async (values: ProfileInput) => userSchema.parse(await api.request('/users/me', { method: 'PATCH', body: { fullName: values.fullName, phone: values.phone || null } })), onSuccess: profile => { if (!updateUser(profile)) return; query.setQueryData(['profile', profile.id], profile); toast('Đã cập nhật hồ sơ cá nhân.'); navigate(`${homeForRole[profile.role]}/profile`, { replace: true }); } });
  useEffect(() => {
    if (!form.formState.isDirty) return;
    const listener = (event: BeforeUnloadEvent) => event.preventDefault(); window.addEventListener('beforeunload', listener); return () => window.removeEventListener('beforeunload', listener);
  }, [form.formState.isDirty]);
  return <><PageHeading eyebrow="TÀI KHOẢN CỦA BẠN" title="Chỉnh sửa hồ sơ" description="Luôn giữ thông tin liên hệ của bạn chính xác." /><div className="profile-grid"><ProfileSummary user={user} /><section className="panel profile-details"><div className="panel-heading"><h2>Thông tin cơ bản</h2><Pencil size={19} /></div><form className="profile-form" noValidate onSubmit={form.handleSubmit(values => mutation.mutate(values))}><FormField name="fullName" label="Họ và tên" error={form.formState.errors.fullName?.message}><Input id="fullName" autoComplete="name" aria-invalid={!!form.formState.errors.fullName} aria-describedby={form.formState.errors.fullName ? 'fullName-error' : undefined} {...form.register('fullName')} /></FormField><FormField name="phone" label="Số điện thoại" hint="Để trống nếu bạn muốn xóa số điện thoại hiện tại." error={form.formState.errors.phone?.message}><Input id="phone" type="tel" autoComplete="tel" aria-invalid={!!form.formState.errors.phone} aria-describedby={form.formState.errors.phone ? 'phone-error phone-hint' : 'phone-hint'} {...form.register('phone')} /></FormField><FormField name="profileEmail" label="Địa chỉ email" hint="Email không thể thay đổi tại đây."><Input id="profileEmail" type="email" value={user.email} readOnly /></FormField>{mutation.error && <p className="form-error" role="alert">{mutation.error instanceof ApiError ? mutation.error.message : 'Không thể lưu hồ sơ. Vui lòng thử lại.'}</p>}<div className="form-actions"><Button type="button" variant="secondary" disabled={mutation.isPending} onClick={() => { if (form.formState.isDirty) setCancelOpen(true); else navigate(`${home}/profile`); }}>Hủy thay đổi</Button><Button type="submit" busy={mutation.isPending} disabled={!form.formState.isDirty}><Check size={17} />{mutation.isPending ? 'Đang lưu…' : 'Lưu thay đổi'}</Button></div></form></section></div><Dialog open={cancelOpen} onClose={() => setCancelOpen(false)} title="Bỏ thay đổi chưa lưu?"><p>Thông tin vừa chỉnh sửa sẽ không được lưu.</p><div className="dialog-actions"><Button variant="secondary" onClick={() => setCancelOpen(false)}>Tiếp tục chỉnh sửa</Button><Button onClick={() => navigate(`${home}/profile`)}>Bỏ thay đổi</Button></div></Dialog></>;
}
