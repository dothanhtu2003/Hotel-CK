import type { Prisma } from '../../generated/prisma/client.js';

export const serviceSelect = { id: true, name: true, description: true, currentPrice: true, isActive: true } satisfies Prisma.ServiceSelect;
export type ServiceRecord = Prisma.ServiceGetPayload<{ select: typeof serviceSelect }>;
export function serviceView(service: ServiceRecord) {
  return { ...service, currentPrice: service.currentPrice.toFixed(2) };
}
