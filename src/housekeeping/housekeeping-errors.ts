import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { postgresCode } from '../common/database/postgres-code.js';

export function throwHousekeepingError(error: unknown): never {
  const code = postgresCode(error);
  const prismaCode = typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
  if (code === '23505' || prismaCode === 'P2002') throw new ConflictException('Room already has an open housekeeping task');
  if (code === '23514') throw new ConflictException('Task state, assignee or room conditions do not allow this action');
  if (code === '23503' || prismaCode === 'P2003') throw new BadRequestException('Referenced room or staff is not available');
  if (code === '40P01' || code === '40001' || prismaCode === 'P2034') throw new ConflictException('Concurrent change; retry the request');
  if (prismaCode === 'P2025') throw new NotFoundException('Housekeeping task not found');
  throw error;
}
