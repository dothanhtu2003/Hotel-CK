import { useState } from 'react';
import { Link } from 'react-router';
import {
  AlertCircle,
  AlertTriangle,
  BedDouble,
  CheckCircle2,
  ClipboardList,
  Clock,
  Layers,
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
  housekeepingError,
  taskLabels,
  workTime,
  type BoardRoom,
  type CleaningStatus,
  type Task,
  type TaskStatus,
} from './contracts';
import { useHousekeepingBase, useWorkMutation } from './queries';

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
}: {
  task: Task;
  action: 'start' | 'complete';
}) {
  const { user } = useAuth(),
    [open, setOpen] = useState(false),
    label = action === 'start' ? 'Bắt đầu dọn phòng' : 'Hoàn thành dọn phòng';
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
        busy={mutation.isPending}
        onClick={() => {
          mutation.reset();
          setOpen(true);
        }}
        className="hk-action-btn"
      >
        {label}
      </Button>
      <Dialog
        open={open}
        onClose={() => {
          if (!mutation.locked()) setOpen(false);
        }}
        title={label + '?'}
      >
        <p>
          Phòng {task.room.roomNumber} · {task.room.roomType.name}
        </p>
        <p>
          {action === 'start'
            ? 'Xác nhận bạn bắt đầu công việc được giao. Hệ thống sẽ cập nhật phòng sang đang dọn khi thành công.'
            : 'Xác nhận đã hoàn tất vệ sinh phòng. Hệ thống sẽ lưu thời điểm hoàn thành và cập nhật phòng sạch.'}
        </p>
        {mutation.error && (
          <p className="form-error" role="alert">
            {housekeepingError(mutation.error, action)}
          </p>
        )}
        <div className="dialog-actions">
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

function cleanRoomTypeName(name: string) {
  return name.replace(/^TEST[\s\-_]*\d{8}[\s\-_]*/i, '').trim() || name;
}

function formatTaskNotes(notes: string | null) {
  if (!notes) return null;
  const trimmed = notes.trim();
  if (/^check-out cleaning$/i.test(trimmed)) return 'Dọn phòng trả (Check-out)';
  if (/^stayover cleaning$/i.test(trimmed)) return 'Dọn phòng đang ở (Stayover)';
  if (/^deep cleaning$/i.test(trimmed)) return 'Tổng vệ sinh (Deep clean)';
  return trimmed;
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
      {rooms.map((r) => (
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
            {r.openTask ? (
              <Link
                className="button button-primary hk-btn-task"
                to={`${base}/tasks/${r.openTask.id}`}
              >
                <ClipboardList className="size-3.5" />
                Xem công việc
              </Link>
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
      ))}
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
            <Link className="text-link" to={`${base}/tasks/${t.id}`}>
              Phòng {t.room.roomNumber}
            </Link>
          ),
        },
        {
          title: 'GHI CHÚ',
          render: (t) => (
            <span className="hk-notes">{t.notes || 'Không có ghi chú'}</span>
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
            t.completedAt ? workTime(t.completedAt) : 'Chưa hoàn thành',
        },
        {
          title: 'CHI TIẾT',
          render: (t) => <Link to={`${base}/tasks/${t.id}`}>Xem công việc</Link>,
        },
      ]}
    />
  );
}
