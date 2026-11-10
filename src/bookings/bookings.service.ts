import { previewStayExtension, confirmStayExtension } from './stay-extension.js';
import type { ExtensionPreviewDto, ExtendBookingDto } from './dto/extend-booking.dto.js';
import { createHash } from 'node:crypto';
import { nextBookingReference } from './booking-reference.js';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import type { BookingStatus } from '../../generated/prisma/enums.js';
import { PrismaService } from '../database/prisma.service.js';
import type { PublicUser } from '../users/public-user.js';
import { paginationMeta } from '../common/dto/pagination-query.dto.js';
import { hotelDay, parseStay } from '../common/validation/stay-dates.js';
import { bookingSelect, bookingView } from './booking-view.js';
import { throwBookingError } from './booking-errors.js';
import type { CreateBookingDto } from './dto/create-booking.dto.js';
import type { BookingQueryDto } from './dto/booking-query.dto.js';

type Actor = Pick<PublicUser, 'id' | 'role'>;
@Injectable()
export class BookingsService {
  constructor(private readonly prisma: PrismaService) {}

  private scope(actor: Actor): Prisma.BookingWhereInput {
    // RolesGuard only permits GUEST/RECEPTIONIST/ADMIN; every guest read/write is scoped in SQL.
    if (actor.role === 'GUEST') return { userId: actor.id };
    if (actor.role === 'RECEPTIONIST' || actor.role === 'ADMIN') return {};
    throw new ForbiddenException('Insufficient permissions');
  }

  async stayHistory(id: string, actor: Actor) {
    const booking = await this.prisma.client.booking.findFirst({ where: { id, ...this.scope(actor) }, select: { id: true } });
    if (!booking) throw new NotFoundException('Booking not found');
    const segments = await this.prisma.client.staySegment.findMany({ where: { bookingId: id }, orderBy: [{ startedAt: 'asc' }, { id: 'asc' }], include: { room: { select: { roomNumber: true } } } });
    return segments.map(s => ({ id: s.id, roomNumber: s.room.roomNumber, startedAt: s.startedAt, endedAt: s.endedAt, estimatedStart: s.estimatedStart, startDate: s.startDate.toISOString().slice(0,10), endDate: s.endDate.toISOString().slice(0,10) }));
  }

