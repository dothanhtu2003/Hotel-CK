import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Dialog, FormField, ErrorState } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../auth/auth-context';
import { assignTaskSchema, canAssign, createTaskSchema, housekeepingError, managesHousekeeping, type AssignTaskInput, type BoardRoom, type CreateTaskInput, type Task } from './contracts';
import { useHousekeepingGet, useWorkMutation } from './queries';

export function CreateTaskDialog({ room, onClose }: { room: BoardRoom; onClose: () => void }) {
  const { user } = useAuth(), form = useForm<CreateTaskInput>({ resolver: zodResolver(createTaskSchema), defaultValues: { roomId: room.id, notes: '' } });
  const mutation = useWorkMutation('create', 'Đã tạo công việc dọn phòng.', (v: CreateTaskInput) => api.request<Task>('/housekeeping/tasks', { method: 'POST', body: { roomId: v.roomId, ...(v.notes ? { notes: v.notes } : {}) } }), onClose);
  if (!user || !managesHousekeeping(user.role)) return null;
  return <Dialog open onClose={() => { if (!mutation.locked()) onClose(); }} title="Tạo công việc dọn phòng"><p>Phòng {room.roomNumber} · {room.roomType.name}. Chỉ tạo khi chưa có công việc đang mở.</p><form noValidate onSubmit={form.handleSubmit(v => mutation.run(v))} className="hk-form"><FormField name="task-notes" label="Ghi chú công việc" error={form.formState.errors.notes?.message} hint="Không bắt buộc. Tối đa 2000 ký tự."><textarea id="task-notes" className="input" rows={4} {...form.register('notes')} aria-invalid={!!form.formState.errors.notes} aria-describedby="task-notes-hint task-notes-error" disabled={mutation.isPending} /></FormField>{mutation.error && <p className="form-error" role="alert">{housekeepingError(mutation.error, 'create')}</p>}<div className="dialog-actions"><Button type="button" variant="secondary" disabled={mutation.isPending} onClick={onClose}>Quay lại</Button><Button type="submit" busy={mutation.isPending} disabled={!!mutation.error || !!room.openTask}>Xác nhận tạo công việc</Button></div></form></Dialog>;
}
export function AssignTaskForm({ task }: { task: Task }) {
  const { user } = useAuth(),
    [review, setReview] = useState<AssignTaskInput | null>(null),
    form = useForm<AssignTaskInput>({
      resolver: zodResolver(assignTaskSchema),
      defaultValues: { assignedStaffId: task.assignedStaffId ?? '' },
    });
  const mutation = useWorkMutation(
    'assign',
    'Đã phân công công việc.',
    (v: AssignTaskInput) =>
      api.request<Task>(`/housekeeping/tasks/${task.id}/assign`, {
        method: 'PATCH',
        body: { assignedStaffId: v.assignedStaffId },
      }),
    () => setReview(null),
  );
  const staff = useHousekeepingGet<
    { id: string; fullName: string; email: string }[]
  >('/housekeeping/staff', !!user && canAssign(task, user.role));
  const selected = staff.data?.find(
    (person) => person.id === review?.assignedStaffId,
  );
  if (!user || !canAssign(task, user.role)) return null;

  return (
    <section className="panel guest-box border border-zinc-200 rounded-xl bg-white p-5 shadow-2xs space-y-4">
      <div className="flex items-center gap-2 pb-3 border-b border-zinc-100">
        <UserPlus className="size-4 text-emerald-700" />
        <h2 className="text-sm font-bold text-zinc-900 m-0">Phân công nhân viên</h2>
      </div>
      <p className="text-xs text-zinc-500 leading-relaxed m-0">
        Chọn nhân viên buồng phòng đang hoạt động. Chỉ công việc chưa bắt đầu mới được phân công hoặc phân công lại.
      </p>
      {staff.isPending ? (
        <p role="status" className="text-xs text-zinc-500">
          Đang tải danh sách nhân viên…
        </p>
      ) : staff.error ? (
        <ErrorState
          message="Không tải được danh sách nhân viên."
          retry={() => void staff.refetch()}
        />
      ) : !staff.data?.length ? (
        <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
          Chưa có nhân viên buồng phòng đang hoạt động.
        </p>
      ) : null}
      <form
        noValidate
        className="hk-form space-y-4"
        onSubmit={form.handleSubmit((v) => {
          mutation.reset();
          setReview(v);
        })}
      >
        <FormField
          name="assignee-id"
          label="Nhân viên buồng phòng"
          error={form.formState.errors.assignedStaffId?.message}
        >
          <select
            id="assignee-id"
            className="input text-xs h-9 w-full rounded-lg border-zinc-200 focus:border-brand-600 focus:outline-none"
            {...form.register('assignedStaffId', {
              onChange: () => mutation.reset(),
            })}
            aria-invalid={!!form.formState.errors.assignedStaffId}
            aria-describedby="assignee-id-error"
            disabled={mutation.isPending || !staff.data?.length}
          >
            <option value="">Chọn nhân viên</option>
            {staff.data?.map((person) => (
              <option key={person.id} value={person.id}>
                {person.fullName} — {person.email}
              </option>
            ))}
          </select>
        </FormField>
        <Button
          type="submit"
          variant="primary"
          className="w-full !h-9 !text-xs !font-semibold !bg-zinc-900 hover:!bg-zinc-800 !text-white"
          busy={mutation.isPending}
          disabled={!staff.data?.length || !!staff.error}
        >
          Xem lại phân công
        </Button>
      </form>
      <Dialog
        open={!!review}
        onClose={() => {
          if (!mutation.locked()) setReview(null);
        }}
        title="Xác nhận phân công"
      >
        <p>
          Phòng {task.room.roomNumber} · Nhân viên: {selected?.fullName} ({selected?.email})
        </p>
        {task.assignedStaff && (
          <p className="text-xs text-zinc-500">
            Thay thế phân công hiện tại cho {task.assignedStaff.fullName} nếu công việc vẫn ở trạng thái TODO.
          </p>
        )}
        {mutation.error && (
          <p className="form-error" role="alert">
            {housekeepingError(mutation.error, 'assign')}
          </p>
        )}
        <div className="dialog-actions">
          <Button
            disabled={mutation.isPending}
            variant="secondary"
            onClick={() => setReview(null)}
          >
            Quay lại
          </Button>
          <Button
            busy={mutation.isPending}
            disabled={!!mutation.error || !selected}
            onClick={() => {
              if (review && selected) mutation.run(review);
            }}
          >
            Xác nhận phân công
          </Button>
        </div>
      </Dialog>
    </section>
  );
}
