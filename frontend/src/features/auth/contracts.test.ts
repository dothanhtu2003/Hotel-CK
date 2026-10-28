import { describe, expect, it } from 'vitest';
import { homeForRole, loginSchema, profileSchema, registerSchema, roles, safeDestination } from './contracts';

describe('Forms and role navigation contract', () => {
  const valid = { fullName: '  An Nhiên  ', email: '  GUEST@EXAMPLE.COM  ', phone: '', password: 'A-strong-pass123', confirmPassword: 'A-strong-pass123' };
  it('normalizes email/name but preserves password exactly', () => {
    const parsed = registerSchema.parse(valid); expect(parsed.email).toBe('guest@example.com'); expect(parsed.fullName).toBe('An Nhiên');
    expect(loginSchema.parse({ email: 'guest@example.com', password: ' password ' }).password).toBe(' password ');
  });
  it.each(['short1', 'onlylettershere', '1234567890123'])('rejects password %s', password => expect(registerSchema.safeParse({ ...valid, password, confirmPassword: password }).success).toBe(false));
  it('validates confirmation, name/email and phone', () => {
    for (const change of [{ confirmPassword: 'not-matching' }, { fullName: '   ' }, { email: 'bad' }, { phone: 'abc' }]) expect(registerSchema.safeParse({ ...valid, ...change }).success).toBe(false);
    expect(profileSchema.safeParse({ fullName: 'An', phone: '+84 901 234 567' }).success).toBe(true); expect(profileSchema.safeParse({ fullName: 'An', phone: '' }).success).toBe(true);
  });
  it.each(roles)('maps backend role %s to its own workspace', role => { expect(safeDestination('/wrong', role)).toBe(homeForRole[role]); expect(safeDestination(`${homeForRole[role]}/profile/edit`, role)).toBe(`${homeForRole[role]}/profile/edit`); });
  it.each(['https://evil.example', '//evil.example', '/guest/../admin', '/guest/%2e%2e/admin', '/guest/\\evil', '/guest/profile?token=x', '/admin', undefined])('rejects unsafe/cross-role return path %s', path => expect(safeDestination(path, 'GUEST')).toBe('/guest'));
});