  async extensionPreview(id: string, actor: Actor, dto: ExtensionPreviewDto) {
    if (!['RECEPTIONIST', 'ADMIN'].includes(actor.role)) throw new ForbiddenException('Staff required');
    return this.prisma.client.$transaction(async tx => (await previewStayExtension(tx, id, dto)).quote, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  async extend(id: string, actor: Actor, dto: ExtendBookingDto) {
    if (!['RECEPTIONIST', 'ADMIN'].includes(actor.role)) throw new ForbiddenException('Staff required');
    try { return await this.prisma.client.$transaction(tx => confirmStayExtension(tx, id, actor.id, dto)); }
    catch (error) { throwBookingError(error); }
  }

  async create(actor: Actor, dto: CreateBookingDto, clientIp?: string) {
    if (actor.role !== 'GUEST') throw new ForbiddenException('Only guests may create their own bookings');
    const { start, end } = parseStay(dto.checkIn, dto.checkOut);
    if (dto.checkIn < hotelDay()) throw new BadRequestException('Ngày nhận phòng không được trước hôm nay. Vui lòng chọn lại ngày lưu trú.');
    const room = await this.prisma.client.room.findUnique({ where: { id: dto.roomId }, select: { operationalStatus: true, roomType: { select: { maxGuests: true } } } });
    if (!room) throw new NotFoundException('Room not found');
    if (room.operationalStatus !== 'ACTIVE') throw new ConflictException('Room is out of service');
    if (dto.guests > room.roomType.maxGuests) throw new BadRequestException('Guest count exceeds room capacity');
    try {
      // Do not pre-SELECT availability or send any prices/status/user-supplied userId.
      // PostgreSQL trigger snapshots price and exclusion constraint arbitrates races.
      return await this.prisma.client.$transaction(async tx => {
        if (dto.checkIn === hotelDay()) {
          await tx.$queryRaw`SELECT id FROM hotel.rooms WHERE id=${dto.roomId}::uuid FOR UPDATE`;
          const ready = await tx.room.findFirst({ where: { id: dto.roomId, operationalStatus: 'ACTIVE', housekeepingStatus: 'CLEAN', tasks: { none: { status: { not: 'DONE' } } }, bookings: { none: { status: 'CHECKED_IN' } } }, select: { id: true } });
          if (!ready) throw new ConflictException('Room is not ready for arrival today');
        }
        return bookingView(await tx.booking.create({
        data: { reference: await nextBookingReference(tx), userId: actor.id, roomId: dto.roomId, checkInDate: start, checkOutDate: end, guestCount: dto.guests, onlinePaymentRequired: true, ...(clientIp ? { clientIpHash:createHash('sha256').update(clientIp).digest('hex') } : {}) }, select: bookingSelect,
      }));
      });
    } catch (error) { throwBookingError(error); }
  }

  async list(query: BookingQueryDto, actor: Actor) {
    const where: Prisma.BookingWhereInput = { ...this.scope(actor), ...(query.status ? { status: query.status } : {}) };
    const [bookings, total] = await this.prisma.client.$transaction([
      this.prisma.client.booking.findMany({ where, select: bookingSelect, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.client.booking.count({ where }),
    ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
    return { data: bookings.map(bookingView), meta: paginationMeta(query, total) };
  }

  async get(id: string, actor: Actor) {
    const booking = await this.prisma.client.booking.findFirst({ where: { id, ...this.scope(actor) }, select: bookingSelect });
    // Same 404 for nonexistent and another guest's booking to avoid disclosing existence.
    if (!booking) throw new NotFoundException('Booking not found');
    return bookingView(booking);
  }

  async checkoutRequests() {
    const bookings = await this.prisma.client.booking.findMany({
      where: { status: 'CHECKED_IN', checkoutRequestedAt: { not: null } },
      select: { ...bookingSelect, user: { select: { fullName: true } } },
      orderBy: [{ checkoutRequestedAt: 'asc' }, { id: 'asc' }],
    });
    return bookings.map(({ user, ...booking }) => ({ ...bookingView(booking), customerName: user.fullName }));
  }

  async requestCheckout(id: string, actor: Actor) {
    if (actor.role !== 'GUEST') throw new ForbiddenException('Only guests may request checkout');
    return this.prisma.client.$transaction(async tx => {
      const where = { id, userId: actor.id };
      await tx.booking.updateMany({
        where: { ...where, status: 'CHECKED_IN', checkoutRequestedAt: null },
        data: { checkoutRequestedAt: new Date() },
      });
      const booking = await tx.booking.findFirst({ where, select: bookingSelect });
      if (!booking) throw new NotFoundException('Booking not found');
      if (booking.status !== 'CHECKED_IN') throw new ConflictException('Chỉ có thể yêu cầu trả phòng khi đang lưu trú.');
      return bookingView(booking);
    });
  }

  async transition(id: string, actor: Actor, action: 'cancel' | 'confirm' | 'check-in') {
    if (action !== 'cancel' && actor.role !== 'RECEPTIONIST' && actor.role !== 'ADMIN') throw new ForbiddenException('Insufficient permissions');
    const transitions: Record<typeof action, { from: BookingStatus[]; to: BookingStatus }> = {
      cancel: { from: ['PENDING', 'CONFIRMED'], to: 'CANCELLED' },
      confirm: { from: ['PENDING'], to: 'CONFIRMED' },
      'check-in': { from: ['PENDING', 'CONFIRMED'], to: 'CHECKED_IN' },
    };
    const change = transitions[action];
    const scope = { id, ...this.scope(actor) };
    try {
      return await this.prisma.client.$transaction(async tx => {
        if (action === 'cancel') {
          await tx.$queryRaw`SELECT id FROM hotel.bookings WHERE id=${id}::uuid FOR UPDATE`;
          if (await tx.bookingPayment.count({ where: { bookingId: id, status: 'COMPLETED' } }))
            throw new ConflictException('Booking đã nhận tiền. Cần xử lý khoản thu trước khi hủy.');
        }
        // Keep the database's guarded transitions atomic behind one reception action.
        if (action === 'check-in') {
          const snapshot = await tx.booking.findFirst({ where: scope, select: { roomId: true } });
          if (!snapshot) throw new NotFoundException('Booking not found');
          await tx.$queryRaw`SELECT id FROM hotel.rooms WHERE id=${snapshot.roomId}::uuid FOR UPDATE`;
          const booking = await tx.booking.findFirstOrThrow({ where: scope });
          if (booking.roomId !== snapshot.roomId) throw new ConflictException('Phòng đã thay đổi. Vui lòng tải lại.');
          const today = hotelDay();
          if (booking.checkInDate.toISOString().slice(0, 10) > today)
            throw new ConflictException('Chưa đến ngày nhận phòng.');
          if (booking.checkOutDate.toISOString().slice(0, 10) <= today)
            throw new ConflictException('Booking đã qua ngày trả phòng.');
          const occupied = await tx.booking.count({ where: { roomId: booking.roomId, id: { not: id }, status: 'CHECKED_IN' } });
          if (occupied) throw new ConflictException('Phòng đang có khách lưu trú. Cần trả phòng trước khi nhận khách mới.');
          await tx.booking.updateMany({ where: { ...scope, status: 'PENDING' }, data: { status: 'CONFIRMED' } });
        }
        const result = await tx.booking.updateMany({ where: { ...scope, status: { in: change.from } }, data: { status: change.to } });
        if (result.count !== 1) {
          const exists = await tx.booking.findFirst({ where: scope, select: { id: true } });
          if (!exists) throw new NotFoundException('Booking not found');
          throw new ConflictException('Current booking status does not allow this action');
        }
        return bookingView(await tx.booking.findUniqueOrThrow({ where: { id }, select: bookingSelect }));
      });
    } catch (error) { throwBookingError(error); }
  }
}
