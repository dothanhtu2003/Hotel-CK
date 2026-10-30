import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { useAuth } from '../features/auth/auth-context';
import { Button, ErrorState, LinkButton, PageHeading, Pagination } from '../components/ui';
import { Skeleton } from '../features/guest/components';
import type { Page } from '../features/guest/contracts';
import { CleaningBadge, RoomBoard, TaskBadge, TaskTable, WorkAction } from '../features/housekeeping/components';
import { AssignTaskForm, CreateTaskDialog } from '../features/housekeeping/forms';
import { canAssign, cleaningLabels, cleaningStatuses, housekeepingParams, managesHousekeeping, taskLabels, taskStatuses, workTime, type BoardRoom, type Task } from '../features/housekeeping/contracts';
import { useHousekeepingBase, useHousekeepingGet } from '../features/housekeeping/queries';
import {
  AlertTriangle,
  ArrowLeft,
  BedDouble,
  Calendar,
  CheckCircle2,
  ClipboardList,
  FileText,
  RefreshCw,
  Sparkles,
  User,
  X,
} from 'lucide-react';

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

export function HousekeepingDashboard() {
  const { user } = useAuth(), todo = useHousekeepingGet<Page<Task>>('/housekeeping/tasks?status=TODO&page=1&pageSize=5'), progress = useHousekeepingGet<Page<Task>>('/housekeeping/tasks?status=IN_PROGRESS&page=1&pageSize=5');
  const dirty = useHousekeepingGet<Page<BoardRoom>>('/housekeeping/board?housekeepingStatus=DIRTY&page=1&pageSize=1'), cleaning = useHousekeepingGet<Page<BoardRoom>>('/housekeeping/board?housekeepingStatus=CLEANING&page=1&pageSize=1');
  const counts = [{ name: 'Công việc cần thực hiện', query: todo, to: '/housekeeping/tasks?status=TODO' }, { name: 'Công việc đang thực hiện', query: progress, to: '/housekeeping/tasks?status=IN_PROGRESS' }, { name: 'Phòng cần dọn được giao', query: dirty, to: '/housekeeping/board?housekeepingStatus=DIRTY' }, { name: 'Phòng đang dọn được giao', query: cleaning, to: '/housekeeping/board?housekeepingStatus=CLEANING' }];
  const refresh = () => counts.forEach(({ query }) => { void query.refetch(); });
  return <div className="hk-page"><PageHeading eyebrow="AN NHIÊN · HOUSEKEEPING" title="Chăm chút từng căn phòng." description="Chỉ hiển thị công việc được phân công cho bạn. Board chỉ gồm phòng có công việc đang mở của bạn." action={<Button variant="secondary" busy={counts.some(c => c.query.isFetching)} onClick={refresh}>Làm mới dữ liệu</Button>} /><div className="desk-stats">{counts.map(c => <Link to={c.to} className="panel" key={c.name}><span>{c.name}</span><strong>{c.query.isPending ? '…' : c.query.data?.meta.total.toLocaleString('vi-VN') ?? '—'}</strong><small>Tổng trong phạm vi được giao</small></Link>)}</div>{counts.some(c => c.query.error) && <ErrorState message="Chưa tải được một phần công việc. Dấu — biểu thị dữ liệu chưa có." retry={refresh} />}<section className="panel desk-panel"><div className="panel-heading"><h2>Cần thực hiện</h2><Link to="/housekeeping/tasks?status=TODO">Xem tất cả →</Link></div>{todo.isPending ? <Skeleton /> : todo.error ? <ErrorState message={todo.error.message} retry={() => void todo.refetch()} /> : <TaskTable tasks={todo.data!.data} />}<p className="panel-footnote">Hiển thị tối đa 5 công việc mới nhất trong trạng thái này.</p></section><section className="panel desk-panel"><div className="panel-heading"><h2>Đang thực hiện</h2><Link to="/housekeeping/tasks?status=IN_PROGRESS">Xem tất cả →</Link></div>{progress.isPending ? <Skeleton /> : progress.error ? <ErrorState message={progress.error.message} retry={() => void progress.refetch()} /> : <TaskTable tasks={progress.data!.data} />}</section><section className="panel guest-box"><h2>Thông tin phân công của bạn</h2><p>Nhân viên: {user?.fullName}</p><p>Lễ tân hoặc quản trị viên có thể chọn tên bạn trong danh sách nhân viên khi phân công.</p><LinkButton to="/housekeeping/board" variant="secondary">Mở board phòng</LinkButton></section></div>;
}

