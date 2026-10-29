import { Navigate, useLocation, useNavigate, useSearchParams } from "react-router";
import {
  ChevronLeft,
  ChevronRight,
  LogIn,
  LogOut,
  Plus,
  Search,
  Users,
} from "lucide-react";
import {
  ErrorState,
  LinkButton,
  Pagination,
  PageHeading,
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
  const base = useDeskBase(),
    [params, setParams] = useSearchParams(),
    page = pageNumber(params.get("page"));
  const filters = new URLSearchParams(params);
  filters.set("page", String(page));
  filters.set("pageSize", "10");
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
  const prettyDate = new Date(currentDate + "T00:00:00Z").toLocaleDateString("vi-VN", {
    weekday: "short",
    day: "numeric",
    month: "numeric",
    timeZone: "UTC",
  });

  return (
    <div className="space-y-4">
      {/* Header with Title and Date Switcher matching Kamra InHouse.tsx */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">
            {billing ? "Tra cứu chi phí & hóa đơn" : "Quản lý booking"}
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            {billing
              ? "Đối chiếu thanh toán, chi phí dịch vụ và tiền phòng theo booking."
              : "Khách đến, khách đang lưu trú và khách đi, trên một màn hình vận hành."}
          </p>
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

      {/* 3 Prominent Operational Tab Cards matching Kamra InHouse.tsx */}
      <div className="grid grid-cols-3 gap-2 sm:max-w-xl" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={currentView === "arrivals"}
          onClick={() => setTab("arrivals", "")}
          className={`flex flex-col-reverse items-start gap-0.5 rounded-xl border px-3 py-2 text-start transition-colors sm:flex-row sm:items-center sm:justify-between sm:gap-2 sm:py-2.5 cursor-pointer ${
            currentView === "arrivals"
              ? "border-brand-600 bg-brand-50 text-brand-800 shadow-2xs"
              : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
          }`}
        >
          <span className="flex min-w-0 max-w-full items-center gap-1.5 text-xs font-medium sm:gap-2 sm:text-sm">
            <LogIn className="hidden size-4 shrink-0 sm:block text-brand-700" />
            <span className="truncate">Khách đến (Arrivals)</span>
          </span>
          <span className="text-base sm:text-lg font-semibold tabular-nums">
            {currentView === "arrivals" && query.data?.meta ? query.data.meta.total : "—"}
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={currentView === "staying"}
          onClick={() => setTab("staying", "")}
          className={`flex flex-col-reverse items-start gap-0.5 rounded-xl border px-3 py-2 text-start transition-colors sm:flex-row sm:items-center sm:justify-between sm:gap-2 sm:py-2.5 cursor-pointer ${
            currentView === "staying"
              ? "border-brand-600 bg-brand-50 text-brand-800 shadow-2xs"
              : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
          }`}
        >
          <span className="flex min-w-0 max-w-full items-center gap-1.5 text-xs font-medium sm:gap-2 sm:text-sm">
            <Users className="hidden size-4 shrink-0 sm:block text-brand-700" />
            <span className="truncate">Đang ở (In-house)</span>
          </span>
          <span className="text-base sm:text-lg font-semibold tabular-nums">
            {currentView === "staying" && query.data?.meta ? query.data.meta.total : "—"}
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={currentView === "departures"}
          onClick={() => setTab("departures", "")}
          className={`flex flex-col-reverse items-start gap-0.5 rounded-xl border px-3 py-2 text-start transition-colors sm:flex-row sm:items-center sm:justify-between sm:gap-2 sm:py-2.5 cursor-pointer ${
            currentView === "departures"
              ? "border-brand-600 bg-brand-50 text-brand-800 shadow-2xs"
              : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
          }`}
        >
          <span className="flex min-w-0 max-w-full items-center gap-1.5 text-xs font-medium sm:gap-2 sm:text-sm">
            <LogOut className="hidden size-4 shrink-0 sm:block text-amber-700" />
            <span className="truncate">Khách đi (Departures)</span>
          </span>
          <span className="text-base sm:text-lg font-semibold tabular-nums">
            {currentView === "departures" && query.data?.meta ? query.data.meta.total : "—"}
          </span>
        </button>
      </div>

      {/* Filter and Search Bar Card */}
      <div className="rounded-xl border border-zinc-200 bg-white p-3 shadow-2xs space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* View Tab Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors cursor-pointer ${
                !currentView && !currentStatus
                  ? "bg-brand-50 text-brand-700 font-semibold"
                  : "text-zinc-600 hover:bg-zinc-100"
              }`}
              onClick={() => setTab("", "")}
            >
              Tất cả booking {query.data?.meta && !currentView && !currentStatus ? `(${query.data.meta.total})` : ""}
            </button>
            <button
              type="button"
              className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors cursor-pointer ${
                currentStatus === "PENDING"
                  ? "bg-amber-50 text-amber-800 font-semibold"
                  : "text-zinc-600 hover:bg-zinc-100"
              }`}
              onClick={() => setTab("", "PENDING")}
            >
              Chờ xác nhận
            </button>
          </div>

          {/* Search Form */}
          <form
            className="flex items-center gap-2 flex-1 max-w-sm"
            onSubmit={(e) => {
              e.preventDefault();
              update("q", String(new FormData(e.currentTarget).get("q") ?? ""));
            }}
          >
            <div className="relative w-full">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-zinc-400" />
              <input
                className="w-full rounded-lg border border-zinc-200 bg-zinc-50/70 py-1.5 pl-8 pr-3 text-xs text-zinc-800 placeholder-zinc-400 focus:bg-white focus:outline-brand-600"
                name="q"
                aria-label="Tìm booking hoặc khách"
                key={params.get("q") ?? ""}
                defaultValue={params.get("q") ?? ""}
                placeholder="Tìm mã booking, tên khách, số phòng, SĐT…"
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 cursor-pointer shrink-0"
            >
              Tìm kiếm
            </button>
          </form>
        </div>

        {/* Secondary Filters row */}
        <div className="flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-2 text-xs">
          <select
            className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs text-zinc-700 focus:outline-brand-600"
            value={params.get("status") ?? ""}
            onChange={(e) => update("status", e.target.value)}
            aria-label="Trạng thái booking"
          >
            <option value="">Tất cả trạng thái</option>
            {bookingStatuses.map((s) => (
              <option key={s} value={s}>
                {statusLabels[s]}
              </option>
            ))}
          </select>

          <label className="flex items-center gap-1 text-zinc-500">
            <span>Nhận:</span>
            <input
              className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700 focus:outline-brand-600"
              type="date"
              value={params.get("checkIn") ?? ""}
              onChange={(e) => update("checkIn", e.target.value)}
            />
          </label>

          <label className="flex items-center gap-1 text-zinc-500">
            <span>Trả:</span>
            <input
              className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700 focus:outline-brand-600"
              type="date"
              value={params.get("checkOut") ?? ""}
              onChange={(e) => update("checkOut", e.target.value)}
            />
          </label>

          {(params.get("q") ||
            params.get("status") ||
            params.get("checkIn") ||
            params.get("checkOut") ||
            params.get("view") ||
            params.get("date")) && (
            <button
              type="button"
              onClick={() => setParams({})}
              className="text-xs text-brand-700 font-medium hover:underline cursor-pointer ml-auto"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
      </div>

      {/* Main Table Card */}
      <section className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
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
    <div className="desk-page">
      <PageHeading
        title="Lịch đặt phòng"
        description="Phòng thực tế và các đêm lưu trú đã đặt."
      />
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
