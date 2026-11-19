import { catalogName } from "../i18n/catalog";
import { displayLocale, safeError, t as tr, useLocale } from "../i18n";


import { DeskBackLink, DeskLink } from '../features/reception/navigation';
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
  const locale = useLocale();
  const base = useHousekeepingBase();

  // Queries
  const todoQuery = useHousekeepingGet<Page<Task>>('/housekeeping/tasks?status=TODO&page=1&pageSize=50');
  const progressQuery = useHousekeepingGet<Page<Task>>('/housekeeping/tasks?status=IN_PROGRESS&page=1&pageSize=50');
  const doneQuery = useHousekeepingGet<Page<Task>>('/housekeeping/tasks?status=DONE&page=1&pageSize=50');
  const boardQuery = useHousekeepingGet<Page<BoardRoom>>('/housekeeping/board?page=1&pageSize=50');

  const allQueries = [todoQuery, progressQuery, doneQuery, boardQuery];
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
  const todoTasks = useMemo(() => { void locale; return (todoQuery.data?.data ?? []); }, [todoQuery.data?.data, locale]);
  const progressTasks = useMemo(() => { void locale; return (progressQuery.data?.data ?? []); }, [progressQuery.data?.data, locale]);
  const doneTasks = useMemo(() => { void locale; return (doneQuery.data?.data ?? []); }, [doneQuery.data?.data, locale]);

  const todoCount = todoQuery.data?.meta.total ?? todoTasks.length;
  const progressCount = progressQuery.data?.meta.total ?? progressTasks.length;
  const doneCount = doneQuery.data?.meta.total ?? doneTasks.length;

  const totalActive = todoCount + progressCount;
  const totalShift = todoCount + progressCount + doneCount;

  // Available floors
  const availableFloors = useMemo(() => {
    void locale; // Recompute presentation when the language changes.

    const floors = new Set<number>();
    [...progressTasks, ...todoTasks, ...doneTasks].forEach((t) => floors.add(t.room.floor));
    return Array.from(floors).sort((a, b) => a - b);
  }, [progressTasks, todoTasks, doneTasks, locale]);

  // Filtered tasks for display
  const displayedTasks = useMemo(() => {
    void locale; // Recompute presentation when the language changes.

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
  }, [statusFilter, floorFilter, searchQuery, progressTasks, todoTasks, doneTasks, locale]);

  return (
    <div className="hk-page-container space-y-4">
      {/* 1. Four Operational Metric Cards - Quick High-Priority Insight & 1-Click Status Filter */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Chờ dọn ngay (Ưu tiên hàng đầu) */}
        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'TODO' ? 'ACTIVE' : 'TODO')}
          className={`hk-stat-card ${statusFilter === 'TODO' ? 'active' : ''}`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-600">{tr("housekeeping:housekeepingPages.readyToClean")}</span>
            <span className="flex size-7 items-center justify-center rounded-lg bg-amber-50/80 text-amber-600 border border-amber-200/50">
              <AlertCircle className="size-3.5" />
            </span>
          </div>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-bold text-zinc-900 tracking-tight">
              {todoQuery.isPending ? '…' : todoCount}
            </span>
            <span className="text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">{tr("housekeeping:housekeepingPages.needsAttention")}</span>
          </div>
        </button>

        {/* Card 2: Đang dọn dẹp */}
        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'IN_PROGRESS' ? 'ACTIVE' : 'IN_PROGRESS')}
          className={`hk-stat-card ${statusFilter === 'IN_PROGRESS' ? 'active' : ''}`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-600">{tr("housekeeping:contracts.cleaning")}</span>
            <span className="flex size-7 items-center justify-center rounded-lg bg-sky-50 text-sky-700 border border-sky-200/60">
              <Brush className="size-3.5" />
            </span>
          </div>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-bold text-zinc-900 tracking-tight">
              {progressQuery.isPending ? '…' : progressCount}
            </span>
            <span className="text-[11px] font-medium text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md">{tr("housekeeping:housekeepingPages.inProgress")}</span>
          </div>
        </button>

        {/* Card 3: Đã hoàn thành */}
        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'DONE' ? 'ACTIVE' : 'DONE')}
          className={`hk-stat-card ${statusFilter === 'DONE' ? 'active' : ''}`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-600">{tr("housekeeping:housekeepingPages.shiftTasksCompleted")}</span>
            <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-50/80 text-emerald-600 border border-emerald-200/50">
              <CheckCircle2 className="size-3.5" />
            </span>
          </div>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-bold text-zinc-900 tracking-tight">
              {doneQuery.isPending ? '…' : doneCount}
            </span>
            <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">{tr("housekeeping:contracts.cleanRoom")}</span>
          </div>
        </button>

        {/* Card 4: Tổng phòng ca trực */}
        <button
          type="button"
          onClick={() => setStatusFilter('ACTIVE')}
          className={`hk-stat-card ${statusFilter === 'ACTIVE' ? 'active' : ''}`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-600">{tr("housekeeping:housekeepingPages.allToDo")}</span>
            <span className="flex size-7 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 border border-zinc-200/60">
              <BedDouble className="size-3.5" />
            </span>
          </div>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-bold text-zinc-900 tracking-tight">
              {totalActive}
            </span>
            <span className="text-[11px] font-medium text-zinc-500">{tr("housekeeping:housekeepingPages.valueTotalShiftTasks", { value0: (totalShift) })}</span>
          </div>
        </button>
      </div>

      {/* Error alert if any query fails */}
      {hasError && (
        <ErrorState
          message={tr("housekeeping:housekeepingPages.unableToLoadTheFullTaskListPleaseTryAgain")}
          retry={refreshAll}
        />
      )}

      {/* 2. Main Operational Section */}
      <section className="bg-white rounded-xl border border-zinc-200 shadow-xs overflow-hidden">
        {/* Streamlined Operational Toolbar */}
        <div className="p-3 sm:p-3.5 border-b border-zinc-100 flex flex-wrap items-center justify-between gap-3">
          {/* Left: Active Status Indicator & Floor Selector */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 mr-1">
              <span className="text-xs font-semibold text-zinc-900">
                {statusFilter === 'TODO'
                  ? tr("housekeeping:housekeepingPages.roomsAwaitingCleaning")
                  : statusFilter === 'IN_PROGRESS'
                  ? tr("housekeeping:housekeepingPages.roomsBeingCleaned")
                  : statusFilter === 'DONE'
                  ? tr("housekeeping:housekeepingPages.completedRooms")
                  : tr("housekeeping:housekeepingPages.allRoomsNeedingCleaning")}
              </span>
              <span className="text-[11px] font-bold text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded-full border border-zinc-200/70">
                {displayedTasks.length}
              </span>
              {statusFilter !== 'ACTIVE' && (
                <button
                  type="button"
                  onClick={() => setStatusFilter('ACTIVE')}
                  className="text-[11px] text-zinc-400 hover:text-zinc-700 underline cursor-pointer ml-1"
                >{tr("housekeeping:housekeepingPages.showAll")}</button>
              )}
            </div>

            <span className="text-zinc-200 hidden sm:inline">|</span>

            {/* Floor Selector */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setFloorFilter('ALL')}
                className={`hk-floor-pill ${floorFilter === 'ALL' ? 'active' : ''}`}
              >{tr("housekeeping:housekeepingPages.allFloors")}</button>
              {availableFloors.map((floor) => (
                <button
                  key={floor}
                  type="button"
                  onClick={() => setFloorFilter(String(floor))}
                  className={`hk-floor-pill ${floorFilter === String(floor) ? 'active' : ''}`}
                >{tr("housekeeping:housekeepingPages.floorValue", { value0: (floor) })}</button>
              ))}
            </div>
          </div>

          {/* Right: Room Search, View Mode Toggle & Room Board Shortcut */}
          <div className="flex items-center gap-2">
            <div className="relative w-36 sm:w-52">
              <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={tr("housekeeping:housekeepingPages.searchRoomNumber")}
                className="h-8 w-full pl-8 pr-7 text-xs rounded-lg border border-zinc-200 bg-zinc-50/60 focus:bg-white focus:border-brand-600 focus:outline-none transition-colors"
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

            <div className="flex items-center bg-zinc-100 rounded-lg p-0.5 border border-zinc-200">
              <button
                type="button"
                title={tr("housekeeping:housekeepingPages.roomCardView")}
                onClick={() => setViewMode('CARDS')}
                className={`p-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  viewMode === 'CARDS'
                    ? 'bg-white text-zinc-900 shadow-2xs'
                    : 'text-zinc-500 hover:text-zinc-800'
                }`}
              >
                <LayoutGrid className="size-3.5" />
              </button>
              <button
                type="button"
                title={tr("housekeeping:housekeepingPages.compactListView")}
                onClick={() => setViewMode('TABLE')}
                className={`p-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  viewMode === 'TABLE'
                    ? 'bg-white text-zinc-900 shadow-2xs'
                    : 'text-zinc-500 hover:text-zinc-800'
                }`}
              >
                <List className="size-3.5" />
              </button>
            </div>

            <Link
              to={`${base}/board`}
              className="h-8 px-2.5 rounded-lg text-xs font-medium border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 transition-colors inline-flex items-center gap-1.5 shadow-2xs"
            >
              <Brush className="size-3.5 text-zinc-400" />
              <span className="hidden sm:inline">{tr("housekeeping:housekeepingPages.roomBoard")}</span>
            </Link>
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
                              <h3 className="text-2xl font-bold tracking-tight text-zinc-900 m-0">{tr("housekeeping:components.roomValue", { value0: (task.room.roomNumber) })}</h3>
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-md">
                                <Layers className="size-3 text-zinc-400" />
                                {tr("housekeeping:components.floor")}{task.room.floor}
                              </span>
                            </div>
                            <p className="text-xs text-zinc-500 font-medium mt-1 flex items-center gap-1">
                              <BedDouble className="size-3.5 text-zinc-400" />
                              {catalogName(cleanRoomTypeName(task.room.roomType.name))}
                            </p>
                          </div>
                          <CleaningBadge status={task.room.housekeepingStatus} />
                        </div>

                        {/* Task Type / Urgency Pill */}
                        <div className="space-y-1.5">
                          {isCheckout ? (
                            <div className="hk-note-box priority flex items-center gap-2">
                              <Sparkles className="size-3.5 text-amber-500 shrink-0" />
                              <div>
                                <strong className="font-semibold block text-zinc-800 text-xs">{tr("housekeeping:contracts.checkOutCleaning")}</strong>
                                <span className="text-[11px] text-zinc-500">{tr("housekeeping:housekeepingPages.prioritizeCleaningToPrepareForTheNextArrival")}</span>
                              </div>
                            </div>
                          ) : isStayover ? (
                            <div className="hk-note-box flex items-center gap-2">
                              <Clock className="size-3.5 text-sky-600 shrink-0" />
                              <div>
                                <strong className="font-semibold block text-zinc-800">{tr("housekeeping:contracts.stayoverCleaning")}</strong>
                                <span className="text-[11px] text-zinc-500">{tr("housekeeping:housekeepingPages.lightCleaningLinenChangesAndAmenityReplenishment")}</span>
                              </div>
                            </div>
                          ) : isDeep ? (
                            <div className="hk-note-box flex items-center gap-2">
                              <Sparkles className="size-3.5 text-purple-600 shrink-0" />
                              <div>
                                <strong className="font-semibold block text-purple-900">{tr("housekeeping:contracts.deepCleaning")}</strong>
                                <span className="text-[11px] text-purple-700">{tr("housekeeping:housekeepingPages.thoroughDeepCleaningOfTheEntireRoom")}</span>
                              </div>
                            </div>
                          ) : task.notes ? (
                            <div className="hk-note-box flex items-start gap-2">
                              <FileText className="size-3.5 text-zinc-400 mt-0.5 shrink-0" />
                              <span className="text-zinc-700 font-medium">
                                {formatTaskNotes(task.notes)}
                              </span>
                            </div>
                          ) : (
                            <div className="hk-note-box flex items-center gap-2 text-zinc-500">
                              <Brush className="size-3.5 text-zinc-400" />
                              <span>{tr("housekeeping:housekeepingPages.standardRoomCleaning")}</span>
                            </div>
                          )}
                        </div>

                        {/* Timing / Staff info */}
                        <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-1">
                          <span>
                            {task.status === 'DONE' && task.completedAt ? (
                              <span className="text-emerald-700 font-medium inline-flex items-center gap-1">
                                <CheckCircle2 className="size-3" />
                                {tr("housekeeping:housekeepingPages.completedAt")}{new Date(task.completedAt).toLocaleTimeString(displayLocale(), { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            ) : task.status === 'IN_PROGRESS' ? (
                              <span className="text-sky-700 font-semibold inline-flex items-center gap-1">
                                <Clock className="size-3 animate-spin" />
                                {tr("housekeeping:housekeepingPages.cleaningInProgress")}</span>
                            ) : (
                              <span>{tr("housekeeping:housekeepingPages.assignedAtValue", { value0: (new Date(task.createdAt).toLocaleTimeString(displayLocale(), { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' })) })}</span>
                            )}
                          </span>
                          {task.assignedStaff ? (
                            <span className="text-zinc-500 font-medium">{tr("housekeeping:housekeepingPages.assignedValue", { value0: (task.assignedStaff.fullName) })}</span>
                          ) : (
                            <span className="text-zinc-400 italic">{tr("housekeeping:components.unassigned")}</span>
                          )}
                        </div>
                      </div>

                      {/* Card Footer: Direct One-Touch Action Buttons */}
                      <div className="pt-4 mt-4 border-t border-zinc-100 flex flex-col gap-2">
                        {task.status === 'TODO' && (
                          <WorkAction
                            task={task}
                            action="start"
                            customLabel={tr("housekeeping:components.startCleaning")}
                            className="hk-btn-work-start"
                            icon={<Play className="size-4 fill-current" />}
                          />
                        )}

                        {task.status === 'IN_PROGRESS' && (
                          <WorkAction
                            task={task}
                            action="complete"
                            customLabel={tr("housekeeping:housekeepingPages.completeMarkClean")}
                            className="hk-btn-work-complete"
                            icon={<CheckCircle2 className="size-4" />}
                          />
                        )}

                        {task.status === 'DONE' && (
                          <div className="w-full py-2.5 px-3 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-xs font-semibold text-center flex items-center justify-center gap-1.5">
                            <CheckCircle2 className="size-4 text-emerald-600" />
                            {tr("housekeeping:housekeepingPages.cleaningCompleted")}</div>
                        )}

                        <div className="flex items-center justify-between pt-1">
                          <DeskLink
                            to={`${base}/tasks/${task.id}`}
                            className="text-xs font-medium text-brand-700 hover:text-brand-900 inline-flex items-center gap-1"
                          >
                            {tr("housekeeping:housekeepingPages.taskDetails")}<ArrowRight className="size-3" />
                          </DeskLink>
                          <Link
                            to={`${base}/tasks?roomId=${task.roomId}`}
                            className="text-[11px] text-zinc-400 hover:text-zinc-600"
                          >{tr("housekeeping:housekeepingPages.roomHistory")}</Link>
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
                <h3 className="text-xl font-bold text-zinc-900">{tr("housekeeping:housekeepingPages.greatWorkAllYourRoomsAreComplete")}</h3>
                <p className="text-xs text-zinc-600 leading-relaxed">{tr("housekeeping:housekeepingPages.allValueRoomsAssignedThisShiftAreCleanAndReadyForGuests", { value0: (doneCount) })}</p>
              </div>
              <div className="pt-2 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setStatusFilter('DONE')}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white transition-colors cursor-pointer shadow-xs"
                >{tr("housekeeping:housekeepingPages.viewCompletedRoomsValue", { value0: (doneCount) })}</button>
                <button
                  type="button"
                  onClick={refreshAll}
                  className="px-4 py-2 rounded-xl text-xs font-medium border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 transition-colors cursor-pointer"
                >{tr("housekeeping:housekeepingPages.refreshShift")}</button>
              </div>
            </div>
          ) : (
            /* Empty State */
            <div className="p-12 text-center max-w-md mx-auto space-y-3">
              <div className="size-14 rounded-2xl bg-zinc-100 text-zinc-400 flex items-center justify-center mx-auto">
                <ClipboardList className="size-6" />
              </div>
              <h3 className="text-base font-bold text-zinc-800">{tr("housekeeping:housekeepingPages.noRoomsInThisSection")}</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">
                {searchQuery || floorFilter !== 'ALL'
                  ? tr("housekeeping:housekeepingPages.noRoomsMatchTheFiltersTryAllFloorsOrClearYourSearch")
                  : tr("housekeeping:housekeepingPages.youHaveNoAssignedRoomsInThisStatus")}
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
                  >{tr("housekeeping:housekeepingPages.clearFilters")}</button>
                )}
                <button
                  type="button"
                  onClick={refreshAll}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border border-zinc-200 hover:bg-zinc-50 text-zinc-700"
                >{tr("housekeeping:housekeepingPages.refreshData")}</button>
              </div>
            </div>
          )}
        </div>
      </section>

    </div>
  );
}

export function HousekeepingBoardPage() {
  useLocale();
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
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">{tr("housekeeping:housekeepingPages.housekeepingBoard")}</h1>
            <span className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700 border border-brand-200/50">
              <Sparkles className="size-3" />
              {manager ? 'Housekeeping Board' : tr("housekeeping:housekeepingPages.assignedRooms")}
            </span>
            {query.data?.meta && (
              <span className="text-xs text-zinc-400 font-medium">{tr("housekeeping:housekeepingPages.valueRooms", { value0: (query.data.meta.total) })}</span>
            )}
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">{tr("housekeeping:housekeepingPages.viewRoomCleaningStatusAndTakeActionDirectlyOnEachRoomCard")}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
            className="h-8.5 px-3 text-xs font-medium rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
          >
            <RefreshCw
              className={`size-3.5 ${query.isFetching ? 'animate-spin' : ''}`}
            />
            {tr("housekeeping:housekeepingPages.refreshBoard")}</button>
          <Link
            to={`${base}/tasks`}
            className="h-8.5 px-3 text-xs font-medium rounded-lg bg-brand-700 hover:bg-brand-800 text-white transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
          >
            <ClipboardList className="size-3.5" />
            {manager ? tr("housekeeping:housekeepingPages.taskHistory") : tr("housekeeping:housekeepingPages.myTasks")}
          </Link>
        </div>
      </div>

      {/* Unified Compact Toolbar: Status Filter Pills + Operational Filter */}
      <div className="rounded-xl border border-zinc-200 bg-white p-2.5 shadow-2xs mb-4 flex flex-wrap items-center justify-between gap-2.5">
        {/* Quick Filter Pills */}
        <div
          className="flex flex-wrap items-center gap-1.5"
          role="group"
          aria-label={tr("housekeeping:housekeepingPages.roomStatusFilter")}
        >
          <button
            type="button"
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
              !status
                ? 'bg-zinc-900 text-white font-semibold shadow-2xs'
                : 'text-zinc-600 hover:bg-zinc-100'
            }`}
            onClick={() => filter('housekeepingStatus', '')}
          >{tr("housekeeping:housekeepingPages.allNeedingAttention")}</button>
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
            {tr("housekeeping:housekeepingPages.needsCleaning")}</button>
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
            {tr("housekeeping:housekeepingPages.cleaning")}</button>
        </div>

        {/* Operational Filter & Reset */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <label
              htmlFor="operational-filter"
              className="text-xs text-zinc-500 whitespace-nowrap"
            >{tr("housekeeping:housekeepingPages.operation")}</label>
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
              <option value="">{tr("housekeeping:housekeepingPages.all")}</option>
              <option value="ACTIVE">{tr("housekeeping:housekeepingPages.active")}</option>
              <option value="OUT_OF_SERVICE">{tr("housekeeping:housekeepingPages.outOfService")}</option>
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
            <option value="">{tr("housekeeping:housekeepingPages.allStatuses")}</option>
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
              <X className="size-3" /> {tr("housekeeping:housekeepingPages.clearFilters2")}</button>
          )}
        </div>
      </div>

      {query.isPending ? (
        <Skeleton />
      ) : query.error ? (
        <ErrorState
          message={safeError(query.error)}
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
  useLocale();
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
                ? tr("housekeeping:housekeepingPages.housekeepingTaskHistory")
                : tr("housekeeping:housekeepingPages.myTasks")}
            </h1>
            <span className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700 border border-brand-200/50">
              <ClipboardList className="size-3" />
              {tr("housekeeping:housekeepingPages.tasks")}</span>
            {roomId && (
              <span className="inline-flex items-center gap-1 text-xs text-brand-700 bg-brand-50 border border-brand-200 px-2 py-0.5 rounded-md font-medium">
                {tr("housekeeping:housekeepingPages.room")}{roomId.slice(0, 8)}
                <Link
                  to={`${base}/tasks`}
                  className="ml-1 text-zinc-400 hover:text-zinc-700 font-bold"
                >
                  ✕
                </Link>
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">{tr("housekeeping:housekeepingPages.trackTasksRoomNotesAndConfirmStatusDirectly")}</p>
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
            {tr("housekeeping:housekeepingPages.refreshTasks")}</button>
          <Link
            to={base === '/housekeeping' ? base + '/board' : base}
            className="h-8.5 px-3 text-xs font-medium rounded-lg bg-brand-700 hover:bg-brand-800 text-white transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
          >{tr("housekeeping:housekeepingPages.roomBoard")}</Link>
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
          >{tr("housekeeping:housekeepingPages.allStatuses")}</button>
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
          >{tr("housekeeping:contracts.toDo")}</button>
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
          >{tr("housekeeping:contracts.inProgress")}</button>
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
          >{tr("housekeeping:contracts.completed")}</button>
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
            <X className="size-3" /> {tr("housekeeping:housekeepingPages.clearFilters2")}</button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden shadow-2xs">
        {query.isPending ? (
          <div className="p-6">
            <Skeleton />
          </div>
        ) : query.error ? (
          <ErrorState
            message={safeError(query.error)}
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
  useLocale();
  const { id = '' } = useParams(),
    base = useHousekeepingBase(),
    { user } = useAuth(),
    query = useHousekeepingGet<Task>('/housekeeping/tasks/' + id);

  if (query.isPending) return <Skeleton />;
  if (query.error)
    return (
      <ErrorState
        message={safeError(query.error)}
        retry={() => void query.refetch()}
      />
    );

  const task = query.data!;
  const canAssignStaff = !!user && canAssign(task, user.role);

  return (
    <div className="hk-page-container space-y-4 max-w-5xl mx-auto pb-10">
      {/* Top Breadcrumb & Header */}
      <div>
        <DeskBackLink
          className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900 transition-colors mb-2.5"
          to={`${base}/tasks`}
        >
          <ArrowLeft className="size-3.5" /> {tr("housekeeping:housekeepingPages.taskList")}</DeskBackLink>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-800">
              <Sparkles className="size-3.5 text-emerald-700" />
              {tr("housekeeping:housekeepingPages.housekeepingTaskDetails")}</div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 mt-1">{tr("housekeeping:housekeepingPages.cleanRoomValue", { value0: (task.room.roomNumber) })}</h1>
            <p className="text-xs text-zinc-500 mt-0.5">{tr("housekeeping:housekeepingPages.trackProgressAssignStaffAndConfirmRoomCleaningCompletion")}</p>
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
              {tr("housekeeping:housekeepingPages.refreshDetails")}</button>
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
              <div className="hk-task-status flex items-center gap-2">
                <span className="text-xs font-semibold text-zinc-500">{tr("housekeeping:housekeepingPages.status")}</span>
                <TaskBadge status={task.status} assigned={Boolean(task.assignedStaffId)} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-zinc-500">{tr("housekeeping:housekeepingPages.room2")}</span>
                <CleaningBadge status={task.room.housekeepingStatus} />
              </div>
            </div>

            {/* Key-Value Details */}
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between py-1.5 border-b border-zinc-100">
                <span className="text-zinc-500 font-medium">{tr("housekeeping:housekeepingPages.taskId")}</span>
                <span
                  className="font-mono text-zinc-700 bg-zinc-100 px-2 py-0.5 rounded text-[11px]"
                  title={task.id}
                >
                  {task.id.slice(0, 18)}...
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-zinc-100">
                <span className="text-zinc-500 font-medium">{tr("housekeeping:housekeepingPages.room3")}</span>
                <span className="font-semibold text-zinc-900 inline-flex items-center gap-1.5">
                  <BedDouble className="size-3.5 text-zinc-400" />
                  {tr("housekeeping:components.room2")}{task.room.roomNumber} · {catalogName(cleanRoomTypeName(task.room.roomType.name))} {tr("housekeeping:housekeepingPages.floor")}{task.room.floor}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-zinc-100">
                <span className="text-zinc-500 font-medium">{tr("housekeeping:housekeepingPages.operationalStatus")}</span>
                {task.room.operationalStatus === 'ACTIVE' ? (
                  <span className="text-emerald-700 font-medium inline-flex items-center gap-1">
                    <span className="size-1.5 rounded-full bg-emerald-500" />
                    {tr("housekeeping:housekeepingPages.active")}</span>
                ) : (
                  <span className="text-rose-700 font-medium inline-flex items-center gap-1">
                    <AlertTriangle className="size-3 text-rose-500" />
                    {tr("housekeeping:housekeepingPages.outOfService")}</span>
                )}
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-zinc-100">
                <span className="text-zinc-500 font-medium">{tr("housekeeping:housekeepingPages.assignedStaff")}</span>
                {task.assignedStaff ? (
                  <span className="font-semibold text-zinc-900 inline-flex items-center gap-1">
                    <User className="size-3.5 text-zinc-400" />
                    {task.assignedStaff.fullName}
                  </span>
                ) : (
                  <span className="text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-[11px] font-medium">{tr("housekeeping:components.unassigned")}</span>
                )}
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-zinc-100">
                <span className="text-zinc-500 font-medium">{tr("housekeeping:housekeepingPages.createdAt")}</span>
                <span className="text-zinc-700 tabular-nums inline-flex items-center gap-1">
                  <Calendar className="size-3 text-zinc-400" />
                  {workTime(task.createdAt)}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-zinc-500 font-medium">{tr("housekeeping:housekeepingPages.completedAt2")}</span>
                <span className="text-zinc-700 tabular-nums">
                  {task.completedAt ? (
                    <span className="text-emerald-700 font-medium inline-flex items-center gap-1">
                      <CheckCircle2 className="size-3.5 text-emerald-600" />
                      {workTime(task.completedAt)}
                    </span>
                  ) : (
                    <span className="text-zinc-400 italic">{tr("housekeeping:components.notCompleted")}</span>
                  )}
                </span>
              </div>
            </div>

            {/* Note Highlight Box */}
            <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-3.5 space-y-1">
              <span className="text-[11px] font-bold text-zinc-500 flex items-center gap-1.5 uppercase tracking-wider">
                <FileText className="size-3 text-zinc-400" />
                {tr("housekeeping:forms.taskNotes")}</span>
              <p className="text-xs font-medium text-zinc-800 m-0 leading-relaxed">
                {formatTaskNotes(task.notes) || tr("housekeeping:housekeepingPages.noNotes")}
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
