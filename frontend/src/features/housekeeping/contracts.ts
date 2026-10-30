import { z } from 'zod';
import type { Role } from '../auth/contracts';
import { ApiError } from '../../lib/api-client';

export const taskStatuses = ['TODO', 'IN_PROGRESS', 'DONE'] as const;
export const cleaningStatuses = ['CLEAN', 'DIRTY', 'CLEANING'] as const;
export type TaskStatus = typeof taskStatuses[number];
export type CleaningStatus = typeof cleaningStatuses[number];
export type HousekeepingRoom = { id: string; roomNumber: string; floor: number; housekeepingStatus: CleaningStatus; operationalStatus: 'ACTIVE' | 'OUT_OF_SERVICE'; roomType: { id: string; name: string } };
export type TaskSummary = { id: string; roomId: string; assignedStaffId: string | null; status: TaskStatus; notes: string | null; createdAt: string; completedAt: string | null; assignedStaff: { id: string; fullName: string } | null };
export type Task = TaskSummary & { room: HousekeepingRoom };
export type BoardRoom = HousekeepingRoom & { openTask: TaskSummary | null };
export const cleaningLabels: Record<CleaningStatus, string> = { CLEAN: 'Phòng sạch', DIRTY: 'Cần dọn', CLEANING: 'Đang dọn' };
export const taskLabels: Record<TaskStatus, string> = { TODO: 'Cần thực hiện', IN_PROGRESS: 'Đang thực hiện', DONE: 'Đã hoàn thành' };
export const createTaskSchema = z.object({ roomId: z.string().uuid('Mã phòng phải là UUID hợp lệ.'), notes: z.string().trim().max(2000, 'Ghi chú tối đa 2000 ký tự.').optional() });
export const assignTaskSchema = z.object({ assignedStaffId: z.string().trim().uuid('Vui lòng chọn nhân viên buồng phòng.') });
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type AssignTaskInput = z.infer<typeof assignTaskSchema>;
export function managesHousekeeping(role: Role) { return role === 'RECEPTIONIST' || role === 'ADMIN'; }
export function canWork(task: TaskSummary, user: { id: string; role: Role }, action: 'start' | 'complete') { return user.role === 'HOUSEKEEPING' && task.assignedStaffId === user.id && task.status === (action === 'start' ? 'TODO' : 'IN_PROGRESS'); }
export function canAssign(task: TaskSummary, role: Role) { return managesHousekeeping(role) && task.status === 'TODO'; }
export function housekeepingParams(params: URLSearchParams, kind: 'board' | 'tasks', pageSize = 9) {
  const page = Number(params.get('page')); const query = new URLSearchParams({ page: String(Number.isInteger(page) && page >= 1 && page <= 1000000 ? page : 1), pageSize: String(pageSize) });
  const statusKey = kind === 'board' ? 'housekeepingStatus' : 'status', allowed: readonly string[] = kind === 'board' ? cleaningStatuses : taskStatuses;
  const status = params.get(statusKey); if (status && allowed.includes(status)) query.set(statusKey, status);
  if (kind === 'board' && ['ACTIVE', 'OUT_OF_SERVICE'].includes(params.get('operationalStatus') ?? '')) query.set('operationalStatus', params.get('operationalStatus')!);
  for (const key of kind === 'board' ? ['roomId', 'roomTypeId', 'assignedStaffId'] : ['roomId', 'assignedStaffId']) { const value = params.get(key); if (value && z.string().uuid().safeParse(value).success) query.set(key, value); }
  return query.toString();
}
export function housekeepingError(error: Error, action = '') {
  if (error instanceof ApiError && error.status === 409) return action === 'create' ? 'Phòng đã có công việc đang mở hoặc trạng thái vừa thay đổi. Hãy tải lại board và kiểm tra lịch sử trước khi tạo lại.' : 'Công việc đã thay đổi hoặc không còn đủ điều kiện. Dữ liệu mới đang được tải lại; hãy kiểm tra trạng thái và người được giao.';
  if (error instanceof ApiError && error.status === 400 && action === 'assign') return 'Không thể phân công. Nhân viên phải có vai trò HOUSEKEEPING và tài khoản ACTIVE.';
  if (error instanceof ApiError && (error.status === 0 || error.status >= 500)) return 'Chưa rõ thao tác đã thành công hay chưa. Hãy làm mới board hoặc công việc trước khi gửi lại.';
  return error.message;
}
export function workTime(value: string) { return new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Bangkok' }); }