export function HousekeepingBoardPage() {
  const { user } = useAuth(),
    [params, setParams] = useSearchParams(),
    base = useHousekeepingBase(),
    manager = !!user && managesHousekeeping(user.role),
    query = useHousekeepingGet<Page<BoardRoom>>(
      '/housekeeping/board?' + housekeepingParams(params, 'board'),
    ),
    [creating, setCreating] = useState<BoardRoom | null>(null);
  const status = params.get('housekeepingStatus') ?? '',
    operational = params.get('operationalStatus') ?? '';

  function filter(key: string, value: string) {
    const next = new URLSearchParams(params);
    next.delete('page');
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  }

  return (
    <div className="hk-page">
      {/* Compact Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-zinc-900">
              Board buồng phòng
            </h1>
            <span className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">
              <Sparkles className="size-3" />
              {manager ? 'Housekeeping' : 'Công việc được giao'}
            </span>
            {query.data?.meta && (
              <span className="text-xs text-zinc-400 font-medium">
                · {query.data.meta.total} phòng
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">
            {manager
              ? 'Theo dõi vệ sinh phòng, tạo và phân công công việc theo dữ liệu thời gian thực.'
              : 'Những phòng có công việc đang mở được phân công cho bạn.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
            className="h-8.5 px-3 text-xs font-medium rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
          >
            <RefreshCw
              className={`size-3.5 ${query.isFetching ? 'animate-spin' : ''}`}
            />
            Làm mới board
          </button>
          <Link
            to={`${base}/tasks`}
            className="h-8.5 px-3 text-xs font-medium rounded-lg bg-brand-700 hover:bg-brand-800 text-white transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
          >
            <ClipboardList className="size-3.5" />
            {manager ? 'Lịch sử công việc' : 'Công việc của tôi'}
          </Link>
        </div>
      </div>

      {/* Unified Compact Toolbar: Status Filter Pills + Operational Filter */}
      <div className="rounded-xl border border-zinc-200 bg-white p-2 shadow-2xs mb-4 flex flex-wrap items-center justify-between gap-2.5">
        {/* Quick Filter Pills */}
        <div
          className="flex flex-wrap items-center gap-1.5"
          role="group"
          aria-label="Bộ lọc trạng thái phòng"
        >
          <button
            type="button"
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
              !status
                ? 'bg-zinc-900 text-white font-semibold shadow-2xs'
                : 'text-zinc-600 hover:bg-zinc-100'
            }`}
            onClick={() => filter('housekeepingStatus', '')}
          >
            Tất cả phòng
          </button>
          <button
            type="button"
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
              status === 'DIRTY'
                ? 'bg-orange-50 text-orange-800 font-semibold border border-orange-200 shadow-2xs'
                : 'text-zinc-600 hover:bg-zinc-100'
            }`}
            onClick={() => filter('housekeepingStatus', 'DIRTY')}
          >
            <span className="size-2 rounded-full bg-orange-500 shrink-0" />
            Cần dọn (Dirty)
          </button>
          <button
            type="button"
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
              status === 'CLEANING'
                ? 'bg-amber-50 text-amber-800 font-semibold border border-amber-200 shadow-2xs'
                : 'text-zinc-600 hover:bg-zinc-100'
            }`}
            onClick={() => filter('housekeepingStatus', 'CLEANING')}
          >
            <span className="size-2 rounded-full bg-amber-400 shrink-0" />
            Đang dọn (Cleaning)
          </button>
          <button
            type="button"
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
              status === 'CLEAN'
                ? 'bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200 shadow-2xs'
                : 'text-zinc-600 hover:bg-zinc-100'
            }`}
            onClick={() => filter('housekeepingStatus', 'CLEAN')}
          >
            <span className="size-2 rounded-full bg-emerald-500 shrink-0" />
            Sạch (Clean)
          </button>
        </div>

        {/* Operational Filter & Reset */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <label
              htmlFor="operational-filter"
              className="text-xs text-zinc-500 whitespace-nowrap"
            >
              Hoạt động:
            </label>
            <select
              id="operational-filter"
              value={
                ['ACTIVE', 'OUT_OF_SERVICE'].includes(operational)
                  ? operational
                  : ''
              }
              onChange={(e) => filter('operationalStatus', e.target.value)}
              className="h-8 px-2.5 text-xs border border-zinc-200 rounded-lg bg-zinc-50/50 focus:bg-white focus:border-brand-600 focus:outline-none transition-colors text-zinc-700 cursor-pointer"
            >
              <option value="">Tất cả</option>
              <option value="ACTIVE">Đang hoạt động</option>
              <option value="OUT_OF_SERVICE">Tạm ngừng phục vụ</option>
            </select>
          </div>

          <select
            id="cleaning-filter"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            value={
              cleaningStatuses.includes(
                status as BoardRoom['housekeepingStatus'],
              )
                ? status
                : ''
            }
            onChange={(e) => filter('housekeepingStatus', e.target.value)}
          >
            <option value="">Tất cả trạng thái</option>
            {cleaningStatuses.map((s) => (
              <option key={s} value={s}>
                {cleaningLabels[s]}
              </option>
            ))}
          </select>

          {(status || operational) && (
            <button
              type="button"
              className="h-8 px-2.5 text-xs font-medium rounded-lg border border-zinc-200 hover:bg-zinc-100 text-zinc-600 transition-colors cursor-pointer inline-flex items-center gap-1"
              onClick={() => {
                const next = new URLSearchParams(params);
                [
                  'housekeepingStatus',
                  'operationalStatus',
                  'page',
                ].forEach((k) => next.delete(k));
                setParams(next);
              }}
            >
              <X className="size-3" /> Xóa lọc
            </button>
          )}
        </div>
      </div>

      {query.isPending ? (
        <Skeleton />
      ) : query.error ? (
        <ErrorState
          message={query.error.message}
          retry={() => void query.refetch()}
        />
      ) : (
        <>
          <RoomBoard
            rooms={query.data!.data}
            onCreate={manager ? setCreating : undefined}
          />
          <Pagination
            {...query.data!.meta}
            onChange={(p) => {
              const next = new URLSearchParams(params);
              next.set('page', String(p));
              setParams(next);
            }}
          />
        </>
      )}
      {creating && (
        <CreateTaskDialog
          key={creating.id}
          room={creating}
          onClose={() => setCreating(null)}
        />
      )}
    </div>
  );
}

