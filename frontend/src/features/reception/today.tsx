import { useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  BedDouble,
  Brush,
  ChevronRight,
  ListChecks,
  LogIn,
  LogOut,
  PieChart,
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
} from "../../components/kamra-ui";
import { ErrorState } from "../../components/ui";
import { Skeleton } from "../guest/components";
import type { Page } from "../guest/contracts";
import type { Dashboard, DeskBooking, DeskRoom } from "./contracts";
import { useDeskBase, useDeskGet, useRefreshDesk } from "./queries";
import { CheckInWizard } from "./check-in";
import { useAuth } from "../auth/auth-context";
import { calculateOccupancyPct } from "./room-state";

function PaymentBadge() {
  return <Badge tone="zinc">Chưa thanh toán</Badge>;
}

export function ReceptionDashboard() {
  const base = useDeskBase(),
    refresh = useRefreshDesk(),
    navigate = useNavigate(),
    { user } = useAuth();
  const query = useDeskGet<Dashboard>("/front-desk/dashboard");
  const [floor, setFloor] = useState<string>("All");
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

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

  // Determine floors available from facets or loaded rooms
  const floorList =
    facets.data?.floors && facets.data.floors.length > 0
      ? [...facets.data.floors].sort((a, b) => Number(a) - Number(b))
      : Array.from(new Set(allRooms.map((r) => r.floor || 1))).sort(
          (a, b) => Number(a) - Number(b),
        );

  const shownRooms =
    floor === "All"
      ? allRooms
      : allRooms.filter((r) => String(r.floor) === floor);

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

  return (
    <div className="space-y-6">
      {/* Top Greeting Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">
            Tổng quan lễ tân (Front Desk Today)
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
            {/* Top 6 KPI StatCards - truthful verified metrics matching real APIs */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              <StatCard
                icon={<LogIn className="size-4" />}
                label="Khách đến (Arrivals)"
                value={d.counts.arrivals}
                to={`${base}/bookings?view=arrivals`}
                sub={`${d.bookingCounts?.arrivals ?? d.arrivals.length} booking hôm nay`}
              />
              <StatCard
                icon={<LogOut className="size-4" />}
                label="Khách đi (Departures)"
                value={d.counts.departures}
                to={`${base}/bookings?view=departures`}
                sub={`${d.bookingCounts?.departures ?? d.departures.length} booking trả phòng`}
              />
              <StatCard
                icon={<Users className="size-4" />}
                label="Đang ở (In-house)"
                value={d.counts.staying}
                to={`${base}/bookings?view=staying`}
                sub={`${d.bookingCounts?.staying ?? d.counts.staying} khách đang lưu trú`}
              />
              <StatCard
                icon={<PieChart className="size-4" />}
                label="Công suất phòng"
                value={`${occupancyPct}%`}
                progress={occupancyPct}
                progressLabel={`${d.occupiedRooms} / ${d.totalRooms} phòng`}
                to={`${base}/rooms`}
              />
              <StatCard
                icon={<BedDouble className="size-4" />}
                label="Phòng sẵn sàng"
                value={d.counts.ready}
                sub={`${d.counts.dirty} phòng chưa dọn`}
                to={`${base}/rooms?state=ready`}
              />
              <StatCard
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

            {/* 2-Column Responsive Layout matching Kamra */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Left Column: Arrivals and Departures */}
              <div className="space-y-6">
                {/* Arrivals Card */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <LogIn className="size-4 text-brand-700" />
                      <CardTitle>Khách đến hôm nay (Arrivals)</CardTitle>
                      <Badge tone="sky">{d.arrivals.length}</Badge>
                    </div>
                    <Link
                      to={`${base}/bookings?view=arrivals`}
                      className="text-xs font-medium text-brand-700 hover:underline"
                    >
                      Xem tất cả
                    </Link>
                  </CardHeader>
                  <CardContent className="pt-2">
                    {d.arrivals.length === 0 ? (
                      <p className="py-6 text-center text-sm text-zinc-400">
                        Không có khách đến dự kiến hôm nay.
                      </p>
                    ) : (
                      <ul className="divide-y divide-zinc-100">
                        {d.arrivals.map((b) => (
                          <li
                            key={b.id}
                            className="flex items-center justify-between gap-3 py-3"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <Link
                                  to={`${base}/bookings/${b.id}`}
                                  className="truncate text-sm font-medium text-zinc-900 hover:text-brand-700"
                                >
                                  {b.customer?.fullName ?? b.reference}
                                </Link>
                                <Badge tone="brand">Trực tiếp</Badge>
                                <PaymentBadge />
                              </div>
                              <div className="mt-0.5 text-xs text-zinc-500">
                                {b.roomNumber
                                  ? `Phòng ${b.roomNumber}`
                                  : "Chưa xếp phòng"}{" "}
                                · {b.nights} đêm · {b.guestCount} khách · {b.reference}
                              </div>
                            </div>
                            <div className="shrink-0 flex items-center gap-2">
                              {b.status === "CONFIRMED" ? (
                                <CheckInWizard bookingId={b.id} />
                              ) : (
                                <Link
                                  to={`${base}/bookings/${b.id}`}
                                  className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                                >
                                  Chi tiết
                                </Link>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>

                {/* Departures Card */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <LogOut className="size-4 text-amber-700" />
                      <CardTitle>Khách đi hôm nay (Departures)</CardTitle>
                      <Badge tone="amber">{d.departures.length}</Badge>
                    </div>
                    <Link
                      to={`${base}/bookings?view=departures`}
                      className="text-xs font-medium text-brand-700 hover:underline"
                    >
                      Xem tất cả
                    </Link>
                  </CardHeader>
                  <CardContent className="pt-2">
                    {d.departures.length === 0 ? (
                      <p className="py-6 text-center text-sm text-zinc-400">
                        Không có khách trả phòng dự kiến hôm nay.
                      </p>
                    ) : (
                      <ul className="divide-y divide-zinc-100">
                        {d.departures.map((b) => (
                          <li
                            key={b.id}
                            className="flex items-center justify-between gap-3 py-3"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <Link
                                  to={`${base}/bookings/${b.id}`}
                                  className="truncate text-sm font-medium text-zinc-900 hover:text-brand-700"
                                >
                                  {b.customer?.fullName ?? b.reference}
                                </Link>
                                <span className="text-xs font-semibold tabular-nums text-zinc-700">
                                  Phòng {b.roomNumber}
                                </span>
                              </div>
                              <div className="mt-0.5 text-xs text-zinc-500">
                                Trả phòng hôm nay · {b.nights} đêm lưu trú · {b.reference}
                              </div>
                            </div>
                            <div className="shrink-0 flex items-center gap-2">
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
                    )}
                  </CardContent>
                </Card>

                {/* In-House Guests Table */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Users className="size-4 text-brand-700" />
                      <CardTitle>Khách đang lưu trú (In-house)</CardTitle>
                    </div>
                    <Link
                      to={`${base}/bookings?view=staying`}
                      className="text-xs font-medium text-brand-700 hover:underline"
                    >
                      {d.counts.staying} khách đang ở
                    </Link>
                  </CardHeader>
                  <CardContent className="pt-1">
                    {stayingQuery.data?.data.length === 0 ? (
                      <p className="py-6 text-center text-sm text-zinc-400">
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
                                    <span className="font-medium text-zinc-800 truncate">
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
                                  {row.checkOut}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Right Column: Room Board and Housekeeping Overview */}
              <div className="space-y-6">
                {/* Room Board Card */}
                <Card>
                  <CardHeader>
                    <div>
                      <CardTitle>Bảng trạng thái phòng (Room Board)</CardTitle>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        Phân bố theo tầng · Click vào phòng để xem hoặc thao tác nhanh
                      </p>
                    </div>
                    <Link
                      to={`${base}/rooms`}
                      className="shrink-0 text-xs font-medium text-brand-700 hover:underline"
                    >
                      Mở toàn bộ
                    </Link>
                  </CardHeader>
                  <CardContent>
                    {/* Floor Tabs */}
                    <div className="mb-4 flex flex-wrap gap-1 border-b border-zinc-100 pb-1">
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

                    {/* Room Grid by Floor */}
                    <div className="space-y-4">
                      {shownFloors.map((fl) => {
                        const roomsOnFloor = shownRooms.filter(
                          (r) => Number(r.floor || 1) === fl,
                        );
                        if (!roomsOnFloor.length) return null;
                        return (
                          <div key={fl} className="flex items-start gap-3">
                            <div className="w-14 shrink-0 pt-2 text-xs font-semibold text-zinc-400">
                              Tầng {fl}
                            </div>
                            <div className="grid flex-1 grid-cols-[repeat(auto-fill,minmax(5.75rem,1fr))] gap-2">
                              {roomsOnFloor.map((room) => {
                                const occupied = room.bookings.some(
                                  (b) => b.status === "CHECKED_IN",
                                );
                                const arriving =
                                  !occupied &&
                                  (d.arrivals || []).some(
                                    (a) => a.roomNumber === room.roomNumber,
                                  );

                                const isDirty = room.housekeepingStatus === "DIRTY";
                                const isCleaning = room.housekeepingStatus === "CLEANING";
                                const isOoo = room.operationalStatus !== "ACTIVE";

                                const statusToneClass = occupied
                                  ? "border-brand-700 bg-brand-700 text-white"
                                  : isOoo
                                  ? "border-rose-300 bg-rose-50 text-rose-900"
                                  : isDirty
                                  ? "border-amber-300 bg-amber-50 text-amber-900"
                                  : isCleaning
                                  ? "border-sky-300 bg-sky-50 text-sky-900"
                                  : "border-emerald-300 bg-emerald-50 text-emerald-900";

                                const isSelected = selectedRoomId === room.id;

                                return (
                                  <div key={room.id} className="relative">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setSelectedRoomId((cur) =>
                                          cur === room.id ? null : room.id,
                                        )
                                      }
                                      className={`w-full rounded-lg border px-2 pb-1.5 pt-2 text-start transition-all cursor-pointer hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-brand-600 ${statusToneClass}`}
                                    >
                                      <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold tabular-nums">
                                          {room.roomNumber}
                                        </span>
                                        {occupied && (
                                          <BedDouble className="size-3" />
                                        )}
                                        {arriving && <LogIn className="size-3" />}
                                      </div>
                                      <div className="mt-0.5 truncate text-[9px] font-semibold uppercase tracking-wide opacity-90">
                                        {occupied
                                          ? "Đang ở"
                                          : arriving
                                          ? "Sắp đến"
                                          : isDirty
                                          ? "Cần dọn"
                                          : isCleaning
                                          ? "Đang dọn"
                                          : isOoo
                                          ? "Bảo trì"
                                          : "Trống sạch"}
                                      </div>
                                      <div className="truncate text-[8px] opacity-75">
                                        {room.roomType.name}
                                      </div>
                                    </button>

                                    {/* Quick Menu Popover */}
                                    {isSelected && (
                                      <div className="absolute left-0 top-full z-30 mt-1 w-48 rounded-lg border border-zinc-200 bg-white p-1 text-xs shadow-xl">
                                        <div className="border-b border-zinc-100 px-2 py-1 font-semibold text-zinc-800">
                                          Phòng {room.roomNumber} · {room.roomType.name}
                                        </div>
                                        {occupied && (
                                          <>
                                            <button
                                              onClick={() => {
                                                const b = room.bookings.find(
                                                  (x) => x.status === "CHECKED_IN",
                                                );
                                                if (b) navigate(`${base}/bookings/${b.id}/billing`);
                                              }}
                                              className="w-full text-start px-2 py-1.5 rounded hover:bg-zinc-100 font-medium text-zinc-800 cursor-pointer"
                                            >
                                              Trả phòng & Hóa đơn
                                            </button>
                                            <button
                                              onClick={() => {
                                                const b = room.bookings.find(
                                                  (x) => x.status === "CHECKED_IN",
                                                );
                                                if (b) navigate(`${base}/bookings/${b.id}`);
                                              }}
                                              className="w-full text-start px-2 py-1.5 rounded hover:bg-zinc-100 text-zinc-700 cursor-pointer"
                                            >
                                              Xem chi tiết booking
                                            </button>
                                          </>
                                        )}
                                        {!occupied && (
                                          <button
                                            onClick={() =>
                                              navigate(
                                                `${base}/walk-in?roomId=${room.id}`,
                                              )
                                            }
                                            className="w-full text-start px-2 py-1.5 rounded hover:bg-zinc-100 font-medium text-brand-700 cursor-pointer"
                                          >
                                            Đặt tại quầy phòng này
                                          </button>
                                        )}
                                        <button
                                          onClick={() => navigate(`${base}/housekeeping`)}
                                          className="w-full text-start px-2 py-1.5 rounded hover:bg-zinc-100 text-zinc-600 cursor-pointer"
                                        >
                                          Điều phối buồng phòng
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {roomsQuery.data?.meta && roomsQuery.data.meta.total > roomsQuery.data.meta.pageSize && (
                      <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50/80 px-3 py-2 text-xs text-zinc-600 flex items-center justify-between">
                        <span>Đang hiển thị {roomsQuery.data.meta.pageSize} / {roomsQuery.data.meta.total} phòng.</span>
                        <Link to={`${base}/rooms`} className="font-semibold text-brand-700 hover:underline">
                          Xem toàn bộ trên Bảng phòng →
                        </Link>
                      </div>
                    )}

                    {/* Room Board Legend */}
                    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
                      <span className="inline-flex items-center gap-1">
                        <span className="size-2 rounded-full bg-emerald-500" />
                        Trống sạch
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="size-2 rounded-full bg-amber-500" />
                        Cần dọn
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="size-2 rounded-full bg-sky-500" />
                        Đang dọn
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="size-2 rounded-full bg-rose-500" />
                        Bảo trì
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <BedDouble className="size-3 text-brand-700" />
                        Đang có khách ở
                      </span>
                    </div>
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
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <Link
                        to={`${base}/rooms?state=ready`}
                        className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 hover:border-brand-300 transition-colors"
                      >
                        <span className="size-2 rounded-full bg-emerald-500 shrink-0" />
                        <span className="text-lg font-semibold tabular-nums text-zinc-900">
                          {d.counts.ready}
                        </span>
                        <span className="text-xs text-zinc-500">Sẵn sàng</span>
                      </Link>

                      <Link
                        to={`${base}/rooms?state=dirty`}
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
                        to={`${base}/rooms?state=occupied`}
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
          </>
        )
      )}
    </div>
  );
}
