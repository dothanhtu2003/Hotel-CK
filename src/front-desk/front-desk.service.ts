import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomBytes, randomUUID } from "node:crypto";
import { hash } from "argon2";
import { Prisma } from "../../generated/prisma/client.js";
import { PrismaService } from "../database/prisma.service.js";
import { bookingSelect, bookingView } from "../bookings/booking-view.js";
import { throwBookingError } from "../bookings/booking-errors.js";
import { parseStay } from "../common/validation/stay-dates.js";
import { paginationMeta } from "../common/dto/pagination-query.dto.js";
import { roomSelect, roomView } from "../rooms/room-view.js";
import { orderSelect, orderView } from "../service-orders/order-view.js";
import type { DeskOrderQuery } from "./desk.dto.js";
import type {
  CustomerQuery,
  DeskQuery,
  RoomQuery,
  WalkInDto,
} from "./desk.dto.js";

export function hotelDay(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
const customerSelect = {
  id: true,
  fullName: true,
  email: true,
  phone: true,
} as const;
const deskSelect = {
  ...bookingSelect,
  user: { select: customerSelect },
} as const;
export function deskWhere(
  q: DeskQuery,
  today = hotelDay(),
): Prisma.BookingWhereInput {
  const date = new Date((q.date ?? today) + "T00:00:00Z");
  return {
    AND: [
      q.status ? { status: q.status } : {},
      q.checkIn ? { checkInDate: new Date(q.checkIn + "T00:00:00Z") } : {},
      q.checkOut ? { checkOutDate: new Date(q.checkOut + "T00:00:00Z") } : {},
      q.view === "arrivals"
        ? { checkInDate: date, status: { in: ["PENDING", "CONFIRMED"] } }
        : q.view === "departures"
          ? { checkOutDate: date, status: "CHECKED_IN" }
          : q.view === "staying"
            ? { status: "CHECKED_IN", ...(q.date ? { checkInDate: { lte: date }, checkOutDate: { gt: date } } : {}) }
            : {},
      q.q?.trim()
        ? {
            OR: [
              { reference: { contains: q.q.trim(), mode: "insensitive" } },
              {
                room: {
                  roomNumber: { contains: q.q.trim(), mode: "insensitive" },
                },
              },
              {
                user: {
                  OR: ["fullName", "phone", "email"].map((key) => ({
                    [key]: { contains: q.q!.trim(), mode: "insensitive" },
                  })),
                },
              },
            ],
          }
        : {},
    ],
  };
}
export const readyWhere = (date: Date): Prisma.RoomWhereInput => ({
  operationalStatus: "ACTIVE",
  housekeepingStatus: "CLEAN",
  tasks: { none: { status: { not: "DONE" } } },
  bookings: {
    none: {
      OR: [
        { status: "CHECKED_IN" },
        {
          status: { in: ["PENDING", "CONFIRMED"] },
          checkInDate: { lte: date },
          checkOutDate: { gt: date },
        },
      ],
    },
  },
});
@Injectable()
export class FrontDeskService {
  constructor(private readonly prisma: PrismaService) {}
  async bookings(q: DeskQuery) {
    const where = deskWhere(q);
    return this.prisma.client.$transaction(
      async (tx) => {
        const rows = await tx.booking.findMany({
          where,
          select: deskSelect,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          skip: (q.page - 1) * q.pageSize,
          take: q.pageSize,
        });
        const total = await tx.booking.count({ where });
        return {
          data: rows.map(({ user, ...b }) => ({
            ...bookingView(b),
            customer: user,
          })),
          meta: paginationMeta(q, total),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  async detail(id: string) {
    const b = await this.prisma.client.booking.findUnique({
      where: { id },
      select: {
        ...deskSelect,
        room: {
          select: {
            ...roomSelect,
            tasks: { where: { status: { not: "DONE" } }, select: { id: true } },
          },
        },
      },
    });
    if (!b) throw new NotFoundException("Booking not found");
    const { user, room, ...record } = b;
    return {
      ...bookingView({ ...record, room }),
      customer: user,
      room: roomView(room),
      openTaskCount: room.tasks.length,
    };
  }
  async dashboard() {
    const today = hotelDay(),
      date = new Date(today + "T00:00:00Z");
    return this.prisma.client.$transaction(
      async (tx) => {
        const [
          arrivals,
          departures,
          staying,
          ready,
          dirty,
          orders,
          pending,
          arrivalRows,
          departureRows,
          totalRooms,
          occupiedRooms,
          openTasks,
        ] = await Promise.all([
          tx.booking.aggregate({
            where: deskWhere({ view: "arrivals" } as DeskQuery, today),
            _sum: { guestCount: true },
            _count: true,
          }),
          tx.booking.aggregate({
            where: deskWhere({ view: "departures" } as DeskQuery, today),
            _sum: { guestCount: true },
            _count: true,
          }),
          tx.booking.aggregate({
            where: { status: "CHECKED_IN" },
            _sum: { guestCount: true },
            _count: true,
          }),
          tx.room.count({ where: readyWhere(date) }),
          tx.room.count({
            where: { housekeepingStatus: { in: ["DIRTY", "CLEANING"] } },
          }),
          tx.serviceOrder.count({ where: { status: "PENDING" } }),
          tx.booking.count({ where: { status: "PENDING" } }),
          tx.booking.findMany({
            where: deskWhere({ view: "arrivals" } as DeskQuery, today),
            select: deskSelect,
            take: 5,
            orderBy: [{ checkInDate: "asc" }, { id: "asc" }],
          }),
          tx.booking.findMany({
            where: deskWhere({ view: "departures" } as DeskQuery, today),
            select: deskSelect,
            take: 5,
            orderBy: [{ checkOutDate: "asc" }, { id: "asc" }],
          }),
          tx.room.count(),
          tx.room.count({ where: { bookings: { some: { status: "CHECKED_IN" } } } }),
          tx.housekeepingTask.count({ where: { status: { not: "DONE" } } }),
        ]);
        const view = (rows: typeof arrivalRows) =>
          rows.map(({ user, ...b }) => ({ ...bookingView(b), customer: user }));
        return {
          today,
          totalRooms,
          occupiedRooms,
          openTasks,
          bookingCounts: {
            arrivals: arrivals._count,
            departures: departures._count,
            staying: staying._count,
          },
          counts: {
            arrivals: arrivals._sum.guestCount ?? 0,
            departures: departures._sum.guestCount ?? 0,
            staying: staying._sum.guestCount ?? 0,
            ready,
            dirty,
            orders,
            pending,
          },
          arrivals: view(arrivalRows),
          departures: view(departureRows),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  async roomFilters() {
    const [types, floors] = await this.prisma.client.$transaction([
      this.prisma.client.roomType.findMany({
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      this.prisma.client.room.findMany({
        distinct: ["floor"],
        select: { floor: true },
        orderBy: { floor: "asc" },
      }),
    ]);
    return { types, floors: floors.map((r) => r.floor) };
  }
  async rooms(q: RoomQuery) {
    const date = new Date(hotelDay() + "T00:00:00Z");
    if (!!q.start !== !!q.end) throw new BadRequestException("Both start and end are required");
    const start = q.start ? new Date(q.start + "T00:00:00Z") : null;
    const end = q.end ? new Date(q.end + "T00:00:00Z") : null;
    if (start && end && (end <= start || end.getTime() - start.getTime() > 31 * 86400000)) {
      throw new BadRequestException("Tape chart range must be 1 to 31 nights");
    }
    const where: Prisma.RoomWhereInput = {
      ...(q.q?.trim()
        ? { roomNumber: { contains: q.q.trim(), mode: "insensitive" } }
        : {}),
      ...(q.floor !== undefined ? { floor: q.floor } : {}),
      ...(q.roomTypeId ? { roomTypeId: q.roomTypeId } : {}),
      ...(q.state === "ready"
        ? readyWhere(date)
        : q.state === "dirty"
          ? { housekeepingStatus: { in: ["DIRTY", "CLEANING"] } }
          : q.state === "occupied"
            ? { bookings: { some: { status: "CHECKED_IN" } } }
            : {}),
    };
    return this.prisma.client.$transaction(
      async (tx) => {
        const rows = await tx.room.findMany({
          where,
          select: {
            ...roomSelect,
            tasks: { where: { status: { not: "DONE" } }, select: { id: true } },
            bookings: {
              where: start && end ? {
                status: { not: "CANCELLED" },
                checkInDate: { lt: end },
                checkOutDate: { gt: start },
              } : {
                OR: [
                  { status: "CHECKED_IN" },
                  {
                    status: { in: ["PENDING", "CONFIRMED"] },
                    checkInDate: { lte: date },
                    checkOutDate: { gt: date },
                  },
                ],
              },
              select: deskSelect,
            },
          },
          skip: (q.page - 1) * q.pageSize,
          take: q.pageSize,
          orderBy: [{ floor: "asc" }, { roomNumber: "asc" }],
        });
        return {
          data: rows.map(({ bookings, tasks, ...r }) => ({
            ...roomView(r),
            openTaskCount: tasks.length,
            bookings: bookings.map(({ user, ...b }) => ({
              ...bookingView(b),
              customer: user,
            })),
          })),
          meta: paginationMeta(q, await tx.room.count({ where })),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  async orders(q: DeskOrderQuery) {
    const where: Prisma.ServiceOrderWhereInput = {
      ...(q.status ? { status: q.status } : {}),
      ...(q.bookingId ? { bookingId: q.bookingId } : {}),
    };
    return this.prisma.client.$transaction(
      async (tx) => {
        const rows = await tx.serviceOrder.findMany({
          where,
          select: {
            ...orderSelect,
            booking: {
              select: { ...deskSelect, invoice: { select: { id: true } } },
            },
          },
          orderBy: [{ orderedAt: "desc" }, { id: "asc" }],
          take: q.pageSize,
          skip: (q.page - 1) * q.pageSize,
        });
        return {
          data: rows.map(({ booking, ...o }) => ({
            ...orderView(o),
            reference: booking.reference,
            roomNumber: booking.room.roomNumber,
            customerName: booking.user.fullName,
            canProcess: booking.status === "CHECKED_IN" && !booking.invoice,
          })),
          meta: paginationMeta(q, await tx.serviceOrder.count({ where })),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  async customers(q: CustomerQuery) {
    const where: Prisma.UserWhereInput = {
      role: "GUEST",
      status: "ACTIVE",
      OR: ["fullName", "phone", "email"].map((key) => ({
        [key]: { contains: q.q.trim(), mode: "insensitive" },
      })),
    };
    const [data, total] = await this.prisma.client.$transaction([
      this.prisma.client.user.findMany({
        where,
        select: customerSelect,
        take: 10,
        skip: (q.page - 1) * 10,
        orderBy: { id: "asc" },
      }),
      this.prisma.client.user.count({ where }),
    ]);
    return {
      data,
      meta: paginationMeta({ page: q.page, pageSize: 10 }, total),
    };
  }
  async walkIn(actorId: string, dto: WalkInDto) {
    const { start, end } = parseStay(dto.checkIn, dto.checkOut);
    if (
      !dto.customerId &&
      (!dto.fullName?.trim() || !dto.email || !dto.phone?.trim())
    )
      throw new BadRequestException(
        "Nhập họ tên, email và số điện thoại hoặc chọn khách đã có.",
      );
    if (dto.customerId && (dto.email || dto.fullName || dto.phone))
      throw new BadRequestException("Chọn một hồ sơ khách hàng duy nhất.");
    const passwordHash = dto.customerId
      ? undefined
      : await hash(randomBytes(48).toString("base64url"));
    try {
      return await this.prisma.client.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM hotel.rooms WHERE id=${dto.roomId}::uuid FOR UPDATE`;
        const room = await tx.room.findUnique({
          where: { id: dto.roomId },
          include: {
            roomType: true,
            tasks: { where: { status: { not: "DONE" } } },
          },
        });
        if (!room) throw new NotFoundException("Room not found");
        if (
          room.operationalStatus !== "ACTIVE" ||
          room.housekeepingStatus !== "CLEAN" ||
          room.tasks.length
        )
          throw new ConflictException({
            code: "WALK_IN_ROOM_NOT_READY",
            message:
              "Phòng cần hoạt động, sạch và không còn công việc buồng phòng.",
          });
        if (dto.guests > room.roomType.maxGuests)
          throw new BadRequestException("Guest count exceeds room capacity");
        if (
          await tx.booking.count({
            where: { roomId: dto.roomId, status: "CHECKED_IN" },
          })
        )
          throw new ConflictException({
            code: "WALK_IN_ROOM_OCCUPIED",
            message: "Phòng đang có khách lưu trú.",
          });
        let customer;
        if (dto.customerId)
          customer = await tx.user.findFirst({
            where: { id: dto.customerId, role: "GUEST", status: "ACTIVE" },
            select: customerSelect,
          });
        else {
          await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${dto.phone!.trim()})::bigint)`;
          // Never silently attach a typed email/phone to someone else's profile.
          if (
            await tx.user.findFirst({
              where: {
                OR: [{ email: dto.email }, { phone: dto.phone!.trim() }],
              },
              select: { id: true },
            })
          )
            throw new ConflictException({
              code: "WALK_IN_CUSTOMER_EXISTS",
              message: "Khách đã có hồ sơ. Hãy tìm và chọn khách hàng hiện có.",
            });
          customer = await tx.user.create({
            data: {
              fullName: dto.fullName!.trim(),
              email: dto.email!,
              phone: dto.phone!.trim(),
              passwordHash: passwordHash!,
            },
            select: customerSelect,
          });
        }
        if (!customer) throw new NotFoundException("Active guest not found");
        const booking = await tx.booking.create({
          data: {
            userId: customer.id,
            createdById: actorId,
            roomId: dto.roomId,
            checkInDate: start,
            checkOutDate: end,
            guestCount: dto.guests,
            reference:
              "CK-" +
              randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase(),
          },
          select: bookingSelect,
        });
        return { ...bookingView(booking), customer };
      });
    } catch (error) {
      throwBookingError(error);
    }
  }
}
