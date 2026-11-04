import type { Prisma } from '../../generated/prisma/client.js';

// Transfer requests enter reception only once payment has been recorded.
export const visibleServiceOrdersWhere: Prisma.ServiceOrderWhereInput = { OR: [
  { requestedPaymentMethod: null }, { requestedPaymentMethod: 'CASH' }, { paymentMethod: { not: null } },
] };
export const checkoutServiceOrdersWhere: Prisma.ServiceOrderWhereInput = {
  AND: [visibleServiceOrdersWhere],
  OR: [
    { status: 'PENDING' },
    { requestedPaymentMethod: { not: null }, paymentMethod: null, status: { not: 'CANCELLED' } },
  ],
};
