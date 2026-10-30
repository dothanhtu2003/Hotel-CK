import { describe, expect, it, jest } from '@jest/globals';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '../../generated/prisma/client.js';
import type { PrismaService } from '../../src/database/prisma.service.js';
import { ServiceOrdersService } from '../../src/service-orders/service-orders.service.js';
import { throwOrderError } from '../../src/service-orders/order-errors.js';
import { CreateServiceOrderDto } from '../../src/service-orders/dto/create-service-order.dto.js';
import { createValidationPipe } from '../../src/configure-app.js';

describe('Room service nested DTO boundary', () => {
  const pipe = createValidationPipe(); const metadata = { type: 'body' as const, metatype: CreateServiceOrderDto };
  const bookingId = randomUUID(), serviceId = randomUUID();
  it('transforms nested items without coercing JSON quantity strings', async () => {
    const dto = await pipe.transform({ bookingId, items: [{ serviceId, quantity: 2 }] }, metadata) as CreateServiceOrderDto;
    expect(dto.items[0].quantity).toBe(2);
    await expect(pipe.transform({ bookingId, items: [{ serviceId, quantity: '2' }] }, metadata)).rejects.toBeInstanceOf(BadRequestException);
  });
  it('rejects both price injection and case-insensitive duplicate service IDs', async () => {
    await expect(pipe.transform({ bookingId, items: [{ serviceId, quantity: 2, unitPrice: 1 }] }, metadata)).rejects.toBeInstanceOf(BadRequestException);
    await expect(pipe.transform({ bookingId, totalAmount: 1, items: [{ serviceId, quantity: 2 }] }, metadata)).rejects.toBeInstanceOf(BadRequestException);
    await expect(pipe.transform({ bookingId, items: [{ serviceId, quantity: 1 }, { serviceId: serviceId.toUpperCase(), quantity: 1 }] }, metadata)).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('Order SQLSTATE boundary', () => {
  it('maps real Prisma 7 P2039 -> nested 23514 to safe 409', () => {
    const error = { code: 'P2039', meta: { driverAdapterError: { cause: { originalCode: '23514', originalMessage: 'private trigger details' } } } };
    let response: unknown;
    try { throwOrderError(error); } catch (caught) { response = caught; }
    expect(response).toBeInstanceOf(ConflictException);
    expect(JSON.stringify((response as ConflictException).getResponse())).not.toMatch(/private|23514|P2039/);
  });
  it.each(['23505', '40P01', '40001'])('maps conflict SQLSTATE %s', code => { expect(() => throwOrderError({ code })).toThrow(ConflictException); });
  it('handles invalid references/overflow/missing records and preserves controlled HTTP errors', () => {
    expect(() => throwOrderError({ code: '23503' })).toThrow(BadRequestException);
    expect(() => throwOrderError({ code: '22003' })).toThrow(BadRequestException);
    expect(() => throwOrderError({ code: 'P2025' })).toThrow(NotFoundException);
    const error = new ForbiddenException('controlled'); expect(() => throwOrderError(error)).toThrow(error);
  });
});

describe('ServiceOrdersService trusted transaction boundary', () => {
  function fixture(status = 'CHECKED_IN', invoice: { id: string } | null = null) {
    const createOrder = jest.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue({ id: 'order-id' });
    const createItem = jest.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue({ id: 'item-id' });
    const findFirst = jest.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue(null);
    const lock = jest.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue([{ id: 'booking-id' }]);
    const tx = {
      $queryRaw: lock,
      booking: { findUniqueOrThrow: jest.fn().mockImplementation(async () => ({ status, invoice })) },
      service: { findUnique: jest.fn().mockImplementation(async () => ({ isActive: true })) },
      serviceOrder: { update: jest.fn().mockImplementation(async () => ({})), create: createOrder, findUniqueOrThrow: jest.fn().mockImplementation(async () => ({ id: 'order-id', bookingId: 'booking-id', status: 'PENDING', totalAmount: new Prisma.Decimal('123.45'), orderedAt: new Date(), items: [{ id: 'item-id', serviceId: 'service-id', quantity: 3, unitPrice: new Prisma.Decimal('41.15'), subtotal: new Prisma.Decimal('123.45'), service: { name: 'Service' } }] })) },
      serviceOrderItem: { create: createItem },
    };
    const service = new ServiceOrdersService({ client: { $transaction: async (fn: (client: unknown) => Promise<unknown>) => fn(tx), serviceOrder: { findFirst } } } as unknown as PrismaService);
    return { service, lock, createOrder, createItem, findFirst };
  }
  it('sends only bookingId/serviceId/quantity to Prisma, and returns database-calculated totals', async () => {
    const f = fixture();
    const response = await f.service.create({ id: 'jwt-user', role: 'GUEST' }, { bookingId: 'booking-id', items: [{ serviceId: 'service-id', quantity: 3, unitPrice: 1 }], userId: 'forged-owner', totalAmount: 1 } as unknown as CreateServiceOrderDto);
    expect(f.createOrder).toHaveBeenCalledWith({ data: { bookingId: 'booking-id' }, select: { id: true } });
    expect(f.createItem).toHaveBeenCalledWith({ data: { serviceOrderId: 'order-id', serviceId: 'service-id', quantity: 3 }, select: { id: true } });
    expect(f.lock).toHaveBeenCalledWith(expect.objectContaining({ values: ['booking-id', 'jwt-user'] }));
    expect(response.totalAmount).toBe('123.45'); expect(response.items[0].unitPrice).toBe('41.15');
  });
  it.each(['RECEPTIONIST', 'ADMIN'] as const)('allows %s to create orders for a checked-in guest without owner scoping', async role => {
    const f = fixture();
    await f.service.create({ id: 'staff', role }, { bookingId: 'booking-id', items: [{ serviceId: 'service-id', quantity: 1 }] });
    expect(f.lock).toHaveBeenCalledWith(expect.objectContaining({ values: ['booking-id'] }));
    expect(f.createOrder).toHaveBeenCalledTimes(1);
  });
  it('rejects housekeeping creation', async () => {
    const f = fixture();
    await expect(f.service.create({ id: 'staff', role: 'HOUSEKEEPING' }, { bookingId: 'booking-id', items: [{ serviceId: 'service-id', quantity: 1 }] })).rejects.toBeInstanceOf(ForbiddenException);
    expect(f.createOrder).not.toHaveBeenCalled();
  });
  it('denies a checked-in stay with invoice before inserting any order', async () => {
    const f = fixture('CHECKED_IN', { id: 'invoice-id' });
    await expect(f.service.create({ id: 'guest', role: 'GUEST' }, { bookingId: 'booking-id', items: [{ serviceId: 'service-id', quantity: 1 }] })).rejects.toBeInstanceOf(ConflictException);
    expect(f.createOrder).not.toHaveBeenCalled();
  });
  it('denies other owners and invalid stays before order creation', async () => {
    const absent = fixture(); absent.lock.mockResolvedValueOnce([]);
    await expect(absent.service.create({ id: 'guest', role: 'GUEST' }, { bookingId: 'booking-id', items: [{ serviceId: 'service-id', quantity: 1 }] })).rejects.toBeInstanceOf(NotFoundException);
    const pending = fixture('PENDING');
    await expect(pending.service.create({ id: 'guest', role: 'GUEST' }, { bookingId: 'booking-id', items: [{ serviceId: 'service-id', quantity: 1 }] })).rejects.toBeInstanceOf(ConflictException);
    expect(absent.createOrder).not.toHaveBeenCalled(); expect(pending.createOrder).not.toHaveBeenCalled();
  });
  it('SQL-scopes guest reads by booking ownership and rejects housekeeping at the service boundary', async () => {
    const f = fixture();
    await expect(f.service.get('order-id', { id: 'guest-id', role: 'GUEST' })).rejects.toBeInstanceOf(NotFoundException);
    expect(f.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'order-id', booking: { userId: 'guest-id' } } }));
    await expect(f.service.get('order-id', { id: 'staff', role: 'HOUSEKEEPING' })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(f.service.transition('order-id', { id: 'guest', role: 'GUEST' }, 'complete')).rejects.toBeInstanceOf(ForbiddenException);
  });
});
