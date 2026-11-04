import { describe, expect, it, jest } from '@jest/globals';
import { ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PayosService } from '../../src/billing/payos.service.js';
import { Prisma } from '../../generated/prisma/client.js';
import type { PrismaService } from '../../src/database/prisma.service.js';
import type { BillingService } from '../../src/billing/billing.service.js';
import type { PublicUser } from '../../src/users/public-user.js';

const actor = { id: 'staff', role: 'RECEPTIONIST' } as PublicUser;
function fixture(pending = true) {
  const order = { orderedAt: new Date(), requestedPaymentMethod: null as string | null, id: 'order', bookingId: 'booking', status: 'COMPLETED', totalAmount: new Prisma.Decimal(9000), paymentMethod: null as string | null,
    payosOrderCode: pending ? 123n : null as bigint | null, payosStatus: pending ? 'PENDING' : null as string | null,
    payosCheckoutUrl: null as string | null, payosQrCode: null as string | null, payosCreatedBy: pending ? actor.id : null as string | null };
  const update = jest.fn<(args: { data: Partial<typeof order> }) => Promise<unknown>>().mockImplementation(async ({ data }) => { Object.assign(order, data); return { ...order }; });
  const orders = { findUnique: jest.fn<() => Promise<unknown>>().mockImplementation(async () => ({ ...order })), findUniqueOrThrow: jest.fn<() => Promise<unknown>>().mockImplementation(async () => ({ ...order })), update };
  const tx = { $queryRaw: jest.fn<() => Promise<unknown>>().mockResolvedValue([]), serviceOrder: orders, booking: { findUniqueOrThrow: jest.fn<() => Promise<unknown>>().mockResolvedValue({ status: 'CHECKED_IN', invoice: null }) } };
  const db = { serviceOrder: orders, $transaction: jest.fn<(fn: (value: typeof tx) => Promise<unknown>) => Promise<unknown>>().mockImplementation(fn => fn(tx)) };
  const service = new PayosService({ client: db } as unknown as PrismaService, {} as BillingService, new ConfigService({ PAYOS_RETURN_ORIGIN: 'http://localhost:5173' }));
  const get = jest.fn<() => Promise<unknown>>().mockResolvedValue({ orderCode: 123, amount: 9000, amountPaid: 9000, amountRemaining: 0, status: 'PAID' });
  const cancel = jest.fn<() => Promise<unknown>>().mockResolvedValue({});
  const create = jest.fn<(input: { orderCode: number; amount: number }) => Promise<unknown>>().mockImplementation(async input => ({ ...input, currency: 'VND', checkoutUrl: 'https://pay.payos.vn/web/test', qrCode: 'bank-qr-payload' }));
  Object.defineProperty(service, 'client', { value: () => ({ paymentRequests: { get, create, cancel } }) });
  return { service, order, update, get, create, cancel, tx };
}

