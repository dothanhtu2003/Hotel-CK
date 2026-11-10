import { describe, expect, it, jest } from '@jest/globals';
import { BadRequestException, ConflictException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PayosService } from '../../src/billing/payos.service.js';
import type { PrismaService } from '../../src/database/prisma.service.js';
import type { BillingService } from '../../src/billing/billing.service.js';
import type { PublicUser } from '../../src/users/public-user.js';
import { Prisma } from '../../generated/prisma/client.js';
import { hotelDay } from '../../src/common/validation/stay-dates.js';

function fixture() {
  const attempt = { id: 'payment', invoiceId: 'invoice', status: 'PENDING', payosOrderCode: 123n, amount: new Prisma.Decimal(10000), checkoutUrl: 'https://pay.payos.vn/web/test' };
  const updateMany = jest.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue({ count: 1 });
  const tx = { $queryRaw: jest.fn<() => Promise<unknown>>().mockResolvedValue([]), invoice: { findUniqueOrThrow: jest.fn<() => Promise<unknown>>().mockResolvedValue({ bookingId: 'booking' }) }, payment: { updateMany, findUniqueOrThrow: jest.fn<() => Promise<unknown>>().mockResolvedValue({ checkoutOnPaid: false }) },
    booking: { updateMany: jest.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue({ count: 1 }) },
    serviceOrder: { count: jest.fn<() => Promise<number>>().mockResolvedValue(0) },
  };
  const db = { serviceOrder: { findUnique: jest.fn<() => Promise<unknown>>().mockResolvedValue(null) }, bookingPayment: { findUnique: jest.fn<() => Promise<unknown>>().mockResolvedValue(null) }, payment: {
    findMany: jest.fn<() => Promise<unknown>>().mockResolvedValue([attempt]),
    count: jest.fn<() => Promise<number>>().mockResolvedValue(1),
    findUnique: jest.fn<() => Promise<unknown>>().mockResolvedValue(attempt), updateMany,
  }, $transaction: jest.fn<(callback: (value: typeof tx) => Promise<unknown>) => Promise<unknown>>().mockImplementation(fn => fn(tx)) };
  const billing = { getInvoice: jest.fn<() => Promise<unknown>>().mockResolvedValue({}) };
  const service = new PayosService({ client: db } as unknown as PrismaService, billing as unknown as BillingService, new ConfigService());
  const get = jest.fn<() => Promise<unknown>>().mockResolvedValue({ orderCode: 123, amount: 10000, amountPaid: 10000, amountRemaining: 0, status: 'PAID' });
  const verify = jest.fn<() => Promise<unknown>>().mockResolvedValue({ orderCode: 123, code: '00' });
  const cancel = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
  Object.defineProperty(service, 'client', { value: () => ({ paymentRequests: { get, cancel }, webhooks: { verify } }) });
  return { service, db, tx, billing, updateMany, get, cancel, verify };
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
  it('checks out a fully paid counter QR invoice through the webhook', async () => {
    const f = fixture();
    const amount = new Prisma.Decimal(10000);
    f.tx.payment.findUniqueOrThrow.mockResolvedValue({ checkoutOnPaid: true });
    f.tx.invoice.findUniqueOrThrow.mockResolvedValueOnce({ bookingId: 'booking' }).mockResolvedValueOnce({
      status: 'PAID', bookingId: 'booking', totalAmount: amount, roomAmount: amount, serviceAmount: new Prisma.Decimal(0),
      payments: [{ amount, status: 'COMPLETED' }],
      booking: { room: {}, checkInDate: new Date(), checkOutDate: new Date(), nightlyPrice: amount, totalRoomAmount: amount },
    });
    await f.service.webhook({});
    expect(f.tx.booking.updateMany).toHaveBeenCalledWith({ where: { id: 'booking', status: 'CHECKED_IN', checkOutDate: { gte: new Date(hotelDay() + 'T00:00:00Z') } }, data: { status: 'CHECKED_OUT' } });
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
  it('closes an unpaid QR before allowing a different payment method', async () => {
    const f = fixture();
    const remote = { orderCode: 123, amount: 10000, amountPaid: 0 };
    f.get.mockResolvedValueOnce({ ...remote, status: 'PENDING' }).mockResolvedValueOnce({ ...remote, status: 'CANCELLED' });
    f.db.payment.count.mockResolvedValue(0);
    await expect(f.service.cancelInvoicePayment('invoice', {} as PublicUser)).resolves.toEqual({ pending: false });
    expect(f.cancel).toHaveBeenCalledTimes(1);
    expect(f.updateMany).toHaveBeenCalledWith({ where: { id: 'payment', status: 'PENDING' }, data: { status: 'FAILED' } });
  });
  it('keeps the payment pending when money has already arrived', async () => {
    const f = fixture();
    f.get.mockResolvedValue({ orderCode: 123, amount: 10000, amountPaid: 5000, status: 'UNDERPAID' });
    await expect(f.service.cancelInvoicePayment('invoice', {} as PublicUser)).resolves.toEqual({ pending: true });
    expect(f.cancel).not.toHaveBeenCalled();
    expect(f.updateMany).not.toHaveBeenCalled();
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
