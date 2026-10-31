import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { useAuth } from '../features/auth/auth-context';
import { ErrorState, Pagination } from '../components/ui';
import { Skeleton } from '../features/guest/components';
import type { Page } from '../features/guest/contracts';
import {
  CleaningBadge,
  RoomBoard,
  TaskBadge,
  TaskTable,
  WorkAction,
} from '../features/housekeeping/components';
import { AssignTaskForm, CreateTaskDialog } from '../features/housekeeping/forms';
import {
  canAssign,
  cleaningLabels,
  cleaningStatuses,
  cleanRoomTypeName,
  formatTaskNotes,
  housekeepingParams,
  managesHousekeeping,
  workTime,
  type BoardRoom,
  type Task,
} from '../features/housekeeping/contracts';
import { useHousekeepingBase, useHousekeepingGet } from '../features/housekeeping/queries';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BedDouble,
  Brush,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileText,
  Layers,
  LayoutGrid,
  List,
  Play,
  RefreshCw,
  Search,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import '../features/housekeeping/housekeeping.css';

export function HousekeepingDashboard() {
  const { user } = useAuth();
  const base = useHousekeepingBase();

  // Queries
  const todoQuery = useHousekeepingGet<Page<Task>>('/housekeeping/tasks?status=TODO&page=1&pageSize=50');
  const progressQuery = useHousekeepingGet<Page<Task>>('/housekeeping/tasks?status=IN_PROGRESS&page=1&pageSize=50');
  const doneQuery = useHousekeepingGet<Page<Task>>('/housekeeping/tasks?status=DONE&page=1&pageSize=50');
  const boardQuery = useHousekeepingGet<Page<BoardRoom>>('/housekeeping/board?page=1&pageSize=50');

  const allQueries = [todoQuery, progressQuery, doneQuery, boardQuery];
  const isFetching = allQueries.some((q) => q.isFetching);
  const isPending = todoQuery.isPending && progressQuery.isPending;
  const hasError = allQueries.some((q) => q.error);

  const refreshAll = () => {
    allQueries.forEach((q) => void q.refetch());
  };

  // State
  const [statusFilter, setStatusFilter] = useState<'ACTIVE' | 'IN_PROGRESS' | 'TODO' | 'DONE'>('ACTIVE');
  const [floorFilter, setFloorFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'CARDS' | 'TABLE'>('CARDS');

  // Counts
  const todoTasks = useMemo(() => todoQuery.data?.data ?? [], [todoQuery.data?.data]);
  const progressTasks = useMemo(() => progressQuery.data?.data ?? [], [progressQuery.data?.data]);
  const doneTasks = useMemo(() => doneQuery.data?.data ?? [], [doneQuery.data?.data]);

  const todoCount = todoQuery.data?.meta.total ?? todoTasks.length;
  const progressCount = progressQuery.data?.meta.total ?? progressTasks.length;
  const doneCount = doneQuery.data?.meta.total ?? doneTasks.length;

  const totalActive = todoCount + progressCount;
  const totalShift = todoCount + progressCount + doneCount;
  const percentComplete = totalShift > 0 ? Math.round((doneCount / totalShift) * 100) : 100;

  // Available floors
  const availableFloors = useMemo(() => {
    const floors = new Set<number>();
    [...progressTasks, ...todoTasks, ...doneTasks].forEach((t) => floors.add(t.room.floor));
    return Array.from(floors).sort((a, b) => a - b);
  }, [progressTasks, todoTasks, doneTasks]);

  // Filtered tasks for display
  const displayedTasks = useMemo(() => {
    let list: Task[] = [];
    if (statusFilter === 'ACTIVE') {
      list = [...progressTasks, ...todoTasks];
    } else if (statusFilter === 'IN_PROGRESS') {
      list = progressTasks;
    } else if (statusFilter === 'TODO') {
      list = todoTasks;
    } else if (statusFilter === 'DONE') {
      list = doneTasks;
    }

    if (floorFilter !== 'ALL') {
      list = list.filter((t) => String(t.room.floor) === floorFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (t) =>
          t.room.roomNumber.toLowerCase().includes(q) ||
          cleanRoomTypeName(t.room.roomType.name).toLowerCase().includes(q) ||
          (t.notes && t.notes.toLowerCase().includes(q)),
      );
    }

    return list;
  }, [statusFilter, floorFilter, searchQuery, progressTasks, todoTasks, doneTasks]);

  const todayStr = useMemo(() => {
    const now = new Date();
    return now.toLocaleDateString('vi-VN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }, []);

  return (
    <div className="hk-page-container space-y-6">
      {/* Top Shift Welcome Banner */}
      <div className="hk-welcome-card">
        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-900/80 text-emerald-200 border border-emerald-700/60 shadow-xs">
                <Sparkles className="size-3 text-amber-300" />
                Ca trực buồng phòng
              </span>
              <span className="text-xs text-emerald-200/70 font-medium">
                · {todayStr}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white m-0">
              Chào ca trực, {user?.fullName || 'nhân viên buồng phòng'} 👋
            </h1>
            <p className="text-xs sm:text-sm text-emerald-100/80 m-0 leading-relaxed">
              Theo dõi danh sách phòng được giao, cập nhật tiến độ vệ sinh và xác nhận hoàn tất theo thời gian thực.
            </p>
          </div>

          {/* Shift Progress Widget */}
          <div className="w-full lg:w-80 rounded-2xl bg-black/20 backdrop-blur-sm border border-white/10 p-4 space-y-3 shrink-0">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-emerald-100">
                Tiến độ dọn phòng ca hôm nay
              </span>
              <span className="font-mono font-bold text-amber-300">
                {percentComplete}%
              </span>
            </div>

            {/* Progress Bar */}
            <div className="h-2.5 w-full bg-black/40 rounded-full overflow-hidden p-0.5">
              <div
                className="h-full bg-gradient-to-r from-amber-400 via-emerald-400 to-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${percentComplete}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-emerald-200/90">
              <span>Đã hoàn thành: <strong>{doneCount}/{totalShift}</strong> phòng</span>
              <button
                type="button"
                disabled={isFetching}
                onClick={refreshAll}
                className="inline-flex items-center gap-1 text-xs text-amber-200 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`size-3 ${isFetching ? 'animate-spin' : ''}`} />
                Làm mới
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Interactive Operational KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Cần dọn ngay */}
        <button
          type="button"
          onClick={() => setStatusFilter('TODO')}
          className={`hk-stat-card ${statusFilter === 'TODO' ? 'active' : ''}`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Chờ dọn ngay
            </span>
            <span className="flex size-8 items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-200/70">
              <AlertCircle className="size-4" />
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-zinc-900 tracking-tight">
              {todoQuery.isPending ? '…' : todoCount}
            </div>
            <p className="text-[11px] text-zinc-400 mt-0.5 truncate">
              Chưa bắt đầu vệ sinh
            </p>
          </div>
          <div className="mt-2 pt-2 border-t border-zinc-100 flex items-center justify-between text-[11px]">
            <span className="text-amber-700 font-medium">Bấm để lọc</span>
            <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
          </div>
        </button>

        {/* Card 2: Đang dọn dẹp */}
        <button
          type="button"
          onClick={() => setStatusFilter('IN_PROGRESS')}
          className={`hk-stat-card ${statusFilter === 'IN_PROGRESS' ? 'active' : ''}`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Đang dọn dẹp
            </span>
            <span className="flex size-8 items-center justify-center rounded-xl bg-sky-50 text-sky-600 border border-sky-200/70">
              <Brush className="size-4" />
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-zinc-900 tracking-tight">
              {progressQuery.isPending ? '…' : progressCount}
            </div>
            <p className="text-[11px] text-zinc-400 mt-0.5 truncate">
              Đang tiến hành làm sạch
            </p>
          </div>
          <div className="mt-2 pt-2 border-t border-zinc-100 flex items-center justify-between text-[11px]">
            <span className="text-sky-700 font-medium">Bấm để lọc</span>
            <span className="size-2 rounded-full bg-sky-500 animate-pulse" />
          </div>
        </button>

        {/* Card 3: Đã hoàn thành */}
        <button
          type="button"
          onClick={() => setStatusFilter('DONE')}
          className={`hk-stat-card ${statusFilter === 'DONE' ? 'active' : ''}`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Đã hoàn thành
            </span>
            <span className="flex size-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200/70">
              <CheckCircle2 className="size-4" />
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-zinc-900 tracking-tight">
              {doneQuery.isPending ? '…' : doneCount}
            </div>
            <p className="text-[11px] text-zinc-400 mt-0.5 truncate">
              Phòng sạch sẵn sàng đón khách
            </p>
          </div>
          <div className="mt-2 pt-2 border-t border-zinc-100 flex items-center justify-between text-[11px]">
            <span className="text-emerald-700 font-medium">Bấm để lọc</span>
            <span className="size-2 rounded-full bg-emerald-500" />
          </div>
        </button>

        {/* Card 4: Tổng phân công ca */}
        <button
          type="button"
          onClick={() => setStatusFilter('ACTIVE')}
          className={`hk-stat-card ${statusFilter === 'ACTIVE' ? 'active' : ''}`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Tổng phòng ca trực
            </span>
            <span className="flex size-8 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700 border border-zinc-200">
              <BedDouble className="size-4" />
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-zinc-900 tracking-tight">
              {totalShift}
            </div>
            <p className="text-[11px] text-zinc-400 mt-0.5 truncate">
              {totalActive} phòng cần xử lý ngay
            </p>
          </div>
          <div className="mt-2 pt-2 border-t border-zinc-100 flex items-center justify-between text-[11px]">
            <span className="text-zinc-600 font-medium">Tất cả cần làm</span>
            <ArrowRight className="size-3 text-zinc-400" />
          </div>
        </button>
      </div>

      {/* Error alert if any query fails */}
      {hasError && (
        <ErrorState
          message="Không thể tải đầy đủ danh sách công việc. Vui lòng thử lại."
          retry={refreshAll}
        />
      )}

      {/* Main Operational Workspace Section */}
      <section className="bg-white rounded-2xl border border-zinc-200 shadow-xs overflow-hidden">
        {/* Workspace Toolbar Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-100 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Status Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 p-1 bg-zinc-100/80 rounded-xl border border-zinc-200/60">
              <button
                type="button"
                onClick={() => setStatusFilter('ACTIVE')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                  statusFilter === 'ACTIVE'
                    ? 'bg-white text-zinc-900 shadow-2xs'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                Tất cả cần làm
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-zinc-200 text-zinc-700 font-bold">
                  {totalActive}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('IN_PROGRESS')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                  statusFilter === 'IN_PROGRESS'
                    ? 'bg-sky-600 text-white shadow-2xs'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                <span className="size-2 rounded-full bg-sky-300 animate-pulse" />
                Đang dọn
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  statusFilter === 'IN_PROGRESS' ? 'bg-sky-700 text-sky-100' : 'bg-zinc-200 text-zinc-700'
                }`}>
                  {progressCount}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('TODO')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                  statusFilter === 'TODO'
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                <span className="size-2 rounded-full bg-amber-300" />
                Cần dọn
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  statusFilter === 'TODO' ? 'bg-amber-700 text-amber-100' : 'bg-zinc-200 text-zinc-700'
                }`}>
                  {todoCount}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('DONE')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                  statusFilter === 'DONE'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                <CheckCircle2 className="size-3 text-emerald-300" />
                Đã xong ca này
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  statusFilter === 'DONE' ? 'bg-emerald-700 text-emerald-100' : 'bg-zinc-200 text-zinc-700'
                }`}>
                  {doneCount}
                </span>
              </button>
            </div>

            {/* View Mode & Quick Link */}
            <div className="flex items-center gap-2 self-end md:self-auto">
              <div className="flex items-center bg-zinc-100 rounded-lg p-0.5 border border-zinc-200">
                <button
                  type="button"
                  title="Dạng thẻ phòng trực quan"
                  onClick={() => setViewMode('CARDS')}
                  className={`p-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                    viewMode === 'CARDS'
                      ? 'bg-white text-zinc-900 shadow-2xs'
                      : 'text-zinc-500 hover:text-zinc-800'
                  }`}
                >
                  <LayoutGrid className="size-4" />
                </button>
                <button
                  type="button"
                  title="Dạng danh sách thu gọn"
                  onClick={() => setViewMode('TABLE')}
                  className={`p-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                    viewMode === 'TABLE'
                      ? 'bg-white text-zinc-900 shadow-2xs'
                      : 'text-zinc-500 hover:text-zinc-800'
                  }`}
                >
                  <List className="size-4" />
                </button>
              </div>

              <Link
                to={`${base}/board`}
                className="h-8 px-3 rounded-lg text-xs font-medium border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 transition-colors inline-flex items-center gap-1.5 shadow-2xs"
              >
                <Brush className="size-3.5 text-zinc-400" />
                Sơ đồ phòng
              </Link>
            </div>
          </div>

          {/* Secondary Controls: Floor Selector & Room Search */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-zinc-100">
            {/* Floor Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium text-zinc-400 mr-1 flex items-center gap-1">
                <Layers className="size-3.5" />
                Tầng:
              </span>
              <button
                type="button"
                onClick={() => setFloorFilter('ALL')}
                className={`hk-floor-pill ${floorFilter === 'ALL' ? 'active' : ''}`}
              >
                Tất cả các tầng
              </button>
              {availableFloors.map((floor) => (
                <button
                  key={floor}
                  type="button"
                  onClick={() => setFloorFilter(String(floor))}
                  className={`hk-floor-pill ${floorFilter === String(floor) ? 'active' : ''}`}
                >
                  Tầng {floor}
                </button>
              ))}
            </div>

            {/* Room Search Input */}
            <div className="relative w-full sm:w-60">
              <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm nhanh số phòng…"
                className="h-8.5 w-full pl-8 pr-7 text-xs rounded-lg border border-zinc-200 bg-zinc-50/60 focus:bg-white focus:border-brand-600 focus:outline-none transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-4 sm:p-6 bg-zinc-50/50 min-h-[350px]">
          {isPending ? (
            <div className="p-6">
              <Skeleton />
            </div>
          ) : displayedTasks.length > 0 ? (
            viewMode === 'CARDS' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
                {displayedTasks.map((task) => {
                  const isCheckout = task.notes && /check-out/i.test(task.notes);
                  const isStayover = task.notes && /stayover/i.test(task.notes);
                  const isDeep = task.notes && /deep/i.test(task.notes);

                  return (
                    <article
                      key={task.id}
                      className={`hk-task-card ${
                        task.status === 'IN_PROGRESS'
                          ? 'status-progress border-sky-200 shadow-sm'
                          : task.status === 'TODO'
                          ? 'status-todo'
                          : 'status-done'
                      }`}
                    >
                      <div className="space-y-3.5">
                        {/* Card Header: Room number & Status badge */}
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-2xl font-bold tracking-tight text-zinc-900 m-0">
                                Phòng {task.room.roomNumber}
                              </h3>
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-md">
                                <Layers className="size-3 text-zinc-400" />
                                Tầng {task.room.floor}
                              </span>
                            </div>
                            <p className="text-xs text-zinc-500 font-medium mt-1 flex items-center gap-1">
                              <BedDouble className="size-3.5 text-zinc-400" />
                              {cleanRoomTypeName(task.room.roomType.name)}
                            </p>
                          </div>
                          <CleaningBadge status={task.room.housekeepingStatus} />
                        </div>

                        {/* Task Type / Urgency Pill */}
                        <div className="space-y-1.5">
                          {isCheckout ? (
                            <div className="hk-note-box priority flex items-center gap-2">
                              <Sparkles className="size-4 text-amber-600 shrink-0" />
                              <div>
                                <strong className="font-semibold block text-amber-900">
                                  Dọn phòng trả (Check-out)
                                </strong>
                                <span className="text-[11px] text-amber-700">
                                  Ưu tiên vệ sinh sớm để đón khách nhận phòng tiếp theo.
                                </span>
                              </div>
                            </div>
                          ) : isStayover ? (
                            <div className="hk-note-box flex items-center gap-2">
                              <Clock className="size-3.5 text-sky-600 shrink-0" />
                              <div>
                                <strong className="font-semibold block text-zinc-800">
                                  Dọn phòng đang ở (Stayover)
                                </strong>
                                <span className="text-[11px] text-zinc-500">
                                  Dọn nhẹ, thay ga giường và bổ sung đồ dùng amenities.
                                </span>
                              </div>
                            </div>
                          ) : isDeep ? (
                            <div className="hk-note-box flex items-center gap-2">
                              <Sparkles className="size-3.5 text-purple-600 shrink-0" />
                              <div>
                                <strong className="font-semibold block text-purple-900">
                                  Tổng vệ sinh (Deep clean)
                                </strong>
                                <span className="text-[11px] text-purple-700">
                                  Làm sạch kỹ toàn diện căn phòng.
                                </span>
                              </div>
                            </div>
                          ) : task.notes ? (
                            <div className="hk-note-box flex items-start gap-2">
                              <FileText className="size-3.5 text-zinc-400 mt-0.5 shrink-0" />
                              <span className="text-zinc-700 font-medium">
                                {task.notes}
                              </span>
                            </div>
                          ) : (
                            <div className="hk-note-box flex items-center gap-2 text-zinc-500">
                              <Brush className="size-3.5 text-zinc-400" />
                              <span>Dọn dẹp phòng tiêu chuẩn</span>
                            </div>
                          )}
                        </div>

                        {/* Timing / Staff info */}
                        <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-1">
                          <span>
                            {task.status === 'DONE' && task.completedAt ? (
                              <span className="text-emerald-700 font-medium inline-flex items-center gap-1">
                                <CheckCircle2 className="size-3" />
                                Xong lúc: {new Date(task.completedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            ) : task.status === 'IN_PROGRESS' ? (
                              <span className="text-sky-700 font-semibold inline-flex items-center gap-1">
                                <Clock className="size-3 animate-spin" />
                                Đang dọn dẹp…
                              </span>
                            ) : (
                              <span>Giao việc: {new Date(task.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                            )}
                          </span>
                          <TaskBadge status={task.status} />
                        </div>
                      </div>

                      {/* Card Footer: Direct One-Touch Action Buttons */}
                      <div className="pt-4 mt-4 border-t border-zinc-100 flex flex-col gap-2">
                        {task.status === 'TODO' && (
                          <WorkAction
                            task={task}
                            action="start"
                            customLabel="Bắt đầu dọn phòng"
                            className="hk-btn-work-start"
                            icon={<Play className="size-4 fill-current" />}
                          />
                        )}

                        {task.status === 'IN_PROGRESS' && (
                          <WorkAction
                            task={task}
                            action="complete"
                            customLabel="Hoàn tất & Phòng sạch"
                            className="hk-btn-work-complete"
                            icon={<CheckCircle2 className="size-4" />}
                          />
                        )}

                        {task.status === 'DONE' && (
                          <div className="w-full py-2.5 px-3 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-xs font-semibold text-center flex items-center justify-center gap-1.5">
                            <CheckCircle2 className="size-4 text-emerald-600" />
                            Đã hoàn thành sạch sẽ
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-1">
                          <Link
                            to={`${base}/tasks/${task.id}`}
                            className="text-xs font-medium text-brand-700 hover:text-brand-900 inline-flex items-center gap-1"
                          >
                            Chi tiết công việc <ArrowRight className="size-3" />
                          </Link>
                          <Link
                            to={`${base}/tasks?roomId=${task.roomId}`}
                            className="text-[11px] text-zinc-400 hover:text-zinc-600"
                          >
                            Lịch sử phòng
                          </Link>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden shadow-2xs">
                <TaskTable tasks={displayedTasks} />
              </div>
            )
          ) : totalActive === 0 && totalShift > 0 && statusFilter !== 'DONE' ? (
            /* Celebratory Finish State */
            <div className="p-10 text-center max-w-lg mx-auto bg-white rounded-2xl border border-emerald-200 shadow-sm space-y-4">
              <div className="size-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="size-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-zinc-900">
                  🎉 Tuyệt vời! Bạn đã hoàn thành tất cả phòng!
                </h3>
                <p className="text-xs text-zinc-600 leading-relaxed">
                  Tất cả {doneCount} phòng được giao trong ca trực đã được vệ sinh sạch sẽ và sẵn sàng đón khách. Cảm ơn sự tận tâm và chu đáo của bạn!
                </p>
              </div>
              <div className="pt-2 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setStatusFilter('DONE')}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white transition-colors cursor-pointer shadow-xs"
                >
                  Xem danh sách phòng đã dọn ({doneCount})
                </button>
                <button
                  type="button"
                  onClick={refreshAll}
                  className="px-4 py-2 rounded-xl text-xs font-medium border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 transition-colors cursor-pointer"
                >
                  Làm mới ca trực
                </button>
              </div>
            </div>
          ) : (
            /* Empty State */
            <div className="p-12 text-center max-w-md mx-auto space-y-3">
              <div className="size-14 rounded-2xl bg-zinc-100 text-zinc-400 flex items-center justify-center mx-auto">
                <ClipboardList className="size-6" />
              </div>
              <h3 className="text-base font-bold text-zinc-800">
                Chưa có phòng nào trong mục này
              </h3>
              <p className="text-xs text-zinc-500 leading-relaxed">
                {searchQuery || floorFilter !== 'ALL'
                  ? 'Không tìm thấy phòng phù hợp với bộ lọc hiện tại. Hãy thử chọn tất cả tầng hoặc xóa từ khóa tìm kiếm.'
                  : 'Hiện tại bạn chưa có phòng nào được phân công trong trạng thái này.'}
              </p>
              <div className="pt-1 flex items-center justify-center gap-2">
                {(searchQuery || floorFilter !== 'ALL') && (
                  <button
                    type="button"
                    onClick={() => {
                      setFloorFilter('ALL');
                      setSearchQuery('');
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-900 text-white"
                  >
                    Xóa bộ lọc
                  </button>
                )}
                <button
                  type="button"
                  onClick={refreshAll}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border border-zinc-200 hover:bg-zinc-50 text-zinc-700"
                >
                  Làm mới dữ liệu
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Quick Tips & Help Bar */}
      <div className="rounded-xl border border-zinc-200/80 bg-white p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-zinc-500">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-emerald-500" />
          <span>
            Nhân viên phụ trách: <strong className="text-zinc-800">{user?.fullName}</strong> ({user?.email})
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link to={`${base}/board`} className="text-brand-700 font-semibold hover:underline">
            Mở sơ đồ buồng phòng →
          </Link>
          <span className="text-zinc-300">·</span>
          <Link to={`${base}/tasks`} className="text-brand-700 font-semibold hover:underline">
            Xem lịch sử công việc →
          </Link>
        </div>
      </div>
    </div>
  );
}

export function HousekeepingBoardPage() {
  const { user } = useAuth(),
    [params, setParams] = useSearchParams(),
    base = useHousekeepingBase(),
    manager = !!user && managesHousekeeping(user.role),
    query = useHousekeepingGet<Page<BoardRoom>>(
      '/housekeeping/board?' + housekeepingParams(
        new URLSearchParams([...params].filter(([key, value]) => key !== 'housekeepingStatus' || value !== 'CLEAN')),
        'board',
      ),
    ),
    [creating, setCreating] = useState<BoardRoom | null>(null);
  const status = ['DIRTY', 'CLEANING'].includes(params.get('housekeepingStatus') ?? '')
    ? params.get('housekeepingStatus')! : '',
    operational = params.get('operationalStatus') ?? '';

  function filter(key: string, value: string) {
    const next = new URLSearchParams(params);
    next.delete('page');
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  }

  return (
    <div className="hk-page-container space-y-4">
      {/* Compact Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
              Sơ đồ buồng phòng
            </h1>
            <span className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700 border border-brand-200/50">
              <Sparkles className="size-3" />
              {manager ? 'Housekeeping Board' : 'Phòng được giao'}
            </span>
            {query.data?.meta && (
              <span className="text-xs text-zinc-400 font-medium">
                · {query.data.meta.total} phòng
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">
            Xem trực quan tình trạng dọn dẹp từng căn phòng và thao tác trực tiếp trên thẻ phòng.
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
      <div className="rounded-xl border border-zinc-200 bg-white p-2.5 shadow-2xs mb-4 flex flex-wrap items-center justify-between gap-2.5">
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
            Tất cả cần xử lý
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
            {cleaningStatuses.filter((s) => s !== 'CLEAN').map((s) => (
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
    <div className="hk-page-container space-y-4">
      {/* Compact Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
              {user && managesHousekeeping(user.role)
                ? 'Lịch sử công việc buồng phòng'
                : 'Công việc của tôi'}
            </h1>
            <span className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700 border border-brand-200/50">
              <ClipboardList className="size-3" />
              Công việc
            </span>
            {roomId && (
              <span className="inline-flex items-center gap-1 text-xs text-brand-700 bg-brand-50 border border-brand-200 px-2 py-0.5 rounded-md font-medium">
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
            Theo dõi danh sách công việc, ghi chú phòng và xác nhận trạng thái trực tiếp.
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
            Sơ đồ phòng
          </Link>
        </div>
      </div>

      {/* Unified Compact Toolbar */}
      <div className="rounded-xl border border-zinc-200 bg-white p-2.5 shadow-2xs mb-4 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              const next = new URLSearchParams(params);
              next.delete('status');
              next.delete('page');
              setParams(next);
            }}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors cursor-pointer ${
              !status
                ? 'bg-zinc-900 text-white font-semibold shadow-2xs'
                : 'text-zinc-600 hover:bg-zinc-100'
            }`}
          >
            Tất cả trạng thái
          </button>
          <button
            type="button"
            onClick={() => {
              const next = new URLSearchParams(params);
              next.set('status', 'TODO');
              next.delete('page');
              setParams(next);
            }}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors cursor-pointer ${
              status === 'TODO'
                ? 'bg-amber-50 text-amber-800 font-semibold border border-amber-200 shadow-2xs'
                : 'text-zinc-600 hover:bg-zinc-100'
            }`}
          >
            Cần thực hiện
          </button>
          <button
            type="button"
            onClick={() => {
              const next = new URLSearchParams(params);
              next.set('status', 'IN_PROGRESS');
              next.delete('page');
              setParams(next);
            }}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors cursor-pointer ${
              status === 'IN_PROGRESS'
                ? 'bg-sky-50 text-sky-800 font-semibold border border-sky-200 shadow-2xs'
                : 'text-zinc-600 hover:bg-zinc-100'
            }`}
          >
            Đang thực hiện
          </button>
          <button
            type="button"
            onClick={() => {
              const next = new URLSearchParams(params);
              next.set('status', 'DONE');
              next.delete('page');
              setParams(next);
            }}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors cursor-pointer ${
              status === 'DONE'
                ? 'bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200 shadow-2xs'
                : 'text-zinc-600 hover:bg-zinc-100'
            }`}
          >
            Đã hoàn thành
          </button>
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

      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden shadow-2xs">
        {query.isPending ? (
          <div className="p-6">
            <Skeleton />
          </div>
        ) : query.error ? (
          <ErrorState
            message={query.error.message}
            retry={() => void query.refetch()}
          />
        ) : (
          <>
            <TaskTable tasks={query.data!.data} />
            <div className="p-3 border-t border-zinc-100">
              <Pagination
                {...query.data!.meta}
                onChange={(p) => {
                  const next = new URLSearchParams(params);
                  next.set('page', String(p));
                  setParams(next);
                }}
              />
            </div>
          </>
        )}
      </div>
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
    <div className="hk-page-container space-y-4 max-w-5xl mx-auto pb-10">
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
