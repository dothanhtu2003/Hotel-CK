import { resolveMessage, safeError, t as tr, useLocale } from "../i18n";
import { LanguageSwitcher } from "../i18n/language-switcher";

import { Trans } from "react-i18next";
import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { useForm } from '../i18n/forms';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, ShieldCheck } from 'lucide-react';
import { useAuth } from '../features/auth/auth-context';
import { loginSchema, registerSchema, safeDestination, type LoginInput, type RegisterInput } from '../features/auth/contracts';
import { ApiError } from '../lib/api-client';
import { api } from '../lib/api';
import { Brand } from '../layouts/public-layout';
import { Button, FormField, Input, PasswordInput } from '../components/ui';
import { useToast } from '../components/toast-context';

function AuthFrame({ children, register = false }: { children: React.ReactNode; register?: boolean }) {
  useLocale();
  return <div className="auth-page"><aside className="auth-visual"><img src="/images/hero.jpg" alt={tr("common:authPages.poolAndResortViewsAtAnNhien")} /><div className="auth-visual-shade" /><Brand light /><div className="auth-quote"><p className="eyebrow light">{tr("common:authPages.aPlaceToReturnTo")}</p><h2><Trans ns="common" i18nKey="authPages.beautifulJourneysBeginWithALittlePeace" components={{ part0: <br />, part1: <br />, part2: <em /> }} /></h2><p>{register ? tr("common:authPages.openTheDoorToNewExperiences") : tr("common:authPages.weAreDelightedToWelcomeYouBack")}</p></div><span className="auth-visual-caption">AN NHIÊN HOTEL & SUITES</span></aside><main className="auth-main" id="main-content"><div className="auth-language"><LanguageSwitcher /></div><Link to="/" className="back-link"><ArrowLeft size={17} />{tr("common:authPages.backToHome")}</Link><div className="auth-form-wrap">{children}</div><p className="auth-copyright">{tr("common:workspaceLayout.valueAnNhienHotelSuites", { value0: (new Date().getFullYear()) })}</p></main></div>;
}
const message = (error: Error) => error instanceof ApiError ? (error.status === 409 ? tr("common:authPages.thisEmailIsAlreadyRegisteredSignInOrUseAnotherEmail") : safeError(error)) : tr("common:authPages.unableToCompleteTheRequestPleaseTryAgain");
export function LoginPage() {
  useLocale();
  const auth = useAuth(), location = useLocation(), navigate = useNavigate(), toast = useToast();
  const [attemptedEmail, setAttemptedEmail] = useState('');
  const form = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { email: typeof location.state?.registeredEmail === 'string' ? location.state.registeredEmail : '', password: '' } });
  const mutation = useMutation({ mutationFn: auth.login, onSuccess: user => { toast(() => (tr("common:authPages.welcomeToAnNhien"))); navigate(safeDestination(location.state?.from, user.role), { replace: true }); } });
  if (auth.user) return <Navigate to={safeDestination(location.state?.from, auth.user.role)} replace />;
  return <AuthFrame><p className="eyebrow">{tr("common:authPages.welcomeBack")}</p><h1><Trans ns="common" i18nKey="authPages.aLittlePeace" components={{ part0: <em /> }} /></h1><p className="auth-subtitle">{tr("common:authPages.signInToContinueYourJourney")}</p>{auth.notice && <div className="notice" role="status">{resolveMessage(auth.notice)}</div>}
    <form noValidate onSubmit={form.handleSubmit(values => { setAttemptedEmail(values.email); mutation.mutate(values); })} className="auth-form">
      <FormField name="email" label={tr("common:authPages.emailAddress")} error={form.formState.errors.email?.message}><Input id="email" type="email" autoComplete="username" placeholder="ban@email.com" aria-invalid={!!form.formState.errors.email} aria-describedby={form.formState.errors.email ? 'email-error' : undefined} {...form.register('email')} /></FormField>
      <FormField name="password" label={tr("common:authPages.password")} error={form.formState.errors.password?.message}><PasswordInput id="password" autoComplete="current-password" placeholder={tr("common:authPages.enterYourPassword")} aria-invalid={!!form.formState.errors.password} aria-describedby={form.formState.errors.password ? 'password-error' : undefined} {...form.register('password')} /></FormField>
      {mutation.error && <p className="form-error" role="alert">{message(mutation.error)}{mutation.error instanceof ApiError && mutation.error.status === 401 && attemptedEmail ? tr("common:authPages.pleaseCheckYourSignInDetails") : ''}</p>}
      <Button type="submit" busy={mutation.isPending} className="full-width">{mutation.isPending ? tr("common:authPages.signingIn") : tr("common:publicLayout.signIn")}<ArrowRight size={18} /></Button>
    </form><p className="auth-switch">{tr("common:authPages.donTHaveAnAccount")}<Link to="/register" state={{ from: location.state?.from }}>{tr("common:authPages.createAccount")}</Link></p><div className="auth-security"><ShieldCheck size={20} /><p>{tr("common:authPages.toProtectYourAccountYouWillNeedToSignInAgainWhen")}</p></div>
  </AuthFrame>;
}
export function RegisterPage() {
  useLocale();
  const auth = useAuth(), location = useLocation(), navigate = useNavigate(), toast = useToast();
  const form = useForm<RegisterInput>({ resolver: zodResolver(registerSchema), defaultValues: { fullName: '', email: '', phone: '', password: '', confirmPassword: '' } });
  const mutation = useMutation({ mutationFn: (values: RegisterInput) => api.request('/auth/register', { method: 'POST', authenticated: false, body: { fullName: values.fullName, email: values.email, password: values.password, ...(values.phone ? { phone: values.phone } : {}) } }), onSuccess: (_data, values) => { toast(() => (tr("common:authPages.yourAccountHasBeenCreatedYouCanSignInNow"))); navigate('/login', { replace: true, state: { registeredEmail: values.email, from: location.state?.from } }); } });
  if (auth.user) return <Navigate to={safeDestination(location.state?.from, auth.user.role)} replace />;
  return <AuthFrame register><p className="eyebrow">{tr("common:authPages.beginYourJourney")}</p><h1><Trans ns="common" i18nKey="authPages.welcomeDearGuest" components={{ part0: <em /> }} /></h1><p className="auth-subtitle">{tr("common:authPages.createAGuestAccountAtAnNhien")}</p><form noValidate onSubmit={form.handleSubmit(values => mutation.mutate(values))} className="auth-form register-form">
    <FormField name="fullName" label={tr("common:authPages.fullName")} error={form.formState.errors.fullName?.message}><Input id="fullName" autoComplete="name" placeholder="Nguyễn An Nhiên" aria-invalid={!!form.formState.errors.fullName} aria-describedby={form.formState.errors.fullName ? 'fullName-error' : undefined} {...form.register('fullName')} /></FormField>
    <FormField name="email" label={tr("common:authPages.emailAddress")} error={form.formState.errors.email?.message}><Input id="email" type="email" autoComplete="username" placeholder="ban@email.com" aria-invalid={!!form.formState.errors.email} aria-describedby={form.formState.errors.email ? 'email-error' : undefined} {...form.register('email')} /></FormField>
    <FormField name="phone" label={tr("common:authPages.phoneNumberOptional")} error={form.formState.errors.phone?.message}><Input id="phone" type="tel" autoComplete="tel" placeholder="090 123 4567" aria-invalid={!!form.formState.errors.phone} aria-describedby={form.formState.errors.phone ? 'phone-error' : undefined} {...form.register('phone')} /></FormField>
    <FormField name="password" label={tr("common:authPages.password")} error={form.formState.errors.password?.message} hint={tr("common:authPages.chooseAnyPasswordButDoNotLeaveItBlank")}><PasswordInput id="password" autoComplete="new-password" placeholder={tr("common:authPages.enterPassword")} aria-invalid={!!form.formState.errors.password} aria-describedby={form.formState.errors.password ? 'password-error password-hint' : 'password-hint'} {...form.register('password')} /></FormField>
    <FormField name="confirmPassword" label={tr("common:authPages.confirmPassword")} error={form.formState.errors.confirmPassword?.message}><PasswordInput id="confirmPassword" autoComplete="new-password" placeholder={tr("common:authPages.enterPasswordAgain")} aria-invalid={!!form.formState.errors.confirmPassword} aria-describedby={form.formState.errors.confirmPassword ? 'confirmPassword-error' : undefined} {...form.register('confirmPassword')} /></FormField>
    {mutation.error && <p className="form-error" role="alert">{message(mutation.error)}</p>}
    <Button type="submit" busy={mutation.isPending} className="full-width">{mutation.isPending ? tr("common:authPages.creatingAccount") : tr("common:authPages.createAccount")}<ArrowRight size={18} /></Button>
  </form><p className="auth-switch">{tr("common:authPages.alreadyHaveAnAccount")}<Link to="/login" state={{ from: location.state?.from }}>{tr("common:publicLayout.signIn")}</Link></p><p className="register-caption"><ShieldCheck size={16} /> {tr("common:authPages.yourInformationIsUsedOnlyToManageYourAccountAndStay")}</p></AuthFrame>;
}
