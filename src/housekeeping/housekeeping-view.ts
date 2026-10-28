import type { Prisma } from '../../generated/prisma/client.js';

export const staffSelect = { id: true, fullName: true } satisfies Prisma.UserSelect;
export const housekeepingRoomSelect = {
  id: true, roomNumber: true, floor: true, housekeepingStatus: true, operationalStatus: true,
  roomType: { select: { id: true, name: true } },
} satisfies Prisma.RoomSelect;
export const taskSummarySelect = {
  id: true, roomId: true, assignedStaffId: true, status: true, notes: true, createdAt: true, completedAt: true,
  assignedStaff: { select: staffSelect },
} satisfies Prisma.HousekeepingTaskSelect;
export const taskSelect = { ...taskSummarySelect, room: { select: housekeepingRoomSelect } } satisfies Prisma.HousekeepingTaskSelect;
export const boardRoomSelect = {
  ...housekeepingRoomSelect,
  tasks: { where: { status: { not: 'DONE' } }, select: taskSummarySelect, orderBy: { id: 'asc' }, take: 1 },
} satisfies Prisma.RoomSelect;
export type BoardRoom = Prisma.RoomGetPayload<{ select: typeof boardRoomSelect }>;
export function boardRoomView({ tasks, ...room }: BoardRoom) { return { ...room, openTask: tasks[0] ?? null }; }
