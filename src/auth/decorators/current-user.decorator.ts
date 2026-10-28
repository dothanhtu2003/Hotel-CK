import { createParamDecorator, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { PublicUser } from '../../users/public-user.js';

export type AuthRequest = Request & { user?: PublicUser };
export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): PublicUser => {
  const user = context.switchToHttp().getRequest<AuthRequest>().user;
  if (!user) throw new UnauthorizedException('Authentication required');
  return user;
});
