import { describe, expect, it, jest } from '@jest/globals';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { AuthService } from '../../src/auth/auth.service.js';
import type { PasswordService } from '../../src/auth/password.service.js';
import type { PrismaService } from '../../src/database/prisma.service.js';

function fixture() {
  const user = { id: randomUUID(), email: 'guest@unit.invalid', fullName: 'Guest', phone: null, role: 'GUEST' as const, status: 'ACTIVE' as const, createdAt: new Date(), updatedAt: new Date(), passwordHash: 'private-hash' };
  const create = jest.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue({ id: user.id });
  const findUnique = jest.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue(user);
  const hash = jest.fn<(password: string) => Promise<string>>().mockResolvedValue('private-hash');
  const verify = jest.fn<(hash: string | undefined, password: string) => Promise<boolean>>().mockResolvedValue(true);
  const signAsync = jest.fn<(...args: unknown[]) => Promise<string>>().mockResolvedValue('test-token');
  const service = new AuthService(
    { client: { user: { create, findUnique } } } as unknown as PrismaService,
    { hash, verify } as unknown as PasswordService,
    { signAsync } as unknown as JwtService,
    new ConfigService({ JWT_ACCESS_TTL_SECONDS: 900 }),
  );
  return { service, user, create, findUnique, hash, verify, signAsync };
}

describe('AuthService boundaries', () => {
  it('registration fixes GUEST/ACTIVE and selects public fields', async () => {
    const f = fixture();
    await f.service.register({ fullName: 'Guest', email: ' GUEST@UNIT.INVALID ', password: 'input-secret' });
    expect(f.create).toHaveBeenCalledWith({ data: expect.objectContaining({ email: 'guest@unit.invalid', role: 'GUEST', status: 'ACTIVE', passwordHash: 'private-hash' }), select: expect.not.objectContaining({ passwordHash: true }) });
    expect(f.hash).toHaveBeenCalledWith('input-secret');
  });
  it('maps UNIQUE race to 409', async () => {
    const f = fixture(); f.create.mockRejectedValueOnce({ code: 'P2002', message: 'private database information' });
    await expect(f.service.register({ fullName: 'Guest', email: 'guest@unit.invalid', password: 'input-secret' })).rejects.toBeInstanceOf(ConflictException);
  });
  it('login signs only subject/token type and omits password hash', async () => {
    const f = fixture(); const response = await f.service.login({ email: ' GUEST@UNIT.INVALID ', password: 'input-secret' });
    expect(f.signAsync).toHaveBeenCalledWith({ sub: f.user.id, tokenType: 'access' });
    expect(response.user).not.toHaveProperty('passwordHash'); expect(response.user).not.toHaveProperty('password_hash');
    expect(response.expiresIn).toBe(900);
  });
  it('wrong password, missing and disabled accounts never receive tokens', async () => {
    for (const state of ['wrong', 'missing', 'disabled']) {
      const f = fixture();
      if (state === 'wrong') f.verify.mockResolvedValueOnce(false);
      if (state === 'missing') f.findUnique.mockResolvedValueOnce(null);
      if (state === 'disabled') f.findUnique.mockResolvedValueOnce({ ...f.user, status: 'DISABLED' });
      await expect(f.service.login({ email: 'guest@unit.invalid', password: 'input-secret' })).rejects.toBeInstanceOf(UnauthorizedException);
      expect(f.signAsync).not.toHaveBeenCalled(); expect(f.verify).toHaveBeenCalledTimes(1);
    }
  });
});
