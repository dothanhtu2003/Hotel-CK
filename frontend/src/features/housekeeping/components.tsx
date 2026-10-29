import { useState } from 'react';
import { Link } from 'react-router';
import { AlertCircle, CheckCircle2, Clock, Sparkles } from 'lucide-react';
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
          className={`panel hk-room hk-room-${r.housekeepingStatus.toLowerCase()}`}
          key={r.id}
        >
          <div className="guest-row">
            <h2>Phòng {r.roomNumber}</h2>
            <CleaningBadge status={r.housekeepingStatus} />
          </div>
          <p>
            {r.roomType.name} · Tầng {r.floor}
          </p>
          <p>
            Hoạt động:{' '}
            {r.operationalStatus === 'ACTIVE'
              ? 'Đang hoạt động'
              : 'Tạm ngừng phục vụ'}
          </p>
          {r.openTask ? (
            <div className="hk-open-task">
              <TaskBadge status={r.openTask.status} />
              <p>
                Phân công:{' '}
                {r.openTask.assignedStaff?.fullName ?? 'Chưa phân công'}
              </p>
              {r.openTask.notes && <p className="hk-notes">{r.openTask.notes}</p>}
              <Link
                className="button button-secondary hk-open-task-btn"
                to={`${base}/tasks/${r.openTask.id}`}
              >
                Xem công việc
              </Link>
            </div>
          ) : (
            <>
              <p>Chưa có công việc đang mở.</p>
              {onCreate && (
                <Button variant="secondary" onClick={() => onCreate(r)}>
                  Tạo công việc
                </Button>
              )}
            </>
          )}
          <Link
            className="text-link hk-history"
            to={`${base}/tasks?roomId=${r.id}`}
          >
            Lịch sử công việc →
          </Link>
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
