import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import type { PublicUser } from '../users/public-user.js';
import { PrismaService } from '../database/prisma.service.js';
import { paginationMeta } from '../common/dto/pagination-query.dto.js';
import type { CreateServiceOrderDto } from './dto/create-service-order.dto.js';
import type { ServiceOrderQueryDto } from './dto/service-order-query.dto.js';
import { orderSelect, orderView } from './order-view.js';
import { throwOrderError } from './order-errors.js';
import type { SettleServiceOrderDto } from './dto/settle-service-order.dto.js';

type Actor = Pick<PublicUser, 'id' | 'role'>;
@Injectable()
export class ServiceOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  private scope(actor: Actor): Prisma.ServiceOrderWhereInput {
    if (actor.role === 'GUEST') return { booking: { userId: actor.id } };
    if (actor.role === 'RECEPTIONIST' || actor.role === 'ADMIN') return {};
    throw new ForbiddenException('Insufficient permissions');
  }

  private async lockStay(tx: Prisma.TransactionClient, id: string, actor: Actor) {
    const rows = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`SELECT id FROM hotel.bookings WHERE id=${id}::uuid ${actor.role === 'GUEST' ? Prisma.sql`AND user_id=${actor.id}::uuid` : Prisma.empty} FOR UPDATE`);
    if (!rows.length) throw new NotFoundException('Booking not found');
    const booking = await tx.booking.findUniqueOrThrow({ where: { id }, select: { status: true, invoice: { select: { id: true } } } });
    if (booking.status !== 'CHECKED_IN' || booking.invoice) throw new ConflictException('Service orders require a checked-in stay without an invoice');
  }

  async create(actor: Actor, dto: CreateServiceOrderDto) {
    if (!['GUEST', 'RECEPTIONIST', 'ADMIN'].includes(actor.role)) throw new ForbiddenException('Insufficient permissions');
    const settlement = dto.settlement ?? 'ROOM';
    if (actor.role === 'GUEST' && settlement !== 'ROOM') throw new ForbiddenException('Only staff can record counter payments');
    if (!['ROOM', 'CASH', 'BANK_TRANSFER'].includes(settlement)) throw new BadRequestException('Invalid settlement');
    // Also enforce item bounds/uniqueness for internal callers bypassing the HTTP DTO pipe.
    if (!Array.isArray(dto.items) || dto.items.length < 1 || dto.items.length > 50 || dto.items.some(item => !item || typeof item.serviceId !== 'string' || !Number.isInteger(item.quantity) || item.quantity <= 0 || item.quantity > 2147483647)
      || new Set(dto.items.map(item => item.serviceId.toLowerCase())).size !== dto.items.length) throw new BadRequestException('Provide 1 to 50 distinct services with positive integer quantities');
    try {
      return await this.prisma.client.$transaction(async tx => {
        // Consistent booking -> order lock order, shared with the eventual billing transaction.
        await this.lockStay(tx, dto.bookingId, actor);
        if (dto.requestId) {
          const prior = await tx.serviceOrder.findUnique({ where: { id: dto.requestId }, select: orderSelect });
          if (prior) {
            if (prior.bookingId !== dto.bookingId || (prior.paymentMethod ?? 'ROOM') !== settlement || prior.items.length !== dto.items.length
              || !prior.items.every(item => dto.items.some(input => input.serviceId.toLowerCase() === item.serviceId.toLowerCase() && input.quantity === item.quantity)))
              throw new ConflictException('Request was already used for another order');
            return orderView(prior);
          }
        }
        const order = await tx.serviceOrder.create({ data: { ...(dto.requestId ? { id: dto.requestId } : {}), bookingId: dto.bookingId }, select: { id: true } });
        for (const item of dto.items) {
          const service = await tx.service.findUnique({ where: { id: item.serviceId }, select: { isActive: true } });
          if (!service) throw new NotFoundException('Service not found');
          if (!service.isActive) throw new ConflictException('Service is not active');
          // Trigger rechecks activity and snapshots catalog price; never send client prices/totals.
          await tx.serviceOrderItem.create({ data: { serviceOrderId: order.id, serviceId: item.serviceId, quantity: item.quantity }, select: { id: true } });
        }
        // Staff entries are recorded immediately. Guest requests still await staff acceptance.
        if (actor.role !== 'GUEST') {
          const stored = await tx.serviceOrder.findUniqueOrThrow({ where: { id: order.id }, select: { totalAmount: true } });
          const receipt = this.receiptData(actor, { ...dto, settlement }, stored.totalAmount);
          await tx.serviceOrder.update({ where: { id: order.id }, data: { status: 'COMPLETED', ...receipt } });
        }
        return orderView(await tx.serviceOrder.findUniqueOrThrow({ where: { id: order.id }, select: orderSelect }));
      });
    } catch (error) { throwOrderError(error); }
  }

  async list(query: ServiceOrderQueryDto, actor: Actor) {
    const where: Prisma.ServiceOrderWhereInput = { ...this.scope(actor), ...(query.status ? { status: query.status } : {}) };
    const [orders, total] = await this.prisma.client.$transaction([
      this.prisma.client.serviceOrder.findMany({ where, select: orderSelect, orderBy: [{ orderedAt: 'desc' }, { id: 'desc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.client.serviceOrder.count({ where }),
    ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
    return { data: orders.map(orderView), meta: paginationMeta(query, total) };
  }

  async get(id: string, actor: Actor) {
    const order = await this.prisma.client.serviceOrder.findFirst({ where: { id, ...this.scope(actor) }, select: orderSelect });
    if (!order) throw new NotFoundException('Service order not found');
    return orderView(order);
  }

  private receiptData(actor: Actor, dto: SettleServiceOrderDto, total: Prisma.Decimal) {
    if (!dto.settlement || dto.settlement === 'ROOM') return {};
    if (actor.role !== 'RECEPTIONIST' && actor.role !== 'ADMIN') throw new ForbiddenException('Only staff can collect payments');
    if (dto.paymentVerified !== true || !dto.expectedAmount || !/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/.test(dto.expectedAmount)) throw new BadRequestException('Confirm receipt and expected amount');
    if (!total.equals(dto.expectedAmount)) throw new ConflictException('Service prices changed; refresh the catalog before collecting payment');
    return { paymentMethod: dto.settlement, paidAt: new Date(), receivedBy: actor.id };
  }

  async settle(id: string, actor: Actor, dto: SettleServiceOrderDto) {
    if (actor.role !== 'RECEPTIONIST' && actor.role !== 'ADMIN') throw new ForbiddenException('Only staff can settle orders');
    try {
      return await this.prisma.client.$transaction(async tx => {
        const target = await tx.serviceOrder.findUnique({ where: { id }, select: { bookingId: true } });
        if (!target) throw new NotFoundException('Service order not found');
        await this.lockStay(tx, target.bookingId, actor);
        const order = await tx.serviceOrder.findUniqueOrThrow({ where: { id }, select: orderSelect });
        if (order.status === 'CANCELLED') throw new ConflictException('Cancelled order cannot be settled');
        if (order.paymentMethod) {
          if (order.paymentMethod !== dto.settlement) throw new ConflictException('Counter receipt is already recorded');
          return orderView(order); // Safe retry: never record another collection.
        }
        await tx.serviceOrder.update({ where: { id }, data: { status: 'COMPLETED', ...this.receiptData(actor, dto, order.totalAmount) } });
        return orderView(await tx.serviceOrder.findUniqueOrThrow({ where: { id }, select: orderSelect }));
      });
    } catch (error) { throwOrderError(error); }
  }

  async transition(id: string, actor: Actor, action: 'complete' | 'cancel', refundConfirmed = false) {
    if (action === 'complete' && actor.role !== 'RECEPTIONIST' && actor.role !== 'ADMIN') throw new ForbiddenException('Insufficient permissions');
    const scope = { id, ...this.scope(actor) };
    try {
      return await this.prisma.client.$transaction(async tx => {
        const order = await tx.serviceOrder.findFirst({ where: scope, select: { bookingId: true } });
        if (!order) throw new NotFoundException('Service order not found');
        await this.lockStay(tx, order.bookingId, actor);
        const current = await tx.serviceOrder.findUniqueOrThrow({ where: { id }, select: orderSelect });
        const staff = actor.role === 'RECEPTIONIST' || actor.role === 'ADMIN';
        const cancellingRecorded = action === 'cancel' && staff && current.status === 'COMPLETED';
        if (current.paymentMethod && action === 'cancel' && (!staff || !refundConfirmed)) throw new ConflictException('Confirm full refund before cancelling a paid order');
        const result = await tx.serviceOrder.updateMany({ where: { ...scope, status: cancellingRecorded ? 'COMPLETED' : 'PENDING' }, data: {
          status: action === 'complete' ? 'COMPLETED' : 'CANCELLED',
          ...(action === 'cancel' && current.paymentMethod ? { refundedAt: new Date(), refundedBy: actor.id } : {}),
        } });
        if (result.count !== 1) throw new ConflictException('Only pending service orders may change status');
        return orderView(await tx.serviceOrder.findUniqueOrThrow({ where: { id }, select: orderSelect }));
      });
    } catch (error) { throwOrderError(error); }
  }
}
