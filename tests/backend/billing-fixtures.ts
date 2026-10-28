import type { Prisma, Invoice } from '../../generated/prisma/client.js';

// Existing Phase 4-6 DB fixtures adapted to the new paid-checkout contract.
// New end-to-end billing tests use real HTTP payment endpoints instead of these helpers.
export async function settleInvoiceFixture(tx: Prisma.TransactionClient, invoice: Invoice) {
  if (invoice.totalAmount.gt(0)) await tx.payment.create({ data: { invoiceId: invoice.id, amount: invoice.totalAmount, method: 'CASH', status: 'COMPLETED' } });
}
export async function checkoutFixture(tx: Prisma.TransactionClient, bookingId: string) {
  const invoice = await tx.invoice.create({ data: { bookingId } });
  await settleInvoiceFixture(tx, invoice);
  await tx.booking.update({ where: { id: bookingId }, data: { status: 'CHECKED_OUT' } });
  return tx.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
}
