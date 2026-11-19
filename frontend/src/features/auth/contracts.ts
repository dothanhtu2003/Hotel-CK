import { t as tr, localized } from "../../i18n";
import { z } from 'zod';

export const roles = ['GUEST', 'RECEPTIONIST', 'HOUSEKEEPING', 'ADMIN'] as const;
export type Role = typeof roles[number];
export const userSchema = z.object({
  id: z.string().uuid(), fullName: z.string(), email: z.string().email().nullable(), phone: z.string().nullable(),
  role: z.enum(roles), status: z.enum(['ACTIVE', 'DISABLED']), createdAt: z.string(), updatedAt: z.string(),
});
export type User = z.infer<typeof userSchema>;
export const loginResponseSchema = z.object({ accessToken: z.string().min(1), tokenType: z.literal('Bearer'), expiresIn: z.number().int().positive() });
const fullName = z.string().trim().min(1, { error: () => tr("common:contracts.pleaseEnterYourFullName") }).max(120, { error: () => tr("common:contracts.yourNameMustBe120CharactersOrFewer") });
const email = z.string().trim().toLowerCase().email({ error: () => tr("common:contracts.pleaseEnterAValidEmailAddress") }).max(254, { error: () => tr("common:contracts.theEmailAddressIsTooLong") });
const phone = z.string().max(24, { error: () => tr("common:contracts.yourPhoneNumberMustBe24CharactersOrFewer") }).refine(value => value === '' || /^\+?[0-9][0-9 ()-]{5,22}[0-9]$/.test(value), { error: () => tr("common:contracts.pleaseEnterAValidPhoneNumber") });
export const loginSchema = z.object({ email, password: z.string().min(1, { error: () => tr("common:contracts.pleaseEnterYourPassword") }) });
export const registerSchema = z.object({
  fullName, email, phone,
  password: z.string().min(1, { error: () => tr("common:contracts.pleaseEnterYourPassword") }),
  confirmPassword: z.string().min(1, { error: () => tr("common:contracts.pleaseEnterYourPasswordAgain") }),
}).refine(data => data.password === data.confirmPassword, { path: ['confirmPassword'], error: () => tr("common:contracts.thePasswordsDoNotMatch") });
export const profileSchema = z.object({ fullName, phone });
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
export const roleLabel: Record<Role, string> = localized(() => ({ GUEST: tr("common:contracts.guest"), RECEPTIONIST: tr("common:contracts.receptionist"), HOUSEKEEPING: tr("common:contracts.housekeepingStaff"), ADMIN: tr("admin:workspace.administrator") }));
export const homeForRole: Record<Role, string> = { GUEST: '/guest', RECEPTIONIST: '/reception', HOUSEKEEPING: '/housekeeping', ADMIN: '/admin' };
export function safeDestination(value: unknown, role: Role) {
  if (role === 'GUEST' && value === '/guest') return '/';
  if (role === 'GUEST' && typeof value === 'string' && /^\/rooms\/[a-f0-9-]{36}(?:\?[^#]*)?$/i.test(value)) return value;
  if (role === 'ADMIN' && typeof value === 'string' && /^\/reception(?:\/[a-z0-9-]+)*$/.test(value)) return value;
  // Deliberately allow only the authenticated role's local workspace (no open redirect).
  const home = homeForRole[role];
  return typeof value === 'string' && /^\/[a-z0-9-]+(?:\/[a-z0-9-]+)*$/.test(value) && (value === home || value.startsWith(home + '/')) ? value : role === 'GUEST' ? '/' : home;
}
