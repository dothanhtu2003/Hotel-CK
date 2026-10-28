import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Role } from '../../generated/prisma/enums.js';
import { Roles } from '../../src/auth/decorators/roles.decorator.js';
import { RolesGuard } from '../../src/auth/guards/roles.guard.js';
import { AuthRateLimitGuard } from '../../src/auth/guards/auth-rate-limit.guard.js';

class FixtureController {
  @Roles(Role.GUEST) guest() {}
  @Roles(Role.RECEPTIONIST) receptionist() {}
  @Roles(Role.HOUSEKEEPING) housekeeping() {}
  @Roles(Role.ADMIN) admin() {}
  unrestricted() {}
}
function context(handler: keyof FixtureController, role?: Role) {
  const headers = new Map();
  return {
    headers,
    execution: {
      getHandler: () => FixtureController.prototype[handler], getClass: () => FixtureController,
      switchToHttp: () => ({ getRequest: () => ({ ip: '127.0.0.1', user: role ? { role } : undefined }), getResponse: () => ({ setHeader: (name: string, value: unknown) => headers.set(name, value) }) }),
    } as unknown as ExecutionContext,
  };
}
describe('RolesGuard', () => {
  const guard = new RolesGuard(new Reflector());
  const cases = [['guest', Role.GUEST], ['receptionist', Role.RECEPTIONIST], ['housekeeping', Role.HOUSEKEEPING], ['admin', Role.ADMIN]] as const;
  it.each(cases)('%s accepts its declared role and denies others', (handler, role) => {
    for (const candidate of Object.values(Role)) {
      if (candidate === role) expect(guard.canActivate(context(handler, candidate).execution)).toBe(true);
      else expect(() => guard.canActivate(context(handler, candidate).execution)).toThrow(ForbiddenException);
    }
  });
  it('fails closed when a role route has no authenticated user', () => {
    expect(() => guard.canActivate(context('admin').execution)).toThrow(ForbiddenException);
    expect(guard.canActivate(context('unrestricted').execution)).toBe(true);
  });
});
describe('Authentication rate limiter window', () => {
  afterEach(() => { jest.restoreAllMocks(); });
  it('blocks excess attempts and resets after the window', () => {
    const clock = jest.spyOn(Date, 'now').mockReturnValue(1000);
    const guard = new AuthRateLimitGuard(new ConfigService({ AUTH_RATE_LIMIT: 2, AUTH_RATE_TTL_MS: 1000 }));
    const c = context('guest');
    expect(guard.canActivate(c.execution)).toBe(true); expect(guard.canActivate(c.execution)).toBe(true);
    expect(() => guard.canActivate(c.execution)).toThrow('Too many authentication attempts');
    expect(c.headers.get('Retry-After')).toBe(1);
    clock.mockReturnValue(2001); expect(guard.canActivate(c.execution)).toBe(true);
  });
});
