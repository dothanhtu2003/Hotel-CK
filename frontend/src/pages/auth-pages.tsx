import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, ShieldCheck } from 'lucide-react';
import { useAuth } from '../features/auth/auth-context';
import { homeForRole, loginSchema, registerSchema, safeDestination, type LoginInput, type RegisterInput } from '../features/auth/contracts';
import { ApiError } from '../lib/api-client';
import { api } from '../lib/api';
import { Brand } from '../layouts/public-layout';
import { Button, FormField, Input, PasswordInput } from '../components/ui';
import { useToast } from '../components/toast-context';

function AuthFrame({ children, register = false }: { children: React.ReactNode; register?: boolean }) {
  return <div className="auth-page"><aside className="auth-visual"><img src="/images/hero.jpg" alt="Khung cảnh hồ bơi và khu nghỉ dưỡng An Nhiên" /><div className="auth-visual-shade" /><Brand light /><div className="auth-quote"><p className="eyebrow light">MỘT NƠI ĐỂ TRỞ VỀ</p><h2>Những hành trình đẹp<br />bắt đầu bằng một<br /><em>chút an nhiên.</em></h2><p>{register ? 'Mở cánh cửa cho những trải nghiệm mới.' : 'Thật vui khi được chào đón bạn trở lại.'}</p></div><span className="auth-visual-caption">AN NHIÊN HOTEL & SUITES</span></aside><main className="auth-main" id="main-content"><Link to="/" className="back-link"><ArrowLeft size={17} />Về trang chủ</Link><div className="auth-form-wrap">{children}</div><p className="auth-copyright">© {new Date().getFullYear()} An Nhiên Hotel & Suites</p></main></div>;
}
const message = (error: Error) => error instanceof ApiError ? (error.status === 409 ? 'Email này đã được đăng ký. Hãy đăng nhập hoặc dùng email khác.' : error.message) : 'Chưa thể hoàn tất yêu cầu. Vui lòng thử lại.';
export function LoginPage() {
  const auth = useAuth(), location = useLocation(), navigate = useNavigate(), toast = useToast();
  const [attemptedEmail, setAttemptedEmail] = useState('');
  const form = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { email: typeof location.state?.registeredEmail === 'string' ? location.state.registeredEmail : '', password: '' } });
  const mutation = useMutation({ mutationFn: auth.login, onSuccess: user => { toast('Chào mừng bạn đến với An Nhiên.'); navigate(safeDestination(location.state?.from, user.role), { replace: true }); } });
  if (auth.user) return <Navigate to={safeDestination(location.state?.from, auth.user.role)} replace />;
  return <AuthFrame><p className="eyebrow">CHÀO MỪNG TRỞ LẠI</p><h1>Một chút <em>an nhiên.</em></h1><p className="auth-subtitle">Đăng nhập để tiếp tục hành trình của bạn.</p>{auth.notice && <div className="notice" role="status">{auth.notice}</div>}
    <form noValidate onSubmit={form.handleSubmit(values => { setAttemptedEmail(values.email); mutation.mutate(values); })} className="auth-form">
      <FormField name="email" label="Địa chỉ email" error={form.formState.errors.email?.message}><Input id="email" type="email" autoComplete="username" placeholder="ban@email.com" aria-invalid={!!form.formState.errors.email} aria-describedby={form.formState.errors.email ? 'email-error' : undefined} {...form.register('email')} /></FormField>
      <FormField name="password" label="Mật khẩu" error={form.formState.errors.password?.message}><PasswordInput id="password" autoComplete="current-password" placeholder="Nhập mật khẩu của bạn" aria-invalid={!!form.formState.errors.password} aria-describedby={form.formState.errors.password ? 'password-error' : undefined} {...form.register('password')} /></FormField>
      {mutation.error && <p className="form-error" role="alert">{message(mutation.error)}{mutation.error instanceof ApiError && mutation.error.status === 401 && attemptedEmail ? ' Vui lòng kiểm tra lại thông tin đăng nhập.' : ''}</p>}
      <Button type="submit" busy={mutation.isPending} className="full-width">{mutation.isPending ? 'Đang đăng nhập…' : 'Đăng nhập'}<ArrowRight size={18} /></Button>
    </form><p className="auth-switch">Chưa có tài khoản? <Link to="/register" state={{ from: location.state?.from }}>Tạo tài khoản</Link></p><div className="auth-security"><ShieldCheck size={20} /><p>Để bảo vệ tài khoản, bạn sẽ cần đăng nhập lại khi tải lại trang. Không có chức năng ghi nhớ đăng nhập.</p></div>
  </AuthFrame>;
}
export function RegisterPage() {
  const auth = useAuth(), location = useLocation(), navigate = useNavigate(), toast = useToast();
  const form = useForm<RegisterInput>({ resolver: zodResolver(registerSchema), defaultValues: { fullName: '', email: '', phone: '', password: '', confirmPassword: '' } });
  const mutation = useMutation({ mutationFn: (values: RegisterInput) => api.request('/auth/register', { method: 'POST', authenticated: false, body: { fullName: values.fullName, email: values.email, password: values.password, ...(values.phone ? { phone: values.phone } : {}) } }), onSuccess: (_data, values) => { toast('Tạo tài khoản thành công. Bạn có thể đăng nhập ngay.'); navigate('/login', { replace: true, state: { registeredEmail: values.email, from: location.state?.from } }); } });
  if (auth.user) return <Navigate to={homeForRole[auth.user.role]} replace />;
  return <AuthFrame register><p className="eyebrow">BẮT ĐẦU HÀNH TRÌNH</p><h1>Chào bạn, <em>khách quý.</em></h1><p className="auth-subtitle">Tạo tài khoản khách lưu trú tại An Nhiên.</p><form noValidate onSubmit={form.handleSubmit(values => mutation.mutate(values))} className="auth-form register-form">
    <FormField name="fullName" label="Họ và tên" error={form.formState.errors.fullName?.message}><Input id="fullName" autoComplete="name" placeholder="Nguyễn An Nhiên" aria-invalid={!!form.formState.errors.fullName} aria-describedby={form.formState.errors.fullName ? 'fullName-error' : undefined} {...form.register('fullName')} /></FormField>
    <FormField name="email" label="Địa chỉ email" error={form.formState.errors.email?.message}><Input id="email" type="email" autoComplete="username" placeholder="ban@email.com" aria-invalid={!!form.formState.errors.email} aria-describedby={form.formState.errors.email ? 'email-error' : undefined} {...form.register('email')} /></FormField>
    <FormField name="phone" label="Số điện thoại (không bắt buộc)" error={form.formState.errors.phone?.message}><Input id="phone" type="tel" autoComplete="tel" placeholder="090 123 4567" aria-invalid={!!form.formState.errors.phone} aria-describedby={form.formState.errors.phone ? 'phone-error' : undefined} {...form.register('phone')} /></FormField>
    <FormField name="password" label="Mật khẩu" error={form.formState.errors.password?.message} hint="Ít nhất 12 ký tự, bao gồm chữ và số."><PasswordInput id="password" autoComplete="new-password" placeholder="Tạo mật khẩu an toàn" aria-invalid={!!form.formState.errors.password} aria-describedby={form.formState.errors.password ? 'password-error password-hint' : 'password-hint'} {...form.register('password')} /></FormField>
    <FormField name="confirmPassword" label="Xác nhận mật khẩu" error={form.formState.errors.confirmPassword?.message}><PasswordInput id="confirmPassword" autoComplete="new-password" placeholder="Nhập lại mật khẩu" aria-invalid={!!form.formState.errors.confirmPassword} aria-describedby={form.formState.errors.confirmPassword ? 'confirmPassword-error' : undefined} {...form.register('confirmPassword')} /></FormField>
    {mutation.error && <p className="form-error" role="alert">{message(mutation.error)}</p>}
    <Button type="submit" busy={mutation.isPending} className="full-width">{mutation.isPending ? 'Đang tạo tài khoản…' : 'Tạo tài khoản'}<ArrowRight size={18} /></Button>
  </form><p className="auth-switch">Đã có tài khoản? <Link to="/login" state={{ from: location.state?.from }}>Đăng nhập</Link></p><p className="register-caption"><ShieldCheck size={16} /> Thông tin của bạn chỉ phục vụ việc quản lý tài khoản và lưu trú.</p></AuthFrame>;
}
