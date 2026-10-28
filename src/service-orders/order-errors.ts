import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { postgresCode } from '../common/database/postgres-code.js';

export function throwOrderError(error: unknown): never {
  const code = postgresCode(error);
  const prismaCode = typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
  if (code === '23514') throw new ConflictException('Order state, service availability or stay conditions do not allow this action');
  if (code === '23505' || prismaCode === 'P2002') throw new ConflictException('Order conflicts with an existing record');
  if (code === '23503' || prismaCode === 'P2003') throw new BadRequestException('Referenced booking or service is not available');
  if (code === '22003') throw new BadRequestException('Requested quantity or amount exceeds supported database limits');
  if (code === '40P01' || code === '40001' || prismaCode === 'P2034') throw new ConflictException('Concurrent change; retry the request');
  if (prismaCode === 'P2025') throw new NotFoundException('Service order not found');
  throw error;
}
