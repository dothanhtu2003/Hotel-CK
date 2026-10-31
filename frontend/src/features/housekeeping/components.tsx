import React, { useState } from 'react';
import { Link } from 'react-router';
import {
  AlertCircle,
  AlertTriangle,
  BedDouble,
  CheckCircle2,
  ClipboardList,
  Clock,
  Layers,
  Play,
  Plus,
  Sparkles,
  User,
} from 'lucide-react';
import { Button, Dialog, EmptyState, StatusBadge, Table } from '../../components/ui';
import { useAuth } from '../auth/auth-context';
import { api } from '../../lib/api';
import {
  canWork,
  cleaningLabels,
  cleanRoomTypeName,
  formatTaskNotes,
  housekeepingError,
  taskLabels,
  workTime,
  type BoardRoom,
  type CleaningStatus,
  type Task,
  type TaskStatus,
} from './contracts';
import { useHousekeepingBase, useWorkMutation } from './queries';
import './housekeeping.css';

export function CleaningBadge({ status }: { status: CleaningStatus }) {
  const tone =
    status === 'CLEAN' ? 'success' : status === 'CLEANING' ? 'gold' : 'muted';
  const Icon =
    status === 'CLEAN'
      ? CheckCircle2
      : status === 'CLEANING'
        ? Sparkles
        : AlertCircle;

  return (
    <StatusBadge tone={tone}>
      <Icon size={12} className="status-badge-icon" aria-hidden="true" />
      {cleaningLabels[status]}
    </StatusBadge>
  );
}

export function TaskBadge({ status }: { status: TaskStatus }) {
  const tone =
    status === 'DONE' ? 'success' : status === 'IN_PROGRESS' ? 'gold' : 'muted';
  const Icon =
    status === 'DONE'
      ? CheckCircle2
      : status === 'IN_PROGRESS'
        ? Sparkles
        : Clock;

  return (
    <StatusBadge tone={tone}>
      <Icon size={12} className="status-badge-icon" aria-hidden="true" />
      {taskLabels[status]}
    </StatusBadge>
  );
}

export function WorkAction({
  task,
  action,
  customLabel,
  className,
  variant,
  icon,
}: {
  task: Task;
  action: 'start' | 'complete';
  customLabel?: string;
  className?: string;
  variant?: 'primary' | 'secondary' | 'light' | 'ghost';
  icon?: React.ReactNode;
}) {
  const { user } = useAuth(),
    [open, setOpen] = useState(false),
    label = customLabel || (action === 'start' ? 'Bắt đầu dọn phòng' : 'Hoàn thành dọn phòng');
  const mutation = useWorkMutation(
    action,
    action === 'start'
      ? 'Đã bắt đầu công việc. Trạng thái phòng được cập nhật từ hệ thống.'
      : 'Đã hoàn thành công việc. Phòng sạch được xác nhận từ hệ thống.',
    () =>
      api.request<Task>(`/housekeeping/tasks/${task.id}/${action}`, {
        method: 'PATCH',
      }),
    () => setOpen(false),
  );
  if (!user || !canWork(task, user, action)) return null;
  return (
    <>
      <Button
        variant={variant}
        busy={mutation.isPending}
        onClick={() => {
          mutation.reset();
          setOpen(true);
        }}
        className={className || 'hk-action-btn'}
      >
        {icon}
        {label}
      </Button>
      <Dialog
        open={open}
        onClose={() => {
          if (!mutation.locked()) setOpen(false);
        }}
        title={(customLabel || (action === 'start' ? 'Bắt đầu dọn phòng' : 'Hoàn thành dọn phòng')) + '?'}
      >
        <div className="space-y-3">
          <div className="rounded-lg bg-zinc-50 border border-zinc-200 p-3 flex items-center justify-between">
            <span className="font-bold text-zinc-900 text-sm">
              Phòng {task.room.roomNumber}
            </span>
            <span className="text-xs text-zinc-500">
              {cleanRoomTypeName(task.room.roomType.name)} · Tầng {task.room.floor}
            </span>
          </div>
          <p className="text-xs text-zinc-600 leading-relaxed">
            {action === 'start'
              ? 'Xác nhận bạn bắt đầu ca vệ sinh căn phòng này. Hệ thống sẽ cập nhật trạng thái phòng sang "Đang dọn" để Lễ tân nắm thông tin.'
              : 'Xác nhận bạn đã vệ sinh sạch sẽ, thay đồ dùng và kiểm tra đầy đủ. Hệ thống sẽ cập nhật phòng sang "Phòng sạch" sẵn sàng đón khách.'}
          </p>
        </div>
        {mutation.error && (
          <p className="form-error mt-3" role="alert">
            {housekeepingError(mutation.error, action)}
          </p>
        )}
        <div className="dialog-actions mt-4">
          <Button
            variant="secondary"
            disabled={mutation.isPending}
            onClick={() => setOpen(false)}
          >
            Quay lại
          </Button>
          <Button
            busy={mutation.isPending}
            disabled={!!mutation.error}
            onClick={() => mutation.run(undefined)}
          >
            Xác nhận {action === 'start' ? 'bắt đầu dọn' : 'hoàn thành dọn'}
          </Button>
        </div>
      </Dialog>
    </>
  );
}