export function HousekeepingTasksPage() {
  const { user } = useAuth(),
    base = useHousekeepingBase(),
    [params, setParams] = useSearchParams(),
    query = useHousekeepingGet<Page<Task>>(
      '/housekeeping/tasks?' + housekeepingParams(params, 'tasks', 10),
    );
  const status = params.get('status') ?? '',
    roomId = new URLSearchParams(
      housekeepingParams(params, 'tasks', 10),
    ).get('roomId');

  return (
    <div className="hk-page">
      {/* Compact Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-zinc-900">
              {user && managesHousekeeping(user.role)
                ? 'Lịch sử công việc buồng phòng'
                : 'Công việc của tôi'}
            </h1>
            <span className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">
              <ClipboardList className="size-3" />
              Công việc
            </span>
            {roomId && (
              <span className="inline-flex items-center gap-1 text-xs text-brand-700 bg-brand-50 border border-brand-200 px-2 py-0.5 rounded-md">
                Phòng: {roomId.slice(0, 8)}
                <Link
                  to={`${base}/tasks`}
                  className="ml-1 text-zinc-400 hover:text-zinc-700 font-bold"
                >
                  ✕
                </Link>
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">
            Theo dõi ghi chú, trạng thái và thời điểm hoàn thành theo thời gian thực.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
            className="h-8.5 px-3 text-xs font-medium rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
          >
            <RefreshCw
              className={`size-3.5 ${query.isFetching ? 'animate-spin' : ''}`}
            />
            Làm mới công việc
          </button>
          <Link
            to={base === '/housekeeping' ? base + '/board' : base}
            className="h-8.5 px-3 text-xs font-medium rounded-lg bg-brand-700 hover:bg-brand-800 text-white transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
          >
            Board phòng
          </Link>
        </div>
      </div>

      {/* Unified Compact Toolbar */}
      <div className="rounded-xl border border-zinc-200 bg-white p-2 shadow-2xs mb-4 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <label
            htmlFor="task-status-filter"
            className="text-xs text-zinc-500 whitespace-nowrap"
          >
            Trạng thái:
          </label>
          <select
            id="task-status-filter"
            value={
              taskStatuses.includes(status as Task['status']) ? status : ''
            }
            onChange={(e) => {
              const next = new URLSearchParams(params);
              next.delete('page');
              if (e.target.value) next.set('status', e.target.value);
              else next.delete('status');
              setParams(next);
            }}
            className="h-8 px-2.5 text-xs border border-zinc-200 rounded-lg bg-zinc-50/50 focus:bg-white focus:border-brand-600 focus:outline-none transition-colors text-zinc-700 cursor-pointer"
          >
            <option value="">Tất cả trạng thái</option>
            {taskStatuses.map((s) => (
              <option key={s} value={s}>
                {taskLabels[s]}
              </option>
            ))}
          </select>
        </div>

        {status && (
          <button
            type="button"
            className="h-8 px-2.5 text-xs font-medium rounded-lg border border-zinc-200 hover:bg-zinc-100 text-zinc-600 transition-colors cursor-pointer inline-flex items-center gap-1"
            onClick={() => {
              const next = new URLSearchParams(params);
              next.delete('status');
              next.delete('page');
              setParams(next);
            }}
          >
            <X className="size-3" /> Xóa lọc
          </button>
        )}
      </div>

      <section className="panel desk-panel">
        {query.isPending ? (
          <Skeleton />
        ) : query.error ? (
          <ErrorState
            message={query.error.message}
            retry={() => void query.refetch()}
          />
        ) : (
          <>
            <TaskTable tasks={query.data!.data} />
            <Pagination
              {...query.data!.meta}
              onChange={(p) => {
                const next = new URLSearchParams(params);
                next.set('page', String(p));
                setParams(next);
              }}
            />
          </>
        )}
      </section>
    </div>
  );
}

