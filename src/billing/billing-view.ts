import { BadRequestException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { bookingSelect, bookingView } from '../bookings/booking-view.js';
import { isUUID } from 'class-validator';

export function billingBookingView(record: Parameters<typeof bookingView>[0]) {
  const { userId, ...view } = bookingView(record);
  void userId;
  return view;
}

export const paymentSelect = { id: true, invoiceId: true, amount: true, method: true, status: true, paidAt: true } satisfies Prisma.PaymentSelect;
export const invoiceSelect = {
  id: true, bookingId: true, roomAmount: true, serviceAmount: true, totalAmount: true, status: true, issuedAt: true,
  booking: { select: bookingSelect }, payments: { select: paymentSelect, orderBy: { id: 'asc' } },
} satisfies Prisma.InvoiceSelect;
export type InvoiceRecord = Prisma.InvoiceGetPayload<{ select: typeof invoiceSelect }>;
export function paymentKey(value: unknown) {
  if (typeof value !== 'string' || !isUUID(value)) throw new BadRequestException('Provide a UUID Idempotency-Key header');
  return value.toLowerCase();
}
export function paymentAmount(value: string) {
  if (typeof value !== 'string' || !/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/.test(value)) throw new BadRequestException('Provide a positive decimal amount with at most two fractional digits');
  const amount = new Prisma.Decimal(value);
  if (amount.lte(0)) throw new BadRequestException('Payment amount must be greater than zero');
  return amount;
}
export function invoiceView(invoice: InvoiceRecord) {
  const paid = invoice.payments.filter(p => p.status === 'COMPLETED').reduce((sum, p) => sum.add(p.amount), new Prisma.Decimal(0));
  const booking = billingBookingView(invoice.booking);
  return { id: invoice.id, bookingId: invoice.bookingId, roomAmount: invoice.roomAmount.toFixed(2), serviceAmount: invoice.serviceAmount.toFixed(2),
    totalAmount: invoice.totalAmount.toFixed(2), status: invoice.status, issuedAt: invoice.issuedAt, paidAmount: paid.toFixed(2),
    balance: invoice.totalAmount.sub(paid).toFixed(2), booking,
    payments: invoice.payments.map(p => ({ ...p, amount: p.amount.toFixed(2) })),
  };
}
