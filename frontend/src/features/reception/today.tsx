import { useState, type MouseEvent } from "react";
import { Link, useLocation, useSearchParams } from "react-router";
import {
  Bell,
  BellRing,
  BedDouble,
  Broom,
  Calendar,
  ChevronRight,
  FileText,
  LogIn,
  Phone,
  Plus,
  Receipt,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Users,
  Wrench,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/kamra-ui";
import { Button, Dialog, ErrorState, LinkButton } from "../../components/ui";
import { GuestBadge, Skeleton } from "../guest/components";
import { money, type Page } from "../guest/contracts";
import type { Dashboard, DeskRoom, DeskBooking } from "./contracts";
import { useDeskBase, useDeskGet, useRefreshDesk } from "./queries";

import {
  cleaningLabels,
  formatStayDateDisplay,
  hotelToday,
  roomState,
  shiftDate,
} from "./room-state";
import { UnifiedBookingModal } from "./unified-booking-modal";

import { RoomRequestsDrawer, useRoomRequests } from "./room-requests";
import { RoomConditionEditor } from './room-condition-editor';
import type { BoardRoom } from '../housekeeping/contracts';
import { useHousekeepingGet } from '../housekeeping/queries';

export function ReceptionDashboard() {
  const location = useLocation();
  const bookingOrigin = { returnTo: location.pathname + location.search, returnLabel: 'Trở lại Hôm nay' };
  const base = useDeskBase(),
    refresh = useRefreshDesk();
  const [params, setParams] = useSearchParams();

  const requests = useRoomRequests();
  const [requestRoom, setRequestRoom] = useState<string | null>(null);
  const [requestsOnly, setRequestsOnly] = useState(false);
  const pendingOrders = requests.data ?? [];
  const requestRooms = new Set(pendingOrders.map(order => order.roomNumber));

  const floorParam = params.get("floor");
  const stateParam = params.get("state");
  const modeParam = params.get("mode");
  const urlRoomId = params.get("roomId");
  const isBookingMode = modeParam === "booking";

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
  const todayStr = query.data?.today ?? hotelToday();
  const overdue = useDeskGet<Page<DeskBooking>>(`/front-desk/bookings?view=overdue&date=${todayStr}&pageSize=5`);

  // Facets for complete floor list
  const facets = useDeskGet<{
    types: { id: string; name: string }[];
    floors: number[];
  }>("/front-desk/room-filters");

  // Get room list for Room Board, filtered by floor on the server if selected
  const roomsPath =
    floor === "All"
      ? `/front-desk/rooms?pageSize=100&start=${todayStr}&end=${shiftDate(todayStr, 7)}`
      : `/front-desk/rooms?pageSize=100&floor=${floor}&start=${todayStr}&end=${shiftDate(todayStr, 7)}`;
  const roomsQuery = useDeskGet<Page<DeskRoom>>(roomsPath);

  const d = query.data;
  const allRooms = roomsQuery.data?.data || [];

  // Selected room for action drawer
  const selectedRoom =
    manualSelectedRoom !== undefined
      ? allRooms.find((r) => r.id === manualSelectedRoom?.id) ?? manualSelectedRoom
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
  const roomWork = useHousekeepingGet<Page<BoardRoom>>(
    `/housekeeping/board?roomId=${selectedRoom?.id ?? ''}&pageSize=1`,
    !!selectedRoom,
  );
  const openTask = roomWork.data?.data[0]?.openTask;
  const housekeepingTarget = openTask
    ? `${base}/housekeeping/tasks/${openTask.id}`
    : `${base}/housekeeping?roomId=${selectedRoom?.id ?? ''}`;
  const openRoomWork = (event: MouseEvent<HTMLAnchorElement>) => {
    if (roomWork.isPending || roomWork.isError) {
      event.preventDefault();
      if (roomWork.isError) void roomWork.refetch();
      return;
    }
    setSelectedRoom(null);
  };

  // Determine floors available from facets or loaded rooms
  const floorList =
    facets.data?.floors && facets.data.floors.length > 0
      ? [...facets.data.floors].sort((a, b) => Number(a) - Number(b))
      : Array.from(new Set(allRooms.map((r) => r.floor || 1))).sort(
          (a, b) => Number(a) - Number(b),
        );

  const shownRooms = allRooms.filter((r) => {
    if (requestsOnly && !requestRooms.has(r.roomNumber)) return false;
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

  const handleRoomClick = (room: DeskRoom) => {
    if (isBookingMode) {
      setBookingRoom(room);
    } else {
      setSelectedRoom(room);
    }
  };

  return (
    <div className="space-y-3">
      {/* Top Greeting Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">
            Tổng quan lễ tân
          </h1>
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
            {/* Quick Alert Bar for pending operations */}
            {((overdue.data?.meta.total ?? 0) > 0 || d.counts.pending > 0 || d.counts.orders > 0) && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs text-amber-900">
                <span className="font-semibold uppercase tracking-wider">Cần lưu ý:</span>
                {(overdue.data?.meta.total ?? 0) > 0 && (
                  <Link to={`${base}/bookings?view=overdue`} className="font-medium hover:underline text-amber-800">
                    {overdue.data!.meta.total} booking quá ngày nhận chưa xử lý →
                  </Link>
                )}
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

            {/* Unified Room Board Card - Full Width */}
            <Card className="w-full">
                  <CardHeader>
                    <div>
                      <CardTitle>Bảng trạng thái phòng</CardTitle>
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

                      <button type="button" aria-pressed={requestsOnly} disabled={!requests.data} onClick={() => setRequestsOnly(!requestsOnly)} className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold ${requestsOnly ? "border-amber-400 bg-amber-100 text-amber-900" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
                        <BellRing className="size-3.5" /> Có yêu cầu ({requests.data ? requestRooms.size : '…'})
                      </button>
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

                    {requests.error && <div role="alert" className="mb-3 text-xs text-rose-700">Chưa tải được thông báo yêu cầu. <button type="button" className="underline" onClick={() => void requests.refetch()}>Thử lại</button></div>}
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
                            <div className="grid flex-1 grid-cols-[repeat(auto-fill,minmax(110px,165px))] gap-2 sm:gap-2.5 sm:grid-cols-[repeat(auto-fill,minmax(130px,175px))]">
                              {roomsOnFloor.map((room) => {
                                const roomOrders = pendingOrders.filter(order => order.roomNumber === room.roomNumber);
                                const occupiedBooking = room.bookings.find(
                                  (b) => b.status === "CHECKED_IN",
                                );
                                const occupied = Boolean(occupiedBooking);
                                const isDirty = room.housekeepingStatus === "DIRTY";
                                const isCleaning = room.housekeepingStatus === "CLEANING";
                                const isOoo = room.operationalStatus !== "ACTIVE";
                                const reservedBooking = room.bookings.find(b => ['PENDING', 'CONFIRMED'].includes(b.status) && b.checkIn <= todayStr && b.checkOut > todayStr);
                                const isClean = !occupied && !reservedBooking && !isDirty && !isCleaning && !isOoo;

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
                                  : reservedBooking
                                  ? "border-sky-300 bg-sky-50 text-sky-950"
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
                                  <div key={room.id} className="relative flex flex-col">
                                  <button
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
                                        {roomOrders.length > 0 ? (
                                          <span aria-hidden="true" className="w-9 shrink-0" />
                                        ) : occupied ? (
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
                                          : reservedBooking
                                          ? "CHỜ NHẬN PHÒNG"
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
                                    ) : reservedBooking ? (
                                      <div className="my-1.5 space-y-0.5">
                                        <div className="text-xs font-semibold">{reservedBooking.customer?.fullName ?? 'Khách đặt phòng'}</div>
                                        <div className="text-xs">{formatStayDateDisplay(reservedBooking.checkIn, todayStr)} → {formatStayDateDisplay(reservedBooking.checkOut, todayStr)}</div>
                                        <div className="text-xs">Chưa nhận phòng</div>
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
                                  {roomOrders.length > 0 && <button type="button" onClick={() => setRequestRoom(room.roomNumber)} aria-label={`Phòng ${room.roomNumber}: ${roomOrders.length} yêu cầu chờ xử lý`} title="Xem yêu cầu của khách" className={`room-request-bell ${occupied ? "room-request-bell--occupied" : ""}`}>
                                    <Bell size={16} strokeWidth={1.7} /><span className="room-request-bell__count">{roomOrders.length > 9 ? "9+" : roomOrders.length}</span>
                                  </button>}
                                  </div>
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

                    {stateParam && (
                      <div className="mt-3 text-xs">
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

            {requestRoom && <RoomRequestsDrawer roomNumber={requestRoom} orders={pendingOrders.filter(order => order.roomNumber === requestRoom)} onClose={() => setRequestRoom(null)} />}
            {/* Room Detail & Action Modal Dialog (Centered) */}
            {selectedRoom && (
              <Dialog
                open={Boolean(selectedRoom)}
                onClose={() => setSelectedRoom(null)}
                title={`Phòng ${selectedRoom.roomNumber} · Chi tiết & Thao tác`}
                className="desk-room-action-modal"
              >
                {(() => {
                  const bookings = selectedRoom.bookings || [];
                  const occupiedBooking = bookings.find(
                    (b) => b && b.status === "CHECKED_IN",
                  );
                  const isDirty = selectedRoom.housekeepingStatus === "DIRTY";
                  const isCleaning = selectedRoom.housekeepingStatus === "CLEANING";
                  const isOoo = selectedRoom.operationalStatus !== "ACTIVE";
                  const reservedBooking = bookings.find(b => ['PENDING', 'CONFIRMED'].includes(b.status) && b.checkIn <= todayStr && b.checkOut > todayStr);
                  const isClean = !occupiedBooking && !reservedBooking && !isDirty && !isCleaning && !isOoo;

                  const roomTypeName = selectedRoom.roomType?.name || "Standard";
                  const nightlyPrice = selectedRoom.roomType?.nightlyPrice || "0";
                  const maxGuests = selectedRoom.roomType?.maxGuests || 2;

                  // 7-day mini schedule calculation based on todayStr
                  const next7Days = [0, 1, 2, 3, 4, 5, 6].map((offset) => {
                    const dateStr = shiftDate(todayStr, offset);
                    const dObj = new Date(dateStr + "T00:00:00Z");
                    const dayOfWeek = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"][dObj.getUTCDay()];
                    const dayOfMonth = dObj.getUTCDate();

                    const bookingOnDate = bookings.find(
                      (b) => b && b.status !== "CANCELLED" && b.checkIn <= dateStr && dateStr < b.checkOut,
                    );

                    let dayStatus: "dirty" | "cleaning" | "occupied" | "booked" | "empty" = "empty";
                    if (offset === 0) {
                      if (occupiedBooking) dayStatus = "occupied";
                      else if (isDirty) dayStatus = "dirty";
                      else if (isCleaning) dayStatus = "cleaning";
                      else if (bookingOnDate) dayStatus = "booked";
                      else dayStatus = "empty";
                    } else {
                      if (bookingOnDate) {
                        dayStatus = bookingOnDate.status === "CHECKED_IN" ? "occupied" : "booked";
                      } else {
                        dayStatus = "empty";
                      }
                    }

                    return {
                      dateStr,
                      dayOfWeek,
                      dayOfMonth,
                      status: dayStatus,
                      booking: bookingOnDate,
                    };
                  });

                  const vacantNightsCount = next7Days.filter((d) => d.status === "empty").length;

                  const upcomingBookings = bookings
                    .filter((b) => b && (b.status === "CONFIRMED" || b.status === "PENDING"))
                    .sort((a, b) => (a.checkIn || "").localeCompare(b.checkIn || ""));
                  const nextUpcomingBooking = upcomingBookings[0];

                  return (
                    <div className="drawer-body space-y-4">
                      {/* 1. ROOM HERO IDENTITY CARD */}
                      <div className="rounded-2xl bg-white p-4 sm:p-4.5 border border-zinc-200/90 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
                        <div className="flex items-center gap-3.5">
                          <div className="w-13 h-13 rounded-2xl bg-emerald-800 text-white font-extrabold text-xl flex items-center justify-center shadow-md shadow-emerald-950/20 ring-4 ring-emerald-50 shrink-0">
                            {selectedRoom.roomNumber}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-base sm:text-lg font-bold text-zinc-900 tracking-tight">
                                Phòng {selectedRoom.roomNumber}
                              </h3>
                              <span className="text-xs font-medium text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded-md">
                                Tầng {selectedRoom.floor}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500 mt-1">
                              <span className="font-semibold text-zinc-700 flex items-center gap-1">
                                <BedDouble className="size-3.5 text-zinc-400" />
                                {roomTypeName}
                              </span>
                              <span className="text-zinc-300">•</span>
                              <span className="font-bold text-emerald-800">
                                {money(nightlyPrice)}/đêm
                              </span>
                              <span className="text-zinc-300">•</span>
                              <span className="flex items-center gap-1 text-zinc-600">
                                <Users className="size-3.5 text-zinc-400" />
                                Tối đa {maxGuests} khách
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-end">
                          {occupiedBooking ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-900 border border-emerald-200 shadow-2xs">
                              <span className="size-2 rounded-full bg-emerald-600 animate-pulse" />
                              Đang ở
                            </span>
                          ) : isOoo ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200 shadow-2xs">
                              <Wrench className="size-3.5 text-rose-600" />
                              Bảo trì
                            </span>
                          ) : reservedBooking ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-800 border border-indigo-200 shadow-2xs">
                              <LogIn className="size-3.5 text-indigo-600" />
                              {"Chờ nhận phòng"}
                            </span>
                          ) : isDirty ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs">
                              <Broom className="size-3.5 text-amber-600" />
                              Cần dọn
                            </span>
                          ) : isCleaning ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-800 border border-sky-200 shadow-2xs">
                              <RefreshCw className="size-3.5 text-sky-600 animate-spin" />
                              Đang dọn
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-teal-50 text-teal-800 border border-teal-200 shadow-2xs">
                              <ShieldCheck className="size-3.5 text-teal-600" />
                              Trống sạch
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 2. OPERATIONAL & HOUSEKEEPING STATUS BANNER */}
                      {isOoo ? (
                        <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-3.5 flex items-start gap-3">
                          <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 mt-0.5">
                            <Wrench className="size-4" />
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-rose-900">Phòng đang tạm khóa bảo trì (Out of Order)</h4>
                            <p className="text-xs text-rose-700 mt-0.5">
                              Phòng đang trong diện kỹ thuật kiểm tra hoặc sửa chữa thiết bị, tạm ngừng đón khách.
                            </p>
                          </div>
                        </div>
                      ) : (isDirty || isCleaning) ? (
                        <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-3.5 flex items-center justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
                              <Broom className="size-4" />
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-amber-900">
                                Buồng phòng: {isCleaning ? "Đang dọn dẹp" : "Cần dọn dẹp"}
                              </h4>
                              <p className="text-xs text-amber-800/90 mt-0.5 leading-relaxed">
                                {selectedRoom.openTaskCount > 0
                                  ? `Có ${selectedRoom.openTaskCount} công việc dọn dẹp cần hoàn tất.`
                                  : "Khách đã trả phòng hoặc cần vệ sinh định kỳ trước khi đón khách mới."}
                              </p>
                            </div>
                          </div>
                          <LinkButton
                            variant="secondary"
                            to={housekeepingTarget}
                            onClick={openRoomWork}
                            className="shrink-0 text-xs px-3 py-1.5 bg-white hover:bg-amber-100 border-amber-300 text-amber-900 font-semibold rounded-lg shadow-2xs"
                          >
                            Xử lý dọn phòng
                          </LinkButton>
                        </div>
                      ) : isClean ? (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                              <ShieldCheck className="size-4" />
                            </div>
                            <span className="text-xs font-semibold text-emerald-950">
                              Phòng đã kiểm tra, vệ sinh sạch & sẵn sàng đón khách
                            </span>
                          </div>
                          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-200/80">
                            Đạt chuẩn
                          </span>
                        </div>
                      ) : null}

                      {roomWork.isError && (
                        <ErrorState message="Chưa tải được công việc buồng phòng của phòng này." retry={() => void roomWork.refetch()} />
                      )}
                      <RoomConditionEditor key={selectedRoom.id} room={selectedRoom} onSaved={() => setSelectedRoom(null)} />

                      {/* 3. GUEST IN-HOUSE CARD IF OCCUPIED */}
                      {occupiedBooking && (
                        <div className="rounded-2xl border border-emerald-200/90 bg-white p-4 text-xs text-emerald-950 shadow-xs">
                          <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
                            <span className="font-bold uppercase tracking-wider text-[11px] text-emerald-900 flex items-center gap-1.5">
                              <Users className="size-3.5 text-emerald-700" />
                              THÔNG TIN KHÁCH ĐANG Ở
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-semibold text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded-md border border-zinc-200/80">
                                #{occupiedBooking.reference}
                              </span>
                              <GuestBadge status={occupiedBooking.status} />
                            </div>
                          </div>

                          <div className="flex items-center gap-3 mt-3.5">
                            <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 font-bold text-sm flex items-center justify-center shrink-0 border border-emerald-200">
                              {occupiedBooking.customer?.fullName
                                ? occupiedBooking.customer.fullName.trim().split(" ").slice(-1)[0]?.slice(0, 2).toUpperCase()
                                : "KH"}
                            </div>
                            <div>
                              <strong className="block text-sm sm:text-base font-bold text-zinc-900">
                                {occupiedBooking.customer?.fullName ?? "Khách lẻ tại quầy"}
                              </strong>
                              <span className="text-[11px] text-zinc-500">
                                Khách lưu trú tại phòng
                              </span>
                            </div>
                          </div>

                          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-3 pt-3 border-t border-zinc-100">
                            <div className="bg-zinc-50 p-2.5 rounded-xl border border-zinc-200/70">
                              <dt className="text-zinc-500 text-[11px] flex items-center gap-1">
                                <Phone className="size-3 text-zinc-400" />
                                Điện thoại
                              </dt>
                              <dd className="font-semibold text-zinc-800 mt-1 truncate">
                                {occupiedBooking.customer?.phone || "Chưa có SĐT"}
                              </dd>
                            </div>
                            <div className="bg-zinc-50 p-2.5 rounded-xl border border-zinc-200/70">
                              <dt className="text-zinc-500 text-[11px] flex items-center gap-1">
                                <Receipt className="size-3 text-emerald-600" />
                                Tiền phòng
                              </dt>
                              <dd className="font-bold text-emerald-800 mt-1">
                                {money(occupiedBooking.totalRoomAmount)}
                              </dd>
                            </div>
                            <div className="bg-zinc-50 p-2.5 rounded-xl border border-zinc-200/70 sm:col-span-1">
                              <dt className="text-zinc-500 text-[11px] flex items-center gap-1">
                                <Calendar className="size-3 text-zinc-400" />
                                Kỳ lưu trú hiện tại
                              </dt>
                              <dd className="font-semibold text-zinc-800 mt-1 text-[11px] leading-tight">
                                <div>{occupiedBooking.checkIn} → {occupiedBooking.checkOut}</div>
                                <div className="text-[10px] text-zinc-500 font-normal">({occupiedBooking.nights} đêm · {occupiedBooking.guestCount} khách)</div>
                              </dd>
                            </div>
                          </dl>
                        </div>
                      )}

                      {/* 4. SMART QUICK ACTIONS HUB */}
                      <div className="rounded-2xl border border-zinc-200/90 bg-white p-4 space-y-3 shadow-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                            <Sparkles className="size-3.5 text-emerald-600" />
                            THAO TÁC KHẢ DỤNG
                          </span>
                          <span className="text-[11px] text-zinc-400">Tùy biến theo phòng</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {reservedBooking && !occupiedBooking && (
                            <LinkButton
                              to={`${base}/bookings/${reservedBooking.id}`}
                              state={bookingOrigin}
                              onClick={() => setSelectedRoom(null)}
                              className="sm:col-span-2 justify-center bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-2.5 rounded-xl shadow-xs"
                            >
                              <LogIn className="size-4 mr-1.5" />
                              Xem booking · Nhận phòng
                            </LinkButton>
                          )}

                          {isClean && (
                            <Button
                              onClick={() => {
                                const r = selectedRoom;
                                setSelectedRoom(null);
                                setBookingRoom(r);
                              }}
                              className="sm:col-span-2 justify-center bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-2.5 rounded-xl shadow-xs"
                            >
                              <Plus className="size-4 mr-1.5" /> Đặt phòng này ({money(nightlyPrice)}/đêm)
                            </Button>
                          )}

                          {occupiedBooking && (
                            <>
                              <LinkButton
                                to={`${base}/bookings/${occupiedBooking.id}/billing`}
                                onClick={() => setSelectedRoom(null)}
                                className="sm:col-span-2 justify-center bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-3 rounded-xl shadow-xs hover:shadow-md transition-all text-sm"
                              >
                                <Receipt className="size-4 mr-1.5" /> Trả phòng & Hóa đơn
                              </LinkButton>
                              <LinkButton
                                variant="secondary"
                                to={`${base}/bookings/${occupiedBooking.id}`}
                                state={bookingOrigin}
                                onClick={() => setSelectedRoom(null)}
                                className="justify-center py-2.5 rounded-xl font-medium"
                              >
                                <FileText className="size-4 mr-1.5 text-zinc-500" /> Chi tiết booking
                              </LinkButton>
                              <Button
                                variant="secondary"
                                onClick={() => {
                                  const r = selectedRoom;
                                  setSelectedRoom(null);
                                  setBookingRoom(r);
                                }}
                                className="justify-center py-2.5 rounded-xl font-medium"
                              >
                                <Plus className="size-4 mr-1.5 text-emerald-700" /> Đặt phòng cho ngày tương lai
                              </Button>
                            </>
                          )}

                          {!isClean && !occupiedBooking && (
                            <Button
                              onClick={() => {
                                const r = selectedRoom;
                                setSelectedRoom(null);
                                setBookingRoom(r);
                              }}
                              className="sm:col-span-2 justify-center bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-2.5 rounded-xl shadow-xs"
                            >
                              <Plus className="size-4 mr-1.5" /> Đặt phòng cho ngày tương lai
                            </Button>
                          )}

                          {(isDirty || isCleaning || selectedRoom.openTaskCount > 0) && (
                            <LinkButton
                              variant="secondary"
                              to={housekeepingTarget}
                              onClick={openRoomWork}
                              className="justify-center py-2.5 rounded-xl font-medium"
                            >
                              <Broom className="size-4 mr-1.5 text-amber-600" /> Điều phối buồng phòng
                            </LinkButton>
                          )}
                        </div>
                      </div>

                      {/* 5. UPCOMING 7-DAY MINI TIMELINE */}
                      <div className="rounded-2xl border border-zinc-200/90 bg-white p-4 space-y-3 text-xs shadow-xs">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                              <Calendar className="size-3.5 text-zinc-400" />
                              LỊCH ĐẶT 7 NGÀY TỚI
                            </span>
                            <span className="text-[11px] text-zinc-500 mt-0.5 block">
                              {formatStayDateDisplay(todayStr)} → {formatStayDateDisplay(shiftDate(todayStr, 6))}
                            </span>
                          </div>
                          <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                            Còn {vacantNightsCount} đêm trống
                          </span>
                        </div>

                        {/* 7-day strip */}
                        <div className="grid grid-cols-7 gap-1.5 text-center">
                          {next7Days.map((d, idx) => {
                            const isToday = idx === 0;
                            const isBooked = d.status === "booked" || d.status === "occupied";
                            const isHk = d.status === "dirty" || d.status === "cleaning";
                            const bgClass = isHk
                              ? "border-amber-300 bg-amber-50 text-amber-900"
                              : isBooked
                              ? "border-sky-300 bg-sky-50 text-sky-900"
                              : "border-emerald-200/80 bg-emerald-50/50 text-emerald-900";
                            const tagLabel = isHk
                              ? "Dọn"
                              : isBooked
                              ? (d.status === "occupied" ? "Ở" : "Đặt")
                              : "Trống";

                            return (
                              <div
                                key={d.dateStr}
                                className={`p-2 rounded-xl border ${bgClass} ${
                                  isToday ? "ring-2 ring-emerald-600 shadow-2xs font-bold" : ""
                                } transition-all`}
                              >
                                <span className="text-[10px] text-zinc-400 block font-medium">{d.dayOfWeek}</span>
                                <strong className="text-xs block my-0.5">{d.dayOfMonth}</strong>
                                <span className="text-[9.5px] font-semibold block">{tagLabel}</span>
                              </div>
                            );
                          })}
                        </div>

                        {/* Next Booking preview or Empty note */}
                        {nextUpcomingBooking ? (
                          <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 text-xs flex items-center justify-between">
                            <div>
                              <span className="text-zinc-400 text-[10px] block font-medium">Khách sắp tới tiếp theo</span>
                              <strong className="text-zinc-800">{nextUpcomingBooking.customer?.fullName ?? "Khách đặt trước"}</strong>
                              <span className="text-zinc-500 text-[11px] ml-1.5">
                                {nextUpcomingBooking.checkIn} → {nextUpcomingBooking.checkOut} ({nextUpcomingBooking.nights} đêm)
                              </span>
                            </div>
                            <LinkButton
                              variant="secondary"
                              to={`${base}/bookings/${nextUpcomingBooking.id}`}
                              state={bookingOrigin}
                              onClick={() => setSelectedRoom(null)}
                              className="text-xs py-1 px-2.5 rounded-lg"
                            >
                              Xem
                            </LinkButton>
                          </div>
                        ) : (
                          <div className="p-2.5 rounded-xl bg-zinc-50/70 border border-dashed border-zinc-200 text-center text-zinc-500 text-[11px]">
                            Phòng chưa có lịch đặt trong tuần tới. Sẵn sàng đón khách mới.
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </Dialog>
            )}

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
