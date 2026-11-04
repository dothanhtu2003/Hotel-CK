import type { Prisma } from '../../generated/prisma/client.js';

export const bookingSelect = {
  onlinePaymentRequired: true, holdExpiresAt:true, holdState:true,
  currentRoomSince: true, id: true, reference: true, userId: true, roomId: true, checkInDate: true, checkOutDate: true,
  guestCount: true, status: true, checkoutRequestedAt: true, nightlyPrice: true, totalRoomAmount: true, createdAt: true, updatedAt: true,
  room: { select: { roomNumber: true } },
} satisfies Prisma.BookingSelect;
export type BookingRecord = Prisma.BookingGetPayload<{ select: typeof bookingSelect }>;
export function bookingView(booking: BookingRecord) {
  const { checkInDate, checkOutDate, currentRoomSince, room, ...rest } = booking;
  return { ...rest, serverNow:new Date(), roomNumber: room.roomNumber, currentRoomSince: currentRoomSince?.toISOString().slice(0,10) ?? null, checkIn: checkInDate.toISOString().slice(0, 10), checkOut: checkOutDate.toISOString().slice(0, 10),
    nights: (checkOutDate.getTime() - checkInDate.getTime()) / 86400000,
    nightlyPrice: booking.nightlyPrice.toFixed(2), totalRoomAmount: booking.totalRoomAmount.toFixed(2),
  };
}
