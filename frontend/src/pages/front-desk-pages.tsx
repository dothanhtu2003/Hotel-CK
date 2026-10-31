import { CashierPage } from "../features/reception/cashier";
import { Navigate, useLocation, useNavigate, useSearchParams } from "react-router";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  LogIn,
  LogOut,
  Plus,
  Search,
  Users,
  X,
} from "lucide-react";
import {
  ErrorState,
  LinkButton,
  Pagination,
} from "../components/ui";
import { Skeleton } from "../features/guest/components";
import {
  bookingStatuses,
  statusLabels,
  type Page,
} from "../features/guest/contracts";
import { BookingTable } from "../features/reception/components";
import {
  pageNumber,
  type DeskBooking,
  type DeskBookingCounts,
} from "../features/reception/contracts";
import {
  useDeskBase,
  useDeskGet,
} from "../features/reception/queries";
import { TapeChart } from "../features/reception/tape-chart";
import { hotelToday, shiftDate } from "../features/reception/room-state";

export { ReceptionDashboard } from "../features/reception/today";
export function ReceptionBookingsPage({
  billing = false,
}: {
  billing?: boolean;
}) {
  return billing ? <CashierPage /> : <ReceptionBookingList />;
}

function ReceptionBookingList() {
  const billing = false;
  const base = useDeskBase(),
    [params, setParams] = useSearchParams(),
    page = pageNumber(params.get("page"));
  const filters = new URLSearchParams(params);
  filters.set("page", String(page));
  filters.set("pageSize", "10");
  if (params.get("view") && !params.get("date")) filters.set("date", hotelToday());
  const query = useDeskGet<Page<DeskBooking>>(
    "/front-desk/bookings?" + filters,
  );
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    next.delete("page");
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  };
  const currentView = params.get("view") ?? "";
  const currentStatus = params.get("status") ?? "";

  const setTab = (view: string, status?: string) => {
    const next = new URLSearchParams(params);
    next.delete("page");
    if (view) next.set("view", view);
    else next.delete("view");
    if (status) next.set("status", status);
    else next.delete("status");
    setParams(next);
  };

  const currentDate = params.get("date") ?? hotelToday();
  const countsQuery = useDeskGet<DeskBookingCounts>(
    `/front-desk/booking-counts?date=${currentDate}`,
  );
  const countValue = (key: keyof DeskBookingCounts) => {
    if (countsQuery.isPending) return <span role="status" aria-label="Đang tải số booking" className="inline-block h-5 w-6 animate-pulse rounded bg-zinc-200/70 align-middle" />;
    if (countsQuery.isError) return <span className="text-xs whitespace-nowrap">Lỗi tải</span>;
    return `${(countsQuery.data?.[key] ?? 0).toLocaleString("vi-VN")} booking`;
  };
  const prettyDate = new Date(currentDate + "T00:00:00Z").toLocaleDateString("vi-VN", {
    weekday: "short",
    day: "numeric",
    month: "numeric",
    timeZone: "UTC",
  });

  const hasActiveFilters = Boolean(
    params.get("q") ||
      params.get("status") ||
      params.get("checkIn") ||
      params.get("checkOut") ||
      params.get("view") ||
      params.get("date"),
  );

  return (
    <div className="space-y-4">
      {/* Header with Title and Date Switcher matching Kamra InHouse.tsx */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">
            {billing ? "Tra cứu chi phí & hóa đơn" : "Quản lý booking"}
          </h1>
          
        </div>

        <div className="flex items-center gap-2">
          {/* Kamra-styled Date Navigation Pill */}
          <div className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-white p-0.5 text-xs shadow-2xs">
            <button
              type="button"
              aria-label="Ngày trước"
              className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 cursor-pointer"
              onClick={() => update("date", shiftDate(currentDate, -1))}
            >
              <ChevronLeft className="size-3.5" />
            </button>
            <button
              type="button"
              className={`rounded-md px-2.5 py-1 font-medium cursor-pointer ${
                currentDate === hotelToday() ? "text-brand-700 font-semibold" : "text-zinc-700"
              }`}
              onClick={() => update("date", "")}
              title="Trở lại hôm nay"
            >
              {prettyDate}
            </button>
            <button
              type="button"
              aria-label="Ngày sau"
              className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 cursor-pointer"
              onClick={() => update("date", shiftDate(currentDate, 1))}
            >
              <ChevronRight className="size-3.5" />
            </button>
          </div>

          <LinkButton to={base + "?mode=booking"}>
            <Plus size={15} /> Đặt phòng mới
          </LinkButton>
        </div>
      </div>

      {/* 3 Prominent Operational Tab Cards spanning full width */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full" role="tablist">
        {/* Card 1: Khách đến */}
        <button
          type="button"
          role="tab"
          aria-selected={currentView === "arrivals"}
          onClick={() => setTab("arrivals", "")}
          className={`flex flex-col justify-between p-3.5 sm:p-4 rounded-xl border text-start transition-all cursor-pointer ${
            currentView === "arrivals"
              ? "border-emerald-600 bg-emerald-50/50 ring-1 ring-emerald-600/30 shadow-2xs"
              : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50/50 shadow-2xs"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-xs sm:text-sm font-medium text-zinc-700">
              <span className="p-1.5 rounded-lg bg-emerald-100/70 text-emerald-700">
                <LogIn className="size-4 shrink-0" />
              </span>
              <span>Khách đến (Arrivals)</span>
            </span>
            <span className="text-[11px] text-zinc-400 font-normal">{prettyDate}</span>
          </div>
          <div className="mt-3 flex items-baseline justify-between gap-2">
            <span className="text-xl sm:text-2xl font-bold tracking-tight text-emerald-800 tabular-nums">
              {countValue("arrivals")}
            </span>
            
          </div>
        </button>

        {/* Card 2: Đang ở */}
        <button
          type="button"
          role="tab"
          aria-selected={currentView === "staying"}
          onClick={() => setTab("staying", "")}
          className={`flex flex-col justify-between p-3.5 sm:p-4 rounded-xl border text-start transition-all cursor-pointer ${
            currentView === "staying"
              ? "border-sky-600 bg-sky-50/50 ring-1 ring-sky-600/30 shadow-2xs"
              : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50/50 shadow-2xs"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-xs sm:text-sm font-medium text-zinc-700">
              <span className="p-1.5 rounded-lg bg-sky-100/70 text-sky-700">
                <Users className="size-4 shrink-0" />
              </span>
              <span>Đang ở (In-house)</span>
            </span>
            <span className="text-[11px] text-zinc-400 font-normal">Lưu trú</span>
          </div>
          <div className="mt-3 flex items-baseline justify-between gap-2">
            <span className="text-xl sm:text-2xl font-bold tracking-tight text-sky-800 tabular-nums">
              {countValue("staying")}
            </span>
            
          </div>
        </button>

        {/* Card 3: Khách đi */}
        <button
          type="button"
          role="tab"
          aria-selected={currentView === "departures"}
          onClick={() => setTab("departures", "")}
          className={`flex flex-col justify-between p-3.5 sm:p-4 rounded-xl border text-start transition-all cursor-pointer ${
            currentView === "departures"
              ? "border-amber-600 bg-amber-50/50 ring-1 ring-amber-600/30 shadow-2xs"
              : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50/50 shadow-2xs"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-xs sm:text-sm font-medium text-zinc-700">
              <span className="p-1.5 rounded-lg bg-amber-100/70 text-amber-700">
                <LogOut className="size-4 shrink-0" />
              </span>
              <span>Khách đi (Departures)</span>
            </span>
            <span className="text-[11px] text-zinc-400 font-normal">{prettyDate}</span>
          </div>
          <div className="mt-3 flex items-baseline justify-between gap-2">
            <span className="text-xl sm:text-2xl font-bold tracking-tight text-amber-800 tabular-nums">
              {countValue("departures")}
            </span>
            
          </div>
        </button>
      </div>

      {countsQuery.isError && (
        <div role="alert" className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <span>Không thể tải số liệu booking.</span>
          <button type="button" className="font-medium underline cursor-pointer" onClick={() => void countsQuery.refetch()}>Thử lại</button>
        </div>
      )}

      {/* Unified Table Section */}
      <section className="rounded-2xl border border-zinc-200 bg-white shadow-2xs overflow-hidden">
        {/* Unified Filter & Search Bar Header */}
        <div className="border-b border-zinc-200 bg-zinc-50/50 p-3 sm:p-4 space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Quick Status View Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all cursor-pointer ${
                  !currentView && !currentStatus
                    ? "bg-white text-brand-700 font-semibold shadow-2xs border border-zinc-200"
                    : "text-zinc-600 hover:bg-zinc-100/80 border border-transparent"
                }`}
                onClick={() => setTab("", "")}
              >
                Tất cả booking {query.data?.meta && !currentView && !currentStatus ? `(${query.data.meta.total})` : ""}
              </button>
              <button
                type="button"
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-medium transition-all cursor-pointer ${
                  currentStatus === "PENDING"
                    ? "bg-amber-100 text-amber-800 font-semibold shadow-2xs border border-amber-200"
                    : "text-zinc-600 hover:bg-zinc-100/80 border border-transparent"
                }`}
                onClick={() => setTab("", "PENDING")}
              >
                <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
                Chờ nhận phòng
              </button>
              <button type="button" onClick={() => setTab('overdue')} className={`px-3 py-1.5 text-xs rounded-lg border ${currentView === 'overdue' ? 'bg-amber-100 text-amber-900 border-amber-300' : 'border-transparent text-zinc-600'}`}>
                Quá ngày nhận chưa xử lý
              </button>
            </div>

            {/* Search Input Form */}
            <form
              className="flex items-center gap-2 flex-1 max-w-md lg:ml-auto"
              onSubmit={(e) => {
                e.preventDefault();
                update("q", String(new FormData(e.currentTarget).get("q") ?? ""));
              }}
            >
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-zinc-400" />
                <input
                  className="w-full rounded-lg border border-zinc-200 bg-white py-1.5 pl-8 pr-3 text-xs text-zinc-800 placeholder-zinc-400 focus:bg-white focus:border-brand-600 focus:outline-none transition-colors"
                  name="q"
                  aria-label="Tìm booking hoặc khách"
                  key={params.get("q") ?? ""}
                  defaultValue={params.get("q") ?? ""}
                  placeholder="Tìm mã booking, tên khách, số phòng, SĐT…"
                />
              </div>
              <button
                type="submit"
                className="inline-flex items-center rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 cursor-pointer shrink-0 shadow-2xs transition-colors"
              >
                Tìm kiếm
              </button>
            </form>
          </div>

          {/* Secondary Filters row */}
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-zinc-200/60 text-xs">
            <select
              className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-700 focus:outline-brand-600 shadow-2xs cursor-pointer"
              value={params.get("status") ?? ""}
              onChange={(e) => update("status", e.target.value)}
              aria-label="Trạng thái booking"
            >
              <option value="">Tất cả trạng thái</option>
              {bookingStatuses.filter((s) => s !== "CONFIRMED").map((s) => (
                <option key={s} value={s}>
                  {s === "PENDING" ? "Chờ nhận phòng" : statusLabels[s]}
                </option>
              ))}
            </select>

            <label className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs text-zinc-600 shadow-2xs">
              <Calendar className="size-3 text-zinc-400 shrink-0" />
              <span className="text-zinc-500">Nhận:</span>
              <input
                className="bg-transparent text-xs text-zinc-700 focus:outline-none cursor-pointer"
                type="date"
                value={params.get("checkIn") ?? ""}
                onChange={(e) => update("checkIn", e.target.value)}
              />
            </label>

            <label className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs text-zinc-600 shadow-2xs">
              <Calendar className="size-3 text-zinc-400 shrink-0" />
              <span className="text-zinc-500">Trả:</span>
              <input
                className="bg-transparent text-xs text-zinc-700 focus:outline-none cursor-pointer"
                type="date"
                value={params.get("checkOut") ?? ""}
                onChange={(e) => update("checkOut", e.target.value)}
              />
            </label>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => setParams({})}
                className="inline-flex items-center gap-1 text-xs text-rose-600 font-medium hover:underline cursor-pointer ml-auto"
              >
                <X className="size-3.5" />
                <span>Xóa bộ lọc</span>
              </button>
            )}
          </div>
        </div>

        {/* Table Content */}
        {query.isPending ? (
          <div className="p-6">
            <Skeleton />
          </div>
        ) : query.error ? (
          <div className="p-6">
            <ErrorState
              message={query.error.message}
              retry={() => void query.refetch()}
            />
          </div>
        ) : (
          <>
            <BookingTable rows={query.data!.data} billing={billing} />
            <Pagination
              {...query.data!.meta}
              onChange={(p) => {
                const next = new URLSearchParams(params);
                next.set("page", String(p));
                setParams(next);
              }}
            />
          </>
        )}
      </section>
    </div>
  );
}
export function ReceptionRoomBoard() {
  const base = useDeskBase(),
    location = useLocation();
  return <Navigate to={`${base}${location.search}`} replace />;
}

export function ReceptionWalkIn() {
  const base = useDeskBase(),
    location = useLocation();
  const search = new URLSearchParams(location.search);
  if (!search.has("mode")) {
    search.set("mode", "booking");
  }
  return <Navigate to={`${base}?${search.toString()}`} replace />;
}

export function ReceptionTapeChartPage() {
  const base = useDeskBase(),
    navigate = useNavigate();
  return (
    <div className="desk-page desk-tape-chart-page">
      <TapeChart
        base={base}
        onSelectRoom={(room) =>
          navigate(`${base}?floor=${room.floor}&roomId=${room.id}`)
        }
        onSelectBooking={(booking) =>
          navigate(`${base}/bookings/${booking.id}`)
        }
      />
    </div>
  );
}
