import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import type { PublicUser } from '../users/public-user.js';
import { PrismaService } from '../database/prisma.service.js';
import { paginationMeta } from '../common/dto/pagination-query.dto.js';
import type { AssignTaskDto, CreateTaskDto } from './dto/create-task.dto.js';
import type { HousekeepingBoardQueryDto, HousekeepingTaskQueryDto } from './dto/housekeeping-query.dto.js';
import { boardRoomSelect, boardRoomView, taskSelect } from './housekeeping-view.js';
import { throwHousekeepingError } from './housekeeping-errors.js';

type Actor = Pick<PublicUser, 'id' | 'role'>;
@Injectable()
export class HousekeepingService {
  constructor(private readonly prisma: PrismaService) {}

  private staff(actor: Actor) {
    if (actor.role !== 'RECEPTIONIST' && actor.role !== 'ADMIN') throw new ForbiddenException('Insufficient permissions');
  }
  private assigneeScope(actor: Actor, requested?: string): Prisma.HousekeepingTaskWhereInput {
    if (actor.role === 'HOUSEKEEPING') {
      if (requested && requested.toLowerCase() !== actor.id.toLowerCase()) throw new ForbiddenException('Cannot select another staff member');
      return { assignedStaffId: actor.id };
    }
    this.staff(actor);
    return requested ? { assignedStaffId: requested } : {};
  }
  private async lockRoom(tx: Prisma.TransactionClient, roomId: string) {
    const rooms = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM hotel.rooms WHERE id=${roomId}::uuid FOR UPDATE`;
    if (!rooms.length) throw new NotFoundException('Room not found');
  }

  async staffDirectory(actor: Actor) {
    this.staff(actor);
    return this.prisma.client.user.findMany({
      where: { role: 'HOUSEKEEPING', status: 'ACTIVE' },
      select: { id: true, fullName: true, email: true },
      orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
    });
  }

  async board(query: HousekeepingBoardQueryDto, actor: Actor) {
    const scope = this.assigneeScope(actor, query.assignedStaffId);
    const where: Prisma.RoomWhereInput = {
      ...(query.roomId ? { id: query.roomId } : {}),
      ...(query.roomTypeId ? { roomTypeId: query.roomTypeId } : {}),
      housekeepingStatus: query.housekeepingStatus ?? { in: ['DIRTY', 'CLEANING'] },
      ...(query.operationalStatus ? { operationalStatus: query.operationalStatus } : {}),
      ...(actor.role === 'HOUSEKEEPING' || query.assignedStaffId ? { tasks: { some: { ...scope, status: { not: 'DONE' } } } } : {}),
    };
    const [rooms, total] = await this.prisma.client.$transaction([
      this.prisma.client.room.findMany({ where, select: boardRoomSelect, orderBy: [{ roomNumber: 'asc' }, { id: 'asc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.client.room.count({ where }),
    ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
    return { data: rooms.map(boardRoomView), meta: paginationMeta(query, total) };
  }

  async list(query: HousekeepingTaskQueryDto, actor: Actor) {
    const where: Prisma.HousekeepingTaskWhereInput = {
      ...this.assigneeScope(actor, query.assignedStaffId),
      ...(query.roomId ? { roomId: query.roomId } : {}), ...(query.status ? { status: query.status } : {}),
    };
    const [tasks, total] = await this.prisma.client.$transaction([
      this.prisma.client.housekeepingTask.findMany({ where, select: taskSelect, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.client.housekeepingTask.count({ where }),
    ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
    return { data: tasks, meta: paginationMeta(query, total) };
  }

  async get(id: string, actor: Actor) {
    const task = await this.prisma.client.housekeepingTask.findFirst({ where: { id, ...this.assigneeScope(actor) }, select: taskSelect });
    if (!task) throw new NotFoundException('Housekeeping task not found');
    return task;
  }

  async create(dto: CreateTaskDto, actor: Actor) {
    this.staff(actor);
    try {
      return await this.prisma.client.$transaction(async tx => {
        await this.lockRoom(tx, dto.roomId);
        const open = await tx.housekeepingTask.findFirst({ where: { roomId: dto.roomId, status: { not: 'DONE' } }, select: { id: true } });
        if (open) throw new ConflictException('Room already has an open housekeeping task');
        // The trigger chooses TODO/DIRTY. No direct room status or client status/timestamps.
        return tx.housekeepingTask.create({ data: { roomId: dto.roomId, ...(dto.notes !== undefined ? { notes: dto.notes } : {}) }, select: taskSelect });
      });
    } catch (error) { throwHousekeepingError(error); }
  }

  async assign(id: string, dto: AssignTaskDto, actor: Actor) {
    this.staff(actor);
    try {
      return await this.prisma.client.$transaction(async tx => {
        const task = await tx.housekeepingTask.findUnique({ where: { id }, select: { roomId: true, assignedStaffId: true } });
        if (!task) throw new NotFoundException('Housekeeping task not found');
        await this.lockRoom(tx, task.roomId);
        const staff = await tx.user.findUnique({ where: { id: dto.assignedStaffId }, select: { role: true, status: true } });
        if (!staff) throw new NotFoundException('Staff not found');
        if (staff.role !== 'HOUSEKEEPING' || staff.status !== 'ACTIVE') throw new BadRequestException('Assignee must be active housekeeping staff');
        // Only TODO is assignable. Preserve the observed assignee as a compare-and-swap
        // condition so a racing reassignment does not silently overwrite a prior one.
        const result = await tx.housekeepingTask.updateMany({ where: { id, status: 'TODO', assignedStaffId: task.assignedStaffId }, data: { assignedStaffId: dto.assignedStaffId } });
        if (result.count !== 1) throw new ConflictException('Task is no longer assignable or was changed concurrently');
        return tx.housekeepingTask.findUniqueOrThrow({ where: { id }, select: taskSelect });
      });
    } catch (error) { throwHousekeepingError(error); }
  }

  async transition(id: string, actor: Actor, action: 'start' | 'complete') {
    // No staff override: only the assigned HOUSEKEEPING user may perform physical work.
    if (actor.role !== 'HOUSEKEEPING') throw new ForbiddenException('Only assigned housekeeping staff may update work status');
    const scope = { id, assignedStaffId: actor.id };
    try {
      return await this.prisma.client.$transaction(async tx => {
        const task = await tx.housekeepingTask.findFirst({ where: scope, select: { roomId: true } });
        if (!task) throw new NotFoundException('Housekeeping task not found');
        await this.lockRoom(tx, task.roomId);
        const result = await tx.housekeepingTask.updateMany({
          where: { ...scope, status: action === 'start' ? 'TODO' : 'IN_PROGRESS' },
          data: { status: action === 'start' ? 'IN_PROGRESS' : 'DONE' },
        });
        if (result.count !== 1) {
          if (!await tx.housekeepingTask.findFirst({ where: scope, select: { id: true } })) throw new NotFoundException('Housekeeping task not found');
          throw new ConflictException('Current task status does not allow this action');
        }
        // Read after AFTER trigger sync; completedAt is set by DB clock_timestamp().
        return tx.housekeepingTask.findUniqueOrThrow({ where: { id }, select: taskSelect });
      });
    } catch (error) { throwHousekeepingError(error); }
  }
}
