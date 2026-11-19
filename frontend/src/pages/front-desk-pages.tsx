import { formatDate as localizedDate } from "../i18n/format";
import { displayLocale, safeError, t as tr, useLocale } from "../i18n";


import { useDeskNavigate } from "../features/reception/navigation-state";
import { CashierPage, StaleBookingQueue } from '../features/reception/cashier';

import { Navigate, useLocation, useSearchParams } from "react-router";
import {
  Calendar,
  ChevronDown,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
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
  useLocale();
  return billing ? <CashierPage /> : <ReceptionBookingList />;
}

function ReceptionBookingList() {
  useLocale();
  const billing = false;
  const base = useDeskBase(),
    [params, setParams] = useSearchParams(),
    page = pageNumber(params.get("page"));
  const filters = new URLSearchParams(params);
  filters.set("page", String(page));
  filters.set("pageSize", "10");
  if (params.get("view")) filters.set("date", params.get("date") ?? hotelToday());
  else filters.delete("date");
  const query = useDeskGet<Page<DeskBooking>>(
    "/front-desk/bookings?" + filters,
  );
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    next.delete("page");
    // Custom filters open a history search; operational tabs always show their full scope.
    if (key !== "date") next.delete("view");
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  };
  const currentView = params.get("view") ?? "";
  const currentStatus = params.get("status") ?? "";

  const setTab = (view: string, status?: string) => {
    const next = new URLSearchParams();
    if (params.get("date")) next.set("date", params.get("date")!);
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
    if (countsQuery.isPending) return <span role="status" aria-label={tr("reception:frontDeskPages.loadingReservationCounts")} className="inline-block h-5 w-6 animate-pulse rounded bg-zinc-200/70 align-middle" />;
    if (countsQuery.isError) return <span className="text-xs whitespace-nowrap">{tr("reception:frontDeskPages.loadingError")}</span>;
    return (countsQuery.data?.[key] ?? 0).toLocaleString(displayLocale());
  };
  const prettyDate = new Date(currentDate + "T00:00:00Z").toLocaleDateString(displayLocale(), {
    weekday: "short",
    day: "numeric",
    month: "numeric",
    timeZone: "UTC",
  });
  const fullDate = localizedDate(currentDate);
  const scopeLabel = currentView === "arrivals" ? tr("reception:frontDeskPages.arrivalsCheckInDateValue", { value0: (fullDate) })
    : currentView === "staying" ? tr("reception:frontDeskPages.inHouseStayingOnValue", { value0: (fullDate) })
    : currentView === "departures" ? tr("reception:frontDeskPages.departuresCheckOutDateValue", { value0: (fullDate) })
    : currentView === "overdue" ? tr("reception:frontDeskPages.overdueArrivalsBeforeValue", { value0: (fullDate) })
    : currentStatus === "PENDING" ? tr("reception:frontDeskPages.awaitingCheckInAllDates")
    : tr("reception:frontDeskPages.allReservationsAllDates");
  const hasCustomFilters = Boolean(params.get("q") || params.get("checkIn") || params.get("checkOut") || (currentStatus && currentStatus !== "PENDING"));

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
      <StaleBookingQueue />
      {/* Header with Title and Date Switcher matching Kamra InHouse.tsx */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">
            {billing ? tr("reception:frontDeskPages.findChargesInvoices") : tr("reception:frontDeskPages.manageReservations")}
          </h1>
          
        </div>

        <div className="flex items-center gap-2">
          <LinkButton to={base + "?mode=booking"}>
            <Plus size={15} /> {tr("reception:frontDeskPages.newReservation")}</LinkButton>
        </div>
      </div>

      {countsQuery.isError && (
        <div role="alert" className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <span>{tr("reception:frontDeskPages.unableToLoadReservationCounts")}</span>
          <button type="button" className="font-medium underline cursor-pointer" onClick={() => void countsQuery.refetch()}>{tr("reception:today.tryAgain")}</button>
        </div>
      )}

      {/* Unified Table Section */}
      <section className="rounded-2xl border border-zinc-200 bg-white shadow-2xs overflow-hidden">
        <div className="border-b border-zinc-200 p-3 sm:p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-1 rounded-xl bg-zinc-100/70 p-1" role="group" aria-label={tr("reception:frontDeskPages.reservationView")}>
            {([
              { view: "", status: "", label: tr("reception:frontDeskPages.allReservations") },
              { view: "arrivals", status: "", label: tr("reception:frontDeskPages.arrivals"), count: "arrivals" },
              { view: "staying", status: "", label: tr("reception:roomState.occupied"), count: "staying" },
              { view: "departures", status: "", label: tr("reception:frontDeskPages.departures"), count: "departures" },
              { view: "", status: "PENDING", label: tr("reception:contracts.awaitingCheckIn") },
              { view: "overdue", status: "", label: tr("reception:frontDeskPages.overdueArrivals") },
            ] as const).map((tab) => {
              const selected = currentView === tab.view && currentStatus === tab.status;
              return (
                <button
                  key={`${tab.view}-${tab.status}`}
                  type="button"
                  aria-pressed={selected}
                  title={"count" in tab ? tr("reception:frontDeskPages.reservationsOnValue", { value0: (fullDate) }) : undefined}
                  onClick={() => setTab(tab.view, tab.status)}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors cursor-pointer ${selected
                    ? "bg-white text-brand-800 shadow-2xs ring-1 ring-zinc-200"
                    : "text-zinc-600 hover:bg-white/70 hover:text-zinc-900"}`}
                >
                  {tab.label}
                  {"count" in tab && <span className={`rounded-md px-1.5 py-0.5 text-[11px] tabular-nums ${selected ? "bg-brand-50 text-brand-800" : "bg-zinc-200/60 text-zinc-500"}`}>{countValue(tab.count)}</span>}
                  {!tab.view && !tab.status && selected && query.data?.meta && <span className="text-[11px] tabular-nums text-zinc-500">({query.data.meta.total})</span>}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-start gap-2">
            <form
              className="flex min-w-0 w-full sm:flex-1 sm:min-w-64 items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                update("q", String(new FormData(e.currentTarget).get("q") ?? ""));
              }}
            >
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-zinc-400" />
                <input
                  className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-8 pr-3 text-xs text-zinc-800 placeholder-zinc-400 focus:bg-white focus:border-brand-600 focus:outline-none transition-colors"
                  name="q"
                  aria-label={tr("reception:frontDeskPages.searchReservationsOrGuests")}
                  key={params.get("q") ?? ""}
                  defaultValue={params.get("q") ?? ""}
                  placeholder={tr("reception:frontDeskPages.searchReservationCodeGuestNameRoomPhone")}
                />
              </div>
              <button
                type="submit"
                className="inline-flex items-center rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100 cursor-pointer shrink-0 shadow-2xs transition-colors"
              >{tr("reception:cashier.search")}</button>
            </form>
            {currentView && <div className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-white p-1 text-xs">
            <button
              type="button"
              aria-label={tr("reception:cashier.previousDay")}
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
              title={tr("reception:frontDeskPages.backToToday")}
            >
              {prettyDate}
            </button>
            <button
              type="button"
              aria-label={tr("reception:cashier.nextDay")}
              className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 cursor-pointer"
              onClick={() => update("date", shiftDate(currentDate, 1))}
            >
              <ChevronRight className="size-3.5" />
            </button>
          </div>}
            <details className="group w-auto open:w-full">
              <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50 [&::-webkit-details-marker]:hidden">
                <SlidersHorizontal className="size-3.5" /> {tr("reception:frontDeskPages.advancedFilters")}{hasCustomFilters && <span className="size-1.5 rounded-full bg-brand-600" aria-label={tr("reception:frontDeskPages.additionalFiltersActive")} />}
                <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" />
              </summary>
              <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 sm:justify-end">
            <select
              className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-700 focus:outline-brand-600 shadow-2xs cursor-pointer"
              value={params.get("status") ?? ""}
              onChange={(e) => update("status", e.target.value)}
              aria-label={tr("reception:frontDeskPages.reservationStatus")}
            >
              <option value="">{tr("reception:frontDeskPages.allStatuses")}</option>
              {bookingStatuses.filter((s) => s !== "CONFIRMED").map((s) => (
                <option key={s} value={s}>
                  {s === "PENDING" ? tr("reception:contracts.awaitingCheckIn") : statusLabels[s]}
                </option>
              ))}
            </select>

            <label className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs text-zinc-600 shadow-2xs">
              <Calendar className="size-3 text-zinc-400 shrink-0" />
              <span className="text-zinc-500">{tr("reception:frontDeskPages.checkIn")}</span>
              <input
                className="bg-transparent text-xs text-zinc-700 focus:outline-none cursor-pointer"
                type="date"
                value={params.get("checkIn") ?? ""}
                onChange={(e) => update("checkIn", e.target.value)}
              />
            </label>

            <label className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs text-zinc-600 shadow-2xs">
              <Calendar className="size-3 text-zinc-400 shrink-0" />
              <span className="text-zinc-500">{tr("reception:frontDeskPages.checkOut")}</span>
              <input
                className="bg-transparent text-xs text-zinc-700 focus:outline-none cursor-pointer"
                type="date"
                value={params.get("checkOut") ?? ""}
                onChange={(e) => update("checkOut", e.target.value)}
              />
            </label>


              </div>
            </details>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <p role="status" className="text-zinc-500">{scopeLabel}{hasCustomFilters ? tr("reception:frontDeskPages.additionalFiltersActive2") : ""}</p>
            {hasActiveFilters && <button type="button" onClick={() => setParams({})} className="inline-flex items-center gap-1 text-zinc-500 hover:text-rose-600 cursor-pointer">
              <X className="size-3.5" /> {tr("reception:frontDeskPages.clearFilters")}</button>}
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
              message={safeError(query.error)}
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
  useLocale();
  const base = useDeskBase(),
    location = useLocation();
  return <Navigate to={`${base}${location.search}`} replace />;
}

export function ReceptionWalkIn() {
  useLocale();
  const base = useDeskBase(),
    location = useLocation();
  const search = new URLSearchParams(location.search);
  if (!search.has("mode")) {
    search.set("mode", "booking");
  }
  return <Navigate to={`${base}?${search.toString()}`} replace />;
}

export function ReceptionTapeChartPage() {
  useLocale();
  const base = useDeskBase(),
    navigate = useDeskNavigate();
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
