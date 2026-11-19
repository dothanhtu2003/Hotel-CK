import { formatDate as localizedDate } from "../../i18n/format";
import { catalogName } from "../../i18n/catalog";
import { displayLocale, safeError, t as tr, useLocale } from "../../i18n";


import { useDeskNavigate } from "./navigation-state";
import { awaitingOnlinePayment, deskBookingStatusLabel } from './contracts';
import { useState } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { ErrorState, Pagination } from "../../components/ui";
import { Badge } from "../../components/kamra-ui";
import { Skeleton } from "../guest/components";
import { type Page } from "../guest/contracts";
import type { DeskBooking, DeskRoom } from "./contracts";
import { useDeskGet } from "./queries";
import { bookingLanes, cleaningLabels, hotelToday, shiftDate } from "./room-state";

export function TapeChart({
  base,
  onSelectBooking,
  onSelectRoom,
}: {
  base: string;
  onSelectBooking?: (booking: DeskBooking) => void;
  onSelectRoom?: (room: DeskRoom) => void;
}) {
  useLocale();
  const navigate = useDeskNavigate(),
    [start, setStart] = useState(hotelToday),
    [page, setPage] = useState(1),
    [roomType, setRoomType] = useState("");

  const facets = useDeskGet<{ types: { id: string; name: string }[] }>(
    "/front-desk/room-filters",
  );
  const query = useDeskGet<Page<DeskRoom>>(
    `/front-desk/rooms?start=${start}&end=${shiftDate(start, 14)}&page=${page}&pageSize=250${roomType ? "&roomTypeId=" + roomType : ""}`,
  );

  const days = Array.from({ length: 14 }, (_, i) => shiftDate(start, i));
  const today = hotelToday();

  return (
    <div className="space-y-2">
      {/* Tape Chart Header & Controls */}
      <div className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Calendar className="size-5 text-brand-700" />
              <h2 className="text-lg font-bold text-zinc-900 tracking-tight">{tr("reception:tapeChart.reservationCalendar")}</h2>
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50/70 p-0.5 text-xs">
              <button
                type="button"
                aria-label={tr("reception:tapeChart.previous14Days")}
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
              >{tr("reception:tapeChart.today")}</button>
              <button
                type="button"
                aria-label={tr("reception:tapeChart.next14Days")}
                onClick={() => setStart(shiftDate(start, 14))}
                className="rounded-md p-1.5 text-zinc-600 hover:bg-zinc-200 cursor-pointer"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>

            <input
              type="date"
              aria-label={tr("reception:tapeChart.calendarStartDate")}
              value={start}
              onChange={(e) => {
                if (e.target.value) setStart(e.target.value);
              }}
              className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-800 focus:outline-brand-600 cursor-pointer"
            />

            <select
              aria-label={tr("reception:tapeChart.calendarRoomType")}
              value={roomType}
              onChange={(e) => {
                setRoomType(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-800 focus:outline-brand-600 cursor-pointer"
            >
              <option value="">{tr("reception:tapeChart.allRoomTypes")}</option>
              {facets.data?.types.map((t) => (
                <option key={t.id} value={t.id}>
                  {catalogName(t.name)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Legend strip */}
        <div className="flex flex-wrap items-center gap-3 border-t border-zinc-100 pt-2.5 text-xs text-zinc-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-emerald-600" />
            {tr("reception:tapeChart.inHouse")}</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-sky-600" />
            {tr("reception:tapeChart.confirmed")}</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-amber-500" />
            {tr("reception:roomRequests.pending")}</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-zinc-400" />
            {tr("reception:tapeChart.checkedOut")}</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-rose-600" />{tr("reception:tapeChart.stayOverdueToday")}</span>
          <span>{tr("reception:tapeChart.hkCurrentCleanlinessBarsShowReservationDatesOverdueMarkersAppearToday")}</span>
        </div>
      </div>

      {query.isPending ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <Skeleton />
        </div>
      ) : query.error ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <ErrorState
            message={safeError(query.error)}
            retry={() => void query.refetch()}
          />
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
          <div className="tape-chart-scroll overflow-auto max-h-[calc(100dvh-210px)] min-h-64">
            <div className="min-w-[900px]">
              {/* Header Row: Room Label Column + 14 Day Columns */}
              <div className="sticky top-0 z-30 flex items-center border-b border-zinc-200 bg-zinc-50 text-xs font-semibold text-zinc-600">
                <div className="sticky left-0 z-40 bg-zinc-50 w-36 shrink-0 px-2 py-2 border-r border-zinc-200">{tr("reception:tapeChart.roomType")}</div>
                <div className="flex flex-1">
                  {days.map((d) => {
                    const isToday = d === today;
                    const dateObj = new Date(d + "T00:00:00Z");
                    const weekday = new Intl.DateTimeFormat(displayLocale(), {
                      weekday: "short",
                      timeZone: "Asia/Ho_Chi_Minh",
                    }).format(dateObj);

                    return (
                      <div
                        key={d}
                        className={`flex-1 text-center py-2 border-r border-zinc-100 last:border-r-0 ${
                          isToday ? "bg-brand-50/90 text-brand-900 font-bold" : ""
                        }`}
                      >
                        <div className="text-[10px] uppercase opacity-75">{weekday}</div>
                        <div className="text-xs tabular-nums">
                          {localizedDate(d, { day: '2-digit', month: '2-digit' })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Rows for each room */}
              <div className="divide-y divide-zinc-100">
                {query.data!.data.map((room) => {
                  const bars = bookingLanes(room.bookings, start, 14, today);
                  const lanes = Math.max(1, ...bars.map(bar => bar.lane + 1));
                  return (
                  <div key={room.id} className="flex items-stretch hover:bg-zinc-50/40 transition-colors">
                    {/* Room Info Cell */}
                    <div className="sticky left-0 z-10 bg-white w-36 shrink-0 px-2 py-1 border-r border-zinc-200 flex flex-col justify-center">
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => onSelectRoom?.(room)}
                          className="min-w-0 truncate font-bold text-xs text-zinc-900 hover:text-brand-700 text-start cursor-pointer tabular-nums"
                        >
                          {room.roomNumber}
                        </button>
                        <Badge
                          tone={
                            room.operationalStatus === "ACTIVE" && room.housekeepingStatus === "CLEAN"
                              ? "green"
                              : room.housekeepingStatus === "DIRTY"
                              ? "amber"
                              : "zinc"
                          }
                          className="text-[10px] py-0 px-1.5"
                        >
                          {room.operationalStatus !== "ACTIVE" ? tr("reception:tapeChart.maintenance") : `${tr("reception:tapeChart.cleanlinessPrefix")}: ${cleaningLabels[room.housekeepingStatus] ?? room.housekeepingStatus}`}
                        </Badge>
                      </div>
                      <div className="text-[11px] text-zinc-400 truncate" title={tr("reception:tapeChart.valueFloorValue", { value0: (catalogName(room.roomType.name)), value1: (room.floor) })}>{tr("reception:tapeChart.valueFloorValue", { value0: (catalogName(room.roomType.name)), value1: (room.floor) })}</div>
                    </div>

                    {/* Timeline Cell */}
                    <div className="flex-1 relative min-h-[40px]" style={{ minHeight: lanes * 36 + 8 }}>
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
                        {bars.map(({ booking: b, span, lane, kind }) => {
                          const overdueArrival = ['PENDING', 'CONFIRMED'].includes(b.status) && b.checkIn < today;
                          const label = kind === 'overdue' ? tr("reception:tapeChart.inHouseCheckOutOverdue") : awaitingOnlinePayment(b) ? tr("reception:contracts.awaitingPayment") : overdueArrival ? tr("reception:tapeChart.checkInOverdue") : deskBookingStatusLabel(b);
                          const title = tr("reception:tapeChart.valueValueValueValueNightsValue", { value0: (b.customer?.fullName ?? b.reference), value1: (b.checkIn), value2: (b.checkOut), value3: (b.nights), value4: (label) });
                          const barColor =
                            kind === 'overdue'
                              ? 'bg-rose-600 hover:bg-rose-700 text-white'
                              : b.status === "CHECKED_IN"
                              ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                              : b.status === "CONFIRMED"
                              ? "bg-sky-600 hover:bg-sky-700 text-white"
                              : b.status === "PENDING"
                              ? "bg-amber-500 hover:bg-amber-600 text-white"
                              : "bg-zinc-400 hover:bg-zinc-500 text-white";

                          return (
                            <button
                              key={`${b.id}-${kind}`}
                              type="button"
                              onClick={() =>
                                onSelectBooking
                                  ? onSelectBooking(b)
                                  : navigate(`${base}/bookings/${b.id}`)
                              }
                              className={`absolute h-7 rounded-md px-2 text-start text-xs font-medium shadow-xs transition-transform hover:scale-[1.01] hover:z-20 cursor-pointer overflow-hidden flex items-center gap-1.5 ${barColor}`}
                              style={{
                                top: 6 + lane * 36, left: `${(span.left / 14) * 100}%`,
                                width: `calc(${(span.width / 14) * 100}% - 2px)`,
                              }}
                              title={title}
                              aria-label={title}
                            >
                              <span className="size-1.5 rounded-full bg-white shrink-0" />
                              <span className="truncate font-semibold text-[11px]">
                                {b.customer?.fullName ?? b.reference}
                              </span>
                              <span className="hidden sm:inline text-[10px] opacity-80 truncate">
                                {kind === 'overdue' ? tr("reception:tapeChart.checkOutOverdue") : overdueArrival ? tr("reception:tapeChart.checkInOverdue") : tr("reception:tapeChart.valueNights", { value0: (b.nights) })}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ); })}

                {!query.data!.data.length && (
                  <div className="py-12 text-center text-sm text-zinc-400">{tr("reception:tapeChart.noRoomsMatchTheFilters")}</div>
                )}
              </div>
            </div>
          </div>

          <div className="border-t border-zinc-200 bg-zinc-50 px-4 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
              <span>{tr("reception:tapeChart.valueRooms14DaysScrollWithinTheBoardToViewMoreRooms", { value0: (query.data!.meta.total) })}</span>
              {query.data!.meta.totalPages > 1 && (
                <Pagination {...query.data!.meta} onChange={setPage} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
