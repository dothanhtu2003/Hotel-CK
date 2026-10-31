import { z } from 'zod';

export const roles = ['GUEST', 'RECEPTIONIST', 'HOUSEKEEPING', 'ADMIN'] as const;
export type Role = typeof roles[number];
export const userSchema = z.object({
  id: z.string().uuid(), fullName: z.string(), email: z.string().email().nullable(), phone: z.string().nullable(),
  role: z.enum(roles), status: z.enum(['ACTIVE', 'DISABLED']), createdAt: z.string(), updatedAt: z.string(),
});
export type User = z.infer<typeof userSchema>;
export const loginResponseSchema = z.object({ accessToken: z.string().min(1), tokenType: z.literal('Bearer'), expiresIn: z.number().int().positive() });
const fullName = z.string().trim().min(1, 'Vui lòng nhập họ và tên.').max(120, 'Họ tên tối đa 120 ký tự.');
const email = z.string().trim().toLowerCase().email('Vui lòng nhập email hợp lệ.').max(254, 'Email quá dài.');
const phone = z.string().max(24, 'Số điện thoại tối đa 24 ký tự.').refine(value => value === '' || /^\+?[0-9][0-9 ()-]{5,22}[0-9]$/.test(value), 'Số điện thoại chưa hợp lệ.');
export const loginSchema = z.object({ email, password: z.string().min(1, 'Vui lòng nhập mật khẩu.') });
export const registerSchema = z.object({
  fullName, email, phone,
  password: z.string().min(1, 'Vui lòng nhập mật khẩu.'),
  confirmPassword: z.string().min(1, 'Vui lòng nhập lại mật khẩu.'),
}).refine(data => data.password === data.confirmPassword, { path: ['confirmPassword'], message: 'Mật khẩu xác nhận chưa khớp.' });
export const profileSchema = z.object({ fullName, phone });
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
export const roleLabel: Record<Role, string> = { GUEST: 'Khách lưu trú', RECEPTIONIST: 'Lễ tân', HOUSEKEEPING: 'Nhân viên buồng phòng', ADMIN: 'Quản trị viên' };
export const homeForRole: Record<Role, string> = { GUEST: '/guest', RECEPTIONIST: '/reception', HOUSEKEEPING: '/housekeeping', ADMIN: '/admin' };
export function safeDestination(value: unknown, role: Role) {
  if (role === 'GUEST' && value === '/guest') return '/';
  if (role === 'GUEST' && typeof value === 'string' && /^\/rooms\/[a-f0-9-]{36}(?:\?[^#]*)?$/i.test(value)) return value;
  if (role === 'ADMIN' && typeof value === 'string' && /^\/reception(?:\/[a-z0-9-]+)*$/.test(value)) return value;
  // Deliberately allow only the authenticated role's local workspace (no open redirect).
  const home = homeForRole[role];
  return typeof value === 'string' && /^\/[a-z0-9-]+(?:\/[a-z0-9-]+)*$/.test(value) && (value === home || value.startsWith(home + '/')) ? value : role === 'GUEST' ? '/' : home;
}
