import { describe, expect, it, jest } from '@jest/globals';
import { Prisma } from '../../generated/prisma/client.js';
import { FrontDeskService } from '../../src/front-desk/front-desk.service.js';
import { BillingQuery } from '../../src/front-desk/desk.dto.js';
import type { PrismaService } from '../../src/database/prisma.service.js';

const decimal = (v: string) => new Prisma.Decimal(v);
function record(id: string, status = 'CHECKED_IN', invoice: unknown = null) {
  return { id, reference: id, userId: 'guest', roomId: 'room', status,
    checkInDate: new Date('2026-10-28'), checkOutDate: new Date('2026-10-30'),
    nightlyPrice: decimal('100.25'), totalRoomAmount: decimal('200.50'),
    room: { roomNumber: '101' }, user: { fullName: 'Guest' }, invoice,
    serviceOrders: [{ status: 'COMPLETED', totalAmount: decimal('10.25') }, { status: 'PENDING', totalAmount: decimal('90') }],
  };
}
const issued = (paid: string) => ({ id: 'invoice', roomAmount: decimal('200.50'), serviceAmount: decimal('10.25'), totalAmount: decimal('210.75'), payments: [{ amount: decimal(paid) }] });
function setup() {
  const findMany = jest.fn<() => Promise<unknown[]>>().mockResolvedValue([
    record('draft'), record('partial', 'CHECKED_IN', issued('100.10')),
    record('paid', 'CHECKED_OUT', issued('210.75')), record('cancelled', 'CANCELLED'),
    record('refund', 'CANCELLED', issued('100.10')),
  ]);
  const client = { $transaction: async (fn: (tx: unknown) => unknown) => fn({ booking: { findMany } }) };
  return { service: new FrontDeskService({ client } as unknown as PrismaService), findMany };
}
describe('Cashier totals and groups', () => {
  it('preserves exact decimals, excludes pending services, separates cancellations and paid invoices', async () => {
    const { service, findMany } = setup();
    const result = await service.billing(Object.assign(new BillingQuery(), { date: '2026-10-30', group: 'all' }));
    expect(result.counts).toEqual({ departures: 2, outstanding: 2, paid: 1, all: 5 });
    expect(result.data[0]).toMatchObject({ totalAmount: '210.75', paidAmount: '0.00', balance: '210.75', pendingOrderCount: 1 });
    expect(result.data[1]).toMatchObject({ balance: '110.65', paidAmount: '100.10' });
    expect(result.data[3]).toMatchObject({ balance: '0.00', paymentState: 'CANCELLED' });
    expect(result.data[4]).toMatchObject({ paymentState: 'REVIEW_REFUND' });
    expect(JSON.stringify(findMany.mock.calls)).toContain('COMPLETED');
  });
  it('filters before pagination and limits departures to the selected date', async () => {
    const { service } = setup();
    const paged = await service.billing(Object.assign(new BillingQuery(), { date: '2026-10-30', group: 'outstanding', pageSize: 1, page: 2 }));
    expect(paged.data.map(r => r.id)).toEqual(['partial']);
    expect(paged.meta).toMatchObject({ total: 2, totalPages: 2 });
    const nextDay = await service.billing(Object.assign(new BillingQuery(), { date: '2026-10-31' }));
    expect(nextDay.data).toEqual([]);
    expect(nextDay.counts.outstanding).toBe(2);
  });
});
