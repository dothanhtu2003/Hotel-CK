import { nextBookingReference } from '../bookings/booking-reference.js';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { hash } from "argon2";
import { Prisma } from "../../generated/prisma/client.js";
import { PrismaService } from "../database/prisma.service.js";
import { bookingSelect, bookingView } from "../bookings/booking-view.js";
import { throwBookingError } from "../bookings/booking-errors.js";
import { parseStay } from "../common/validation/stay-dates.js";
import { paginationMeta } from "../common/dto/pagination-query.dto.js";
import { roomSelect, roomView } from "../rooms/room-view.js";
import { orderSelect, orderView } from "../service-orders/order-view.js";
import type { BillingQuery, DeskOrderQuery } from "./desk.dto.js";
import type { UpdateRoomConditionDto } from './room-condition.dto.js';
import type { PublicUser } from '../users/public-user.js';
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
      q.status ? { status: q.status === "PENDING" ? { in: ["PENDING", "CONFIRMED"] } : q.status } : {},
      q.checkIn ? { checkInDate: new Date(q.checkIn + "T00:00:00Z") } : {},
      q.checkOut ? { checkOutDate: new Date(q.checkOut + "T00:00:00Z") } : {},
      q.view === "overdue"
        ? { checkInDate: { lt: date }, status: { in: ["PENDING", "CONFIRMED"] } }
        : q.view === "arrivals"
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
  async billing(q: BillingQuery) {
    return this.prisma.client.$transaction(async (tx) => {
      const records = await tx.booking.findMany({
        where: deskWhere({ ...q, view: undefined }),
        select: { ...deskSelect,
          serviceOrders: { where: { status: { in: ["COMPLETED", "PENDING"] }, paymentMethod: null }, select: { status: true, totalAmount: true } },
          invoice: { select: { id: true, roomAmount: true, serviceAmount: true, totalAmount: true,
            payments: { where: { status: "COMPLETED" }, select: { amount: true } } } },
        },
        orderBy: [{ checkOutDate: "asc" }, { id: "asc" }],
      });
      const rows = records.map(({ user, invoice, serviceOrders, ...b }) => {
        const room = invoice?.roomAmount ?? b.totalRoomAmount;
        const service = invoice?.serviceAmount ?? serviceOrders.filter(o => o.status === "COMPLETED").reduce((sum, o) => sum.add(o.totalAmount), new Prisma.Decimal(0));
        const total = invoice?.totalAmount ?? room.add(service);
        const paid = invoice?.payments.reduce((sum, p) => sum.add(p.amount), new Prisma.Decimal(0)) ?? new Prisma.Decimal(0);
        const balance = total.sub(paid);
        const cancelled = b.status === "CANCELLED";
        return { ...bookingView(b), customer: user, invoiceId: invoice?.id ?? null,
          roomAmount: room.toFixed(2), serviceAmount: service.toFixed(2), totalAmount: total.toFixed(2), paidAmount: paid.toFixed(2),
          balance: cancelled ? "0.00" : balance.toFixed(2),
          paymentState: cancelled ? (paid.gt(0) ? "REVIEW_REFUND" : "CANCELLED") : invoice && balance.lte(0) ? "PAID" : "OUTSTANDING",
          pendingOrderCount: serviceOrders.filter(o => o.status === "PENDING").length,
        };
      });
      const date = q.date ?? hotelDay();
      const matches = (r: typeof rows[number], group: string) => group === "all" ||
        (group === "paid" ? r.paymentState === "PAID" : group === "outstanding" ? r.paymentState === "OUTSTANDING" :
          r.paymentState === "OUTSTANDING" && r.status === "CHECKED_IN" && r.checkOut === date);
      const counts = Object.fromEntries(["departures", "outstanding", "paid", "all"].map(group => [group, rows.filter(r => matches(r, group)).length]));
      const filtered = rows.filter(r => matches(r, q.group ?? "departures"));
      return { data: filtered.slice((q.page - 1) * q.pageSize, q.page * q.pageSize), meta: paginationMeta(q, filtered.length), counts };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
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
  async bookingCounts(dateStr?: string) {
    const today = hotelDay();
    const date = dateStr ?? today;
    const [arrivals, departures, staying] = await Promise.all([
      this.prisma.client.booking.count({
        where: deskWhere({ view: "arrivals", date } as DeskQuery, today),
      }),
      this.prisma.client.booking.count({
        where: deskWhere({ view: "departures", date } as DeskQuery, today),
      }),
      this.prisma.client.booking.count({
        where: deskWhere({ view: "staying", date } as DeskQuery, today),
      }),
    ]);
    return { arrivals, departures, staying };
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
  async updateRoomCondition(id: string, actor: Pick<PublicUser, 'id' | 'role'>, dto: UpdateRoomConditionDto) {
    if (actor.role !== 'RECEPTIONIST' && actor.role !== 'ADMIN') throw new ForbiddenException('Only front desk staff can change room conditions');
    try {
      return await this.prisma.client.$transaction(async tx => {
        const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM hotel.rooms WHERE id=${id}::uuid FOR UPDATE`;
        if (!locked.length) throw new NotFoundException('Room not found');
        const room = await tx.room.findUniqueOrThrow({ where: { id }, select: roomSelect });
        if (room.operationalStatus !== dto.expectedOperationalStatus || room.housekeepingStatus !== dto.expectedHousekeepingStatus)
          throw new ConflictException({ code: 'ROOM_CHANGED', message: 'Room condition changed; reload before editing' });
        if (await tx.booking.findFirst({ where: { roomId: id, status: 'CHECKED_IN' }, select: { id: true } }))
          throw new ConflictException({ code: 'ROOM_OCCUPIED', message: 'Cannot mark an occupied room as empty or out of service' });
        const tasks = await tx.housekeepingTask.findMany({ where: { roomId: id, status: { not: 'DONE' } }, select: { id: true } });
        if (dto.condition === 'CLEAN' && tasks.length && dto.completeOpenTasks !== true)
          throw new ConflictException({ code: 'ROOM_TASK_CONFIRMATION_REQUIRED', message: 'Confirm inspection and completion of open cleaning tasks' });
        await tx.roomStatusChange.create({ data: {
          roomId: id, actorId: actor.id, condition: dto.condition,
          previousOperationalStatus: room.operationalStatus, previousHousekeepingStatus: room.housekeepingStatus,
          completedTaskIds: dto.condition === 'CLEAN' ? tasks.map(task => task.id) : [], note: dto.note?.trim() || null,
        } });
        if (dto.condition === 'CLEAN' && tasks.length) {
          await tx.housekeepingTask.updateMany({ where: { roomId: id, status: { not: 'DONE' } }, data: { status: 'DONE', manualCompletedBy: actor.id } });
        }
        const updated = await tx.room.update({ where: { id }, data: dto.condition === 'CLEAN'
          ? { operationalStatus: 'ACTIVE', housekeepingStatus: 'CLEAN' }
          : { operationalStatus: 'OUT_OF_SERVICE' }, select: roomSelect });
        return { ...roomView(updated), openTaskCount: dto.condition === 'CLEAN' ? 0 : tasks.length };
      });
    } catch (error) { throwBookingError(error); }
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
      ...(q.q?.trim() ? { booking: { OR: [
        { reference: { contains: q.q.trim(), mode: 'insensitive' } },
        { room: { roomNumber: { contains: q.q.trim(), mode: 'insensitive' } } },
        { user: { fullName: { contains: q.q.trim(), mode: 'insensitive' } } },
      ] } } : {}),
      ...(q.date ? { orderedAt: { gte: new Date(`${q.date}T00:00:00+07:00`), lt: new Date(new Date(`${q.date}T00:00:00+07:00`).getTime() + 86400000) } } : {}),
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
        const counts = await tx.serviceOrder.groupBy({ by: ['status'], where: { ...where, status: undefined }, _count: { _all: true } });
        return {
          counts: Object.fromEntries(counts.map(row => [row.status, row._count._all])),
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
      (!dto.fullName?.trim() || !dto.phone?.trim())
    )
      throw new BadRequestException(
        "Nhập họ tên và số điện thoại hoặc chọn khách đã có.",
      );
    if (dto.customerId && (dto.email || dto.fullName || dto.phone))
      throw new BadRequestException("Chọn một hồ sơ khách hàng duy nhất.");
    if (dto.receiveNow && dto.checkIn !== hotelDay()) throw new BadRequestException("Chỉ nhận phòng ngay cho ngày hôm nay.");
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
        if (room.operationalStatus !== "ACTIVE")
          throw new ConflictException({
            code: "WALK_IN_ROOM_NOT_READY",
            message: "Phòng ngưng phục vụ.",
          });
        const today = new Date(`${hotelDay()}T00:00:00.000Z`);
        const isToday = start.getTime() <= today.getTime();
        if (isToday) {
          if (room.housekeepingStatus !== "CLEAN" || room.tasks.length)
            throw new ConflictException({
              code: "WALK_IN_ROOM_NOT_READY",
              message:
                "Phòng cần hoạt động, sạch và không còn công việc buồng phòng.",
            });
          if (
            await tx.booking.count({
              where: { roomId: dto.roomId, status: "CHECKED_IN" },
            })
          )
            throw new ConflictException({
              code: "WALK_IN_ROOM_OCCUPIED",
              message: "Phòng đang có khách lưu trú.",
            });
        }
        if (dto.guests > room.roomType.maxGuests)
          throw new BadRequestException("Guest count exceeds room capacity");
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
                OR: [...(dto.email ? [{ email: dto.email }] : []), { phone: dto.phone!.trim() }],
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
              email: dto.email ?? null,
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
            reference: await nextBookingReference(tx),
          },
          select: bookingSelect,
        });
        if (dto.receiveNow ?? dto.checkIn === hotelDay()) {
          await tx.booking.update({ where: { id: booking.id }, data: { status: 'CONFIRMED' } });
          const checkedIn = await tx.booking.update({ where: { id: booking.id }, data: { status: 'CHECKED_IN' }, select: bookingSelect });
          return { ...bookingView(checkedIn), customer };
        }
        return { ...bookingView(booking), customer };
      });
    } catch (error) {
      throwBookingError(error);
    }
  }
}
