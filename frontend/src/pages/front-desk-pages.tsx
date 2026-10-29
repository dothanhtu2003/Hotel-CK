import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate, useSearchParams } from "react-router";
import { UnifiedBookingModal } from "../features/reception/unified-booking-modal";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  LogIn,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";
import {
  Button,
  Dialog,
  EmptyState,
  ErrorState,
  LinkButton,
  Pagination,
  PageHeading,
} from "../components/ui";
import { GuestBadge, Skeleton } from "../features/guest/components";
import {
  bookingStatuses,
  money,
  statusLabels,
  type Availability,
  type Page,
} from "../features/guest/contracts";
import { BookingTable } from "../features/reception/components";
import {
  pageNumber,
  type DeskBooking,
  type DeskRoom,
} from "../features/reception/contracts";
import {
  useDeskBase,
  useDeskGet,
} from "../features/reception/queries";
import { TapeChart } from "../features/reception/tape-chart";
import { hotelToday, shiftDate, roomState, roomStateLabels, cleaningLabels } from "../features/reception/room-state";

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

          <LinkButton to={base + "/walk-in"}>
            <Plus size={15} /> Đặt phòng tại quầy
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
    navigate = useNavigate(),
    [params, setParams] = useSearchParams(),
    [selectedRoom, setSelectedRoom] = useState<DeskRoom | null | undefined>(undefined),
    [bookingRoomTarget, setBookingRoomTarget] = useState<DeskRoom | null | undefined>(undefined),
    [viewMode, setViewMode] = useState<"floors" | "tape">(
      params.get("view") === "tape" ? "tape" : "floors",
    ),
    [quickSearch, setQuickSearch] = useState("");

  const defaultCheckIn = hotelToday();
  const defaultCheckOut = shiftDate(defaultCheckIn, 1);

  const checkIn = params.get("checkIn") || defaultCheckIn;
  const checkOut = params.get("checkOut") || defaultCheckOut;
  const guests = Number(params.get("guests") || 2);
  const availabilityParam = params.get("availability") || "";
  const modeParam = params.get("mode") || "";
  const stateParam = params.get("state") || "";
  const floorParam = params.get("floor") || "";
  const typeParam = params.get("roomTypeId") || "";

  const isDateRangeValid = Boolean(checkIn && checkOut && checkOut > checkIn);

  const queryParams = new URLSearchParams();
  for (const [key, val] of params.entries()) {
    if (val && ["page", "floor", "roomTypeId", "state"].includes(key)) {
      queryParams.set(key, val);
    }
  }
  if (!queryParams.has("page")) queryParams.set("page", "1");
  queryParams.set("pageSize", "50");

  const query = useDeskGet<Page<DeskRoom>>(
    "/front-desk/rooms?" + queryParams.toString(),
  );

  const [lastSync, setLastSync] = useState(() =>
    new Date().toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
  );

  const facets = useDeskGet<{
    types: { id: string; name: string }[];
    floors: number[];
  }>("/front-desk/room-filters");

  const availabilityQuery = useDeskGet<Availability>(
    "/front-desk/available?checkIn=" +
      encodeURIComponent(checkIn) +
      "&checkOut=" +
      encodeURIComponent(checkOut) +
      "&guests=" +
      guests,
    isDateRangeValid,
  );

  const availableRoomsMap = new Map<string, { id: string; estimatedTotalAmount?: string }>();
  if (availabilityQuery.data?.data) {
    for (const ar of availabilityQuery.data.data) {
      availableRoomsMap.set(ar.id, ar);
    }
  }

  const nights = isDateRangeValid
    ? availabilityQuery.data?.nights ??
      Math.max(
        1,
        Math.round(
          (Date.parse(checkOut + "T00:00:00Z") -
            Date.parse(checkIn + "T00:00:00Z")) /
            86400000,
        ),
      )
    : 1;

  const todayStr = hotelToday();
  const isSameDayCheckIn = checkIn === todayStr;

  const getRoomAvailability = (r: DeskRoom) => {
    if (!isDateRangeValid) {
      return {
        available: false,
        reason: "Khoảng ngày không hợp lệ",
        estimatedTotal: "0.00",
      };
    }
    const availItem = availableRoomsMap.get(r.id);
    if (availItem) {
      const estimatedTotal =
        availItem.estimatedTotalAmount ??
        (Number(r.roomType.nightlyPrice) * nights).toFixed(2);
      return { available: true, reason: null, estimatedTotal };
    }
    let reason = "Đã có lịch đặt trong khoảng ngày này";
    if (r.operationalStatus !== "ACTIVE") {
      reason = "Phòng ngưng phục vụ / bảo trì";
    } else if (r.roomType.maxGuests < guests) {
      reason = "Sức chứa tối đa " + r.roomType.maxGuests + " khách (yêu cầu " + guests + ")";
    } else if (isSameDayCheckIn && (r.housekeepingStatus !== "CLEAN" || r.openTaskCount > 0)) {
      reason = "Phòng chưa hoàn tất dọn dẹp để nhận hôm nay";
    } else if (isSameDayCheckIn && r.bookings.some((b) => b.status === "CHECKED_IN")) {
      reason = "Phòng đang có khách lưu trú hôm nay";
    }
    const estimatedTotal = (Number(r.roomType.nightlyPrice) * nights).toFixed(2);
    return { available: false, reason, estimatedTotal };
  };

  // Live sync every 30s
  useEffect(() => {
    const timer = setInterval(() => {
      void query.refetch().then(() => {
        setLastSync(
          new Date().toLocaleTimeString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }),
        );
      });
      if (isDateRangeValid) {
        void availabilityQuery.refetch();
      }
    }, 30000);
    return () => clearInterval(timer);
  }, [query, availabilityQuery, isDateRangeValid]);

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    next.delete("page");
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  };

  const getRoomState = (r: DeskRoom) => {
    const key = roomState(r);
    return {
      key,
      label: roomStateLabels[key],
      className: key === "ready" ? "room-ready-clean" : "room-" + key,
      badgeClass: "badge-" + key,
    };
  };

  const allRooms = query.data?.data ?? [];

  const urlRoomId = params.get("roomId");
  const isBookingMode = params.get("mode") === "booking";

  const selected =
    selectedRoom !== undefined
      ? selectedRoom
      : urlRoomId && !isBookingMode
        ? allRooms.find((r) => r.id === urlRoomId) ?? null
        : null;

  const bookingRoom =
    bookingRoomTarget !== undefined
      ? bookingRoomTarget
      : urlRoomId && isBookingMode
        ? allRooms.find((r) => r.id === urlRoomId) ?? null
        : null;

  const setSelected = (room: DeskRoom | null) => setSelectedRoom(room);
  const setBookingRoom = (room: DeskRoom | null) => setBookingRoomTarget(room);

  // Operational Counts
  const readyCount = allRooms.filter((r) => roomState(r) === "ready").length;
  const occupiedCount = allRooms.filter(
    (r) =>
      r.operationalStatus === "ACTIVE" &&
      r.bookings.some((b) => b.status === "CHECKED_IN"),
  ).length;
  const dirtyCount = allRooms.filter(
    (r) =>
      r.operationalStatus === "ACTIVE" && r.housekeepingStatus === "DIRTY",
  ).length;
  const cleaningCount = allRooms.filter(
    (r) =>
      r.operationalStatus === "ACTIVE" && r.housekeepingStatus === "CLEANING",
  ).length;
  const outOfServiceCount = allRooms.filter(
    (r) => r.operationalStatus !== "ACTIVE",
  ).length;

  const filteredRooms = allRooms.filter((r) => {
    if (floorParam && r.floor !== Number(floorParam)) return false;
    if (typeParam && r.roomType.id !== typeParam) return false;
    if (stateParam) {
      const isOccupied = r.bookings.some((b) => b.status === "CHECKED_IN");
      if (stateParam === "ready") {
        if (roomState(r) !== "ready") return false;
      } else if (stateParam === "occupied") {
        if (!(r.operationalStatus === "ACTIVE" && isOccupied)) return false;
      } else if (stateParam === "dirty") {
        if (
          !(
            r.operationalStatus === "ACTIVE" &&
            (r.housekeepingStatus === "DIRTY" ||
              r.housekeepingStatus === "CLEANING")
          )
        )
          return false;
      }
    }
    if (availabilityParam) {
      const avail = getRoomAvailability(r);
      if (availabilityParam === "available" && !avail.available) return false;
      if (availabilityParam === "unavailable" && avail.available) return false;
    }
    if (quickSearch.trim()) {
      const q = quickSearch.trim().toLowerCase();
      const matchNumber = r.roomNumber.toLowerCase().includes(q);
      const matchType = r.roomType.name.toLowerCase().includes(q);
      const matchGuest = r.bookings.some((b) =>
        b.customer?.fullName?.toLowerCase().includes(q),
      );
      if (!matchNumber && !matchType && !matchGuest) return false;
    }
    return true;
  });

  const floorsMap = new Map<number, DeskRoom[]>();
  for (const r of filteredRooms) {
    const list = floorsMap.get(r.floor) ?? [];
    list.push(r);
    floorsMap.set(r.floor, list);
  }
  const sortedFloors = Array.from(floorsMap.keys()).sort((a, b) => a - b);

  const availableFloors = Array.from(
    new Set([...(facets.data?.floors ?? []), ...allRooms.map((r) => r.floor)]),
  ).sort((a, b) => a - b);
  const availableTypesMap = new Map<string, string>();
  for (const t of facets.data?.types ?? []) {
    availableTypesMap.set(t.id, t.name);
  }
  for (const r of allRooms) {
    if (r.roomType?.id && r.roomType?.name) {
      availableTypesMap.set(r.roomType.id, r.roomType.name);
    }
  }

  const clearFilters = () => {
    setQuickSearch("");
    const next = new URLSearchParams();
    if (params.get("view")) next.set("view", params.get("view")!);
    setParams(next);
  };

  return (
    <div className="desk-page">
      {/* Unified Master Control Header */}
      <div className="desk-master-header panel">
        <div className="desk-master-top">
          <div className="desk-master-title-group">
            <h1>Sơ đồ phòng</h1>
            <div className="view-mode-toggle" role="tablist">
              <button
                type="button"
                className={"view-mode-btn " + (viewMode === "floors" ? "active" : "")}
                onClick={() => setViewMode("floors")}
                role="tab"
                aria-selected={viewMode === "floors"}
              >
                <LayoutGrid size={15} /> Sơ đồ tầng
              </button>
              <button
                type="button"
                className={"view-mode-btn " + (viewMode === "tape" ? "active" : "")}
                onClick={() => setViewMode("tape")}
                role="tab"
                aria-selected={viewMode === "tape"}
              >
                <Calendar size={15} /> Dòng thời gian
              </button>
            </div>
          </div>

          <div className="desk-master-actions">
            <div className="desk-board-stats-pills">
              <small>Trang hiện tại:</small>
              <span className="stat-pill pill-ready" title="Phòng trống sạch">
                <span className="stat-dot dot-ready" /> {readyCount} Trống sạch
              </span>
              <span className="stat-pill pill-occupied" title="Phòng đang có khách">
                <span className="stat-dot dot-occupied" /> {occupiedCount} Đang ở
              </span>
              <span className="stat-pill pill-dirty" title="Phòng cần dọn dẹp">
                <span className="stat-dot dot-dirty" /> {dirtyCount} Cần dọn
              </span>
              <span className="stat-pill pill-cleaning" title="Phòng đang được dọn">
                <span className="stat-dot dot-cleaning" /> {cleaningCount} Đang dọn
              </span>
              {outOfServiceCount > 0 && (
                <span className="stat-pill pill-out" title="Phòng bảo trì">
                  <span className="stat-dot dot-out" /> {outOfServiceCount} Bảo trì
                </span>
              )}
            </div>

            <span
              className="live-sync-indicator"
              title="Tự động đồng bộ mỗi 30 giây"
            >
              <span className="pulse-dot" />
              Live {lastSync}
            </span>
            <Button
              variant="secondary"
              busy={query.isFetching || availabilityQuery.isFetching}
              onClick={() => {
                void query.refetch().then(() =>
                  setLastSync(
                    new Date().toLocaleTimeString("vi-VN", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    }),
                  ),
                );
                if (isDateRangeValid) {
                  void availabilityQuery.refetch();
                }
              }}
              aria-label="Làm mới sơ đồ phòng"
              className="desk-refresh-btn"
            >
              <RefreshCw size={14} /> Làm mới
            </Button>
            <Button
              variant={modeParam === "booking" ? "secondary" : "primary"}
              onClick={() => {
                const next = new URLSearchParams(params);
                if (modeParam === "booking") {
                  next.delete("mode");
                } else {
                  next.set("mode", "booking");
                }
                setParams(next);
              }}
            >
              <Plus size={16} /> {modeParam === "booking" ? "Thoát chế độ đặt phòng" : "Đặt phòng mới"}
            </Button>
          </div>
        </div>

        {/* Booking mode guidance banner */}
        {modeParam === "booking" && (
          <div className="desk-board-booking-mode-banner mt-3">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-brand-900">✨ Chế độ Đặt phòng mới:</span>
              <span>Chọn ngày nhận/trả phòng & số khách bên dưới, sau đó bấm vào phòng có nhãn <strong>"✓ Có thể đặt"</strong> để bắt đầu tạo booking.</span>
            </div>
            <button
              type="button"
              className="text-xs text-brand-700 hover:underline cursor-pointer ml-3 font-semibold"
              onClick={() => update("mode", "")}
            >
              Đóng hướng dẫn ✕
            </button>
          </div>
        )}

        {/* Date error alert */}
        {!isDateRangeValid && (
          <div className="desk-date-error-banner mt-3" role="alert">
            <span>⚠️ Ngày trả phòng phải sau ngày nhận phòng. Vui lòng chọn ngày hợp lệ.</span>
          </div>
        )}

        {/* Master Filters (Enhanced with Dates, Guests & Availability) */}
        {viewMode === "floors" && (
          <div className="desk-master-filters flex flex-wrap gap-2.5 pt-3 border-t border-zinc-100">
            {/* Date and Guest Filters */}
            <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-200 px-2 py-1 rounded-md">
              <label className="flex items-center gap-1.5 text-xs text-zinc-600">
                <span className="font-medium text-zinc-700">Nhận:</span>
                <input
                  type="date"
                  className="bg-white border border-zinc-200 rounded px-1.5 py-0.5 text-xs text-zinc-800"
                  value={checkIn}
                  onChange={(e) => update("checkIn", e.target.value)}
                  aria-label="Ngày nhận phòng"
                />
              </label>
              <span className="text-zinc-400">→</span>
              <label className="flex items-center gap-1.5 text-xs text-zinc-600">
                <span className="font-medium text-zinc-700">Trả:</span>
                <input
                  type="date"
                  className="bg-white border border-zinc-200 rounded px-1.5 py-0.5 text-xs text-zinc-800"
                  value={checkOut}
                  onChange={(e) => update("checkOut", e.target.value)}
                  aria-label="Ngày trả phòng"
                />
              </label>
              <label className="flex items-center gap-1.5 text-xs text-zinc-600 border-l border-zinc-200 pl-2">
                <Users size={13} className="text-zinc-500" />
                <input
                  type="number"
                  min="1"
                  max="100"
                  className="bg-white border border-zinc-200 rounded px-1 py-0.5 text-xs w-12 text-zinc-800"
                  value={guests}
                  onChange={(e) => update("guests", e.target.value)}
                  aria-label="Số lượng khách"
                />
                <span>khách</span>
              </label>
            </div>

            {/* Availability Filter */}
            <select
              className="input master-select text-xs"
              value={availabilityParam}
              onChange={(e) => update("availability", e.target.value)}
              aria-label="Lọc theo khả dụng"
            >
              <option value="">Khả dụng: Tất cả</option>
              <option value="available">✓ Chỉ phòng có thể đặt</option>
              <option value="unavailable">✕ Chỉ phòng không thể đặt</option>
            </select>

            {/* Operational Status */}
            <select
              className="input master-select text-xs"
              value={stateParam}
              onChange={(e) => update("state", e.target.value)}
              aria-label="Trạng thái vận hành"
            >
              <option value="">Vận hành: Tất cả trạng thái</option>
              <option value="ready">Trống sạch hôm nay</option>
              <option value="occupied">Đang có khách</option>
              <option value="dirty">Cần dọn / đang dọn</option>
            </select>

            {/* Floor */}
            <select
              className="input master-select text-xs"
              value={floorParam}
              onChange={(e) => update("floor", e.target.value)}
              aria-label="Tầng"
            >
              <option value="">Tất cả các tầng</option>
              {availableFloors.map((f) => (
                <option key={f} value={f}>
                  Tầng {f}
                </option>
              ))}
            </select>

            {/* Room Type */}
            <select
              className="input master-select text-xs"
              value={typeParam}
              onChange={(e) => update("roomTypeId", e.target.value)}
              aria-label="Loại phòng"
            >
              <option value="">Tất cả loại phòng</option>
              {Array.from(availableTypesMap.entries()).map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>

            {/* Quick search */}
            <div className="filter-input-wrap flex-1 min-w-[180px]">
              <Search size={14} className="filter-search-icon" />
              <input
                type="search"
                className="input master-search-input text-xs"
                placeholder="Tìm số phòng, loại phòng, tên khách…"
                value={quickSearch}
                onChange={(e) => setQuickSearch(e.target.value)}
                aria-label="Tìm kiếm phòng"
              />
            </div>

            {(quickSearch ||
              params.get("state") ||
              params.get("floor") ||
              params.get("roomTypeId") ||
              params.get("availability") ||
              params.get("checkIn") ||
              params.get("checkOut") ||
              params.get("guests")) && (
              <Button
                variant="ghost"
                onClick={clearFilters}
                className="master-clear-btn text-xs"
              >
                Xóa bộ lọc
              </Button>
            )}
          </div>
        )}
      </div>

      {viewMode === "tape" ? (
        <TapeChart
          base={base}
          onSelectRoom={setSelected}
          onSelectBooking={(b) => navigate(base + "/bookings/" + b.id)}
        />
      ) : (
        <>
          {/* Dual Legend: Operational Status & Booking Availability */}
          <div className="desk-unified-legend" aria-label="Chú giải trạng thái phòng">
            <div className="legend-row">
              <span className="legend-label">Trạng thái vận hành:</span>
              <span className="stat-pill pill-ready"><span className="stat-dot dot-ready" /> Trống sạch</span>
              <span className="stat-pill pill-occupied"><span className="stat-dot dot-occupied" /> Đang ở</span>
              <span className="stat-pill pill-dirty"><span className="stat-dot dot-dirty" /> Cần dọn</span>
              <span className="stat-pill pill-cleaning"><span className="stat-dot dot-cleaning" /> Đang dọn</span>
              <span className="stat-pill pill-out"><span className="stat-dot dot-out" /> Bảo trì</span>
            </div>
            <div className="legend-row">
              <span className="legend-label">Khả dụng ({checkIn} → {checkOut}):</span>
              <span className="room-avail-pill avail-yes"><span className="avail-icon">✓</span> Có thể đặt trong khoảng ngày đã chọn</span>
              <span className="room-avail-pill avail-no"><span className="avail-icon">✕</span> Không thể đặt (trùng lịch, ngưng phục vụ hoặc vượt sức chứa)</span>
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
              {sortedFloors.map((floor) => {
                const floorRooms = floorsMap.get(floor) ?? [];
                return (
                  <section key={floor} className="desk-floor-group">
                    <div className="desk-floor-header">
                      <h3 className="desk-floor-title">Tầng {floor}</h3>
                      <span className="desk-floor-count">
                        {floorRooms.length} phòng ·{" "}
                        {
                          floorRooms.filter(
                            (r) => getRoomAvailability(r).available,
                          ).length
                        }{" "}
                        có thể đặt ({nights} đêm)
                      </span>
                    </div>
                    <div className="desk-room-grid">
                      {floorRooms.map((r) => {
                        const state = getRoomState(r);
                        const avail = getRoomAvailability(r);
                        const checkedInBooking = r.bookings.find(
                          (b) => b.status === "CHECKED_IN",
                        );
                        return (
                          <button
                            key={r.id}
                            type="button"
                            className={
                              "desk-room " +
                              state.className +
                              (modeParam === "booking" && avail.available ? " room-booking-highlight" : "")
                            }
                            onClick={() => setSelected(r)}
                          >
                            <div className="desk-room-top">
                              <strong className="desk-room-num">{r.roomNumber}</strong>
                              <span
                                className={"room-badge " + state.badgeClass}
                              >
                                {state.label}
                              </span>
                            </div>

                            <div className="desk-room-meta">
                              <span className="desk-room-type">
                                {r.roomType.name}
                              </span>
                              <span className="desk-room-price">
                                {money(r.roomType.nightlyPrice)}/đêm
                              </span>
                            </div>

                            {/* Booking Availability Pill */}
                            <div
                              className={
                                "room-avail-pill " +
                                (avail.available ? "avail-yes" : "avail-no")
                              }
                              title={avail.available ? "Phòng có thể nhận đặt cho khoảng ngày đã chọn" : avail.reason || "Không thể đặt"}
                            >
                              <span className="avail-icon">
                                {avail.available ? "✓" : "✕"}
                              </span>
                              <span>
                                {avail.available ? "Có thể đặt" : "Không thể đặt"}
                              </span>
                              {avail.available ? (
                                <strong className="avail-total">
                                  {money(avail.estimatedTotal)}
                                </strong>
                              ) : (
                                <small className="avail-reason">
                                  {avail.reason}
                                </small>
                              )}
                            </div>

                            <div className="desk-room-body">
                              {checkedInBooking?.customer?.fullName ? (
                                <div className="desk-room-guest-wrap">
                                  <p className="desk-room-guest">
                                    Khách: {checkedInBooking.customer.fullName}
                                  </p>
                                  <span className="desk-room-stay">
                                    {checkedInBooking.checkIn} → {checkedInBooking.checkOut} ({checkedInBooking.nights} đêm)
                                  </span>
                                </div>
                              ) : state.key === "ready" ? (
                                <div className="desk-room-ready-wrap">
                                  <p className="desk-room-guest ready-text">
                                    Chưa có khách · Sẵn sàng đón
                                  </p>
                                  <span className="desk-room-stay">
                                    Tối đa {r.roomType.maxGuests} khách
                                  </span>
                                </div>
                              ) : (
                                <div className="desk-room-dirty-wrap">
                                  <p className="desk-room-guest">
                                    {r.housekeepingStatus === "CLEANING"
                                      ? "Buồng phòng đang dọn"
                                      : state.key === "reserved"
                                        ? "Phòng đã được đặt"
                                        : state.key === "out-of-service"
                                          ? "Ngưng phục vụ"
                                          : "Cần dọn phòng"}
                                  </p>
                                  <span className="desk-room-stay">
                                    {r.openTaskCount > 0
                                      ? "Có " + r.openTaskCount + " việc dọn dẹp"
                                      : "Chưa phân công ca"}
                                  </span>
                                </div>
                              )}
                            </div>

                            <small>
                              Vệ sinh: {cleaningLabels[r.housekeepingStatus] ?? r.housekeepingStatus} · {r.openTaskCount} việc mở
                            </small>

                            <div className="desk-room-hint">
                              <span>
                                {avail.available
                                  ? "Đặt phòng này →"
                                  : "Chi tiết phòng →"}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                );
              })}

              <Pagination
                {...query.data!.meta}
                onChange={(p) => {
                  const next = new URLSearchParams(params);
                  next.set("page", String(p));
                  setParams(next);
                }}
              />
              {!filteredRooms.length && (
                <EmptyState
                  title="Không có phòng phù hợp"
                  description="Thử thay đổi bộ lọc ngày, trạng thái khả dụng, loại phòng hoặc tầng."
                />
              )}
            </>
          )}
        </>
      )}

      {/* Room Detail & Action Drawer */}
      <Dialog
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={"Thao tác phòng " + (selected?.roomNumber ?? "")}
        className="desk-room-action-drawer"
      >
        {selected && (() => {
          const state = getRoomState(selected);
          const avail = getRoomAvailability(selected);
          const checkedInBooking = selected.bookings.find(
            (b) => b.status === "CHECKED_IN",
          );
          return (
            <div className="drawer-body">
              {/* Room Hero Banner */}
              <div className="drawer-room-hero">
                <div>
                  <span className="drawer-room-number">Phòng {selected.roomNumber}</span>
                  <p className="drawer-room-type">
                    {selected.roomType.name} · Tầng {selected.floor} · {money(selected.roomType.nightlyPrice)}/đêm
                  </p>
                </div>
                <span className={"room-badge " + state.badgeClass}>
                  {state.label}
                </span>
              </div>

              {/* Stay & Availability Card */}
              <div
                className={
                  "p-3.5 rounded-lg border " +
                  (avail.available
                    ? "bg-emerald-50 border-emerald-200 text-emerald-950"
                    : "bg-amber-50 border-amber-200 text-amber-950")
                }
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs uppercase tracking-wider">
                    {avail.available ? "✓ Khả dụng đặt phòng" : "✕ Chưa thể đặt phòng"}
                  </span>
                  <strong className="text-xs">
                    {avail.available
                      ? money(avail.estimatedTotal) + " (" + nights + " đêm)"
                      : avail.reason}
                  </strong>
                </div>
                <p className="text-xs text-zinc-600 mt-1">
                  Khoảng ngày đã chọn: <strong>{checkIn}</strong> → <strong>{checkOut}</strong> ({nights} đêm · {guests} khách)
                </p>
              </div>

              {selected.openTaskCount > 0 && (
                <div className="drawer-task-alert">
                  <strong>⚠️ Buồng phòng chưa hoàn tất</strong>
                  <p>Có {selected.openTaskCount} công việc dọn dẹp cần xử lý.</p>
                </div>
              )}

              {/* Guest Snapshot Card if Occupied */}
              {checkedInBooking && (
                <div className="drawer-guest-card">
                  <div className="drawer-guest-header">
                    <span className="drawer-section-label">THÔNG TIN KHÁCH ĐANG Ở</span>
                    <GuestBadge status={checkedInBooking.status} />
                  </div>
                  <strong className="drawer-guest-name">
                    {checkedInBooking.customer?.fullName ?? "Khách lẻ tại quầy"}
                  </strong>
                  <dl className="drawer-guest-dl">
                    <div>
                      <dt>Điện thoại</dt>
                      <dd>{checkedInBooking.customer?.phone || "Chưa có SĐT"}</dd>
                    </div>
                    <div>
                      <dt>Lưu trú hiện tại</dt>
                      <dd>
                        {checkedInBooking.checkIn} → {checkedInBooking.checkOut} ({checkedInBooking.nights} đêm)
                      </dd>
                    </div>
                    <div>
                      <dt>Mã booking</dt>
                      <dd><code>{checkedInBooking.reference}</code></dd>
                    </div>
                    <div>
                      <dt>Tiền phòng</dt>
                      <dd><strong>{money(checkedInBooking.totalRoomAmount)}</strong></dd>
                    </div>
                  </dl>
                </div>
              )}

              {/* Actions Section */}
              <div className="drawer-actions-section">
                <span className="drawer-section-label">THAO TÁC</span>
                <div className="drawer-action-buttons">
                  {/* Unified Booking Action */}
                  {avail.available && (
                    <Button
                      className="drawer-btn-primary"
                      onClick={() => {
                        const r = selected;
                        setSelected(null);
                        setBookingRoom(r);
                      }}
                    >
                      <Plus size={15} /> Đặt phòng này ({money(avail.estimatedTotal)})
                    </Button>
                  )}

                  {checkedInBooking && (
                    <LinkButton
                      to={base + "/bookings/" + checkedInBooking.id + "/billing"}
                      onClick={() => setSelected(null)}
                      className="drawer-btn-checkout"
                    >
                      Làm thủ tục trả phòng
                    </LinkButton>
                  )}

                  {checkedInBooking && (
                    <LinkButton
                      variant="secondary"
                      to={base + "/bookings/" + checkedInBooking.id}
                      onClick={() => setSelected(null)}
                    >
                      Chi tiết booking
                    </LinkButton>
                  )}

                  <LinkButton
                    variant="secondary"
                    to={base + "/housekeeping"}
                    onClick={() => setSelected(null)}
                  >
                    Phối hợp buồng phòng
                  </LinkButton>
                </div>
              </div>

              {/* Related bookings list */}
              {selected.bookings.length > 0 && (
                <div className="drawer-bookings-section">
                  <span className="drawer-section-label">
                    LỊCH ĐẶT LIÊN QUAN ({selected.bookings.length})
                  </span>
                  <div className="drawer-bookings-list">
                    {selected.bookings.map((b) => (
                      <div className="panel drawer-booking-item" key={b.id}>
                        <div className="drawer-booking-top">
                          <strong>{b.customer?.fullName ?? "Khách lẻ"}</strong>
                          <GuestBadge status={b.status} />
                        </div>
                        <p className="drawer-booking-meta">
                          Mã: {b.reference} · {b.checkIn} → {b.checkOut}
                        </p>
                        <div className="drawer-item-actions">
                          <LinkButton
                            to={base + "/bookings/" + b.id}
                            variant="secondary"
                            onClick={() => setSelected(null)}
                          >
                            Chi tiết booking
                          </LinkButton>
                          {b.status === "CHECKED_IN" && (
                            <LinkButton
                              variant="secondary"
                              to={base + "/bookings/" + b.id + "/billing"}
                              onClick={() => setSelected(null)}
                            >
                              Hóa đơn / Trả phòng
                            </LinkButton>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </Dialog>

      {/* Unified Booking Modal */}
      <UnifiedBookingModal
        open={Boolean(bookingRoom)}
        onClose={() => setBookingRoom(null)}
        room={bookingRoom}
        initialCheckIn={checkIn}
        initialCheckOut={checkOut}
        initialGuests={guests}
      />
    </div>
  );
}

export function ReceptionWalkIn() {
  const base = useDeskBase(),
    location = useLocation();
  const search = new URLSearchParams(location.search);
  if (!search.has("mode")) {
    search.set("mode", "booking");
  }
  return <Navigate to={base + "/rooms?" + search.toString()} replace />;
}

export function ReceptionTapeChartPage() {
  const base = useDeskBase(), navigate = useNavigate();
  return <div className="desk-page"><PageHeading title="Lịch đặt phòng" description="Phòng thực tế và các đêm lưu trú đã đặt." /><TapeChart base={base} onSelectRoom={room => navigate(`${base}/rooms?floor=${room.floor}&roomTypeId=${room.roomType.id}`)} /></div>;
}