export function RoomBoard({
  rooms,
  onCreate,
}: {
  rooms: BoardRoom[];
  onCreate?: (room: BoardRoom) => void;
}) {
  const base = useHousekeepingBase();
  return rooms.length ? (
    <div className="hk-room-grid">
      {rooms.map((r) => {
        const fullTask: Task | null = r.openTask ? { ...r.openTask, room: r } : null;
        return (
          <article
            className={`hk-card hk-room hk-room-${r.housekeepingStatus.toLowerCase()} hk-card-${r.housekeepingStatus.toLowerCase()}`}
            key={r.id}
          >
            {/* Card Header: Room Number + Floor/Type + Status Badge */}
            <div className="hk-card-header">
              <div className="hk-card-room-info">
                <div className="hk-card-room-number">
                  <h2>Phòng {r.roomNumber}</h2>
                </div>
                <div className="hk-card-tags">
                  <span className="hk-tag hk-tag-floor">
                    <Layers className="size-3 text-zinc-400" />
                    Tầng {r.floor}
                  </span>
                  <span className="hk-tag hk-tag-type">
                    <BedDouble className="size-3 text-zinc-400" />
                    {cleanRoomTypeName(r.roomType.name)}
                  </span>
                  {r.operationalStatus === 'OUT_OF_SERVICE' ? (
                    <span className="hk-tag hk-tag-oos">
                      <AlertTriangle className="size-3 text-rose-500" />
                      Tạm ngừng
                    </span>
                  ) : (
                    <span className="sr-only">Hoạt động: Đang hoạt động</span>
                  )}
                </div>
              </div>
              <div className="hk-card-status">
                <CleaningBadge status={r.housekeepingStatus} />
              </div>
            </div>

            {/* Card Body: Task details OR Ready state */}
            <div className="hk-card-body">
              {r.openTask ? (
                <div className="hk-task-badge-box">
                  <div className="hk-task-header-row">
                    <TaskBadge status={r.openTask.status} />
                    {r.openTask.notes && (
                      <span className="hk-task-note-pill">
                        {formatTaskNotes(r.openTask.notes)}
                      </span>
                    )}
                  </div>
                  <div className="hk-task-staff-row">
                    <User className="size-3.5 text-zinc-400 shrink-0" />
                    <span className="hk-staff-label">Phân công:</span>
                    {r.openTask.assignedStaff ? (
                      <span className="hk-staff-name">
                        {r.openTask.assignedStaff.fullName}
                      </span>
                    ) : (
                      <span className="hk-staff-unassigned">Chưa phân công</span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="hk-ready-box">
                  <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                  <span>Chưa có công việc đang mở.</span>
                </div>
              )}
            </div>

            {/* Card Footer: Action Button & History Link */}
            <div className="hk-card-footer">
              {fullTask ? (
                <div className="flex flex-col gap-2 w-full">
                  {fullTask.status === 'TODO' && (
                    <WorkAction
                      task={fullTask}
                      action="start"
                      customLabel="Bắt đầu dọn phòng"
                      className="hk-btn-work-start"
                      icon={<Play className="size-3.5 fill-current" />}
                    />
                  )}
                  {fullTask.status === 'IN_PROGRESS' && (
                    <WorkAction
                      task={fullTask}
                      action="complete"
                      customLabel="Hoàn tất dọn phòng"
                      className="hk-btn-work-complete"
                      icon={<CheckCircle2 className="size-3.5" />}
                    />
                  )}
                  <Link
                    className="button button-secondary hk-btn-task"
                    to={`${base}/tasks/${r.openTask!.id}`}
                  >
                    <ClipboardList className="size-3.5" />
                    Chi tiết công việc
                  </Link>
                </div>
              ) : onCreate ? (
                <Button
                  variant="secondary"
                  className="hk-btn-create"
                  onClick={() => onCreate(r)}
                >
                  <Plus className="size-3.5" />
                  Tạo công việc
                </Button>
              ) : (
                <span className="hk-btn-placeholder" />
              )}

              <Link
                className="hk-history-link text-link hk-history"
                to={`${base}/tasks?roomId=${r.id}`}
              >
                Lịch sử công việc →
              </Link>
            </div>
          </article>
        );
      })}
    </div>
  ) : (
    <EmptyState
      title="Chưa có phòng phù hợp"
      description="Không có phòng trong phạm vi và bộ lọc hiện tại. Hãy thử trạng thái khác hoặc làm mới dữ liệu."
    />
  );
}

export function TaskTable({ tasks }: { tasks: Task[] }) {
  const base = useHousekeepingBase();
  return (
    <Table
      caption="Danh sách công việc buồng phòng"
      rows={tasks}
      rowKey={(t) => t.id}
      empty={
        <EmptyState
          title="Chưa có công việc phù hợp"
          description="Công việc được phân công sẽ xuất hiện tại đây. Hãy thử bộ lọc khác hoặc làm mới dữ liệu."
        />
      }
      columns={[
        {
          title: 'PHÒNG',
          render: (t) => (
            <Link className="text-link font-bold text-zinc-900" to={`${base}/tasks/${t.id}`}>
              Phòng {t.room.roomNumber}
              <span className="block text-[11px] font-normal text-zinc-500">
                Tầng {t.room.floor} · {cleanRoomTypeName(t.room.roomType.name)}
              </span>
            </Link>
          ),
        },
        {
          title: 'LOẠI CÔNG VIỆC / GHI CHÚ',
          render: (t) => (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium bg-zinc-100 text-zinc-700">
              {formatTaskNotes(t.notes) || 'Dọn phòng định kỳ'}
            </span>
          ),
        },
        {
          title: 'PHÂN CÔNG',
          render: (t) => t.assignedStaff?.fullName ?? 'Chưa phân công',
        },
        {
          title: 'TRẠNG THÁI',
          render: (t) => <TaskBadge status={t.status} />,
        },
        {
          title: 'TẠO LÚC',
          render: (t) => workTime(t.createdAt),
        },
        {
          title: 'HOÀN THÀNH LÚC',
          render: (t) =>
            t.completedAt ? (
              <span className="text-emerald-700 font-medium inline-flex items-center gap-1">
                <CheckCircle2 className="size-3.5 text-emerald-600" />
                {workTime(t.completedAt)}
              </span>
            ) : (
              <span className="text-zinc-400 italic">Chưa hoàn thành</span>
            ),
        },
        {
          title: 'THAO TÁC',
          render: (t) => (
            <div className="flex items-center gap-2">
              {t.status === 'TODO' && (
                <WorkAction
                  task={t}
                  action="start"
                  customLabel="Bắt đầu"
                  className="!min-h-[32px] !py-1 !px-2.5 !text-xs !bg-amber-600 hover:!bg-amber-700 !text-white !rounded-md"
                />
              )}
              {t.status === 'IN_PROGRESS' && (
                <WorkAction
                  task={t}
                  action="complete"
                  customLabel="Hoàn tất"
                  className="!min-h-[32px] !py-1 !px-2.5 !text-xs !bg-emerald-600 hover:!bg-emerald-700 !text-white !rounded-md"
                />
              )}
              <Link
                className="text-xs text-brand-700 hover:underline font-medium px-1.5 py-1"
                to={`${base}/tasks/${t.id}`}
              >
                Chi tiết →
              </Link>
            </div>
          ),
        },
      ]}
    />
  );
}
