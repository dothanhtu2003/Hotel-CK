import { useState } from "react";
import { useNavigate } from "react-router";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { ErrorState, Pagination } from "../../components/ui";
import { Badge } from "../../components/kamra-ui";
import { Skeleton } from "../guest/components";
import { statusLabels, type Page } from "../guest/contracts";
import type { DeskBooking, DeskRoom } from "./contracts";
import { useDeskGet } from "./queries";
import { cleaningLabels, hotelToday, shiftDate, staySpan } from "./room-state";

export function TapeChart({
  base,
  onSelectBooking,
  onSelectRoom,
}: {
  base: string;
  onSelectBooking?: (booking: DeskBooking) => void;
  onSelectRoom?: (room: DeskRoom) => void;
}) {
  const navigate = useNavigate(),
    [start, setStart] = useState(hotelToday),
    [page, setPage] = useState(1),
    [roomType, setRoomType] = useState("");

  const facets = useDeskGet<{ types: { id: string; name: string }[] }>(
    "/front-desk/room-filters",
  );
  const query = useDeskGet<Page<DeskRoom>>(
    `/front-desk/rooms?start=${start}&end=${shiftDate(start, 14)}&page=${page}&pageSize=30${roomType ? "&roomTypeId=" + roomType : ""}`,
  );

  const days = Array.from({ length: 14 }, (_, i) => shiftDate(start, i));
  const today = hotelToday();

  return (
    <div className="space-y-4">
      {/* Tape Chart Header & Controls */}
      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Calendar className="size-5 text-brand-700" />
              <h2 className="text-lg font-bold text-zinc-900 tracking-tight">
                Tape Chart (Sơ đồ Timeline)
              </h2>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Lịch đặt phòng theo phòng vật lý · Khoảng [nhận phòng, trả phòng) · Click vào thanh booking để xem chi tiết
            </p>
          </div>

          {/* Navigation Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50/70 p-0.5 text-xs">
              <button
                type="button"
                aria-label="14 ngày trước"
                onClick={() => setStart(shiftDate(start, -14))}
                className="rounded-md p-1.5 text-zinc-600 hover:bg-zinc-200 cursor-pointer"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setStart(hotelToday())}
                className={`rounded-md px-2.5 py-1 font-medium cursor-pointer ${
                  start === today ? "text-brand-700 font-bold bg-white shadow-2xs" : "text-zinc-700 hover:bg-zinc-200"
                }`}
              >
                Hôm nay
              </button>
              <button
                type="button"
                aria-label="14 ngày tới"
                onClick={() => setStart(shiftDate(start, 14))}
                className="rounded-md p-1.5 text-zinc-600 hover:bg-zinc-200 cursor-pointer"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>

            <input
              type="date"
              aria-label="Ngày bắt đầu lịch"
              value={start}
              onChange={(e) => {
                if (e.target.value) setStart(e.target.value);
              }}
              className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-800 focus:outline-brand-600 cursor-pointer"
            />

            <select
              aria-label="Loại phòng trên lịch"
              value={roomType}
              onChange={(e) => {
                setRoomType(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-800 focus:outline-brand-600 cursor-pointer"
            >
              <option value="">Tất cả loại phòng</option>
              {facets.data?.types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Legend strip */}
        <div className="flex flex-wrap items-center gap-3 border-t border-zinc-100 pt-2.5 text-xs text-zinc-500">
          <span className="font-semibold text-zinc-400 text-[11px] uppercase tracking-wider">
            Chú thích:
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-emerald-600" />
            Đang lưu trú (Checked in)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-sky-600" />
            Đã xác nhận (Confirmed)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-amber-500" />
            Chờ xử lý (Pending)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-zinc-400" />
            Đã trả phòng (Checked out)
          </span>
        </div>
      </div>

      {query.isPending ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <Skeleton />
        </div>
      ) : query.error ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <ErrorState
            message={query.error.message}
            retry={() => void query.refetch()}
          />
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[900px]">
              {/* Header Row: Room Label Column + 14 Day Columns */}
              <div className="flex items-center border-b border-zinc-200 bg-zinc-50/80 text-xs font-semibold text-zinc-600">
                <div className="w-48 shrink-0 px-3 py-2.5 border-r border-zinc-200">
                  Phòng / Loại phòng
                </div>
                <div className="flex flex-1">
                  {days.map((d) => {
                    const isToday = d === today;
                    const dateObj = new Date(d + "T00:00:00Z");
                    const weekday = new Intl.DateTimeFormat("vi-VN", {
                      weekday: "short",
                      timeZone: "UTC",
                    }).format(dateObj);
                    const dayNum = d.slice(8);
                    const monthNum = d.slice(5, 7);

                    return (
                      <div
                        key={d}
                        className={`flex-1 text-center py-2 border-r border-zinc-100 last:border-r-0 ${
                          isToday ? "bg-brand-50/90 text-brand-900 font-bold" : ""
                        }`}
                      >
                        <div className="text-[10px] uppercase opacity-75">{weekday}</div>
                        <div className="text-xs tabular-nums">
                          {dayNum}/{monthNum}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Rows for each room */}
              <div className="divide-y divide-zinc-100">
                {query.data!.data.map((room) => (
                  <div key={room.id} className="flex items-stretch hover:bg-zinc-50/40 transition-colors">
                    {/* Room Info Cell */}
                    <div className="w-48 shrink-0 px-3 py-2 border-r border-zinc-200 flex flex-col justify-center">
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => onSelectRoom?.(room)}
                          className="font-bold text-sm text-zinc-900 hover:text-brand-700 text-start cursor-pointer tabular-nums"
                        >
                          Phòng {room.roomNumber}
                        </button>
                        <Badge
                          tone={
                            room.housekeepingStatus === "CLEAN"
                              ? "green"
                              : room.housekeepingStatus === "DIRTY"
                              ? "amber"
                              : "zinc"
                          }
                          className="text-[10px] py-0 px-1.5"
                        >
                          {cleaningLabels[room.housekeepingStatus] ?? room.housekeepingStatus}
                        </Badge>
                      </div>
                      <div className="text-[11px] text-zinc-400 truncate">
                        {room.roomType.name} · Tầng {room.floor}
                      </div>
                    </div>

                    {/* Timeline Cell */}
                    <div className="flex-1 relative min-h-[44px]">
                      {/* Grid Day Lines */}
                      <div className="absolute inset-0 flex pointer-events-none">
                        {days.map((d) => (
                          <div
                            key={d}
                            className={`flex-1 border-r border-zinc-100 last:border-r-0 ${
                              d === today ? "bg-brand-50/20" : ""
                            }`}
                          />
                        ))}
                      </div>

                      {/* Booking Bars */}
                      <div className="absolute inset-0 flex items-center px-0.5">
                        {room.bookings.map((b) => {
                          const span = staySpan(b.checkIn, b.checkOut, start, 14);
                          if (!span) return null;

                          const barColor =
                            b.status === "CHECKED_IN"
                              ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                              : b.status === "CONFIRMED"
                              ? "bg-sky-600 hover:bg-sky-700 text-white"
                              : b.status === "PENDING"
                              ? "bg-amber-500 hover:bg-amber-600 text-white"
                              : "bg-zinc-400 hover:bg-zinc-500 text-white";

                          return (
                            <button
                              key={b.id}
                              type="button"
                              onClick={() =>
                                onSelectBooking
                                  ? onSelectBooking(b)
                                  : navigate(`${base}/bookings/${b.id}`)
                              }
                              className={`absolute h-7 rounded-md px-2 text-start text-xs font-medium shadow-xs transition-transform hover:scale-[1.01] hover:z-20 cursor-pointer overflow-hidden flex items-center gap-1.5 ${barColor}`}
                              style={{
                                left: `${(span.left / 14) * 100}%`,
                                width: `calc(${(span.width / 14) * 100}% - 2px)`,
                              }}
                              title={`${b.customer?.fullName ?? b.reference} · ${b.checkIn} → ${b.checkOut} (${b.nights} đêm) · ${statusLabels[b.status]}`}
                            >
                              <span className="size-1.5 rounded-full bg-white shrink-0" />
                              <span className="truncate font-semibold text-[11px]">
                                {b.customer?.fullName ?? b.reference}
                              </span>
                              <span className="hidden sm:inline text-[10px] opacity-80 truncate">
                                ({b.nights}đ)
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}

                {!query.data!.data.length && (
                  <div className="py-12 text-center text-sm text-zinc-400">
                    Không có phòng nào phù hợp với bộ lọc.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="border-t border-zinc-200 bg-zinc-50 px-4 py-2">
            <Pagination {...query.data!.meta} onChange={setPage} />
          </div>
        </div>
      )}
    </div>
  );
}
