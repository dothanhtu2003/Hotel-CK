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

  async create(actor: Actor, dto: CreateBookingDto) {
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
      return bookingView(await this.prisma.client.booking.create({
        data: { userId: actor.id, roomId: dto.roomId, checkInDate: start, checkOutDate: end, guestCount: dto.guests }, select: bookingSelect,
      }));
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
        // Keep the database's guarded transitions atomic behind one reception action.
        if (action === 'check-in') {
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
