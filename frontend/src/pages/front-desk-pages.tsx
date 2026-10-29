import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useMutation } from "@tanstack/react-query";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BedDouble,
  Brush,
  Calendar,
  CalendarCheck,
  ConciergeBell,
  LayoutGrid,
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
  PageHeading,
  Pagination,
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
  deskError,
  pageNumber,
  type Customer,
  type Dashboard,
  type DeskBooking,
  type DeskRoom,
} from "../features/reception/contracts";
import {
  useDeskBase,
  useDeskGet,
  useRefreshDesk,
} from "../features/reception/queries";
import { ApiError } from "../lib/api-client";
import { api } from "../lib/api";
import { useToast } from "../components/toast-context";
import { TapeChart } from "../features/reception/tape-chart";
import { getEnrichedDemoRooms } from "../features/reception/mock-expanded-rooms";

export function ReceptionDashboard() {
  const base = useDeskBase(),
    query = useDeskGet<Dashboard>("/front-desk/dashboard");

  // Live Sync auto-refresh every 30s
  useEffect(() => {
    const timer = setInterval(() => {
      void query.refetch();
    }, 30000);
    return () => clearInterval(timer);
  }, [query]);

  const cards = [
    [
      "arrivals",
      "Khách dự kiến đến hôm nay",
      "bookings?view=arrivals",
      ArrowDownLeft,
    ],
    [
      "departures",
      "Khách dự kiến đi hôm nay",
      "bookings?view=departures",
      ArrowUpRight,
    ],
    ["staying", "Khách đang lưu trú", "bookings?view=staying", Users],
    ["ready", "Phòng trống sạch", "rooms?state=ready", BedDouble],
    ["dirty", "Phòng cần dọn", "rooms?state=dirty", Brush],
    [
      "orders",
      "Dịch vụ đang chờ",
      "service-orders?status=PENDING",
      ConciergeBell,
    ],
    [
      "pending",
      "Booking chờ xác nhận",
      "bookings?status=PENDING",
      CalendarCheck,
    ],
  ] as const;
  return (
    <div className="desk-page">
      <PageHeading
        eyebrow="AN NHIÊN · FRONT DESK"
        title="Một ngày đón khách chu đáo."
        description={
          query.data
            ? `Ngày ${query.data.today.split("-").reverse().join("/")} · Giờ Việt Nam`
            : "Vận hành lễ tân"
        }
        action={
          <div className="desk-heading-actions">
            <Button
              variant="secondary"
              busy={query.isFetching}
              onClick={() => void query.refetch()}
              aria-label="Làm mới tổng quan"
            >
              <RefreshCw size={15} /> Làm mới
            </Button>
            <LinkButton to={base + "/walk-in"}>
              <Plus size={18} />
              Đặt phòng tại quầy
            </LinkButton>
          </div>
        }
      />
      {query.isPending ? (
        <Skeleton />
      ) : query.error ? (
        <ErrorState
          message={query.error.message}
          retry={() => void query.refetch()}
        />
      ) : (
        <>
          <div className="desk-stats desk-operation-stats">
            {cards.map(([key, label, to, Icon]) => (
              <Link
                className={"panel desk-metric metric-" + key}
                key={key}
                to={base + "/" + to}
              >
                <Icon size={20} />
                <span>{label}</span>
                <strong>
                  {query.data!.counts[key].toLocaleString("vi-VN")}
                </strong>
                <small>
                  {["arrivals", "departures", "staying"].includes(key) &&
                  query.data!.bookingCounts
                    ? `${query.data!.bookingCounts[key as "arrivals" | "departures" | "staying"]} booking · Xem danh sách →`
                    : "Mở danh sách →"}
                </small>
              </Link>
            ))}
          </div>
          <section className="panel desk-task-strip">
            <div>
              <p className="eyebrow">ƯU TIÊN TRONG CA</p>
              <h2>Công việc cần xử lý</h2>
            </div>
            <Link to={base + "/bookings?status=PENDING"}>
              {query.data!.counts.pending} booking cần xác nhận
            </Link>
            <Link to={base + "/service-orders?status=PENDING"}>
              {query.data!.counts.orders} đơn dịch vụ chờ
            </Link>
            <Link to={base + "/housekeeping"}>
              {query.data!.counts.dirty} phòng cần phối hợp dọn
            </Link>
          </section>
          {(["arrivals", "departures"] as const).map((key) => (
            <section key={key} className="panel desk-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">LỊCH HÔM NAY</p>
                  <h2>
                    {key === "arrivals"
                      ? "Khách sắp nhận phòng"
                      : "Khách sắp trả phòng"}
                  </h2>
                </div>
                <Link to={base + "/bookings?view=" + key}>Xem tất cả →</Link>
              </div>
              <BookingTable
                rows={query.data![key]}
                billing={key === "departures"}
              />
              <p className="panel-footnote">
                Tối đa 5 booking ·{" "}
                {key === "arrivals"
                  ? "Đang chờ hoặc đã xác nhận, dự kiến đến hôm nay."
                  : "Đang lưu trú, dự kiến trả hôm nay."}
              </p>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
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

  return (
    <div className="desk-page">
      {/* Consolidated Booking Master Header (One-Card Control) */}
      <div className="desk-master-header panel booking-master-header">
        {/* Top Row: Title, Quick View Tabs, and Walk-in Button */}
        <div className="desk-master-top">
          <div className="desk-master-title-group">
            <h1 className="booking-page-title">
              {billing ? "Tra cứu chi phí & hóa đơn" : "Quản lý booking"}
            </h1>
            {query.data?.meta && (
              <span className="booking-total-badge">
                {query.data.meta.total} booking
              </span>
            )}
            <div className="booking-view-tabs" role="tablist" aria-label="Bộ lọc nhanh">
              <button
                type="button"
                className={`booking-tab-pill ${!currentView && !currentStatus ? "active" : ""}`}
                onClick={() => setTab("", "")}
                role="tab"
                aria-selected={!currentView && !currentStatus}
              >
                Tất cả booking
              </button>
              <button
                type="button"
                className={`booking-tab-pill ${currentView === "arrivals" ? "active" : ""}`}
                onClick={() => setTab("arrivals", "")}
                role="tab"
                aria-selected={currentView === "arrivals"}
              >
                Khách đến hôm nay
              </button>
              <button
                type="button"
                className={`booking-tab-pill ${currentView === "departures" ? "active" : ""}`}
                onClick={() => setTab("departures", "")}
                role="tab"
                aria-selected={currentView === "departures"}
              >
                Khách đi hôm nay
              </button>
              <button
                type="button"
                className={`booking-tab-pill ${currentView === "staying" ? "active" : ""}`}
                onClick={() => setTab("staying", "")}
                role="tab"
                aria-selected={currentView === "staying"}
              >
                Đang lưu trú
              </button>
              <button
                type="button"
                className={`booking-tab-pill ${currentStatus === "PENDING" ? "active" : ""}`}
                onClick={() => setTab("", "PENDING")}
                role="tab"
                aria-selected={currentStatus === "PENDING"}
              >
                Chờ xác nhận
              </button>
            </div>
          </div>

          <div className="desk-master-actions">
            <LinkButton to={base + "/walk-in"}>
              <Plus size={16} /> Đặt phòng tại quầy
            </LinkButton>
          </div>
        </div>

        {/* Bottom Row: 1-Line Integrated Search & Fast Filters */}
        <div className="booking-master-filters">
          <form
            className="booking-search-form"
            onSubmit={(e) => {
              e.preventDefault();
              update("q", String(new FormData(e.currentTarget).get("q") ?? ""));
            }}
          >
            <label className="booking-search-label">
              <span className="sr-only">Tìm booking hoặc khách</span>
              <div className="booking-search-input-wrap">
                <Search size={15} className="filter-search-icon" />
                <input
                  className="input master-search-input booking-search-field"
                  name="q"
                  key={params.get("q") ?? ""}
                  defaultValue={params.get("q") ?? ""}
                  placeholder="Mã booking, tên khách, số điện thoại, email, số phòng…"
                  maxLength={120}
                  aria-label="Tìm booking hoặc khách"
                />
                <Button className="booking-search-submit">
                  Tìm kiếm
                </Button>
              </div>
            </label>
          </form>

          <div className="booking-quick-selects">
            <select
              className="input master-select booking-status-select"
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

            <label className="booking-date-label">
              <span className="date-field-tag">Nhận</span>
              <input
                className="input master-date-input"
                type="date"
                value={params.get("checkIn") ?? ""}
                onChange={(e) => update("checkIn", e.target.value)}
                aria-label="Ngày nhận phòng"
              />
            </label>

            <label className="booking-date-label">
              <span className="date-field-tag">Trả</span>
              <input
                className="input master-date-input"
                type="date"
                value={params.get("checkOut") ?? ""}
                onChange={(e) => update("checkOut", e.target.value)}
                aria-label="Ngày trả phòng"
              />
            </label>

            {(params.get("q") ||
              params.get("status") ||
              params.get("checkIn") ||
              params.get("checkOut") ||
              params.get("view")) && (
              <Button
                variant="ghost"
                onClick={() => setParams({})}
                className="master-clear-btn"
              >
                Xóa bộ lọc
              </Button>
            )}
          </div>
        </div>
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
    [selected, setSelected] = useState<DeskRoom | null>(null),
    [viewMode, setViewMode] = useState<"floors" | "tape">("floors"),
    [quickSearch, setQuickSearch] = useState(""),
    [expandedHotel, setExpandedHotel] = useState(false);

  const queryParams = new URLSearchParams();
  for (const [key, val] of params.entries()) {
    if (val) queryParams.set(key, val);
  }
  if (!queryParams.has("page")) queryParams.set("page", "1");
  queryParams.set("pageSize", "50");

  const query = useDeskGet<Page<DeskRoom>>(
    "/front-desk/rooms?" + queryParams.toString(),
  ),
    [lastSync, setLastSync] = useState(() =>
      new Date().toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
    ),
    facets = useDeskGet<{
      types: { id: string; name: string }[];
      floors: number[];
    }>("/front-desk/room-filters");

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
    }, 30000);
    return () => clearInterval(timer);
  }, [query]);

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    next.delete("page");
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  };

  // Xác định chính xác 1 trong 5 trạng thái phòng
  const getRoomState = (r: DeskRoom) => {
    if (r.operationalStatus !== "ACTIVE") {
      return {
        key: "out-of-service",
        label: "Bảo trì",
        className: "room-out-of-service",
        badgeClass: "badge-out-of-service",
      };
    }
    if (r.bookings.some((b) => b.status === "CHECKED_IN")) {
      return {
        key: "occupied",
        label: "Đang ở",
        className: "room-occupied",
        badgeClass: "badge-occupied",
      };
    }
    if (r.housekeepingStatus === "CLEANING") {
      return {
        key: "cleaning",
        label: "Đang dọn",
        className: "room-cleaning",
        badgeClass: "badge-cleaning",
      };
    }
    if (r.housekeepingStatus === "DIRTY") {
      return {
        key: "dirty",
        label: "Cần dọn",
        className: "room-dirty",
        badgeClass: "badge-dirty",
      };
    }
    return {
      key: "ready",
      label: "Trống sạch",
      className: "room-ready-clean",
      badgeClass: "badge-ready-clean",
    };
  };

  const rawRooms = query.data?.data ?? [];
  const allRooms = expandedHotel ? getEnrichedDemoRooms(rawRooms) : rawRooms;

  // Tính toán nhanh số lượng trạng thái phòng trên toàn bộ khách sạn
  const readyCount = allRooms.filter(
    (r) =>
      r.operationalStatus === "ACTIVE" &&
      r.housekeepingStatus === "CLEAN" &&
      !r.bookings.some((b) => b.status === "CHECKED_IN"),
  ).length;
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

  // Lọc phòng theo các tiêu chí (Trạng thái, Tầng, Loại phòng, Tìm kiếm nhanh)
  const stateParam = params.get("state") ?? "";
  const floorParam = params.get("floor") ?? "";
  const typeParam = params.get("roomTypeId") ?? "";

  const filteredRooms = allRooms.filter((r) => {
    if (floorParam && r.floor !== Number(floorParam)) return false;
    if (typeParam && r.roomType.id !== typeParam) return false;
    if (stateParam) {
      const isOccupied = r.bookings.some((b) => b.status === "CHECKED_IN");
      if (stateParam === "ready") {
        if (!(r.operationalStatus === "ACTIVE" && r.housekeepingStatus === "CLEAN" && !isOccupied)) return false;
      } else if (stateParam === "occupied") {
        if (!(r.operationalStatus === "ACTIVE" && isOccupied)) return false;
      } else if (stateParam === "dirty") {
        if (!(r.operationalStatus === "ACTIVE" && (r.housekeepingStatus === "DIRTY" || r.housekeepingStatus === "CLEANING"))) return false;
      }
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

  // Gom nhóm phòng theo Tầng
  const floorsMap = new Map<number, DeskRoom[]>();
  for (const r of filteredRooms) {
    const list = floorsMap.get(r.floor) ?? [];
    list.push(r);
    floorsMap.set(r.floor, list);
  }
  const sortedFloors = Array.from(floorsMap.keys()).sort((a, b) => a - b);

  // Danh sách tầng và loại phòng khả dụng
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
                className={`view-mode-btn ${viewMode === "floors" ? "active" : ""}`}
                onClick={() => setViewMode("floors")}
                role="tab"
                aria-selected={viewMode === "floors"}
              >
                <LayoutGrid size={15} /> Sơ đồ tầng
              </button>
              <button
                type="button"
                className={`view-mode-btn ${viewMode === "tape" ? "active" : ""}`}
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

            <button
              type="button"
              className={`stat-pill demo-toggle-btn ${expandedHotel ? "active" : ""}`}
              onClick={() => setExpandedHotel((v) => !v)}
              title="Bật/tắt 24 phòng mô phỏng đầy tải"
              aria-label="Chế độ 24 phòng"
            >
              {expandedHotel ? "🏨 24 phòng đầy tải" : "🏢 12 phòng gốc"}
            </button>

            <span
              className="live-sync-indicator"
              title="Tự động đồng bộ mỗi 30 giây"
            >
              <span className="pulse-dot" />
              Live {lastSync}
            </span>
            <Button
              variant="secondary"
              busy={query.isFetching}
              onClick={() =>
                void query.refetch().then(() =>
                  setLastSync(
                    new Date().toLocaleTimeString("vi-VN", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    }),
                  ),
                )
              }
              aria-label="Làm mới sơ đồ phòng"
              className="desk-refresh-btn"
            >
              <RefreshCw size={14} /> Làm mới
            </Button>
            <LinkButton to={base + "/walk-in"}>
              <Plus size={16} /> Đặt phòng tại quầy
            </LinkButton>
          </div>
        </div>

        {/* Master Filters (Integrated 1 Row) */}
        {viewMode === "floors" && (
          <div className="desk-master-filters">
            <div className="filter-input-wrap">
              <Search size={15} className="filter-search-icon" />
              <input
                type="search"
                className="input master-search-input"
                placeholder="Tìm nhanh số phòng hoặc loại phòng…"
                value={quickSearch}
                onChange={(e) => setQuickSearch(e.target.value)}
              />
            </div>
            <select
              className="input master-select"
              value={params.get("state") ?? ""}
              onChange={(e) => update("state", e.target.value)}
              aria-label="Trạng thái"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="ready">Trống sạch hôm nay</option>
              <option value="occupied">Đang có khách</option>
              <option value="dirty">Cần dọn / đang dọn</option>
            </select>
            <select
              className="input master-select"
              value={params.get("floor") ?? ""}
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
            <select
              className="input master-select"
              value={params.get("roomTypeId") ?? ""}
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
            {(quickSearch || params.get("state") || params.get("floor") || params.get("roomTypeId")) && (
              <Button
                variant="ghost"
                onClick={() => {
                  setQuickSearch("");
                  setParams({});
                }}
                className="master-clear-btn"
              >
                Xóa bộ lọc
              </Button>
            )}
          </div>
        )}
      </div>

      {viewMode === "tape" ? (
        <TapeChart
          rooms={filteredRooms}
          base={base}
          onSelectRoom={setSelected}
          onSelectBooking={(b) => navigate(`${base}/bookings/${b.id}`)}
        />
      ) : (
        <>
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
                            (r) =>
                              r.operationalStatus === "ACTIVE" &&
                              r.housekeepingStatus === "CLEAN" &&
                              !r.bookings.some((b) => b.status === "CHECKED_IN"),
                          ).length
                        }{" "}
                        trống sạch
                      </span>
                    </div>
                    <div className="desk-room-grid">
                      {floorRooms.map((r) => {
                        const state = getRoomState(r);
                        const checkedInBooking = r.bookings.find(
                          (b) => b.status === "CHECKED_IN",
                        );
                        return (
                          <button
                            key={r.id}
                            type="button"
                            className={`desk-room ${state.className}`}
                            onClick={() => setSelected(r)}
                          >
                            <div className="desk-room-top">
                              <strong className="desk-room-num">{r.roomNumber}</strong>
                              <span
                                className={`room-badge ${state.badgeClass}`}
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
                                      : "Cần dọn phòng"}
                                  </p>
                                  <span className="desk-room-stay">
                                    {r.openTaskCount > 0
                                      ? `Có ${r.openTaskCount} việc dọn dẹp`
                                      : "Chưa phân công ca"}
                                  </span>
                                </div>
                              )}
                            </div>
                            <div className="desk-room-hint">
                              <span>
                                {checkedInBooking
                                  ? "Chi tiết khách & Trả phòng →"
                                  : state.key === "ready"
                                    ? "Đón khách (Walk-in) →"
                                    : "Xem chi tiết →"}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                );
              })}

              {!filteredRooms.length && (
                <EmptyState
                  title="Không có phòng phù hợp"
                  description="Thử thay đổi bộ lọc trạng thái, loại phòng hoặc tầng."
                />
              )}
            </>
          )}
        </>
      )}

      <Dialog
        open={!!selected}
        onClose={() => setSelected(null)}
        title={"Thao tác phòng " + (selected?.roomNumber ?? "")}
        className="desk-room-action-drawer"
      >
        {selected && (() => {
          const state = getRoomState(selected);
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
                    {selected.roomType.name} · Tầng {selected.floor}
                  </p>
                </div>
                <span className={`room-badge ${state.badgeClass}`}>
                  {state.label}
                </span>
              </div>

              {selected.openTaskCount > 0 && (
                <div className="drawer-task-alert">
                  <strong>⚠️ Buồng phòng chưa hoàn tất</strong>
                  <p>Có {selected.openTaskCount} công việc dọn dẹp cần xử lý trước khi nhận khách mới.</p>
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
                      <dt>Lưu trú</dt>
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

              {/* 1-Click Fast Actions */}
              <div className="drawer-actions-section">
                <span className="drawer-section-label">THAO TÁC NHANH</span>
                <div className="drawer-action-buttons">
                  {state.key === "ready" && (
                    <Button
                      className="drawer-btn-primary"
                      onClick={() => {
                        const id = selected.id;
                        setSelected(null);
                        navigate(`${base}/walk-in?roomId=${id}`);
                      }}
                    >
                      Đón khách vào phòng này (Walk-in)
                    </Button>
                  )}

                  {checkedInBooking && (
                    <LinkButton
                      to={`${base}/bookings/${checkedInBooking.id}/billing`}
                      onClick={() => setSelected(null)}
                      className="drawer-btn-checkout"
                    >
                      Làm thủ tục trả phòng
                    </LinkButton>
                  )}

                  {checkedInBooking && (
                    <LinkButton
                      variant="secondary"
                      to={`${base}/bookings/${checkedInBooking.id}`}
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
                  <span className="drawer-section-label">LỊCH ĐẶT LIÊN QUAN ({selected.bookings.length})</span>
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
                            to={`${base}/bookings/${b.id}`}
                            variant="secondary"
                            onClick={() => setSelected(null)}
                          >
                            Chi tiết booking
                          </LinkButton>
                          {b.status === "CHECKED_IN" && (
                            <LinkButton
                              variant="secondary"
                              to={`${base}/bookings/${b.id}/billing`}
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
    </div>
  );
}
export function ReceptionWalkIn() {
  const base = useDeskBase(),
    navigate = useNavigate(),
    toast = useToast(),
    refresh = useRefreshDesk(),
    [urlParams] = useSearchParams(),
    lock = useRef(false);

  // Mặc định ngày Check-in là hôm nay, Check-out là ngày mai (1 đêm)
  const todayStr = new Date().toISOString().split("T")[0];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];

  const initialStay = new URLSearchParams({
    checkIn: todayStr,
    checkOut: tomorrowStr,
    guests: "2",
  }).toString();

  const [stay, setStay] = useState(initialStay),
    [roomId, setRoomId] = useState(urlParams.get("roomId") ?? ""),
    [search, setSearch] = useState(""),
    [customerPage, setCustomerPage] = useState(1),
    [customer, setCustomer] = useState<Customer | null>(null),
    [newGuest, setNewGuest] = useState(false),
    [review, setReview] = useState<Record<string, unknown> | null>(null),
    [uncertain, setUncertain] = useState(false);
  const availability = useDeskGet<Availability>(
      "/front-desk/available?" + stay,
      !!stay,
    ),
    customers = useDeskGet<Page<Customer>>(
      "/front-desk/customers?q=" +
        encodeURIComponent(search) +
        "&page=" +
        customerPage,
      search.length >= 2,
    ),
    room = availability.data?.data.find((r) => r.id === roomId);
  const mutation = useMutation({
    retry: false,
    mutationFn: (data: Record<string, unknown>) =>
      api.request<DeskBooking>("/front-desk/walk-in", {
        method: "POST",
        body: data,
      }),
    onSuccess: async (b) => {
      toast("Đã tạo booking tại quầy.");
      await refresh();
      navigate(`${base}/bookings/${b.id}`);
    },
    onError: (error) => {
      setUncertain(
        !(error instanceof ApiError) ||
          error.status === 0 ||
          error.status >= 500,
      );
      toast(deskError(error, "booking"), "error");
    },
    onSettled: () => {
      lock.current = false;
    },
  });
  return (
    <div className="desk-page">
      {/* Consolidated Slim Walk-In Master Bar */}
      <div className="walk-in-master-card panel">
        <div className="walk-in-top-row">
          <div className="walk-in-title-wrap">
            <h1 className="walk-in-title">Đón khách tại quầy (Walk-in)</h1>
            <span className="walk-in-badge">
              {room ? `Đang chọn: Phòng ${room.roomNumber}` : "Bước 1: Chọn phòng trống sạch"}
            </span>
          </div>

          <div className="walk-in-steps-compact" aria-label="Các bước đón khách">
            <span className={`step-chip ${!room ? "active" : "done"}`}>
              <span className="chip-num">{room ? "✓" : "1"}</span> Kỳ nghỉ & phòng
            </span>
            <span className="chip-arrow">→</span>
            <span className={`step-chip ${room && !customer && !newGuest ? "active" : room ? "done" : ""}`}>
              <span className="chip-num">{customer || newGuest ? "✓" : "2"}</span> Hồ sơ khách
            </span>
            <span className="chip-arrow">→</span>
            <span className={`step-chip ${review ? "active" : ""}`}>
              <span className="chip-num">3</span> Xác nhận
            </span>
          </div>
        </div>

        <form
          className="walk-in-inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setRoomId("");
            setStay(
              new URLSearchParams({
                checkIn: String(f.get("checkIn")),
                checkOut: String(f.get("checkOut")),
                guests: String(f.get("guests")),
              }).toString(),
            );
          }}
        >
          <div className="walk-in-inputs">
            <label className="walk-in-field">
              <span className="field-caption">Ngày nhận phòng</span>
              <input
                className="input walk-in-input"
                name="checkIn"
                type="date"
                defaultValue={todayStr}
                required
              />
            </label>
            <label className="walk-in-field">
              <span className="field-caption">Ngày trả phòng</span>
              <input
                className="input walk-in-input"
                name="checkOut"
                type="date"
                defaultValue={tomorrowStr}
                required
              />
            </label>
            <label className="walk-in-field field-guests">
              <span className="field-caption">Số khách</span>
              <input
                className="input walk-in-input input-guests"
                name="guests"
                type="number"
                min="1"
                max="100"
                defaultValue="2"
                required
              />
            </label>
            <Button className="walk-in-search-btn">Tìm phòng khả dụng</Button>
          </div>

          {availability.data?.data && (
            <div className="walk-in-clean-count">
              <span className="stat-dot dot-ready" />
              <span>
                {availability.data.data.filter((r) => r.housekeepingStatus === "CLEAN").length} phòng sạch sẵn sàng
              </span>
            </div>
          )}
        </form>
      </div>

      {stay && (
        <div className="walk-in-room-section">
          {availability.isPending ? (
            <Skeleton />
          ) : availability.error ? (
            <ErrorState
              message={availability.error.message}
              retry={() => void availability.refetch()}
            />
          ) : (
            <>
              <div className="desk-room-grid">
                {availability.data!.data
                  .filter((r) => r.housekeepingStatus === "CLEAN")
                  .map((r) => {
                    const isSelected = roomId === r.id;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        className={
                          "desk-room room-ready-clean " +
                          (isSelected ? "room-selected" : "")
                        }
                        onClick={() => {
                          setRoomId(r.id);
                          setTimeout(() => {
                            document
                              .getElementById("walk-in-guest-section")
                              ?.scrollIntoView({ behavior: "smooth" });
                          }, 100);
                        }}
                        aria-pressed={isSelected}
                      >
                        <div className="desk-room-top">
                          <strong className="desk-room-num">Phòng {r.roomNumber}</strong>
                          <span className="room-badge badge-ready-clean">
                            {isSelected ? "Đang chọn ✓" : "Trống sạch"}
                          </span>
                        </div>
                        <div className="desk-room-meta">
                          <span className="desk-room-type">{r.roomType.name}</span>
                          <span className="desk-room-price">
                            {money(r.roomType.nightlyPrice)} / đêm
                          </span>
                        </div>
                        <div className="desk-room-body">
                          <p className="desk-room-guest">
                            Tối đa {r.roomType.maxGuests} khách
                          </p>
                          <span className="desk-room-stay">
                            Tổng ({availability.data?.nights} đêm):
                          </span>
                          <strong className="walk-in-room-total">
                            {money(r.estimatedTotalAmount!)}
                          </strong>
                        </div>
                        <div className="desk-room-hint">
                          <span>
                            {isSelected ? "Đã chọn phòng này ✓" : "Chọn phòng này →"}
                          </span>
                        </div>
                      </button>
                    );
                  })}
              </div>

              {!availability.data!.data.some(
                (r) => r.housekeepingStatus === "CLEAN",
              ) && (
                <EmptyState
                  title="Chưa có phòng sạch khả dụng"
                  description="Thay đổi ngày hoặc phối hợp buồng phòng."
                />
              )}
            </>
          )}
        </div>
      )}
      {room && (() => {
        const dates = Object.fromEntries(new URLSearchParams(stay));
        const stayDates = {
          checkIn: dates.checkIn || todayStr,
          checkOut: dates.checkOut || tomorrowStr,
          guests: dates.guests || "2",
        };

        const handleBookingSubmit = (e: React.FormEvent<HTMLFormElement>) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          mutation.reset();
          const fullName = String(f.get("fullName") ?? "").trim();
          const phoneRaw = String(f.get("phone") ?? "").trim();
          const cleanPhone = phoneRaw.replace(/\D/g, "") || Date.now().toString();
          const enteredEmail = String(f.get("email") ?? "").trim();
          // Nếu khách không cung cấp email, tự động tạo email định danh theo SĐT
          const finalEmail = enteredEmail || `${cleanPhone}@guest.annhien.vn`;

          setReview({
            roomId,
            checkIn: stayDates.checkIn,
            checkOut: stayDates.checkOut,
            guests: Number(stayDates.guests),
            ...(newGuest
              ? {
                  fullName,
                  email: finalEmail,
                  phone: phoneRaw,
                }
              : { customerId: customer!.id }),
          });
        };

        return (
          <section id="walk-in-guest-section" className="panel walk-in-guest-panel">
            <div className="guest-section-header">
              <div>
                <span className="eyebrow">BƯỚC 2 / 3</span>
                <h2>Hồ sơ khách hàng & Xác nhận đặt phòng</h2>
              </div>
              <div className="guest-header-room-pill">
                <span className="stat-dot dot-ready" />
                <span>Phòng {room.roomNumber} ({room.roomType.name})</span>
              </div>
            </div>

            <form id="walk-in-booking-form" onSubmit={handleBookingSubmit}>
              <div className="walk-in-split-grid">
                {/* Cột trái (65%): Thao tác chọn / tạo khách */}
                <div className="walk-in-guest-col">
                  <div className="guest-type-toggle-bar">
                    <Button
                      type="button"
                      variant={!newGuest ? "primary" : "secondary"}
                      className={`guest-toggle-chip ${!newGuest ? "active" : ""}`}
                      onClick={() => {
                        setNewGuest(false);
                        setCustomer(null);
                      }}
                    >
                      <Search size={15} /> Tìm khách đã có
                    </Button>
                    <Button
                      type="button"
                      variant={newGuest ? "primary" : "secondary"}
                      className={`guest-toggle-chip ${newGuest ? "active" : ""}`}
                      onClick={() => {
                        setNewGuest(true);
                        setCustomer(null);
                      }}
                    >
                      <Plus size={15} /> Tạo hồ sơ mới
                    </Button>
                  </div>

                  {!newGuest ? (
                    <div className="walk-in-search-section">
                      <label className="walk-in-search-card">
                        <span className="search-field-title">
                          Tìm theo tên, điện thoại hoặc email
                        </span>
                        <div className="walk-in-search-input-box">
                          <Search size={16} className="search-box-icon" />
                          <input
                            className="input walk-in-customer-input"
                            name="search"
                            minLength={2}
                            maxLength={120}
                            defaultValue={search}
                            placeholder="Nhập tên, số điện thoại hoặc email khách hàng…"
                            aria-label="Tìm theo tên, điện thoại hoặc email"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                const val = (e.currentTarget as HTMLInputElement).value.trim();
                                setCustomerPage(1);
                                setSearch(val);
                              }
                            }}
                            onChange={(e) => {
                              const val = e.target.value.trim();
                              if (val.length >= 2) {
                                setCustomerPage(1);
                                setSearch(val);
                              }
                            }}
                            required={!customer}
                          />
                          <Button
                            type="button"
                            className="walk-in-search-customer-btn"
                            onClick={(e) => {
                              const input = e.currentTarget
                                .closest(".walk-in-search-input-box")
                                ?.querySelector("input");
                              if (input) {
                                setCustomerPage(1);
                                setSearch(input.value.trim());
                              }
                            }}
                          >
                            Tìm khách hàng
                          </Button>
                        </div>
                      </label>

                      {customer && (
                        <div className="walk-in-selected-customer-card">
                          <div className="selected-customer-avatar">
                            {customer.fullName.slice(0, 1).toUpperCase()}
                          </div>
                          <div className="selected-customer-info">
                            <div className="selected-customer-name-row">
                              <strong>{customer.fullName}</strong>
                              <span className="selected-badge">✓ Đã chọn hồ sơ</span>
                            </div>
                            <p className="selected-customer-meta">
                              <span>📞 {customer.phone ?? "Chưa có SĐT"}</span>
                              <span>✉️ {customer.email}</span>
                            </p>
                          </div>
                          <button
                            type="button"
                            className="change-customer-btn"
                            onClick={() => setCustomer(null)}
                            title="Chọn khách hàng khác"
                          >
                            Đổi khách khác
                          </button>
                        </div>
                      )}

                      {customer && (
                        <p className="notice" style={{ display: "none" }}>
                          Đã chọn: {customer.fullName} · {customer.email}
                        </p>
                      )}

                      {search.length >= 2 && !customer && (
                        <div className="walk-in-search-results">
                          {customers.isPending ? (
                            <Skeleton />
                          ) : customers.error ? (
                            <ErrorState
                              message={customers.error.message}
                              retry={() => void customers.refetch()}
                            />
                          ) : (
                            <>
                              <div className="desk-customers">
                                {customers.data!.data.map((c) => (
                                  <button
                                    type="button"
                                    className="panel"
                                    key={c.id}
                                    onClick={() => setCustomer(c)}
                                    aria-pressed={false}
                                  >
                                    <div className="customer-avatar-small">
                                      {c.fullName.slice(0, 1).toUpperCase()}
                                    </div>
                                    <div className="customer-info-small">
                                      <strong>{c.fullName}</strong>
                                      <span>
                                        {c.phone ? `${c.phone} · ` : ""}{c.email}
                                      </span>
                                    </div>
                                    <span className="select-customer-pill">
                                      Chọn khách này →
                                    </span>
                                  </button>
                                ))}
                              </div>
                              {!customers.data!.data.length && (
                                <p className="no-customer-text">
                                  Không tìm thấy khách với từ khóa trên. Bạn có thể chọn <strong>Tạo hồ sơ mới</strong>.
                                </p>
                              )}
                              <Pagination
                                {...customers.data!.meta}
                                onChange={setCustomerPage}
                              />
                            </>
                          )}
                        </div>
                      )}

                      {search.length < 2 && !customer && (
                        <div className="search-empty-hint">
                          <span className="hint-icon">💡</span>
                          <div>
                            <strong>Tìm kiếm nhanh hồ sơ khách:</strong>
                            <p>
                              Nhập tên, số điện thoại hoặc email của khách hàng để tra cứu lịch sử lưu trú. Nếu là khách mới, chuyển sang tab <strong>Tạo hồ sơ mới</strong> bên trên.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="walk-in-new-guest-card">
                      <div className="new-guest-header">
                        <h3>Thông tin khách mới tại quầy</h3>
                        <p>Hồ sơ khách sẽ được tạo và liên kết trực tiếp với booking này.</p>
                      </div>
                      <div className="new-guest-form-grid">
                        <label className="new-guest-field">
                          <span className="field-title">Họ và tên <span className="req">*</span></span>
                          <input
                            className="input"
                            name="fullName"
                            placeholder="Ví dụ: Nguyễn Văn An"
                            required
                            maxLength={120}
                            aria-label="Họ và tên"
                          />
                        </label>
                        <label className="new-guest-field">
                          <span className="field-title">Số điện thoại <span className="req">*</span></span>
                          <input
                            className="input"
                            name="phone"
                            type="tel"
                            placeholder="Ví dụ: 0901 234 567"
                            required
                            minLength={6}
                            maxLength={24}
                            aria-label="Số điện thoại"
                          />
                        </label>
                        <label className="new-guest-field field-full-width">
                          <span className="field-title">
                            Email <small className="field-hint-optional">(Không bắt buộc · Để trống nếu khách không có email)</small>
                          </span>
                          <input
                            className="input"
                            name="email"
                            type="email"
                            placeholder="Để trống nếu khách không có email"
                            maxLength={254}
                            aria-label="Email"
                          />
                        </label>
                      </div>
                    </div>
                  )}
                </div>

                {/* Cột phải (35%): Phiếu tóm tắt kỳ nghỉ & Nút xác nhận */}
                <div className="walk-in-summary-col">
                  <div className="walk-in-summary-card">
                    <div className="summary-header">
                      <span className="summary-eyebrow">PHIẾU ĐẶT PHÒNG</span>
                      <h3 className="summary-room-title">Phòng {room.roomNumber}</h3>
                      <p className="summary-room-type">
                        {room.roomType.name} · Tối đa {room.roomType.maxGuests} khách
                      </p>
                    </div>

                    <div className="summary-details-list">
                      <div className="summary-row">
                        <span>Thời gian lưu trú</span>
                        <strong>{availability.data?.nights} đêm</strong>
                      </div>
                      <div className="summary-row">
                        <span>Ngày nhận phòng</span>
                        <span>{stayDates.checkIn}</span>
                      </div>
                      <div className="summary-row">
                        <span>Ngày trả phòng</span>
                        <span>{stayDates.checkOut}</span>
                      </div>
                      <div className="summary-row">
                        <span>Số lượng khách</span>
                        <span>{stayDates.guests} người lớn</span>
                      </div>
                      <div className="summary-row">
                        <span>Giá niêm yết theo đêm</span>
                        <span>{money(room.roomType.nightlyPrice)}</span>
                      </div>
                    </div>

                    <div className="summary-divider" />

                    <div className="desk-total">
                      <span>Tổng tiền phòng:</span>
                      <strong className="summary-total-amount">
                        {money(room.estimatedTotalAmount!)}
                      </strong>
                    </div>

                    <div className="summary-action-area">
                      <Button
                        type="submit"
                        className="walk-in-confirm-submit-btn"
                        disabled={(!customer && !newGuest) || uncertain}
                      >
                        Xem lại booking
                      </Button>
                      {!customer && !newGuest && (
                        <p className="summary-hint-warning">
                          ⚠️ Hãy chọn hoặc điền thông tin khách để xem lại booking
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </form>
          </section>
        );
      })()}
      <Dialog
        open={!!review}
        onClose={() => {
          if (!lock.current) setReview(null);
        }}
        title="Xác nhận đặt phòng tại quầy"
      >
        {review && (
          <>
            <p>
              Phòng {room?.roomNumber} · {String(review.checkIn)} →{" "}
              {String(review.checkOut)}
            </p>
            <p>
              Khách: {customer?.fullName ?? String(review.fullName)} ·{" "}
              {String(review.guests)} người
            </p>
            <p>
              Tổng tiền phòng: {room && money(room.estimatedTotalAmount!)}.
              Booking bắt đầu ở trạng thái chờ xác nhận.
            </p>
            {mutation.error && (
              <p className="form-error" role="alert">
                {deskError(mutation.error, "booking")} Hãy kiểm tra danh sách
                booking trước khi thử lại.
              </p>
            )}
            <div className="dialog-actions">
              <LinkButton to={base + "/bookings"} variant="secondary">
                Kiểm tra booking
              </LinkButton>
              <Button
                busy={mutation.isPending}
                disabled={uncertain || !!mutation.error}
                onClick={() => {
                  if (lock.current) return;
                  lock.current = true;
                  mutation.mutate(review);
                }}
              >
                Xác nhận tạo booking
              </Button>
            </div>
          </>
        )}
      </Dialog>
    </div>
  );
}
