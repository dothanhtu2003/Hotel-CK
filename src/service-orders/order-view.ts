import type { Prisma } from '../../generated/prisma/client.js';

export const orderSelect = {
  id: true, bookingId: true, status: true, totalAmount: true, orderedAt: true,
  items: { orderBy: { id: 'asc' }, select: {
    id: true, serviceId: true, quantity: true, unitPrice: true, subtotal: true,
    service: { select: { name: true } },
  } },
} satisfies Prisma.ServiceOrderSelect;
export type OrderRecord = Prisma.ServiceOrderGetPayload<{ select: typeof orderSelect }>;
export function orderView(order: OrderRecord) {
  return { ...order, totalAmount: order.totalAmount.toFixed(2),
    items: order.items.map(({ service, ...item }) => ({ ...item, serviceName: service.name, unitPrice: item.unitPrice.toFixed(2), subtotal: item.subtotal.toFixed(2) })),
  };
}
