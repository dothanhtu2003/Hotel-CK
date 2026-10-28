import { ForbiddenException } from '@nestjs/common';
import type { Role } from '../../../generated/prisma/enums.js';
import type { PublicUser } from '../../users/public-user.js';

// ownerUserId must come from a DB record/query scope, never a caller-supplied owner field.
// Future business handlers must also scope writes by ownership within their transaction.
export function assertOwnership(actor: Pick<PublicUser, 'id' | 'role'>, ownerUserId: string, allowedStaffRoles: readonly Role[] = []) {
  if (actor.role === 'GUEST' ? actor.id === ownerUserId : allowedStaffRoles.includes(actor.role)) return;
  throw new ForbiddenException('Insufficient permissions');
}
