import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { Controller, Get } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, randomUUID } from 'node:crypto';
import request from 'supertest';
import { Role } from '../../generated/prisma/enums.js';
import { Roles } from '../../src/auth/decorators/roles.decorator.js';
import { createAuthTestApp } from './auth-test-app.js';
import { PasswordService } from '../../src/auth/password.service.js';

// Fixture routes exist only in this test module, never in the real AppModule/Swagger.
@Controller('_test/roles')
class RoleFixtureController {
  @Get('guest') @Roles(Role.GUEST) guest() { return { allowed: true }; }
  @Get('receptionist') @Roles(Role.RECEPTIONIST) receptionist() { return { allowed: true }; }
  @Get('housekeeping') @Roles(Role.HOUSEKEEPING) housekeeping() { return { allowed: true }; }
  @Get('admin') @Roles(Role.ADMIN) admin() { return { allowed: true }; }
}

describe('Phase 3 authentication/profile/RBAC — hotel_test only', () => {
  let context: Awaited<ReturnType<typeof createAuthTestApp>>;
  const suffix = randomUUID();
  const email = `guest-${suffix}@auth-test.invalid`;
  const password = `A1-${randomBytes(24).toString('base64url')}`;
  const emails = new Set<string>([email]);
  let userId: string;
  let accessToken: string;
  let otherToken: string;
  let otherId: string;
  let hashesBefore: Record<string, number>;

  beforeAll(async () => {
    context = await createAuthTestApp(100, [RoleFixtureController]);
    hashesBefore = { bookings: await context.prisma.client.booking.count(), invoices: await context.prisma.client.invoice.count(), payments: await context.prisma.client.payment.count() };
  });
  afterAll(async () => {
    if (context) {
      try {
        // Only the random fixture users created by this suite; no seed data cleanup.
        await context.prisma.client.user.deleteMany({ where: { email: { in: [...emails] } } });
        expect({ bookings: await context.prisma.client.booking.count(), invoices: await context.prisma.client.invoice.count(), payments: await context.prisma.client.payment.count() }).toEqual(hashesBefore);
      } finally { await context.app.close(); }
    }
  });
  const api = () => request(context.app.getHttpServer());
  const assertSafe = (body: unknown) => {
    const text = JSON.stringify(body);
    expect(text).not.toMatch(/passwordHash|password_hash|\$argon2|scrypt\$/);
    expect(text).not.toContain(password);
  };
  const registration = () => ({ fullName: 'Test Guest', email, password });

  it('01 registers only an ACTIVE GUEST with normalized email and Argon2id hash', async () => {
    const response = await api().post('/api/auth/register').send({ ...registration(), email: ` ${email.toUpperCase()} ` }).expect(201);
    expect(response.body.email).toBe(email);
    expect(response.body.role).toBe('GUEST'); expect(response.body.status).toBe('ACTIVE');
    userId = response.body.id;
    assertSafe(response.body);
    const stored = await context.prisma.client.user.findUniqueOrThrow({ where: { id: userId } });
    expect(stored.passwordHash.startsWith('$argon2id$')).toBe(true);
    expect(await context.app.get(PasswordService).verify(stored.passwordHash, password)).toBe(true);
  });

  it('02 duplicate normalized email returns controlled 409', async () => {
    const response = await api().post('/api/auth/register').send(registration()).expect(409);
    assertSafe(response.body);
  });

  it('03 invalid email returns 400', async () => {
    await api().post('/api/auth/register').send({ ...registration(), email: 'invalid' }).expect(400);
  });

  it.each(['short1A', '12345678901234', 'abcdefghijklmn'])('04 weak password rejected', async weak => {
    const response = await api().post('/api/auth/register').send({ ...registration(), password: weak }).expect(400);
    expect(response.text).not.toContain(weak);
  });

  it.each(['ADMIN', 'RECEPTIONIST', 'HOUSEKEEPING'])('05 cannot self-register privileged role %s', async role => {
    await api().post('/api/auth/register').send({ ...registration(), role }).expect(400);
  });

  it('06 login succeeds and token has expiry/issuer/audience and no private claims', async () => {
    const response = await api().post('/api/auth/login').send({ email: ` ${email.toUpperCase()} `, password }).expect(200);
    accessToken = response.body.accessToken;
    expect(response.body.tokenType).toBe('Bearer'); expect(response.body.expiresIn).toBe(900);
    assertSafe(response.body);
    const payload = await context.app.get(JwtService).verifyAsync(accessToken);
    expect(payload.sub).toBe(userId); expect(payload.exp - payload.iat).toBe(900);
    expect(payload.iss).toBe('hotel-ck'); expect(payload.aud).toBe('hotel-api');
    expect(payload).not.toHaveProperty('role'); expect(payload).not.toHaveProperty('email');
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('07/08 wrong password and nonexistent email have the same generic 401', async () => {
    const wrong = await api().post('/api/auth/login').send({ email, password: `${password}-wrong` }).expect(401);
    const missing = await api().post('/api/auth/login').send({ email: `missing-${suffix}@auth-test.invalid`, password }).expect(401);
    expect(wrong.body).toEqual(missing.body); assertSafe(wrong.body);
  });

  it('09 disabled account cannot login or use a previously issued JWT', async () => {
    await context.prisma.client.user.update({ where: { id: userId }, data: { status: 'DISABLED' } });
    try {
      await api().post('/api/auth/login').send({ email, password }).expect(401);
      await api().get('/api/auth/me').auth(accessToken, { type: 'bearer' }).expect(401);
    } finally { await context.prisma.client.user.update({ where: { id: userId }, data: { status: 'ACTIVE' } }); }
  });

  it('10 rejects malformed, wrong-signature, wrong-audience and wrong-algorithm JWTs', async () => {
    const signer = context.app.get(JwtService);
    const tokens = [
      'invalid.jwt.token',
      await signer.signAsync({ sub: userId, tokenType: 'access' }, { secret: randomBytes(48).toString('base64url') }),
      await signer.signAsync({ sub: userId, tokenType: 'access' }, { audience: 'another-api' }),
      await signer.signAsync({ sub: userId, tokenType: 'access' }, { algorithm: 'HS384' }),
    ];
    for (const token of tokens) await api().get('/api/auth/me').auth(token, { type: 'bearer' }).expect(401);
  });

  it('11 rejects expired JWT', async () => {
    const token = await context.app.get(JwtService).signAsync({ sub: userId, tokenType: 'access' }, { expiresIn: -1 });
    await api().get('/api/auth/me').auth(token, { type: 'bearer' }).expect(401);
  });

  it('rejects missing expiry, wrong issuer/type/subject and ignores JWT role claims', async () => {
    const signer = context.app.get(JwtService);
    const noExpiry = new JwtService({ secret: context.config.JWT_SECRET, signOptions: { algorithm: 'HS256', issuer: 'hotel-ck', audience: 'hotel-api' } });
    const tokens = [
      await noExpiry.signAsync({ sub: userId, tokenType: 'access' }),
      await signer.signAsync({ sub: userId, tokenType: 'access' }, { issuer: 'another-issuer' }),
      await signer.signAsync({ sub: userId, tokenType: 'refresh' }),
      await signer.signAsync({ sub: 'invalid-uuid', tokenType: 'access' }),
    ];
    for (const token of tokens) await api().get('/api/auth/me').auth(token, { type: 'bearer' }).expect(401);
    const injectedRole = await signer.signAsync({ sub: userId, tokenType: 'access', role: 'ADMIN' });
    await api().get('/api/_test/roles/admin').auth(injectedRole, { type: 'bearer' }).expect(403);
    await api().get('/api/_test/roles/guest').auth(injectedRole, { type: 'bearer' }).expect(200);
  });

  it('12 requires bearer authentication on all profile endpoints', async () => {
    await api().get('/api/auth/me').expect(401);
    await api().get('/api/users/me').expect(401);
    await api().patch('/api/users/me').send({ fullName: 'No token' }).expect(401);
    await api().get('/api/auth/me').set('Authorization', 'Basic invalid').expect(401);
  });

  it('13/15 returns only the authenticated profile without any password hash', async () => {
    for (const path of ['/api/auth/me', '/api/users/me']) {
      const response = await api().get(path).auth(accessToken, { type: 'bearer' }).expect(200);
      expect(response.body.id).toBe(userId); assertSafe(response.body);
    }
  });

  it('14 forbids mass assignment to role/status/hash/email/id and rejects invalid profile values', async () => {
    for (const extra of [{ role: 'ADMIN' }, { status: 'DISABLED' }, { password_hash: 'invalid' }, { passwordHash: 'invalid' }, { email: 'other@example.com' }, { id: randomUUID() }]) {
      await api().patch('/api/users/me').auth(accessToken, { type: 'bearer' }).send({ fullName: 'Test', ...extra }).expect(400);
    }
    for (const body of [{}, { fullName: null }, { fullName: '   ' }, { phone: 'not-a-number' }]) {
      await api().patch('/api/users/me').auth(accessToken, { type: 'bearer' }).send(body).expect(400);
    }
    const user = await context.prisma.client.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.role).toBe('GUEST'); expect(user.status).toBe('ACTIVE');
  });

  it('updates only own permitted fields; a second user cannot target the first user', async () => {
    const response = await api().patch('/api/users/me').auth(accessToken, { type: 'bearer' }).send({ fullName: '  Updated Guest  ', phone: '+84901234567' }).expect(200);
    expect(response.body.fullName).toBe('Updated Guest'); assertSafe(response.body);
    const otherEmail = `other-${suffix}@auth-test.invalid`; emails.add(otherEmail);
    const other = await api().post('/api/auth/register').send({ ...registration(), email: otherEmail }).expect(201); otherId = other.body.id;
    const login = await api().post('/api/auth/login').send({ email: otherEmail, password }).expect(200); otherToken = login.body.accessToken;
    const own = await api().patch('/api/users/me').auth(otherToken, { type: 'bearer' }).send({ fullName: 'Other Guest' }).expect(200);
    expect(own.body.id).toBe(otherId);
    await api().patch(`/api/users/${userId}`).auth(otherToken, { type: 'bearer' }).send({ fullName: 'Attack' }).expect(404);
    expect((await context.prisma.client.user.findUniqueOrThrow({ where: { id: userId } })).fullName).toBe('Updated Guest');
    const cleared = await api().patch('/api/users/me').auth(accessToken, { type: 'bearer' }).send({ phone: null }).expect(200);
    expect(cleared.body.phone).toBeNull();
  });

  const roles = ['GUEST', 'RECEPTIONIST', 'HOUSEKEEPING', 'ADMIN'] as const;
  for (const [i, role] of roles.entries()) it(`${16 + i} RBAC ${role} allows only the declared role`, async () => {
    const roleEmail = `rbac-${role.toLowerCase()}-${suffix}@auth-test.invalid`; emails.add(roleEmail);
    const hash = await context.app.get(PasswordService).hash(password);
    await context.prisma.client.user.create({ data: { email: roleEmail, fullName: `Test ${role}`, passwordHash: hash, role } });
    const login = await api().post('/api/auth/login').send({ email: roleEmail, password }).expect(200);
    for (const target of roles) await api().get(`/api/_test/roles/${target.toLowerCase()}`).auth(login.body.accessToken, { type: 'bearer' }).expect(target === role ? 200 : 403);
  });

  it('role changes take effect for an existing token, using current database role', async () => {
    await context.prisma.client.user.update({ where: { id: otherId }, data: { role: 'HOUSEKEEPING' } });
    await api().get('/api/_test/roles/guest').auth(otherToken, { type: 'bearer' }).expect(403);
    await api().get('/api/_test/roles/housekeeping').auth(otherToken, { type: 'bearer' }).expect(200);
  });

  it('rejects token for a deleted user', async () => {
    await context.prisma.client.user.delete({ where: { id: otherId } });
    await api().get('/api/auth/me').auth(otherToken, { type: 'bearer' }).expect(401);
  });

  it('does not implement fake logout and protects the booking list', async () => {
    await api().post('/api/auth/logout').expect(404);
    await api().get('/api/bookings').expect(401);
  });
});

describe('20 Login rate limiting is enforced before password verification', () => {
  let context: Awaited<ReturnType<typeof createAuthTestApp>>;
  beforeAll(async () => { context = await createAuthTestApp(5); });
  afterAll(async () => { if (context) await context.app.close(); });

  it('allows 5 attempts per IP/window then responds 429 with Retry-After', async () => {
    for (let i = 0; i < 5; i++) await request(context.app.getHttpServer()).post('/api/auth/login').send({ email: 'nonexistent@auth-test.invalid', password: randomBytes(24).toString('base64url') }).expect(401);
    const blocked = await request(context.app.getHttpServer()).post('/api/auth/login').set('X-Forwarded-For', '203.0.113.99').send({ email: 'different@auth-test.invalid', password: 'placeholder' }).expect(429);
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
    expect(blocked.text).not.toMatch(/passwordHash|password_hash|postgresql|JWT_SECRET/);
    await request(context.app.getHttpServer()).get('/api/health').expect(200);
  });
});