describe('service payOS payments', () => {
  it('records a verified payment once as a separate bank receipt', async () => {
    const f = fixture();
    await expect(f.service.syncServiceOrder('order', actor)).resolves.toEqual({ paid: true, closed: false });
    await f.service.syncServiceOrder('order', actor);
    expect(f.update).toHaveBeenCalledTimes(1);
    expect(f.order.paymentMethod).toBe('BANK_TRANSFER');
    expect(f.order.payosStatus).toBe('PAID');
    expect(f.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ receivedBy: actor.id, status: 'COMPLETED' }) }));
  });
  it.each([
    { orderCode: 124, amount: 9000, amountPaid: 9000, amountRemaining: 0, status: 'PAID' },
    { orderCode: 123, amount: 9000, amountPaid: 8000, amountRemaining: 1000, status: 'PAID' },
  ])('rejects mismatched or underfunded confirmations', async remote => {
    const f = fixture(); f.get.mockResolvedValue(remote);
    await expect(f.service.syncServiceOrder('order', actor)).rejects.toBeInstanceOf(ConflictException);
    expect(f.update).not.toHaveBeenCalled();
  });
  it('keeps partial funds locked even if the remote link is cancelled', async () => {
    const f = fixture(); f.get.mockResolvedValue({ orderCode: 123, amount: 9000, amountPaid: 1000, amountRemaining: 8000, status: 'CANCELLED' });
    expect(await f.service.syncServiceOrder('order', actor)).toEqual({ paid: false, closed: false });
    expect(f.update).not.toHaveBeenCalled();
  });
  it('allows another collection method after cancellation with zero received', async () => {
    const f = fixture(); f.get.mockResolvedValue({ orderCode: 123, amount: 9000, amountPaid: 0, amountRemaining: 9000, status: 'CANCELLED' });
    expect(await f.service.syncServiceOrder('order', actor)).toEqual({ paid: false, closed: true });
    expect(f.order.payosStatus).toBe('CLOSED');
  });
  it('persists and reuses the order code and actual payOS bank QR', async () => {
    const f = fixture(false);
    const result = await f.service.startServiceOrder('order', actor);
    expect(result).toEqual({ paid: false, checkoutUrl: 'https://pay.payos.vn/web/test', qrCode: 'bank-qr-payload' });
    const code = f.order.payosOrderCode;
    f.get.mockResolvedValue({ orderCode: Number(code), amount: 9000, amountPaid: 0, amountRemaining: 9000, status: 'PENDING' });
    await f.service.startServiceOrder('order', actor);
    expect(f.create).toHaveBeenCalledTimes(1);
    expect(f.create).toHaveBeenCalledWith(expect.objectContaining({ orderCode: Number(code), amount: 9000 }));
  });
  it('renews a closed unpaid link and replaces its cached QR', async () => {
    const f = fixture(); f.order.payosStatus = 'CLOSED';
    f.order.payosCheckoutUrl = 'https://pay.payos.vn/web/old';
    f.get.mockResolvedValue({ orderCode: 123, amount: 9000, amountPaid: 0, amountRemaining: 9000, status: 'CANCELLED' });
    const result = await f.service.startServiceOrder('order', actor);
    expect(result.qrCode).toBe('bank-qr-payload');
    expect(f.order.payosOrderCode).not.toBe(123n);
    expect(f.order.payosStatus).toBe('PENDING');
    expect(f.create).toHaveBeenCalledTimes(1);
  });
  it('refuses renewal if the old closed link reports received funds', async () => {
    const f = fixture(); f.order.payosStatus = 'CLOSED';
    f.get.mockResolvedValue({ orderCode: 123, amount: 9000, amountPaid: 1000, amountRemaining: 8000, status: 'CANCELLED' });
    await expect(f.service.startServiceOrder('order', actor)).rejects.toBeInstanceOf(ConflictException);
    expect(f.create).not.toHaveBeenCalled();
  });
  it('does not create links for an invoiced stay', async () => {
    const f = fixture(false); f.tx.booking.findUniqueOrThrow.mockResolvedValue({ status: 'CHECKED_IN', invoice: { id: 'invoice' } });
    await expect(f.service.startServiceOrder('order', actor)).rejects.toBeInstanceOf(ConflictException);
    expect(f.create).not.toHaveBeenCalled();
  });
});

it('expires an unpaid guest transfer only after remote cancellation is confirmed', async () => {
  const f = fixture(); f.order.status = 'PENDING'; f.order.requestedPaymentMethod = 'BANK_TRANSFER'; f.order.orderedAt = new Date(Date.now() - 16 * 60_000);
  f.get.mockResolvedValueOnce({ orderCode: 123, amount: 9000, amountPaid: 0, amountRemaining: 9000, status: 'PENDING' }).mockResolvedValueOnce({ orderCode: 123, amount: 9000, amountPaid: 0, amountRemaining: 9000, status: 'CANCELLED' });
  expect(await f.service.syncServiceOrder('order', actor)).toEqual({ paid: false, closed: true, expired: true });
  expect(f.cancel).toHaveBeenCalledTimes(1);
  expect(f.order.status).toBe('CANCELLED');
  expect(f.order.payosQrCode).toBeNull();
});
it('preserves a successful transfer even when the 15-minute deadline has passed', async () => {
  const f = fixture(); f.order.status = 'PENDING'; f.order.requestedPaymentMethod = 'BANK_TRANSFER'; f.order.orderedAt = new Date(Date.now() - 16 * 60_000);
  expect(await f.service.syncServiceOrder('order', actor)).toEqual({ paid: true, closed: false });
  expect(f.order.status).toBe('COMPLETED');
  expect(f.cancel).not.toHaveBeenCalled();
});
