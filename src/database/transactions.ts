// Minimal transaction examples for later NestJS integration. Call only after JWT/RBAC checks.
import type { PrismaClient } from '../../generated/prisma/client.js';

export async function placeServiceOrder(db: PrismaClient, bookingId: string, items: { serviceId: string; quantity: number }[]) {
  if (items.length === 0) throw new Error('Order requires at least one item');
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM hotel.bookings WHERE id=${bookingId}::uuid FOR UPDATE`;
    const order = await tx.serviceOrder.create({ data: { bookingId } });
    for (const item of items) await tx.serviceOrderItem.create({ data: { serviceOrderId: order.id, ...item } });
    return tx.serviceOrder.findUniqueOrThrow({ where: { id: order.id }, include: { items: true } });
  });
}

export async function checkout(db: PrismaClient, bookingId: string) {
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM hotel.bookings WHERE id=${bookingId}::uuid FOR UPDATE`;
    const booking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
    if (booking.status === 'CHECKED_OUT') return tx.invoice.findUniqueOrThrow({ where: { bookingId } });
    const invoice = await tx.invoice.findUniqueOrThrow({ where: { bookingId } });
    if (invoice.status !== 'PAID') throw new Error('Checkout requires a fully paid invoice');
    await tx.booking.update({ where: { id: bookingId }, data: { status: 'CHECKED_OUT' } });
    return invoice;
  });
}
