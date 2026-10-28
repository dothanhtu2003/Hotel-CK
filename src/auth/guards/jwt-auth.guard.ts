import { Injectable, UnauthorizedException, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { isUUID } from 'class-validator';
import { UsersService } from '../../users/users.service.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import type { AuthRequest } from '../decorators/current-user.decorator.js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly jwt: JwtService, private readonly users: UsersService) {}

  async canActivate(context: ExecutionContext) {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()])) return true;
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const match = /^Bearer ([^\s]+)$/i.exec(request.headers.authorization ?? '');
    if (!match) throw new UnauthorizedException('Authentication required');
    let payload: { sub?: unknown; exp?: unknown; iat?: unknown; tokenType?: unknown };
    try {
      payload = await this.jwt.verifyAsync(match[1], { algorithms: ['HS256'], issuer: 'hotel-ck', audience: 'hotel-api' });
      if (typeof payload.sub !== 'string' || !isUUID(payload.sub) || typeof payload.exp !== 'number' || typeof payload.iat !== 'number' || payload.exp <= payload.iat || payload.tokenType !== 'access') throw new Error();
    } catch { throw new UnauthorizedException('Authentication required'); }
    // Trust current database role/status rather than claims that may have become stale.
    request.user = await this.users.findActive(payload.sub as string);
    return true;
  }
}
