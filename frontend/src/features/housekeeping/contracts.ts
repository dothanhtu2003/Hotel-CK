import { displayLocale, errorToken, localized, message, safeError, t as tr } from "../../i18n";



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
export const cleaningLabels: Record<CleaningStatus, string> = localized(() => ({ CLEAN: tr("housekeeping:contracts.cleanRoom"), DIRTY: tr("housekeeping:contracts.needsCleaning"), CLEANING: tr("housekeeping:contracts.cleaning") }));
export const taskLabels: Record<TaskStatus, string> = localized(() => ({ TODO: tr("housekeeping:contracts.toDo"), IN_PROGRESS: tr("housekeeping:contracts.inProgress"), DONE: tr("housekeeping:contracts.completed") }));
export const createTaskSchema = z.object({ roomId: z.string().uuid({ error: () => tr("housekeeping:contracts.theRoomIdMustBeAValidUuid") }), notes: z.string().trim().max(2000, { error: () => tr("housekeeping:contracts.notesMustBe2000CharactersOrFewer") }).optional() });
export const assignTaskSchema = z.object({ assignedStaffId: z.string().trim().uuid({ error: () => tr("housekeeping:contracts.pleaseSelectAHousekeepingStaffMember") }) });
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
export function housekeepingError(error: Error, action = '', token = false) {
  const translate = token ? message : tr;
  if (error instanceof ApiError && error.status === 409) return action === 'create' ? translate("housekeeping:contracts.theRoomAlreadyHasAnOpenTaskOrItsStateHasChanged") : translate("housekeeping:contracts.theTaskChangedOrIsNoLongerEligibleUpdatedDataIsLoading");
  if (error instanceof ApiError && error.status === 400 && action === 'assign') return translate("housekeeping:contracts.unableToAssignTheAssigneeMustBeActiveHousekeepingStaff");
  if (error instanceof ApiError && (error.status === 0 || error.status >= 500)) return translate("housekeeping:contracts.theOutcomeIsUncertainRefreshTheBoardOrTaskBeforeSubmittingAgain");
  return token ? errorToken(error) : safeError(error);
}
export function workTime(value: string) { return new Date(value).toLocaleString(displayLocale(), { timeZone: 'Asia/Ho_Chi_Minh' }); }
export function cleanRoomTypeName(name: string) { return name.replace(/^TEST[\s\-_]*\d{8}[\s\-_]*/i, '').trim() || name; }
export function formatTaskNotes(notes: string | null) {
  if (!notes) return null;
  if (notes.trim() === 'Dọn phòng sau chuyển phòng gia hạn') return tr("common:supplement.transferCleaning");
  if (notes.trim() === 'Vệ sinh phòng trước khi đón khách') return tr("common:supplement.arrivalCleaning");
  const trimmed = notes.trim();
  if (/^check-out cleaning$/i.test(trimmed)) return tr("housekeeping:contracts.checkOutCleaning");
  if (/^stayover cleaning$/i.test(trimmed)) return tr("housekeeping:contracts.stayoverCleaning");
  if (/^deep cleaning$/i.test(trimmed)) return tr("housekeeping:contracts.deepCleaning");
  return trimmed;
}
