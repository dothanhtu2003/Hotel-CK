import { beforeAll, describe, expect, it } from '@jest/globals';
import { ForbiddenException } from '@nestjs/common';
import { randomBytes, scryptSync } from 'node:crypto';
import { PasswordService } from '../../src/auth/password.service.js';
import { assertOwnership } from '../../src/auth/policies/ownership.js';
import { RegisterDto } from '../../src/auth/dto/register.dto.js';
import { createValidationPipe } from '../../src/configure-app.js';

describe('Password security', () => {
  const service = new PasswordService();
  const password = `A1-${randomBytes(24).toString('base64url')}`;
  beforeAll(async () => { await service.onModuleInit(); });

  it('Argon2id uses randomized salts and verifies the correct password', async () => {
    const a = await service.hash(password), b = await service.hash(password);
    expect(a).not.toBe(b); expect(a.startsWith('$argon2id$')).toBe(true);
    expect(await service.verify(a, password)).toBe(true);
    expect(await service.verify(a, `${password}-wrong`)).toBe(false);
  });

  it('verifies legacy seed scrypt without rewriting its hash', async () => {
    const salt = randomBytes(16).toString('hex');
    const legacy = `scrypt$${salt}$${scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 }).toString('hex')}`;
    expect(await service.verify(legacy, password)).toBe(true);
    expect(await service.verify(legacy, `${password}-wrong`)).toBe(false);
  });

  it('missing/unsupported/malformed hashes fail safely', async () => {
    expect(await service.verify(undefined, password)).toBe(false);
    expect(await service.verify('unsupported', password)).toBe(false);
    expect(await service.verify('$argon2id$invalid', password)).toBe(false);
  });
});

describe('Ownership policy for future business modules', () => {
  it('GUEST must own the DB record, including when staff roles are allowed', () => {
    expect(() => assertOwnership({ id: 'guest-a', role: 'GUEST' }, 'guest-a')).not.toThrow();
    expect(() => assertOwnership({ id: 'guest-a', role: 'GUEST' }, 'guest-b', ['ADMIN'])).toThrow(ForbiddenException);
  });

  it('staff access is explicit; ADMIN has no implicit ownership bypass', () => {
    expect(() => assertOwnership({ id: 'staff', role: 'ADMIN' }, 'guest-a')).toThrow(ForbiddenException);
    expect(() => assertOwnership({ id: 'staff', role: 'ADMIN' }, 'guest-a', ['ADMIN'])).not.toThrow();
    expect(() => assertOwnership({ id: 'staff', role: 'HOUSEKEEPING' }, 'guest-a', ['RECEPTIONIST'])).toThrow(ForbiddenException);
  });
});

describe('Authentication input validation', () => {
  const pipe = createValidationPipe();
  const metadata = { type: 'body' as const, metatype: RegisterDto };
  const password = `A1-${randomBytes(24).toString('base64url')} `;

  it('normalizes email/name while preserving password bytes', async () => {
    const dto = await pipe.transform({ email: ' USER@EXAMPLE.COM ', fullName: '  Test User  ', password }, metadata) as RegisterDto;
    expect(dto.email).toBe('user@example.com'); expect(dto.fullName).toBe('Test User');
    expect(dto.password).toBe(password);
  });

  it('rejects privilege injection before service invocation', async () => {
    await expect(pipe.transform({ email: 'user@example.com', fullName: 'Test', password, role: 'ADMIN' }, metadata)).rejects.toMatchObject({ status: 400 });
  });
});
