import { describe, expect, it } from 'vitest';
import { homeForRole, loginSchema, profileSchema, registerSchema, roles, safeDestination } from './contracts';

describe('Forms and role navigation contract', () => {
  const valid = { fullName: '  An Nhiên  ', email: '  GUEST@EXAMPLE.COM  ', phone: '', password: 'A-strong-pass123', confirmPassword: 'A-strong-pass123' };
  it('normalizes email/name but preserves password exactly', () => {
    const parsed = registerSchema.parse(valid); expect(parsed.email).toBe('guest@example.com'); expect(parsed.fullName).toBe('An Nhiên');
    expect(loginSchema.parse({ email: 'guest@example.com', password: ' password ' }).password).toBe(' password ');
  });
  it.each(['1', 'short1', 'onlylettershere', '1234567890123', 'a'.repeat(256)])('accepts password %s', password => expect(registerSchema.safeParse({ ...valid, password, confirmPassword: password }).success).toBe(true));
  it('validates confirmation, name/email and phone', () => {
    for (const change of [{ confirmPassword: 'not-matching' }, { fullName: '   ' }, { email: 'bad' }, { phone: 'abc' }]) expect(registerSchema.safeParse({ ...valid, ...change }).success).toBe(false);
    expect(profileSchema.safeParse({ fullName: 'An', phone: '+84 901 234 567' }).success).toBe(true); expect(profileSchema.safeParse({ fullName: 'An', phone: '' }).success).toBe(true);
  });
  it.each(roles)('maps backend role %s to its own workspace', role => { expect(safeDestination('/wrong', role)).toBe(role === 'GUEST' ? '/' : homeForRole[role]); expect(safeDestination(`${homeForRole[role]}/profile/edit`, role)).toBe(`${homeForRole[role]}/profile/edit`); });
  it.each(['https://evil.example', '//evil.example', '/guest/../admin', '/guest/%2e%2e/admin', '/guest/\\evil', '/guest/profile?token=x', '/admin', undefined])('rejects unsafe/cross-role return path %s', path => expect(safeDestination(path, 'GUEST')).toBe('/'));
});

it('sends normal guest login home and preserves booking and protected page returns', () => {
  expect(safeDestination(undefined, 'GUEST')).toBe('/');
  expect(safeDestination('/guest', 'GUEST')).toBe('/');
  const room = '/rooms/550e8400-e29b-41d4-a716-446655440000?checkIn=2030-01-01&checkOut=2030-01-02&guests=2';
  expect(safeDestination(room, 'GUEST')).toBe(room);
  expect(safeDestination('/guest/bookings', 'GUEST')).toBe('/guest/bookings');
});
