import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';
import { paginationMeta, type PaginationQueryDto } from '../common/dto/pagination-query.dto.js';
import { parseStay } from '../common/validation/stay-dates.js';
import { roomSelect, roomView } from './room-view.js';
import type { AvailabilityQueryDto } from './dto/availability-query.dto.js';

@Injectable()
export class RoomsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: PaginationQueryDto) {
    const [rooms, total] = await this.prisma.client.$transaction([
      this.prisma.client.room.findMany({ select: roomSelect, orderBy: [{ roomNumber: 'asc' }, { id: 'asc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.client.room.count(),
    ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
    return { data: rooms.map(roomView), meta: paginationMeta(query, total) };
  }

  async get(id: string) {
    const room = await this.prisma.client.room.findUnique({ where: { id }, select: roomSelect });
    if (!room) throw new NotFoundException('Room not found');
    return roomView(room);
  }

  async available(query: AvailabilityQueryDto) {
    const { start, end, nights } = parseStay(query.checkIn, query.checkOut);
    const rooms = await this.prisma.client.room.findMany({
      where: {
        operationalStatus: 'ACTIVE',
        ...(query.roomTypeId ? { roomTypeId: query.roomTypeId } : {}),
        roomType: { maxGuests: { gte: query.guests } },
        bookings: { none: {
          status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'] },
          checkInDate: { lt: end }, checkOutDate: { gt: start },
        } },
      },
      select: roomSelect,
      orderBy: [{ roomType: { nightlyPrice: 'asc' } }, { roomNumber: 'asc' }, { id: 'asc' }],
    });
    return { checkIn: query.checkIn, checkOut: query.checkOut, guests: query.guests, nights,
      data: rooms.map(room => ({ ...roomView(room), estimatedTotalAmount: room.roomType.nightlyPrice.mul(nights).toFixed(2) })),
    };
  }
}
