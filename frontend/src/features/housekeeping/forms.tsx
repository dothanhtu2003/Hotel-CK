import { Trans } from "react-i18next";
import { catalogName } from "../../i18n/catalog";
import { t as tr, useLocale } from "../../i18n";
import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { useForm } from "../../i18n/forms";
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Dialog, FormField, ErrorState } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../auth/auth-context';
import { assignTaskSchema, canAssign, createTaskSchema, housekeepingError, managesHousekeeping, type AssignTaskInput, type BoardRoom, type CreateTaskInput, type Task } from './contracts';
import { useHousekeepingGet, useWorkMutation } from './queries';

export function CreateTaskDialog({ room, onClose }: { room: BoardRoom; onClose: () => void }) {
  useLocale();
  const { user } = useAuth(), form = useForm<CreateTaskInput>({ resolver: zodResolver(createTaskSchema), defaultValues: { roomId: room.id, notes: '' } });
  const mutation = useWorkMutation('create', () => (tr("housekeeping:forms.cleaningTaskCreated")), (v: CreateTaskInput) => api.request<Task>('/housekeeping/tasks', { method: 'POST', body: { roomId: v.roomId, ...(v.notes ? { notes: v.notes } : {}) } }), onClose);
  if (!user || !managesHousekeeping(user.role)) return null;
  return <Dialog open onClose={() => { if (!mutation.locked()) onClose(); }} title={tr("housekeeping:forms.createCleaningTask")}><p>{tr("housekeeping:forms.roomValueValueCreateOnlyIfThereIsNoOpenTask", { value0: (room.roomNumber), value1: (catalogName(room.roomType.name)) })}</p><form noValidate onSubmit={form.handleSubmit(v => mutation.run(v))} className="hk-form"><FormField name="task-notes" label={tr("housekeeping:forms.taskNotes")} error={form.formState.errors.notes?.message} hint={tr("housekeeping:forms.optionalMaximum2000Characters")}><textarea id="task-notes" className="input" rows={4} {...form.register('notes')} aria-invalid={!!form.formState.errors.notes} aria-describedby="task-notes-hint task-notes-error" disabled={mutation.isPending} /></FormField>{mutation.error && <p className="form-error" role="alert">{housekeepingError(mutation.error, 'create')}</p>}<div className="dialog-actions"><Button type="button" variant="secondary" disabled={mutation.isPending} onClick={onClose}>{tr("housekeeping:components.back")}</Button><Button type="submit" busy={mutation.isPending} disabled={!!mutation.error || !!room.openTask}>{tr("housekeeping:forms.confirmTaskCreation")}</Button></div></form></Dialog>;
}
export function AssignTaskForm({ task }: { task: Task }) {
  useLocale();
  const assigned = Boolean(task.assignedStaffId);
  const [editing, setEditing] = useState(!assigned);
  const { user } = useAuth(),
    [review, setReview] = useState<AssignTaskInput | null>(null),
    form = useForm<AssignTaskInput>({
      resolver: zodResolver(assignTaskSchema),
      defaultValues: { assignedStaffId: '' },
    });
  const mutation = useWorkMutation(
    'assign',
    () => (tr("housekeeping:forms.taskAssigned")),
    (v: AssignTaskInput) =>
      api.request<Task>(`/housekeeping/tasks/${task.id}/assign`, {
        method: 'PATCH',
        body: { assignedStaffId: v.assignedStaffId },
      }),
    () => setReview(null),
  );
  const staff = useHousekeepingGet<
    { id: string; fullName: string; email: string }[]
  >('/housekeeping/staff', !!user && canAssign(task, user.role) && editing);
  const selected = staff.data?.find(
    (person) => person.id === review?.assignedStaffId,
  );
  if (!user || !canAssign(task, user.role)) return null;

  return (
    <section className="panel guest-box border border-zinc-200 rounded-xl bg-white p-5 shadow-2xs space-y-4">
      <div className="flex items-center gap-2 pb-3 border-b border-zinc-100">
        <UserPlus className="size-4 text-emerald-700" />
        <h2 className="text-sm font-bold text-zinc-900 m-0">{assigned ? tr("housekeeping:forms.currentAssignment") : tr("housekeeping:forms.assignStaff")}</h2>
      </div>
      {assigned && <p className="text-sm">
        {task.assignedStaff ? <Trans ns="common" i18nKey="supplement.assignmentAwaitingStart" values={{ value0: task.assignedStaff.fullName }} components={{ part0: <strong /> }} /> : tr("housekeeping:forms.awaitingStart")}</p>}
      {!editing ? (
        <Button type="button" variant="secondary" onClick={() => setEditing(true)}>{tr("housekeeping:forms.changeStaff")}</Button>
      ) : <>
      {staff.isPending ? (
        <p role="status" className="text-xs text-zinc-500">{tr("housekeeping:forms.loadingStaffList")}</p>
      ) : staff.error ? (
        <ErrorState
          message={tr("housekeeping:forms.unableToLoadStaffList")}
          retry={() => void staff.refetch()}
        />
      ) : !staff.data?.length ? (
        <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200">{tr("housekeeping:forms.thereAreNoActiveHousekeepingStaffMembers")}</p>
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
          label={tr("housekeeping:forms.housekeepingStaff")}
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
            <option value="">{tr("housekeeping:forms.selectStaff")}</option>
            {staff.data?.filter(person => person.id !== task.assignedStaffId).map((person) => (
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
        >{tr("housekeeping:forms.reviewAssignment")}</Button>
        {assigned && <Button type="button" variant="secondary" onClick={() => { form.reset(); setEditing(false); }}>{tr("housekeeping:components.back")}</Button>}
      </form>
      </>}
      <Dialog
        open={!!review}
        onClose={() => {
          if (!mutation.locked()) setReview(null);
        }}
        title={tr("housekeeping:forms.confirmAssignment")}
      >
        <p>{tr("housekeeping:forms.roomValueStaffValueValue", { value0: (task.room.roomNumber), value1: (selected?.fullName), value2: (selected?.email) })}</p>
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
          >{tr("housekeeping:components.back")}</Button>
          <Button
            busy={mutation.isPending}
            disabled={!!mutation.error || !selected}
            onClick={() => {
              if (review && selected) mutation.run(review);
            }}
          >{tr("housekeeping:forms.confirmAssignment")}</Button>
        </div>
      </Dialog>
    </section>
  );
}
