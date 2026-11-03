import { describe, expect, it, jest } from '@jest/globals';
import { BadRequestException, ConflictException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PayosService } from '../../src/billing/payos.service.js';
import type { PrismaService } from '../../src/database/prisma.service.js';
import type { BillingService } from '../../src/billing/billing.service.js';
import type { PublicUser } from '../../src/users/public-user.js';
import { Prisma } from '../../generated/prisma/client.js';

function fixture() {
  const attempt = { id: 'payment', invoiceId: 'invoice', status: 'PENDING', payosOrderCode: 123n, amount: new Prisma.Decimal(10000), checkoutUrl: 'https://pay.payos.vn/web/test' };
  const updateMany = jest.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue({ count: 1 });
  const tx = { $queryRaw: jest.fn<() => Promise<unknown>>().mockResolvedValue([]), invoice: { findUniqueOrThrow: jest.fn<() => Promise<unknown>>().mockResolvedValue({ bookingId: 'booking' }) }, payment: { updateMany } };
  const db = { bookingPayment: { findUnique: jest.fn<() => Promise<unknown>>().mockResolvedValue(null) }, payment: {
    findMany: jest.fn<() => Promise<unknown>>().mockResolvedValue([attempt]),
    findUnique: jest.fn<() => Promise<unknown>>().mockResolvedValue(attempt), updateMany,
  }, $transaction: jest.fn<(callback: (value: typeof tx) => Promise<unknown>) => Promise<unknown>>().mockImplementation(fn => fn(tx)) };
  const billing = { getInvoice: jest.fn<() => Promise<unknown>>().mockResolvedValue({}) };
  const service = new PayosService({ client: db } as unknown as PrismaService, billing as unknown as BillingService, new ConfigService());
  const get = jest.fn<() => Promise<unknown>>().mockResolvedValue({ orderCode: 123, amount: 10000, amountPaid: 10000, amountRemaining: 0, status: 'PAID' });
  const verify = jest.fn<() => Promise<unknown>>().mockResolvedValue({ orderCode: 123, code: '00' });
  Object.defineProperty(service, 'client', { value: () => ({ paymentRequests: { get }, webhooks: { verify } }) });
  return { service, db, billing, updateMany, get, verify };
}

describe('payOS verification', () => {
  it('checks ownership before calling the gateway', async () => {
    const f = fixture(); f.billing.getInvoice.mockRejectedValue(new NotFoundException());
    await expect(f.service.sync('invoice', {} as PublicUser)).rejects.toBeInstanceOf(NotFoundException);
    expect(f.get).not.toHaveBeenCalled(); expect(f.updateMany).not.toHaveBeenCalled();
  });
  it('uses a conditional pending update so retries cannot create extra receipts', async () => {
    const f = fixture(); await f.service.sync('invoice'); await f.service.sync('invoice');
    expect(f.updateMany).toHaveBeenCalledWith({ where: { id: 'payment', status: 'PENDING' }, data: { status: 'COMPLETED' } });
    expect(f.db.$transaction).toHaveBeenCalledTimes(2);
  });
  it.each([
    { orderCode: 999, amount: 10000, amountPaid: 10000, amountRemaining: 0, status: 'PAID' },
    { orderCode: 123, amount: 9000, amountPaid: 9000, amountRemaining: 0, status: 'PAID' },
    { orderCode: 123, amount: 10000, amountPaid: 9000, amountRemaining: 1000, status: 'PAID' },
  ])('rejects mismatched or insufficient payments', async remote => {
    const f = fixture(); f.get.mockResolvedValue(remote);
    await expect(f.service.sync('invoice')).rejects.toBeInstanceOf(ConflictException);
    expect(f.updateMany).not.toHaveBeenCalled();
  });
  it('keeps an underpaid attempt pending', async () => {
    const f = fixture(); f.get.mockResolvedValue({ orderCode: 123, amount: 10000, amountPaid: 5000, amountRemaining: 5000, status: 'UNDERPAID' });
    await f.service.sync('invoice'); expect(f.updateMany).not.toHaveBeenCalled();
  });
  it('releases a cancelled attempt only if no funds were received', async () => {
    const f = fixture(); f.get.mockResolvedValue({ orderCode: 123, amount: 10000, amountPaid: 0, status: 'CANCELLED' });
    await f.service.sync('invoice');
    expect(f.updateMany).toHaveBeenCalledWith({ where: { id: 'payment', status: 'PENDING' }, data: { status: 'FAILED' } });
  });
  it('does not mark anything paid when payOS is unreachable', async () => {
    const f = fixture(); f.get.mockRejectedValue(new Error('offline'));
    await expect(f.service.sync('invoice')).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(f.updateMany).not.toHaveBeenCalled();
  });
  it('rejects forged webhooks before looking up payments', async () => {
    const f = fixture(); f.verify.mockRejectedValue(new Error('bad signature'));
    await expect(f.service.webhook({})).rejects.toBeInstanceOf(BadRequestException);
    expect(f.db.payment.findUnique).not.toHaveBeenCalled();
  });
  it('acknowledges signed registration probes for unknown orders', async () => {
    const f = fixture(); f.db.payment.findUnique.mockResolvedValue(null);
    await expect(f.service.webhook({})).resolves.toEqual({ success: true });
    expect(f.get).not.toHaveBeenCalled();
  });
});
