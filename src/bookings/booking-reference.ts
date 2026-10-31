import type { Prisma } from '../../generated/prisma/client.js';
import { hotelDay } from '../common/validation/stay-dates.js';

// All application booking creation paths share this transaction-scoped daily lock.
export async function nextBookingReference(tx: Prisma.TransactionClient) {
  const day = hotelDay().slice(2).replaceAll('-', '');
  const prefix = `CK-${day}-`;
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(73142, ${Number(day)}::integer)::text`;
  const rows = await tx.$queryRaw<{ next: number }[]>`
    SELECT (COALESCE(MAX(substring(reference from 11)::integer), 0) + 1)::integer AS next
    FROM hotel.bookings WHERE reference ~ ${'^' + prefix + '[0-9]{4,}$'}
  `;
  return prefix + String(rows[0].next).padStart(4, '0');
}
