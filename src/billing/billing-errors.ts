import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { postgresCode } from '../common/database/postgres-code.js';

export function throwBillingError(error: unknown): never {
  const code = postgresCode(error);
  const prismaCode = typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
  if (code === '23514') throw new ConflictException('Invoice, payment, service orders or checkout conditions do not allow this action');
  if (code === '23505' || prismaCode === 'P2002') throw new ConflictException('Invoice or payment request conflicts with an existing record');
  if (code === '23503' || prismaCode === 'P2003') throw new BadRequestException('Referenced booking or invoice is not available');
  if (code === '22003') throw new BadRequestException('Amount exceeds supported database limits');
  if (code === '40P01' || code === '40001' || prismaCode === 'P2034') throw new ConflictException('Concurrent change; refresh before retrying');
  if (prismaCode === 'P2025') throw new NotFoundException('Billing resource not found');
  throw error;
}
