import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Prisma } from '../../generated/prisma/client.js';
import { hotelDay, parseStay } from '../common/validation/stay-dates.js';
import { bookingSelect, bookingView } from './booking-view.js';
import type { ExtensionPreviewDto, ExtendBookingDto } from './dto/extend-booking.dto.js';

const EXTENSION_NIGHTLY_RATE = new Prisma.Decimal(1000);
const days = (a: string, b: string) => Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / 86400000));
const conflict = (message: string) => new ConflictException({ code: 'EXTENSION_CHANGED', message });
export async function previewStayExtension(tx: Prisma.TransactionClient, id: string, dto: ExtensionPreviewDto) {
  const today = hotelDay();
  const { end } = parseStay(dto.expectedCheckOut, dto.checkOut);
  // An overdue guest can settle through today without buying another night.
  if (dto.checkOut < today) throw new BadRequestException({ code: 'EXTENSION_INVALID_DATE', message: 'Ngày trả mới không được trước hôm nay' });
  const booking = await tx.booking.findUnique({ where: { id }, include: { room: true, invoice: { select: { id: true } }, bookingPayments: { where: { status: 'COMPLETED' }, select: { amount: true } } } });
  if (!booking) throw new NotFoundException('Booking not found');
  if (booking.invoice) throw new ConflictException({ code: 'EXTENSION_INVOICED', message: 'Hóa đơn đã chốt, cần hoàn tất kỳ lưu trú hiện tại trước khi lập kỳ mới' });
  if (booking.status !== 'CHECKED_IN') throw conflict('Booking không còn đang lưu trú');
  if (booking.checkOutDate.toISOString().slice(0, 10) !== dto.expectedCheckOut) throw conflict('Ngày trả đã thay đổi. Vui lòng kiểm tra lại');
  const overlap = await tx.booking.findFirst({ where: { id: { not: id }, roomId: booking.roomId, status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN'] }, checkInDate: { lt: end }, checkOutDate: { gt: booking.checkOutDate } }, orderBy: [{ checkInDate: 'asc' }, { id: 'asc' }], select: { reference: true, checkInDate: true, checkOutDate: true } });
  if (dto.checkOut === today && overlap) throw conflict('Lịch ở quá hạn trùng booking khác. Cần xử lý booking trùng trước khi chốt tiền phòng.');
  const todayDate = new Date(today + 'T00:00:00Z');
  const rooms = overlap ? await tx.room.findMany({ where: {
    id: { not: booking.roomId }, operationalStatus: 'ACTIVE', housekeepingStatus: 'CLEAN',
    roomType: { maxGuests: { gte: booking.guestCount } }, tasks: { none: { status: { not: 'DONE' } } },
    bookings: { none: { OR: [ { status: 'CHECKED_IN' }, { status: { in: ['PENDING', 'CONFIRMED'] }, checkInDate: { lt: end }, checkOutDate: { gt: todayDate } } ] } },
  }, include: { roomType: true } }) : [];
  rooms.sort((a, b) => Number(b.roomTypeId === booking.room.roomTypeId) - Number(a.roomTypeId === booking.room.roomTypeId)
    || a.roomType.maxGuests - b.roomType.maxGuests || a.roomNumber.localeCompare(b.roomNumber, 'vi', { numeric: true }));
  const overdueNights = days(dto.expectedCheckOut, today);
  const extensionNights = days(today > dto.expectedCheckOut ? today : dto.expectedCheckOut, dto.checkOut);
  const overdueAmount = EXTENSION_NIGHTLY_RATE.mul(overdueNights);
  const extensionAmount = EXTENSION_NIGHTLY_RATE.mul(extensionNights);
  const extra = overdueAmount.add(extensionAmount);
  const paid = booking.bookingPayments.reduce((sum, p) => sum.add(p.amount), new Prisma.Decimal(0));
  const total = booking.totalRoomAmount.add(extra);
  const roomIds = rooms.map(r => r.id);
  const quoteToken = createHash('sha256').update(JSON.stringify({ id, oldRoom: booking.roomId, oldDate: dto.expectedCheckOut, newDate: dto.checkOut, today, total: total.toFixed(2), paid: paid.toFixed(2), roomIds, updatedAt: booking.updatedAt.toISOString() })).digest('hex');
  return {
    booking, quote: {
      quoteToken, checkOut: dto.checkOut, expectedCheckOut: dto.expectedCheckOut, transferDate: today,
      currentRoomId: booking.roomId, currentRoomNumber: booking.room.roomNumber,
      conflict: overlap ? { reference: overlap.reference, checkIn: overlap.checkInDate.toISOString().slice(0, 10), checkOut: overlap.checkOutDate.toISOString().slice(0, 10) } : null,
      rooms: rooms.map(r => ({ id: r.id, roomNumber: r.roomNumber, roomType: r.roomType.name, sameType: r.roomTypeId === booking.room.roomTypeId, capacity: r.roomType.maxGuests, nightlyPrice: '1000.00' })),
      overdueNights, extensionNights, overdueAmount: overdueAmount.toFixed(2), extensionAmount: extensionAmount.toFixed(2), priceDifference: '0.00',
      additionalAmount: extra.toFixed(2), totalRoomAmount: total.toFixed(2), paidAmount: paid.toFixed(2), balance: Prisma.Decimal.max(0, total.sub(paid)).toFixed(2),
      checkoutTime: '12:00', nightlyPrice: '1000.00',
    },
  };
}

export async function confirmStayExtension(tx: Prisma.TransactionClient, id: string, actorId: string, dto: ExtendBookingDto) {
  await tx.$queryRaw`SELECT id FROM hotel.bookings WHERE id=${id}::uuid FOR UPDATE`;
  const prior = await tx.stayExtension.findUnique({ where: { id: dto.requestId } });
  if (prior) {
    if (prior.bookingId !== id || prior.actorId !== actorId || prior.newCheckOut.toISOString().slice(0,10) !== dto.checkOut || prior.oldCheckOut.toISOString().slice(0,10) !== dto.expectedCheckOut || (dto.targetRoomId && prior.newRoomId !== dto.targetRoomId)) throw conflict('Mã xác nhận đã được sử dụng');
    return bookingView(await tx.booking.findUniqueOrThrow({ where: { id }, select: bookingSelect }));
  }
  const snapshot = await tx.booking.findUniqueOrThrow({ where: { id }, select: { roomId: true } });
  const roomIds = [...new Set([snapshot.roomId, dto.targetRoomId ?? snapshot.roomId])].sort();
  for (const roomId of roomIds) await tx.$queryRaw`SELECT id FROM hotel.rooms WHERE id=${roomId}::uuid FOR UPDATE`;
  const { booking, quote } = await previewStayExtension(tx, id, dto);
  if (quote.quoteToken !== dto.quoteToken) throw conflict('Lịch phòng hoặc chi phí vừa thay đổi. Vui lòng kiểm tra lại');
  const target = dto.targetRoomId ?? booking.roomId;
  if (quote.conflict && !quote.rooms.some(r => r.id === target)) throw conflict('Không còn phòng trống phù hợp');
  if (!quote.conflict && target !== booking.roomId) throw conflict('Phòng hiện tại còn trống, hãy kiểm tra lại phương án gia hạn');
  const transfer = target !== booking.roomId;
  const end = new Date(dto.checkOut + 'T00:00:00Z');
  const today = new Date(quote.transferDate + 'T00:00:00Z');
  const now = new Date();
  const roomSince = transfer ? today : booking.currentRoomSince;
  // Append the financial adjustment before updating the live booking snapshot.
  await tx.stayExtension.create({ data: {
    id: dto.requestId, bookingId: id, actorId, oldRoomId: booking.roomId, newRoomId: target,
    oldCheckOut: booking.checkOutDate, newCheckOut: end, roomSince,
    oldAmount: booking.totalRoomAmount, newAmount: quote.totalRoomAmount,
    overdueAmount: quote.overdueAmount, extensionAmount: quote.extensionAmount, priceDifference: quote.priceDifference, paidBefore: quote.paidAmount,
  } });
  const segment = await tx.staySegment.findFirst({ where: { bookingId: id, endedAt: null } });
  if (!segment) throw conflict('Thiếu bản ghi lưu trú. Vui lòng kiểm tra hồ sơ');
  if (transfer) {
    await tx.staySegment.update({ where: { id: segment.id }, data: { endedAt: now, endDate: today } });
    await tx.staySegment.create({ data: { bookingId: id, roomId: target, startedAt: now, startDate: today, endDate: end } });
  } else {
    await tx.staySegment.update({ where: { id: segment.id }, data: { endDate: end } });
  }
  const updated = await tx.booking.update({ where: { id }, data: { roomId: target, currentRoomSince: roomSince, checkOutDate: end, totalRoomAmount: quote.totalRoomAmount }, select: bookingSelect });
  if (transfer) {
    await tx.room.update({ where: { id: booking.roomId }, data: { housekeepingStatus: 'DIRTY' } });
    if (!await tx.housekeepingTask.findFirst({ where: { roomId: booking.roomId, status: { not: 'DONE' } }, select: { id: true } })) await tx.housekeepingTask.create({ data: { roomId: booking.roomId, notes: 'Dọn phòng sau chuyển phòng gia hạn' } });
  }
  return bookingView(updated);
}