export function HousekeepingTaskDetailPage() {
  const { id = '' } = useParams(),
    base = useHousekeepingBase(),
    { user } = useAuth(),
    query = useHousekeepingGet<Task>('/housekeeping/tasks/' + id);

  if (query.isPending) return <Skeleton />;
  if (query.error)
    return (
      <ErrorState
        message={query.error.message}
        retry={() => void query.refetch()}
      />
    );

  const task = query.data!;
  const canAssignStaff = !!user && canAssign(task, user.role);

  return (
    <div className="hk-page space-y-4 max-w-5xl mx-auto pb-10">
      {/* Top Breadcrumb & Header */}
      <div>
        <Link
          className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900 transition-colors mb-2.5"
          to={`${base}/tasks`}
        >
          <ArrowLeft className="size-3.5" /> Danh sách công việc
        </Link>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-800">
              <Sparkles className="size-3.5 text-emerald-700" />
              Chi tiết công việc buồng phòng
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 mt-1">
              Dọn phòng {task.room.roomNumber}
            </h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              Theo dõi tiến độ, phân công nhân viên và xác nhận hoàn tất vệ sinh phòng.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={query.isFetching}
              onClick={() => void query.refetch()}
              className="h-8.5 px-3 text-xs font-medium rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
            >
              <RefreshCw
                className={`size-3.5 ${query.isFetching ? 'animate-spin' : ''}`}
              />
              Làm mới chi tiết
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Details on Left (7 cols), Assignment on Right (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Task Details & Work Action */}
        <div
          className={
            canAssignStaff
              ? 'lg:col-span-7 space-y-4'
              : 'lg:col-span-12 space-y-4'
          }
        >
          <section className="panel guest-box border border-zinc-200 rounded-xl bg-white p-5 shadow-2xs space-y-4">
            {/* Statuses Header */}
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-zinc-500">
                  Trạng thái:
                </span>
                <TaskBadge status={task.status} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-zinc-500">
                  Phòng:
                </span>
                <CleaningBadge status={task.room.housekeepingStatus} />
              </div>
            </div>

            {/* Key-Value Details */}
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between py-1.5 border-b border-zinc-100">
                <span className="text-zinc-500 font-medium">Mã công việc</span>
                <span
                  className="font-mono text-zinc-700 bg-zinc-100 px-2 py-0.5 rounded text-[11px]"
                  title={task.id}
                >
                  {task.id.slice(0, 18)}...
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-zinc-100">
                <span className="text-zinc-500 font-medium">Phòng</span>
                <span className="font-semibold text-zinc-900 inline-flex items-center gap-1.5">
                  <BedDouble className="size-3.5 text-zinc-400" />
                  Phòng {task.room.roomNumber} · {cleanRoomTypeName(task.room.roomType.name)} · Tầng {task.room.floor}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-zinc-100">
                <span className="text-zinc-500 font-medium">
                  Trạng thái vận hành
                </span>
                {task.room.operationalStatus === 'ACTIVE' ? (
                  <span className="text-emerald-700 font-medium inline-flex items-center gap-1">
                    <span className="size-1.5 rounded-full bg-emerald-500" />
                    Đang hoạt động
                  </span>
                ) : (
                  <span className="text-rose-700 font-medium inline-flex items-center gap-1">
                    <AlertTriangle className="size-3 text-rose-500" />
                    Tạm ngừng phục vụ
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-zinc-100">
                <span className="text-zinc-500 font-medium">
                  Nhân viên phụ trách
                </span>
                {task.assignedStaff ? (
                  <span className="font-semibold text-zinc-900 inline-flex items-center gap-1">
                    <User className="size-3.5 text-zinc-400" />
                    {task.assignedStaff.fullName}
                  </span>
                ) : (
                  <span className="text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-[11px] font-medium">
                    Chưa phân công
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-zinc-100">
                <span className="text-zinc-500 font-medium">Thời gian tạo</span>
                <span className="text-zinc-700 tabular-nums inline-flex items-center gap-1">
                  <Calendar className="size-3 text-zinc-400" />
                  {workTime(task.createdAt)}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-zinc-500 font-medium">
                  Thời gian hoàn thành
                </span>
                <span className="text-zinc-700 tabular-nums">
                  {task.completedAt ? (
                    <span className="text-emerald-700 font-medium inline-flex items-center gap-1">
                      <CheckCircle2 className="size-3.5 text-emerald-600" />
                      {workTime(task.completedAt)}
                    </span>
                  ) : (
                    <span className="text-zinc-400 italic">Chưa hoàn thành</span>
                  )}
                </span>
              </div>
            </div>

            {/* Note Highlight Box */}
            <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-3.5 space-y-1">
              <span className="text-[11px] font-bold text-zinc-500 flex items-center gap-1.5 uppercase tracking-wider">
                <FileText className="size-3 text-zinc-400" />
                Ghi chú công việc
              </span>
              <p className="text-xs font-medium text-zinc-800 m-0 leading-relaxed">
                {formatTaskNotes(task.notes) || 'Không có ghi chú.'}
              </p>
            </div>

            {/* Work Actions if eligible */}
            <div className="pt-2 flex flex-wrap gap-2">
              <WorkAction key={id + '-start'} task={task} action="start" />
              <WorkAction key={id + '-complete'} task={task} action="complete" />
            </div>
          </section>
        </div>

        {/* Right Column: Assign Staff Form */}
        {canAssignStaff && (
          <div className="lg:col-span-5">
            <AssignTaskForm
              key={`${task.id}:${task.assignedStaffId ?? 'unassigned'}`}
              task={task}
            />
          </div>
        )}
      </div>
    </div>
  );
}
