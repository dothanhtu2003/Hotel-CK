import { safeError, t as tr, useLocale } from "../i18n";
import { formatDate } from "../i18n/format";

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from '../i18n/forms';
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
  useLocale();
  return <aside className="panel profile-summary"><div className="profile-avatar">{user.fullName.slice(0, 1).toUpperCase()}</div><h2>{user.fullName}</h2><p>{user.email}</p><StatusBadge tone="success">{roleLabel[user.role]}</StatusBadge><div className="summary-divider" /><div className="summary-security"><ShieldCheck size={20} /><div><strong>{tr("common:profilePages.yourAccountIsProtected")}</strong><p>{tr("common:profilePages.yourPersonalInformationIsVisibleOnlyInYourAccount")}</p></div></div></aside>;
}
function ProfileFailure({ error, retry }: { error: Error; retry: () => void }) {
  useLocale(); return <ErrorState title={error instanceof ApiError && error.status === 403 ? tr("common:profilePages.accessDenied") : undefined} message={error instanceof ApiError ? safeError(error) : tr("common:profilePages.unableToLoadYourProfilePleaseTryAgain")} retry={retry} />; }
export function ProfilePage() {
  useLocale();
  const profile = useProfile();
  if (profile.isPending) return <LoadingState />;
  if (profile.error) return <ProfileFailure error={profile.error} retry={() => { void profile.refetch(); }} />;
  const user = profile.data;
  return <><PageHeading eyebrow={tr("common:profilePages.yourAccount")} title={tr("common:guestPortalLayout.myProfile")} description={tr("common:profilePages.aFewDetailsToHelpUsWelcomeYouBetter")} action={<LinkButton to={`${homeForRole[user.role]}/profile/edit`} variant="secondary"><Pencil size={16} />{tr("common:profilePages.editProfile")}</LinkButton>} /><div className="profile-grid"><ProfileSummary user={user} /><section className="panel profile-details"><div className="panel-heading"><h2>{tr("common:profilePages.personalInformation")}</h2><UserRound size={20} /></div><dl>{[{ icon: UserRound, label: tr("common:authPages.fullName"), value: user.fullName }, { icon: Mail, label: tr("common:authPages.emailAddress"), value: user.email }, { icon: Phone, label: tr("common:profilePages.phoneNumber"), value: user.phone || tr("common:profilePages.notProvided") }, { icon: ShieldCheck, label: tr("common:profilePages.role"), value: roleLabel[user.role] }, { icon: CalendarDays, label: tr("common:profilePages.memberSince"), value: formatDate(user.createdAt, { dateStyle: 'long' }) }].map(({ icon: Icon, label, value }) => <div key={label}><dt><Icon size={17} />{label}</dt><dd>{value}</dd></div>)}</dl><div className="profile-info"><LockKeyhole size={19} /><p>{tr("common:profilePages.yourEmailAndRoleAreManagedByTheSystemYouCanUpdate")}</p></div></section></div></>;
}
export function EditProfilePage() {
  useLocale();
  const profile = useProfile();
  if (profile.isPending) return <LoadingState />;
  if (profile.error) return <ProfileFailure error={profile.error} retry={() => { void profile.refetch(); }} />;
  return <EditProfileForm user={profile.data} />;
}
function EditProfileForm({ user }: { user: User }) {
  useLocale();
  const { updateUser } = useAuth(), query = useQueryClient(), toast = useToast(), navigate = useNavigate();
  const [cancelOpen, setCancelOpen] = useState(false);
  const home = homeForRole[user.role];
  const form = useForm<ProfileInput>({ resolver: zodResolver(profileSchema), defaultValues: { fullName: user.fullName, phone: user.phone ?? '' } });
  const mutation = useMutation({ mutationFn: async (values: ProfileInput) => userSchema.parse(await api.request('/users/me', { method: 'PATCH', body: { fullName: values.fullName, phone: values.phone || null } })), onSuccess: profile => { if (!updateUser(profile)) return; query.setQueryData(['profile', profile.id], profile); toast(() => (tr("common:profilePages.yourProfileHasBeenUpdated"))); navigate(`${homeForRole[profile.role]}/profile`, { replace: true }); } });
  useEffect(() => {
    if (!form.formState.isDirty) return;
    const listener = (event: BeforeUnloadEvent) => event.preventDefault(); window.addEventListener('beforeunload', listener); return () => window.removeEventListener('beforeunload', listener);
  }, [form.formState.isDirty]);
  return <><PageHeading eyebrow={tr("common:profilePages.yourAccount")} title={tr("common:profilePages.editProfile")} description={tr("common:profilePages.keepYourContactInformationUpToDate")} /><div className="profile-grid"><ProfileSummary user={user} /><section className="panel profile-details"><div className="panel-heading"><h2>{tr("common:profilePages.basicInformation")}</h2><Pencil size={19} /></div><form className="profile-form" noValidate onSubmit={form.handleSubmit(values => mutation.mutate(values))}><FormField name="fullName" label={tr("common:authPages.fullName")} error={form.formState.errors.fullName?.message}><Input id="fullName" autoComplete="name" aria-invalid={!!form.formState.errors.fullName} aria-describedby={form.formState.errors.fullName ? 'fullName-error' : undefined} {...form.register('fullName')} /></FormField><FormField name="phone" label={tr("common:profilePages.phoneNumber")} hint={tr("common:profilePages.leaveBlankToRemoveYourCurrentPhoneNumber")} error={form.formState.errors.phone?.message}><Input id="phone" type="tel" autoComplete="tel" aria-invalid={!!form.formState.errors.phone} aria-describedby={form.formState.errors.phone ? 'phone-error phone-hint' : 'phone-hint'} {...form.register('phone')} /></FormField><FormField name="profileEmail" label={tr("common:authPages.emailAddress")} hint={tr("common:profilePages.yourEmailCannotBeChangedHere")}><Input id="profileEmail" type="email" value={user.email ?? ""} readOnly /></FormField>{mutation.error && <p className="form-error" role="alert">{mutation.error instanceof ApiError ? safeError(mutation.error) : tr("common:profilePages.unableToSaveYourProfilePleaseTryAgain")}</p>}<div className="form-actions"><Button type="button" variant="secondary" disabled={mutation.isPending} onClick={() => { if (form.formState.isDirty) setCancelOpen(true); else navigate(`${home}/profile`); }}>{tr("common:profilePages.cancelChanges")}</Button><Button type="submit" busy={mutation.isPending} disabled={!form.formState.isDirty}><Check size={17} />{mutation.isPending ? tr("common:profilePages.saving") : tr("common:profilePages.saveChanges")}</Button></div></form></section></div><Dialog open={cancelOpen} onClose={() => setCancelOpen(false)} title={tr("common:profilePages.discardUnsavedChanges")}><p>{tr("common:profilePages.yourRecentChangesWillNotBeSaved")}</p><div className="dialog-actions"><Button variant="secondary" onClick={() => setCancelOpen(false)}>{tr("common:profilePages.continueEditing")}</Button><Button onClick={() => navigate(`${home}/profile`)}>{tr("common:profilePages.discardChanges")}</Button></div></Dialog></>;
}
