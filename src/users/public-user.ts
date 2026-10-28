import type { Prisma } from '../../generated/prisma/client.js';

// An allowlist at the query boundary: passwordHash never enters profile responses.
export const publicUserSelect = {
  id: true, fullName: true, email: true, phone: true, role: true, status: true,
  createdAt: true, updatedAt: true,
} satisfies Prisma.UserSelect;

export type PublicUser = Prisma.UserGetPayload<{ select: typeof publicUserSelect }>;
