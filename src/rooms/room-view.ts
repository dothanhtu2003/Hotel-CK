import type { Prisma } from '../../generated/prisma/client.js';

export const roomSelect = {
  id: true, roomNumber: true, floor: true, operationalStatus: true, housekeepingStatus: true,
  roomType: { select: { id: true, name: true, description: true, nightlyPrice: true, maxGuests: true } },
} satisfies Prisma.RoomSelect;
export type RoomRecord = Prisma.RoomGetPayload<{ select: typeof roomSelect }>;
export function roomView(room: RoomRecord) {
  return { ...room, roomType: { ...room.roomType, nightlyPrice: room.roomType.nightlyPrice.toFixed(2) } };
}
