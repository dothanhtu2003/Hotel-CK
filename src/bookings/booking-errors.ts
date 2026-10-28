import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

import { postgresCode } from '../common/database/postgres-code.js';
export { postgresCode } from '../common/database/postgres-code.js';
export function throwBookingError(error: unknown): never {
  const code = postgresCode(error);
  const prismaCode = typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
  if (code === '23P01') throw new ConflictException('Room is not available for the requested dates');
  if (code === '23514') throw new ConflictException('Booking state, capacity or room conditions do not allow this action');
  if (code === '23505' || prismaCode === 'P2002') throw new ConflictException('Booking conflicts with an existing record');
  if (code === '23503' || prismaCode === 'P2003') throw new BadRequestException('Referenced guest or room is not available');
  if (code === '22003') throw new BadRequestException('Requested values exceed supported database limits');
  if (code === '40P01' || code === '40001' || prismaCode === 'P2034') throw new ConflictException('Concurrent change; retry the request');
  if (prismaCode === 'P2025') throw new NotFoundException('Booking not found');
  throw error;
}
