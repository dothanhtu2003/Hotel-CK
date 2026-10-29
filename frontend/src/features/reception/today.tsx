import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import {
  BedDouble,
  Brush,
  ChevronRight,
  ListChecks,
  LogIn,
  LogOut,
  PieChart,
  Plus,
  RefreshCw,
  Users,
} from "lucide-react";
import {
  Avatar,
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  StatCard,
  type BadgeTone,
} from "../../components/kamra-ui";
import { Button, Dialog, ErrorState, LinkButton } from "../../components/ui";
import { GuestBadge, Skeleton } from "../guest/components";
import { money, type Page } from "../guest/contracts";
import type { Dashboard, DeskBooking, DeskRoom } from "./contracts";
import { useDeskBase, useDeskGet, useRefreshDesk } from "./queries";
import { CheckInWizard } from "./check-in";
import { useAuth } from "../auth/auth-context";
import {
  calculateOccupancyPct,
  cleaningLabels,
  formatStayDateDisplay,
  hotelToday,
  roomState,
  shiftDate,
} from "./room-state";
import { UnifiedBookingModal } from "./unified-booking-modal";

function PaymentBadge() {
  return <Badge tone="zinc">Chưa thanh toán</Badge>;
}

export function ReceptionDashboard() {
  const base = useDeskBase(),
    refresh = useRefreshDesk(),
    navigate = useNavigate(),
    { user } = useAuth();
  const [params, setParams] = useSearchParams();

  const floorParam = params.get("floor");
  const stateParam = params.get("state");
  const modeParam = params.get("mode");
  const urlRoomId = params.get("roomId");
  const isBookingMode = modeParam === "booking";
  const [guestTab, setGuestTab] = useState<"arrivals" | "departures" | "staying">("arrivals");

  const floor = floorParam || "All";
  const setFloor = (newFloor: string) => {
    const next = new URLSearchParams(params);
    if (newFloor === "All") next.delete("floor");
    else next.set("floor", newFloor);
    setParams(next);
  };

  const [manualSelectedRoom, setManualSelectedRoom] = useState<DeskRoom | null | undefined>(undefined);
  const [manualBookingRoom, setManualBookingRoom] = useState<DeskRoom | null | undefined>(undefined);

  const query = useDeskGet<Dashboard>("/front-desk/dashboard");

  // Facets for complete floor list
  const facets = useDeskGet<{
    types: { id: string; name: string }[];
    floors: number[];
  }>("/front-desk/room-filters");

  // Get room list for Room Board, filtered by floor on the server if selected
  const roomsPath =
    floor === "All"
      ? `/front-desk/rooms?pageSize=100`
      : `/front-desk/rooms?pageSize=100&floor=${floor}`;
  const roomsQuery = useDeskGet<Page<DeskRoom>>(roomsPath);

  // Get active in-house guests for the In-House table
  const stayingQuery = useDeskGet<Page<DeskBooking>>(
    "/front-desk/bookings?view=staying&pageSize=8",
  );

  const d = query.data;
  const allRooms = roomsQuery.data?.data || [];
  const todayStr = d?.today ?? hotelToday();

  // Selected room for action drawer
  const selectedRoom =
    manualSelectedRoom !== undefined
      ? manualSelectedRoom
      : urlRoomId && !isBookingMode
      ? allRooms.find((r) => r.id === urlRoomId) ?? null
      : null;

  // Selected room for UnifiedBookingModal
  const bookingRoom =
    manualBookingRoom !== undefined
      ? manualBookingRoom
      : urlRoomId && isBookingMode
      ? allRooms.find((r) => r.id === urlRoomId) ?? null
      : null;

  const setSelectedRoom = (r: DeskRoom | null) => setManualSelectedRoom(r);
  const setBookingRoom = (r: DeskRoom | null) => setManualBookingRoom(r);

  // Determine floors available from facets or loaded rooms
  const floorList =
    facets.data?.floors && facets.data.floors.length > 0
      ? [...facets.data.floors].sort((a, b) => Number(a) - Number(b))
      : Array.from(new Set(allRooms.map((r) => r.floor || 1))).sort(
          (a, b) => Number(a) - Number(b),
        );

  const shownRooms = allRooms.filter((r) => {
    if (floor !== "All" && String(r.floor) !== floor) return false;
    if (stateParam === "ready") {
      if (roomState(r) !== "ready") return false;
    } else if (stateParam === "occupied") {
      if (!r.bookings.some((b) => b.status === "CHECKED_IN")) return false;
    } else if (stateParam === "dirty") {
      if (
        r.housekeepingStatus !== "DIRTY" &&
        r.housekeepingStatus !== "CLEANING"
      ) {
        return false;
      }
    }
    return true;
  });

  // Group shown rooms by floor for display
  const shownFloors =
    floor === "All" ? floorList : [Number(floor)];

  const occupancyPct = calculateOccupancyPct(
    d?.occupiedRooms ?? 0,
    d?.totalRooms ?? 0,
  );

  const hh = new Date().getHours();
  const greeting =
    hh < 12
      ? "Chào buổi sáng"
      : hh < 18
      ? "Chào buổi chiều"
      : "Chào buổi tối";

  const todayPretty = d?.today
    ? new Date(d.today + "T00:00:00Z").toLocaleDateString("vi-VN", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      })
    : "";

  const handleRoomClick = (room: DeskRoom) => {
    if (isBookingMode) {
      setBookingRoom(room);
    } else {
      setSelectedRoom(room);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Greeting Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">
            Tổng quan lễ tân
          </h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            {greeting}, <strong className="font-medium text-zinc-800">{user?.fullName}</strong>. Dưới đây là tình hình vận hành hôm nay: {todayPretty}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={query.isFetching}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 shadow-2xs transition-colors cursor-pointer"
          >
            <RefreshCw
              className={`size-3.5 text-zinc-500 ${query.isFetching ? "animate-spin" : ""}`}
            />
            <span>Làm mới</span>
          </button>
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
        d && (
          <>
            {/* Top 6 KPI StatCards */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6 desk-stats today-metrics">
              <StatCard
                className="today-metric metric-arrivals"
                icon={<LogIn className="size-4" />}
                label="Khách đến"
                value={d.counts.arrivals}
                to={`${base}/bookings?view=arrivals`}
                sub={`${d.bookingCounts?.arrivals ?? d.arrivals.length} booking hôm nay`}
              />
              <StatCard
                className="today-metric metric-departures"
                icon={<LogOut className="size-4" />}
                label="Khách đi"
                value={d.counts.departures}
                to={`${base}/bookings?view=departures`}
                sub={`${d.bookingCounts?.departures ?? d.departures.length} booking trả phòng`}
              />
              <StatCard
                className="today-metric metric-staying"
                icon={<Users className="size-4" />}
                label="Đang ở (In-house)"
                value={d.counts.staying}
                to={`${base}/bookings?view=staying`}
                sub={`${d.bookingCounts?.staying ?? d.counts.staying} khách đang lưu trú`}
              />
              <StatCard
                className="today-metric"
                icon={<PieChart className="size-4" />}
                label="Công suất phòng"
                value={`${occupancyPct}%`}
                progress={occupancyPct}
                progressLabel={`${d.occupiedRooms} / ${d.totalRooms} phòng`}
                to={`${base}?state=occupied`}
              />
              <StatCard
                className="today-metric"
                icon={<BedDouble className="size-4" />}
                label="Phòng sẵn sàng"
                value={d.counts.ready}
                sub={`${d.counts.dirty} phòng chưa dọn`}
                to={`${base}?state=ready`}
              />
              <StatCard
                className="today-metric"
                icon={<ListChecks className="size-4" />}
                label="Việc buồng phòng"
                value={d.openTasks}
                sub={`${d.counts.dirty} phòng cần xử lý`}
                to={`${base}/housekeeping`}
              />
            </div>

            {/* Quick Alert Bar for pending operations */}
            {(d.counts.pending > 0 || d.counts.orders > 0) && (
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900">
                <span className="font-semibold uppercase tracking-wider">Cần lưu ý:</span>
                {d.counts.pending > 0 && (
                  <Link
                    to={`${base}/bookings?status=PENDING`}
                    className="inline-flex items-center gap-1 font-medium hover:underline text-amber-800"
                  >
                    <span>{d.counts.pending} booking chờ xác nhận</span>
                    <ChevronRight className="size-3" />
                  </Link>
                )}
                {d.counts.orders > 0 && (
                  <Link
                    to={`${base}/service-orders?status=PENDING`}
                    className="inline-flex items-center gap-1 font-medium hover:underline text-amber-800"
                  >
                    <span>{d.counts.orders} đơn dịch vụ phòng chờ xử lý</span>
                    <ChevronRight className="size-3" />
                  </Link>
                )}
              </div>
            )}

            {/* 2-Column Responsive Layout: Left is narrower, Right (Room Board) is wider for 4+ columns per row */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              {/* Left Column: Unified Room Board (Primary Focus) */}
              <div className="space-y-6 lg:col-span-7 xl:col-span-7 2xl:col-span-8">
                {/* Unified Room Board Card */}
                <Card>
                  <CardHeader>
                    <div>
                      <CardTitle>Bảng trạng thái phòng (Room Board)</CardTitle>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        Phân bố theo tầng · Click vào phòng để xem hoặc thao tác nhanh
                      </p>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* Booking Mode Banner */}
                    {isBookingMode && (
                      <div className="mb-3 flex items-center justify-between rounded-lg border border-brand-200 bg-brand-50/80 px-3 py-2 text-xs text-brand-900">
                        <div className="flex items-center gap-2">
                          <Plus className="size-4 text-brand-600 shrink-0" />
                          <span>
                            <strong>Chế độ đặt phòng mới:</strong> Chọn phòng phù hợp trên sơ đồ bên dưới để tạo booking.
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const next = new URLSearchParams(params);
                            next.delete("mode");
                            setParams(next);
                          }}
                          className="text-xs font-semibold text-brand-700 hover:underline cursor-pointer"
                        >
                          Thoát chế độ
                        </button>
                      </div>
                    )}

                    {/* Floor Tabs & Filters */}
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 pb-2">
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          onClick={() => setFloor("All")}
                          className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                            floor === "All"
                              ? "bg-brand-50 text-brand-700 font-semibold"
                              : "text-zinc-500 hover:text-zinc-800"
                          }`}
                        >
                          Tất cả các tầng
                        </button>
                        {floorList.map((fl) => (
                          <button
                            key={fl}
                            type="button"
                            onClick={() => setFloor(String(fl))}
                            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                              floor === String(fl)
                                ? "bg-brand-50 text-brand-700 font-semibold"
                                : "text-zinc-500 hover:text-zinc-800"
                            }`}
                          >
                            Tầng {fl}
                          </button>
                        ))}
                      </div>

                      {stateParam && (
                        <div className="flex items-center gap-1.5 text-xs text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded-md">
                          <span>
                            Lọc:{" "}
                            <strong>
                              {stateParam === "ready"
                                ? "Trống sạch"
                                : stateParam === "occupied"
                                ? "Đang ở"
                                : "Cần dọn"}
                            </strong>
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const next = new URLSearchParams(params);
                              next.delete("state");
                              setParams(next);
                            }}
                            className="font-bold text-zinc-400 hover:text-zinc-800 ml-1 cursor-pointer"
                            title="Xóa bộ lọc"
                          >
                            ×
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Room Grid by Floor */}
                    {roomsQuery.isPending ? (
                      <div className="py-8">
                        <Skeleton />
                      </div>
                    ) : roomsQuery.error ? (
                      <div className="py-6">
                        <ErrorState
                          message={roomsQuery.error.message}
                          retry={() => void roomsQuery.refetch()}
                        />
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {shownFloors.map((fl) => {
                        const roomsOnFloor = shownRooms.filter(
                          (r) => Number(r.floor || 1) === fl,
                        );
                        if (!roomsOnFloor.length) return null;
                        return (
                          <div key={fl} className="flex items-start gap-2.5 sm:gap-3">
                            <div className="w-11 sm:w-13 shrink-0 pt-2 text-xs font-semibold text-zinc-400">
                              Tầng {fl}
                            </div>
                            <div className="grid flex-1 grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2 sm:gap-2.5">
                              {roomsOnFloor.map((room) => {
                                const occupiedBooking = room.bookings.find(
                                  (b) => b.status === "CHECKED_IN",
                                );
                                const occupied = Boolean(occupiedBooking);
                                const isDirty = room.housekeepingStatus === "DIRTY";
                                const isCleaning = room.housekeepingStatus === "CLEANING";
                                const isOoo = room.operationalStatus !== "ACTIVE";
                                const isClean = !occupied && !isDirty && !isCleaning && !isOoo;

                                const arrivingBooking =
                                  !occupied &&
                                  (room.bookings.find(
                                    (b) => b.status === "CONFIRMED" && b.checkIn === todayStr,
                                  ) ||
                                    (d?.arrivals || []).find(
                                      (a) => a.roomNumber === room.roomNumber,
                                    ));

                                const isDepartingToday =
                                  occupied && occupiedBooking?.checkOut === todayStr;
                                const isOverdue =
                                  occupied &&
                                  Boolean(
                                    occupiedBooking?.checkOut &&
                                      occupiedBooking.checkOut < todayStr,
                                  );

                                const statusToneClass = occupied
                                  ? "border-brand-700 bg-brand-700 text-white shadow-xs"
                                  : isOoo
                                  ? "border-rose-300 bg-rose-50 text-rose-950 hover:bg-rose-100/70"
                                  : isDirty
                                  ? "border-amber-300 bg-amber-50 text-amber-950 hover:bg-amber-100/70"
                                  : isCleaning
                                  ? "border-sky-300 bg-sky-50 text-sky-950 hover:bg-sky-100/70"
                                  : "border-emerald-300 bg-emerald-50 text-emerald-950 hover:bg-emerald-100/70";

                                const staySubInfo = occupiedBooking
                                  ? [
                                      occupiedBooking.nights && occupiedBooking.nights > 0
                                        ? `${occupiedBooking.nights} đêm`
                                        : null,
                                      occupiedBooking.guestCount && occupiedBooking.guestCount > 0
                                        ? `${occupiedBooking.guestCount} khách`
                                        : null,
                                    ]
                                      .filter(Boolean)
                                      .join(" · ")
                                  : "";

                                return (
                                  <button
                                    key={room.id}
                                    type="button"
                                    onClick={() => handleRoomClick(room)}
                                    className={`today-room w-full min-h-[132px] flex flex-col justify-between rounded-xl border p-2 sm:p-2.5 text-start transition-all cursor-pointer hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-brand-600 ${statusToneClass} ${
                                      isBookingMode && isClean
                                        ? "ring-2 ring-brand-500 ring-offset-1"
                                        : ""
                                    }`}
                                  >
                                    {/* Top Row: Room Number & Icon / Badges */}
                                    <div>
                                      <div className="flex items-center justify-between gap-1">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                          <strong className="text-[15px] sm:text-[17px] font-extrabold tracking-tight tabular-nums leading-none truncate">
                                            {room.roomNumber}
                                          </strong>
                                          {isDepartingToday && (
                                            <span
                                              className="rounded bg-amber-400 text-amber-950 px-1.5 py-0.5 text-[9px] font-bold leading-none shrink-0"
                                              title="Khách dự kiến trả phòng hôm nay"
                                            >
                                              Trả hôm nay
                                            </span>
                                          )}
                                          {isOverdue && (
                                            <span
                                              className="rounded bg-rose-500 text-white px-1.5 py-0.5 text-[9px] font-bold leading-none shrink-0"
                                              title="Quá hạn ngày trả phòng"
                                            >
                                              Quá hạn
                                            </span>
                                          )}
                                          {!occupied && arrivingBooking && (
                                            <span
                                              className="rounded bg-sky-200 text-sky-950 px-1 py-0.5 text-[9px] font-bold leading-none shrink-0"
                                              title="Có booking sắp nhận phòng hôm nay"
                                            >
                                              Sắp đến
                                            </span>
                                          )}
                                        </div>
                                        {occupied ? (
                                          <BedDouble className="size-3.5 shrink-0 text-emerald-200" />
                                        ) : arrivingBooking ? (
                                          <LogIn className="size-3.5 shrink-0 text-sky-600" />
                                        ) : null}
                                      </div>

                                      {/* Status Label (10-11px, font-semibold, uppercase) */}
                                      <div
                                        className={`mt-1 text-[10px] font-semibold uppercase tracking-wider leading-none ${
                                          occupied
                                            ? "text-emerald-200/90"
                                            : isOoo
                                            ? "text-rose-700"
                                            : isDirty
                                            ? "text-amber-700"
                                            : isCleaning
                                            ? "text-sky-700"
                                            : "text-emerald-700"
                                        }`}
                                      >
                                        {occupied
                                          ? "ĐANG Ở"
                                          : isOoo
                                          ? "BẢO TRÌ"
                                          : isDirty
                                          ? "CẦN DỌN"
                                          : isCleaning
                                          ? "ĐANG DỌN"
                                          : "TRỐNG SẠCH"}
                                      </div>
                                    </div>

                                    {/* Middle Section: Specific per Status */}
                                    {occupied && occupiedBooking ? (
                                      <div className="border-t border-emerald-600/40 pt-1.5 my-1.5 space-y-0.5">
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-[9.5px] font-semibold text-emerald-200/80 w-5.5 shrink-0">
                                            IN
                                          </span>
                                          <span className="text-[12.5px] sm:text-[13px] font-bold text-white tabular-nums leading-none">
                                            {formatStayDateDisplay(
                                              occupiedBooking.checkIn,
                                              todayStr,
                                            )}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-[9.5px] font-semibold text-emerald-200/80 w-5.5 shrink-0">
                                            OUT
                                          </span>
                                          <span className="text-[12.5px] sm:text-[13px] font-bold text-white tabular-nums leading-none">
                                            {formatStayDateDisplay(
                                              occupiedBooking.checkOut,
                                              todayStr,
                                            )}
                                          </span>
                                        </div>
                                        {staySubInfo ? (
                                          <div className="text-[10px] font-medium text-emerald-100/75 truncate pt-0.5">
                                            {staySubInfo}
                                          </div>
                                        ) : null}
                                      </div>
                                    ) : isClean ? (
                                      <div className="my-1.5 space-y-0.5">
                                        <div className="text-[11px] font-semibold text-emerald-900/80 tabular-nums">
                                          {money(room.roomType.nightlyPrice)}/đêm
                                        </div>
                                        <div className="text-[10px] text-emerald-700/75">
                                          Tối đa {room.roomType.maxGuests} khách
                                        </div>
                                      </div>
                                    ) : isDirty || isCleaning ? (
                                      <div className="my-1.5 space-y-0.5">
                                        <div className="text-[10px] font-medium">
                                          {room.openTaskCount > 0
                                            ? `${room.openTaskCount} việc buồng phòng`
                                            : isCleaning
                                            ? "Đang dọn dẹp"
                                            : "Chờ dọn dẹp"}
                                        </div>
                                        <div className="text-[10px] opacity-75">
                                          {cleaningLabels[room.housekeepingStatus] ??
                                            room.housekeepingStatus}
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="my-1.5 text-[10px] font-medium opacity-80">
                                        Ngưng phục vụ
                                      </div>
                                    )}

                                    {/* Bottom: Room Type Name */}
                                    <div
                                      className={`text-[10px] truncate mt-auto pt-1 ${
                                        occupied ? "text-emerald-200/70" : "opacity-75"
                                      }`}
                                    >
                                      {room.roomType.name}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}

                      {shownRooms.length === 0 && (
                        <div className="py-8 text-center text-sm text-zinc-400">
                          Không có phòng nào phù hợp với bộ lọc hiện tại.
                        </div>
                      )}
                    </div>
                  )}

                    {roomsQuery.data?.meta && (
                      <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50/80 px-3 py-2 text-xs text-zinc-600 flex items-center justify-between">
                        <span>
                          Đang hiển thị {shownRooms.length} phòng{" "}
                          {floor !== "All" ? `tại tầng ${floor}` : "toàn khách sạn"}.
                        </span>
                        {stateParam && (
                          <button
                            type="button"
                            onClick={() => {
                              const next = new URLSearchParams(params);
                              next.delete("state");
                              setParams(next);
                            }}
                            className="font-medium text-brand-700 hover:underline cursor-pointer"
                          >
                            Xem tất cả trạng thái
                          </button>
                        )}
                      </div>
                    )}

                    {/* Room Board Legend */}
                    <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="size-2.5 rounded-full bg-emerald-500" />
                        Trống sạch
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="size-2.5 rounded-full bg-brand-600" />
                        Đang ở
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="size-2.5 rounded-full bg-amber-500" />
                        Cần dọn
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="size-2.5 rounded-full bg-sky-500" />
                        Đang dọn
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="size-2.5 rounded-full bg-rose-500" />
                        Bảo trì
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right Column: Arrivals, Departures, In-House Guests & Housekeeping Overview */}
              <div className="space-y-6 lg:col-span-5 xl:col-span-5 2xl:col-span-4">
                {/* Unified Guest Operations Hub (1 Card with 3 Segmented Tabs) */}
                <Card>
                  <CardHeader className="pb-2.5 border-b border-zinc-100 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                        Điều phối khách
                      </span>
                      <Link
                        to={
                          guestTab === "arrivals"
                            ? `${base}/bookings?view=arrivals`
                            : guestTab === "departures"
                            ? `${base}/bookings?view=departures`
                            : `${base}/bookings?view=staying`
                        }
                        className="text-xs font-medium text-brand-700 hover:underline shrink-0"
                      >
                        Xem tất cả →
                      </Link>
                    </div>

                    <div className="flex items-center gap-1 bg-zinc-100/90 p-1 rounded-lg w-full" role="tablist">
                      <button
                        type="button"
                        role="tab"
                        aria-selected={guestTab === "arrivals"}
                        onClick={() => setGuestTab("arrivals")}
                        className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap cursor-pointer ${
                          guestTab === "arrivals"
                            ? "bg-white text-zinc-900 font-semibold shadow-xs"
                            : "text-zinc-500 hover:text-zinc-800"
                        }`}
                      >
                        <LogIn className="size-3.5 text-brand-700 shrink-0" />
                        <span>Khách đến</span>
                        <Badge tone="sky" className="text-[10px] px-1.5 py-0 leading-tight">
                          {d.arrivals.length}
                        </Badge>
                      </button>

                      <button
                        type="button"
                        role="tab"
                        aria-selected={guestTab === "departures"}
                        onClick={() => setGuestTab("departures")}
                        className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap cursor-pointer ${
                          guestTab === "departures"
                            ? "bg-white text-zinc-900 font-semibold shadow-xs"
                            : "text-zinc-500 hover:text-zinc-800"
                        }`}
                      >
                        <LogOut className="size-3.5 text-amber-700 shrink-0" />
                        <span>Khách đi</span>
                        <Badge tone="amber" className="text-[10px] px-1.5 py-0 leading-tight">
                          {d.departures.length}
                        </Badge>
                      </button>

                      <button
                        type="button"
                        role="tab"
                        aria-selected={guestTab === "staying"}
                        onClick={() => setGuestTab("staying")}
                        className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap cursor-pointer ${
                          guestTab === "staying"
                            ? "bg-white text-zinc-900 font-semibold shadow-xs"
                            : "text-zinc-500 hover:text-zinc-800"
                        }`}
                      >
                        <Users className="size-3.5 text-brand-700 shrink-0" />
                        <span>Đang ở</span>
                        <Badge tone="brand" className="text-[10px] px-1.5 py-0 leading-tight">
                          {d.counts.staying}
                        </Badge>
                      </button>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-2 max-h-[460px] overflow-y-auto">
                    {/* Tab 1: Khách đến */}
                    {guestTab === "arrivals" && (
                      d.arrivals.length === 0 ? (
                        <p className="py-12 text-center text-sm text-zinc-400">
                          Không có khách đến dự kiến hôm nay.
                        </p>
                      ) : (
                        <ul className="divide-y divide-zinc-100">
                          {d.arrivals.map((b) => (
                            <li
                              key={b.id}
                              className="flex items-start justify-between gap-3 py-3"
                            >
                              <div className="min-w-0 flex-1 space-y-1">
                                <div className="flex items-center gap-2">
                                  <Link
                                    to={`${base}/bookings/${b.id}`}
                                    className="truncate text-sm font-semibold text-zinc-900 hover:text-brand-700"
                                  >
                                    {b.customer?.fullName ?? b.reference}
                                  </Link>
                                </div>
                                <div className="text-xs text-zinc-500 truncate">
                                  <span className="font-semibold text-zinc-700">
                                    {b.roomNumber
                                      ? `Phòng ${b.roomNumber}`
                                      : "Chưa xếp phòng"}
                                  </span>{" "}
                                  · {b.nights} đêm · {b.guestCount} khách
                                </div>
                                <div className="flex items-center gap-1.5 pt-0.5">
                                  <Badge tone="brand" className="text-[10.5px] px-2 py-0.5 whitespace-nowrap">
                                    Trực tiếp
                                  </Badge>
                                  <PaymentBadge />
                                </div>
                              </div>
                              <div className="shrink-0 pt-0.5">
                                {b.status === "CONFIRMED" ? (
                                  <CheckInWizard bookingId={b.id} />
                                ) : (
                                  <Link
                                    to={`${base}/bookings/${b.id}`}
                                    className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 shadow-2xs"
                                  >
                                    Chi tiết
                                  </Link>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      )
                    )}

                    {/* Tab 2: Khách đi */}
                    {guestTab === "departures" && (
                      d.departures.length === 0 ? (
                        <p className="py-12 text-center text-sm text-zinc-400">
                          Không có khách trả phòng dự kiến hôm nay.
                        </p>
                      ) : (
                        <ul className="divide-y divide-zinc-100">
                          {d.departures.map((b) => (
                            <li
                              key={b.id}
                              className="flex items-start justify-between gap-3 py-3"
                            >
                              <div className="min-w-0 flex-1 space-y-1">
                                <div className="flex items-center gap-2">
                                  <Link
                                    to={`${base}/bookings/${b.id}`}
                                    className="truncate text-sm font-semibold text-zinc-900 hover:text-brand-700"
                                  >
                                    {b.customer?.fullName ?? b.reference}
                                  </Link>
                                </div>
                                <div className="text-xs text-zinc-500 truncate">
                                  <span className="font-semibold text-zinc-700">
                                    Phòng {b.roomNumber}
                                  </span>{" "}
                                  · {b.nights} đêm lưu trú
                                </div>
                                <div className="flex items-center gap-1.5 pt-0.5">
                                  <Badge tone="amber" className="text-[10.5px] px-2 py-0.5 whitespace-nowrap">
                                    Trả phòng hôm nay
                                  </Badge>
                                </div>
                              </div>
                              <div className="shrink-0 pt-0.5">
                                <Link
                                  to={`${base}/bookings/${b.id}/billing`}
                                  className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-800 hover:bg-zinc-50 shadow-2xs"
                                >
                                  Trả phòng
                                </Link>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )
                    )}

                    {/* Tab 3: Đang ở (In-House) */}
                    {guestTab === "staying" && (
                      stayingQuery.data?.data.length === 0 ? (
                        <p className="py-12 text-center text-sm text-zinc-400">
                          Hiện chưa có khách nào đang nhận phòng.
                        </p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-zinc-100 text-left text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                                <th className="pb-2 ps-1">Khách</th>
                                <th className="pb-2">Phòng</th>
                                <th className="pb-2">Lưu trú</th>
                                <th className="pb-2 pe-1 text-right">Trả phòng</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100">
                              {(stayingQuery.data?.data || []).map((row) => (
                                <tr
                                  key={row.id}
                                  onClick={() => navigate(`${base}/bookings/${row.id}`)}
                                  className="cursor-pointer hover:bg-zinc-50/70"
                                >
                                  <td className="py-2.5 ps-1">
                                    <div className="flex items-center gap-2">
                                      <Avatar name={row.customer?.fullName || row.reference} />
                                      <span className="font-medium text-zinc-800 truncate max-w-[120px]">
                                        {row.customer?.fullName || row.reference}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="py-2.5 tabular-nums font-semibold text-zinc-700">
                                    {row.roomNumber}
                                  </td>
                                  <td className="py-2.5 text-xs text-zinc-500">
                                    {row.nights} đêm
                                  </td>
                                  <td className="py-2.5 pe-1 text-right tabular-nums text-xs text-zinc-600">
                                    {formatStayDateDisplay(row.checkOut, todayStr)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )
                    )}
                  </CardContent>
                </Card>

                {/* Housekeeping Summary Card */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Brush className="size-4 text-brand-700" />
                      <CardTitle>Tình trạng buồng phòng</CardTitle>
                    </div>
                    <Link
                      to={`${base}/housekeeping`}
                      className="text-xs font-medium text-brand-700 hover:underline"
                    >
                      Bảng buồng phòng →
                    </Link>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-2">
                      <Link
                        to={`${base}?state=ready`}
                        className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 hover:border-brand-300 transition-colors"
                      >
                        <span className="size-2 rounded-full bg-emerald-500 shrink-0" />
                        <span className="text-lg font-semibold tabular-nums text-zinc-900">
                          {d.counts.ready}
                        </span>
                        <span className="text-xs text-zinc-500">Sẵn sàng</span>
                      </Link>

                      <Link
                        to={`${base}?state=dirty`}
                        className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 hover:border-brand-300 transition-colors"
                      >
                        <span className="size-2 rounded-full bg-amber-500 shrink-0" />
                        <span className="text-lg font-semibold tabular-nums text-zinc-900">
                          {d.counts.dirty}
                        </span>
                        <span className="text-xs text-zinc-500">Cần dọn</span>
                      </Link>

                      <Link
                        to={`${base}/housekeeping`}
                        className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 hover:border-brand-300 transition-colors"
                      >
                        <span className="size-2 rounded-full bg-sky-500 shrink-0" />
                        <span className="text-lg font-semibold tabular-nums text-zinc-900">
                          {d.openTasks}
                        </span>
                        <span className="text-xs text-zinc-500">Nhiệm vụ mở</span>
                      </Link>

                      <Link
                        to={`${base}?state=occupied`}
                        className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 hover:border-brand-300 transition-colors"
                      >
                        <span className="size-2 rounded-full bg-brand-600 shrink-0" />
                        <span className="text-lg font-semibold tabular-nums text-zinc-900">
                          {d.occupiedRooms}
                        </span>
                        <span className="text-xs text-zinc-500">Đang ở</span>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Room Detail & Action Drawer Dialog */}
            <Dialog
              open={Boolean(selectedRoom)}
              onClose={() => setSelectedRoom(null)}
              title={`Thao tác phòng ${selectedRoom?.roomNumber ?? ""}`}
              className="desk-room-action-drawer"
            >
              {selectedRoom && (() => {
                const occupiedBooking = selectedRoom.bookings.find(
                  (b) => b.status === "CHECKED_IN",
                );
                const isDirty = selectedRoom.housekeepingStatus === "DIRTY";
                const isCleaning = selectedRoom.housekeepingStatus === "CLEANING";
                const isOoo = selectedRoom.operationalStatus !== "ACTIVE";
                const isClean = !occupiedBooking && !isDirty && !isCleaning && !isOoo;
                const statusLabel = occupiedBooking
                  ? "Đang ở"
                  : isOoo
                  ? "Bảo trì"
                  : isDirty
                  ? "Cần dọn"
                  : isCleaning
                  ? "Đang dọn"
                  : "Trống sạch";
                const statusBadgeTone: BadgeTone = occupiedBooking
                  ? "brand"
                  : isOoo
                  ? "rose"
                  : isDirty
                  ? "amber"
                  : isCleaning
                  ? "sky"
                  : "green";

                return (
                  <div className="drawer-body space-y-4">
                    {/* Room Hero Banner */}
                    <div className="flex items-center justify-between rounded-xl bg-zinc-50 p-3 border border-zinc-200">
                      <div>
                        <h3 className="text-lg font-bold text-zinc-900">
                          Phòng {selectedRoom.roomNumber}
                        </h3>
                        <p className="text-xs text-zinc-500">
                          {selectedRoom.roomType.name} · Tầng {selectedRoom.floor} · {money(selectedRoom.roomType.nightlyPrice)}/đêm · Tối đa {selectedRoom.roomType.maxGuests} khách
                        </p>
                      </div>
                      <Badge tone={statusBadgeTone}>{statusLabel}</Badge>
                    </div>

                    {/* Guest Card if Occupied */}
                    {occupiedBooking && (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5 text-xs text-emerald-950">
                        <div className="flex items-center justify-between pb-2 border-b border-emerald-200/60">
                          <span className="font-semibold uppercase tracking-wider text-[10px] text-emerald-800">
                            THÔNG TIN KHÁCH ĐANG Ở
                          </span>
                          <GuestBadge status={occupiedBooking.status} />
                        </div>
                        <strong className="block text-sm font-bold text-zinc-900 mt-2">
                          {occupiedBooking.customer?.fullName ?? "Khách lẻ tại quầy"}
                        </strong>
                        <dl className="grid grid-cols-2 gap-2 mt-2">
                          <div>
                            <dt className="text-zinc-500 text-[11px]">Điện thoại</dt>
                            <dd className="font-medium">{occupiedBooking.customer?.phone || "Chưa có SĐT"}</dd>
                          </div>
                          <div>
                            <dt className="text-zinc-500 text-[11px]">Mã booking</dt>
                            <dd className="font-mono font-medium">{occupiedBooking.reference}</dd>
                          </div>
                          <div>
                            <dt className="text-zinc-500 text-[11px]">Lưu trú hiện tại</dt>
                            <dd className="font-medium">
                              {occupiedBooking.checkIn} → {occupiedBooking.checkOut} ({occupiedBooking.nights} đêm)
                            </dd>
                          </div>
                          <div>
                            <dt className="text-zinc-500 text-[11px]">Tiền phòng</dt>
                            <dd className="font-bold text-brand-700">{money(occupiedBooking.totalRoomAmount)}</dd>
                          </div>
                        </dl>
                      </div>
                    )}

                    {/* Tasks alert if any */}
                    {selectedRoom.openTaskCount > 0 && (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 flex items-center gap-2">
                        <span className="font-bold">⚠️ Buồng phòng:</span>
                        <span>Có {selectedRoom.openTaskCount} công việc dọn dẹp cần hoàn tất.</span>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="space-y-2 pt-2 border-t border-zinc-100">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                        THAO TÁC
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {isClean && (
                          <Button
                            onClick={() => {
                              const r = selectedRoom;
                              setSelectedRoom(null);
                              setBookingRoom(r);
                            }}
                          >
                            <Plus className="size-4" /> Đặt phòng này ({money(selectedRoom.roomType.nightlyPrice)}/đêm)
                          </Button>
                        )}

                        {occupiedBooking && (
                          <>
                            <LinkButton
                              to={`${base}/bookings/${occupiedBooking.id}/billing`}
                              onClick={() => setSelectedRoom(null)}
                            >
                              Trả phòng & Hóa đơn
                            </LinkButton>
                            <LinkButton
                              variant="secondary"
                              to={`${base}/bookings/${occupiedBooking.id}`}
                              onClick={() => setSelectedRoom(null)}
                            >
                              Chi tiết booking
                            </LinkButton>
                            <Button
                              variant="secondary"
                              onClick={() => {
                                const r = selectedRoom;
                                setSelectedRoom(null);
                                setBookingRoom(r);
                              }}
                            >
                              <Plus className="size-4" /> Đặt phòng cho ngày tương lai
                            </Button>
                          </>
                        )}

                        {!isClean && !occupiedBooking && (
                          <Button
                            variant="secondary"
                            onClick={() => {
                              const r = selectedRoom;
                              setSelectedRoom(null);
                              setBookingRoom(r);
                            }}
                          >
                            <Plus className="size-4" /> Đặt phòng cho ngày tương lai
                          </Button>
                        )}

                        <LinkButton
                          variant="secondary"
                          to={`${base}/housekeeping`}
                          onClick={() => setSelectedRoom(null)}
                        >
                          Điều phối buồng phòng
                        </LinkButton>
                      </div>
                    </div>

                    {/* Related bookings list */}
                    {selectedRoom.bookings.length > 0 && (
                      <div className="space-y-2 pt-2 border-t border-zinc-100">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                          LỊCH ĐẶT LIÊN QUAN ({selectedRoom.bookings.length})
                        </span>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {selectedRoom.bookings.map((b) => (
                            <div
                              key={b.id}
                              className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-2.5 text-xs"
                            >
                              <div>
                                <div className="flex items-center gap-2">
                                  <strong className="text-zinc-800">
                                    {b.customer?.fullName ?? "Khách lẻ"}
                                  </strong>
                                  <GuestBadge status={b.status} />
                                </div>
                                <p className="text-zinc-500 mt-0.5">
                                  {b.reference} · {b.checkIn} → {b.checkOut} ({b.nights} đêm)
                                </p>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <LinkButton
                                  variant="secondary"
                                  to={`${base}/bookings/${b.id}`}
                                  onClick={() => setSelectedRoom(null)}
                                  className="text-xs py-1 px-2"
                                >
                                  Chi tiết
                                </LinkButton>
                                {b.status === "CHECKED_IN" && (
                                  <LinkButton
                                    to={`${base}/bookings/${b.id}/billing`}
                                    onClick={() => setSelectedRoom(null)}
                                    className="text-xs py-1 px-2"
                                  >
                                    Trả phòng
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
              initialCheckIn={todayStr}
              initialCheckOut={shiftDate(todayStr, 1)}
              initialGuests={2}
              onSuccess={() => {
                setBookingRoom(null);
                void roomsQuery.refetch();
                void query.refetch();
              }}
            />
          </>
        )
      )}
    </div>
  );
}
