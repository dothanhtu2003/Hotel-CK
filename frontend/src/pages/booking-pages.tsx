import { displayLocale, localized, safeError, t as tr, useLocale } from "../i18n";

import { catalogName } from "../i18n/catalog";

import { Trans } from "react-i18next";
import { ServicePaymentBadge, usePendingServicePayments } from '../features/guest/service-payment-notice';
import { useState, useEffect } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  BellRing,
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  MapPin,
  Phone,
  ReceiptText,
  RotateCcw,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import {
  Button,
  Dialog,
  EmptyState,
  ErrorState,
  LinkButton,
  PageHeading,
  Pagination,
} from '../components/ui';
import { Skeleton } from '../features/guest/components';
import { BookingStatus, bookingOverdue } from '../features/guest/booking-status';
import { BookingPayment } from '../features/guest/booking-payment';
import {
  bookingStatuses,
  formatBookingReference,
  guestError,
  money,
  statusLabels,
  type Booking,
  type Page,
  type Preview,
} from '../features/guest/contracts';
import { useGet } from '../features/guest/queries';
import { api } from '../lib/api';
import { useToast } from '../components/toast-context';

/* Date display helper for friendly Vietnamese hotel format */
function formatStayDateDisplay(isoDate: string): {
  weekday: string;
  dayMonth: string;
  year: string;
  formatted: string;
} {
  if (!isoDate) return { weekday: '', dayMonth: '', year: '', formatted: '' };
  try {
    const parts = isoDate.split('-');
    if (parts.length !== 3) return { weekday: '', dayMonth: isoDate, year: '', formatted: isoDate };
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    const date = new Date(Date.UTC(y, m, d, 12, 0, 0));
    const weekday = new Intl.DateTimeFormat(displayLocale(), { weekday: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(date);
    return {
      weekday: weekday.startsWith('Th') ? weekday : tr("guest:bookingPages.value", { value0: (weekday) }),
      dayMonth: new Intl.DateTimeFormat(displayLocale(), { day: '2-digit', month: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }).format(date),
      year: String(y),
      formatted: new Intl.DateTimeFormat(displayLocale(), { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' }).format(date),
    };
  } catch {
    return { weekday: '', dayMonth: isoDate, year: '', formatted: isoDate };
  }
}

function getDepartureNotice(checkOutIso: string, overdue: string | null) {
  if (overdue === 'departure') {
    return { text: tr("guest:bookingStatus.checkOutOverdue"), tone: 'danger' };
  }
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  if (checkOutIso === today) {
    return { text: tr("guest:bookingPages.checkOutTodayBefore1200"), tone: 'urgent' };
  }
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(tomorrowDate);

  if (checkOutIso === tomorrow) {
    return { text: tr("guest:bookingPages.checkOutTomorrowBefore1200"), tone: 'warning' };
  }
  const outDate = formatStayDateDisplay(checkOutIso);
  const outLabel = outDate.dayMonth || checkOutIso;
  return { text: tr("guest:bookingPages.checkOut") + outLabel + tr("guest:bookingPages.before1200"), tone: 'normal' };
}

const FILTER_TABS: { id: string; label: string }[] = localized(() => ([
  { id: '', label: tr("guest:bookingPages.all") },
  { id: 'CHECKED_IN', label: tr("guest:contracts.inHouse") },
  { id: 'CONFIRMED', label: tr("guest:contracts.confirmed") },
  { id: 'PENDING', label: tr("guest:bookingStatus.awaitingPayment") },
  { id: 'CHECKED_OUT', label: tr("guest:contracts.checkedOut") },
  { id: 'CANCELLED', label: tr("guest:bookingStatus.cancelled") },
]));

/* ========================================================
   MY BOOKINGS PAGE (LIST & FILTER)
   ======================================================== */
export function MyBookingsPage({ billing = false }: { billing?: boolean }) {
  useLocale();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const page = Math.max(1, Number(params.get('page')) || 1);
  const status = params.get('status') ?? '';

  const queryPath = `/bookings/my?page=${page}&pageSize=6${
    bookingStatuses.includes(status as Booking['status']) ? '&status=' + status : ''
  }`;
  const query = useGet<Page<Booking>>(queryPath);
  const unpaidServiceOrders = usePendingServicePayments();

  // Status counts for tabs
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!query.data) return;
    const data = query.data;
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setStatusCounts((prev) => {
      const next = { ...prev };
      if (!status) {
        next[''] = data.meta.total;
        FILTER_TABS.forEach((tab) => {
          if (tab.id) {
            next[tab.id] = data.data.filter((b) => b.status === tab.id).length;
          }
        });
      } else {
        next[status] = data.meta.total;
      }
      return next;
    });
    });
    return () => { active = false; };
  }, [query.data, status]);

  const isCurrentOrUpcoming = (booking: Booking) => {
    const overdue = bookingOverdue(booking);
    if (overdue) return false;
    return ['CHECKED_IN', 'CONFIRMED', 'PENDING'].includes(booking.status);
  };

  const bookings = query.data?.data ?? [];
  const hasActiveAndPast =
    !status &&
    bookings.some(isCurrentOrUpcoming) &&
    bookings.some((b) => !isCurrentOrUpcoming(b));

  const activeBookings = hasActiveAndPast ? bookings.filter(isCurrentOrUpcoming) : bookings;
  const pastBookings = hasActiveAndPast ? bookings.filter((b) => !isCurrentOrUpcoming(b)) : [];

  // Split active into staying (in-house) and upcoming
  const stayingBookings = activeBookings.filter((b) => b.status === 'CHECKED_IN');
  const upcomingBookings = activeBookings.filter((b) => b.status !== 'CHECKED_IN');

  /* 1. Hero Card for In-House Active Stay */
  const renderHeroBookingCard = (b: Booking) => {
    const inDate = formatStayDateDisplay(b.checkIn);
    const outDate = formatStayDateDisplay(b.checkOut);
    const detailUrl = `/guest/bookings/${b.id}${billing ? '/billing' : ''}`;
    const refCode = formatBookingReference(b.reference);
    const overdue = bookingOverdue(b);
    const departureNotice = getDepartureNotice(b.checkOut, overdue);

    return (
      <article
        key={b.id}
        className="guest-card guest-stay-pass-card guest-hero-stay-card is-active-stay"
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('a, button')) return;
          navigate(detailUrl);
        }}
      >
        {/* Top: Status & Live badge on left, ref code on right */}
        <div className="guest-card-top guest-hero-card-top">
          <div className="guest-hero-status-group">
            <BookingStatus booking={b} />
          </div>

          <div className="guest-card-ref-badge">
            <span className="guest-hero-ref-label">{tr("guest:bookingPages.reservationCode")}</span>
            <h2 className="guest-card-ref-title">{refCode}</h2>
            <button
              type="button"
              className="guest-card-copy-btn"
              title={tr("guest:bookingPages.copyCode")}
              aria-label={tr("guest:bookingPages.copyCodeValue", { value0: (refCode) })}
              onClick={(e) => {
                e.stopPropagation();
                void navigator.clipboard?.writeText(refCode);
                toast?.(() => (tr("guest:bookingPages.reservationCodeCopied")));
              }}
            >
              <Copy size={11} />
            </button>
          </div>
        </div>

        {/* Center: Room number + Departure Notice, and Stay Dates */}
        <div className="guest-hero-body">
          <div className="guest-hero-room-meta">
            <div className="guest-hero-room-line">
              <strong className="guest-hero-room-number">{tr("guest:roomCompare.roomValue", { value0: (b.roomNumber) })}</strong>
              <div className={`guest-departure-pill tone-${departureNotice.tone}`}>
                <Clock size={13} />
                <span>{departureNotice.text}</span>
              </div>
            </div>
            <div className="guest-card-room-line guest-hero-sub-line">
              <span className="guest-card-guests">{tr("guest:bookingPages.valueGuests", { value0: (b.guestCount) })}</span>
              <span className="guest-card-dot" aria-hidden="true">·</span>
              <span className="guest-card-nights">{tr("guest:bookingPages.valueNightsAway", { value0: (b.nights) })}</span>
            </div>
          </div>

          <div className="guest-card-dates guest-hero-dates">
            <div className="guest-card-date-col">
              <span className="guest-card-date-eyebrow">{tr("guest:bookingPages.checkIn")}</span>
              <span className="guest-card-date-main">{inDate.dayMonth || b.checkIn}</span>
              <span className="guest-card-date-sub">{tr("guest:bookingPages.valueFrom1400", { value0: (inDate.weekday) })}</span>
              <span className="sr-only">{b.checkIn}</span>
            </div>

            <div className="guest-card-date-arrow" aria-hidden="true">
              <ArrowRight size={20} strokeWidth={1.8} />
            </div>

            <div className="guest-card-date-col">
              <span className="guest-card-date-eyebrow">{tr("guest:bookingPages.checkOut2")}</span>
              <span className="guest-card-date-main">{outDate.dayMonth || b.checkOut}</span>
              <span className="guest-card-date-sub">{tr("guest:bookingPages.valueBefore1200", { value0: (outDate.weekday) })}</span>
              <span className="sr-only">{b.checkOut}</span>
            </div>
          </div>
        </div>

        {/* Footer: Price & Primary Context Actions */}
        <div className="guest-card-footer guest-hero-footer">
          <div className="guest-card-price-group">
            <span className="guest-card-price-label">{tr("guest:bookingPages.total")}</span>
            <strong className="guest-hero-price-amount whitespace-nowrap">
              {money(b.totalRoomAmount)}
            </strong>
            {b.nights > 1 && (
              <span className="guest-card-price-sub whitespace-nowrap">{tr("guest:bookingPages.valueNight", { value0: (money(b.nightlyPrice)) })}</span>
            )}
          </div>

          <div className="guest-hero-actions">
            {!billing && (
              <Link
                to={`/guest/services?bookingId=${b.id}`}
                className="guest-hero-btn guest-hero-service-btn"
                onClick={(e) => e.stopPropagation()}
                title={tr("guest:bookingPages.orderRoomService")}
              >
                <BellRing size={13} />
                <span>{tr("guest:bookingPages.roomService")}</span>
                <ServicePaymentBadge count={unpaidServiceOrders.filter(order => order.bookingId === b.id).length} />
              </Link>
            )}
            <Link
              to={`/guest/bookings/${b.id}/billing`}
              className="guest-hero-btn guest-hero-billing-btn"
              onClick={(e) => e.stopPropagation()}
              title={tr("guest:bookingPages.chargesInvoices")}
            >
              <ReceiptText size={13} />
              <span>{tr("guest:bookingPages.invoice")}</span>
            </Link>
            <Link
              to={detailUrl}
              className="guest-hero-btn guest-hero-primary-btn"
            >
              <span>{billing && b.status !== 'CANCELLED' ? tr("guest:bookingPages.viewChargesInvoice") : tr("guest:billingPages.reservationDetails")}</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </article>
    );
  };

  /* 2. Standard Grid Card for Upcoming and Past Stays */
  const renderBookingCard = (b: Booking) => {
    const inDate = formatStayDateDisplay(b.checkIn);
    const outDate = formatStayDateDisplay(b.checkOut);
    const isCheckedIn = b.status === 'CHECKED_IN';
    const isCheckedOut = b.status === 'CHECKED_OUT';
    const detailUrl = `/guest/bookings/${b.id}${billing ? '/billing' : ''}`;
    const refCode = formatBookingReference(b.reference);

    return (
      <article
        key={b.id}
        className={`guest-card guest-stay-pass-card ${
          isCheckedIn ? 'is-active-stay' : ''
        }`}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('a, button')) return;
          navigate(detailUrl);
        }}
      >
        {/* 1. Header: Status on Left, Ref code on Right */}
        <div className="guest-card-top">
          <BookingStatus booking={b} />

          <div className="guest-card-ref-badge">
            <h2 className="guest-card-ref-title">
              {refCode}
            </h2>
            <button
              type="button"
              className="guest-card-copy-btn"
              title={tr("guest:bookingPages.copyCode")}
              aria-label={tr("guest:bookingPages.copyCodeValue", { value0: (refCode) })}
              onClick={(e) => {
                e.stopPropagation();
                void navigator.clipboard?.writeText(refCode);
                toast?.(() => (tr("guest:bookingPages.reservationCodeCopied")));
              }}
            >
              <Copy size={11} />
            </button>
          </div>
        </div>

        {/* 2. Room & Guest Meta Line: Gộp 1 dòng gọn đẹp */}
        <div className="guest-card-room-line">
          <strong className="guest-card-room-number">{tr("guest:roomCompare.roomValue", { value0: (b.roomNumber) })}</strong>
          <span className="guest-card-dot" aria-hidden="true">·</span>
          <span className="guest-card-guests">{tr("guest:bookingPages.valueGuests", { value0: (b.guestCount) })}</span>
          <span className="guest-card-dot" aria-hidden="true">·</span>
          <span className="guest-card-nights">{tr("guest:bookingPages.valueNightsAway", { value0: (b.nights) })}</span>
        </div>

        {/* 3. Main Stay Dates: Lớn nhất, thoáng đãng, không ô lồng nhau */}
        <div className="guest-card-dates">
          <div className="guest-card-date-col">
            <span className="guest-card-date-eyebrow">{tr("guest:bookingPages.checkIn")}</span>
            <span className="guest-card-date-main">{inDate.dayMonth || b.checkIn}</span>
            <span className="guest-card-date-sub">{tr("guest:bookingPages.valueFrom1400", { value0: (inDate.weekday) })}</span>
            <span className="sr-only">{b.checkIn}</span>
          </div>

          <div className="guest-card-date-arrow" aria-hidden="true">
            <ArrowRight size={18} strokeWidth={1.8} />
          </div>

          <div className="guest-card-date-col">
            <span className="guest-card-date-eyebrow">{tr("guest:bookingPages.checkOut2")}</span>
            <span className="guest-card-date-main">{outDate.dayMonth || b.checkOut}</span>
            <span className="guest-card-date-sub">{tr("guest:bookingPages.valueBefore1200", { value0: (outDate.weekday) })}</span>
            <span className="sr-only">{b.checkOut}</span>
          </div>
        </div>

        {/* 4. Footer: Giá (Tổng tiền) & Link Chi tiết booking */}
        <div className="guest-card-footer">
          <div className="guest-card-price-group">
            <span className="guest-card-price-label">{tr("guest:bookingPages.total")}</span>
            <strong className="guest-card-price-amount whitespace-nowrap">
              {money(b.totalRoomAmount)}
            </strong>
            {b.nights > 1 && (
              <span className="guest-card-price-sub whitespace-nowrap">{tr("guest:bookingPages.valueNight", { value0: (money(b.nightlyPrice)) })}</span>
            )}
          </div>

          <div className="guest-card-action-links">
            {isCheckedIn && !billing && (
              <Link
                to={`/guest/services?bookingId=${b.id}`}
                className="guest-card-service-shortcut"
                onClick={(e) => e.stopPropagation()}
                title={tr("guest:bookingPages.orderRoomService")}
              >
                <BellRing size={12} />
                <span>{tr("guest:bookingPages.services")}</span>
              </Link>
            )}
            {isCheckedOut && !billing && (
              <>
                <Link
                  to={`/guest/bookings/${b.id}/billing`}
                  className="guest-card-secondary-shortcut"
                  onClick={(e) => e.stopPropagation()}
                  title={tr("guest:bookingPages.viewChargesInvoice")}
                >
                  <ReceiptText size={12} />
                  <span>{tr("guest:bookingPages.invoice")}</span>
                </Link>
                <Link
                  to="/rooms"
                  className="guest-card-secondary-shortcut"
                  onClick={(e) => e.stopPropagation()}
                  title={tr("guest:bookingPages.bookARoomAgain")}
                >
                  <RotateCcw size={12} />
                  <span>{tr("guest:bookingPages.bookAgain")}</span>
                </Link>
              </>
            )}
            <Link
              to={b.status === 'CANCELLED' ? `/guest/bookings/${b.id}` : detailUrl}
              className="guest-card-main-link"
            >
              <span>{billing && b.status !== 'CANCELLED' ? tr("guest:bookingPages.viewChargesInvoice") : tr("guest:billingPages.reservationDetails")}</span>
              <ArrowRight size={14} className="guest-card-link-arrow" />
            </Link>
          </div>
        </div>
      </article>
    );
  };

  return (
    <div className="guest-bookings-page-space">
      <PageHeading
        title={billing ? tr("guest:bookingPages.invoicesPayments") : tr("guest:bookingPages.myReservations")}
      />

      {/* Filter Bar with Tabs & Dropdown */}
      <div className="guest-filter-bar">
        <div className="guest-filter-tabs" role="tablist" aria-label={tr("guest:bookingPages.filterByStayStatus")}>
          {FILTER_TABS.map((tab) => {
            const isActive = status === tab.id;
            const count = statusCounts[tab.id];
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`guest-filter-tab ${isActive ? 'is-active' : ''}`}
                onClick={() => setParams(tab.id ? { status: tab.id } : {})}
              >
                <span>{tab.label}</span>
                {typeof count === 'number' && (
                  <span
                    className={`guest-filter-tab-count ${
                      count > 0 ? 'has-data' : 'is-zero'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="guest-filter-meta-wrap">
          {query.data && (
            <span className="guest-booking-count-chip">{tr("guest:bookingPages.valueStays", { value0: (query.data.meta.total) })}</span>
          )}
          <label className="filter-label quick-select-label sr-only">
            {tr("guest:bookingPages.reservationStatus")}<select
              className="input quick-select"
              value={status}
              onChange={(e) =>
                setParams(e.target.value ? { status: e.target.value } : {})
              }
            >
              <option value="">{tr("guest:bookingPages.allStatuses")}</option>
              {bookingStatuses.map((s) => (
                <option value={s} key={s}>
                  {statusLabels[s]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {query.isPending ? (
        <Skeleton />
      ) : query.error ? (
        <ErrorState message={safeError(query.error)} retry={() => void query.refetch()} />
      ) : query.data && (
        <>
          {query.data.data.length ? (
            hasActiveAndPast ? (
              <div className="guest-grouped-sections">
                {stayingBookings.length > 0 && (
                  <section className="guest-booking-group-section" aria-label={tr("guest:bookingPages.currentStays")}>
                    <div className="guest-group-header">
                      <Sparkles size={16} className="text-emerald-700" />
                      <h3 className="guest-group-title">
                        {tr("guest:bookingPages.currentStays")}<span className="guest-group-count">{stayingBookings.length}</span>
                      </h3>
                    </div>
                    <div className="guest-hero-stay-wrap">
                      {stayingBookings.map(renderHeroBookingCard)}
                    </div>
                  </section>
                )}

                {upcomingBookings.length > 0 && (
                  <section className="guest-booking-group-section" aria-label={tr("guest:bookingPages.upcomingStays")}>
                    <div className="guest-group-header">
                      <Calendar size={16} className="text-emerald-700" />
                      <h3 className="guest-group-title">
                        {tr("guest:bookingPages.upcomingStays")}<span className="guest-group-count">{upcomingBookings.length}</span>
                      </h3>
                    </div>
                    <div className="booking-list guest-stay-passes-grid">
                      {upcomingBookings.map(renderBookingCard)}
                    </div>
                  </section>
                )}

                {pastBookings.length > 0 && (
                  <section className="guest-booking-group-section is-past" aria-label={tr("guest:bookingPages.previousStays")}>
                    <div className="guest-group-header past-header">
                      <Clock size={16} className="text-stone-500" />
                      <h3 className="guest-group-title">
                        {tr("guest:bookingPages.previousStays")}<span className="guest-group-count">{pastBookings.length}</span>
                      </h3>
                    </div>
                    <div className="booking-list guest-stay-passes-grid">
                      {pastBookings.map(renderBookingCard)}
                    </div>
                  </section>
                )}
              </div>
            ) : (
              <div className="booking-list guest-stay-passes-grid">
                {status === 'CHECKED_IN'
                  ? bookings.map(renderHeroBookingCard)
                  : bookings.map(renderBookingCard)}
              </div>
            )
          ) : (
            <EmptyState
              title={tr("guest:bookingPages.noReservationsYet")}
              description={tr("guest:bookingPages.noReservationsMatchTheCurrentFilter")}
              action={<LinkButton to="/rooms">{tr("guest:bookingPages.exploreRooms")}</LinkButton>}
            />
          )}

          {query.data.meta.totalPages > 1 && (
            <Pagination
              {...query.data.meta}
              onChange={(p) =>
                setParams({ ...(status ? { status } : {}), page: String(p) })
              }
            />
          )}
        </>
      )}
    </div>
  );
}


/* ========================================================
   BOOKING DETAIL PAGE
   ======================================================== */
export function BookingDetailPage() {
  useLocale();
  const { id = '' } = useParams();
  const query = useGet<Booking>('/bookings/' + id);
  const billing = useGet<Preview>(`/bookings/${id}/billing-preview`);
  const [confirm, setConfirm] = useState(false);
  const [checkoutConfirm, setCheckoutConfirm] = useState(false);
  const qc = useQueryClient();
  const toast = useToast();

  const cancel = useMutation({
    retry: false,
    mutationFn: () => query.data?.onlinePaymentRequired
      ? api.request(`/bookings/${id}/payos/cancel`, { method: 'POST' })
      : api.request<Booking>(`/bookings/${id}/cancel`, { method: 'PATCH' }),
    onSuccess: () => {
      setConfirm(false);
      toast(() => (tr("guest:bookingPages.reservationCancelled")));
      void qc.invalidateQueries({ queryKey: ['guest'] });
    },
    onError: () => {
      void qc.invalidateQueries({ queryKey: ['guest'] });
    },
  });

  const requestCheckout = useMutation({
    retry: false,
    mutationFn: () => api.request<Booking>(`/bookings/${id}/request-checkout`, { method: 'PATCH' }),
    onSuccess: () => {
      setCheckoutConfirm(false);
      toast(() => (tr("guest:bookingPages.yourCheckOutRequestHasBeenSentToReception")));
      void qc.invalidateQueries({ queryKey: ['guest'] });
      void qc.invalidateQueries({ queryKey: ['reception'] });
    },
    onError: () => { void qc.invalidateQueries({ queryKey: ['guest'] }); },
  });

  if (query.isPending) return <Skeleton />;
  if (query.error)
    return (
      <ErrorState message={safeError(query.error)} retry={() => void query.refetch()} />
    );

  const b = query.data!;

  // Status Stepper Progress
  const isCancelled = b.status === 'CANCELLED';
  const steps = [
    { key: 'PENDING', label: b.onlinePaymentRequired ? tr("guest:bookingStatus.awaitingPayment") : tr("guest:bookingStatus.awaitingConfirmation") },
    { key: 'CONFIRMED', label: tr("guest:contracts.confirmed") },
    { key: 'CHECKED_IN', label: tr("guest:contracts.inHouse") },
    { key: 'CHECKED_OUT', label: tr("guest:bookingPages.completed") },
  ];
  const currentStepIndex = steps.findIndex((s) => s.key === b.status);

  const inDate = formatStayDateDisplay(b.checkIn);
  const outDate = formatStayDateDisplay(b.checkOut);

  return (
    <div className="guest-booking-detail-space">
      <div className="guest-detail-top-nav">
        <Link to="/guest/bookings" className="guest-detail-back-link">
          <ArrowLeft size={16} />
          <span>{tr("guest:bookingPages.myReservations")}</span>
        </Link>
      </div>

      <div className="guest-detail-header-card">
        <div className="guest-detail-header-info">
          <span className="guest-detail-ref-label">{tr("guest:bookingPages.reservationCode2")}</span>
          <h1 className="guest-detail-title">
            {tr("common:supplement.reservationReference", { reference: formatBookingReference(b.reference) })}
          </h1>
        </div>
        <BookingStatus booking={b} detail />
      </div>

      {/* Main Reservation Ticket Card */}
      <section className="panel guest-box guest-detail-card">
        <div className="guest-detail-room-banner">
          <div className="guest-detail-room-badge">
            <h2 className="guest-detail-room-title">{tr("guest:roomCompare.roomValue", { value0: (b.roomNumber) })}</h2>
          </div>
          <div className="guest-detail-room-meta">
            <span className="guest-detail-stay-summary">{tr("guest:bookingPages.valueNightsValueGuests", { value0: (b.nights), value1: (b.guestCount) })}</span>
            <span className="guest-detail-price-preview"><Trans ns="guest" i18nKey="bookingPages.valueNightTotalRoomChargeValue" values={{ value0: (money(b.nightlyPrice)), value1: (money(b.totalRoomAmount)) }} components={{ part0: <strong /> }} /></span>
          </div>
        </div>

        {/* Stay Journey Stepper (if not cancelled) */}
        {!isCancelled && currentStepIndex >= 0 && (
          <div className="guest-stay-stepper" aria-label={tr("guest:bookingPages.stayTimeline")}>
            {steps.map((step, idx) => {
              const isPast = idx < currentStepIndex;
              const isCurrent = idx === currentStepIndex;
              return (
                <div
                  key={step.key}
                  className={`stepper-step ${isPast ? 'is-past' : ''} ${
                    isCurrent ? 'is-current' : ''
                  }`}
                >
                  <div className="stepper-circle">
                    {isPast ? <CheckCircle2 size={16} /> : idx + 1}
                  </div>
                  <span className="stepper-label">{step.label}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Stay Dates Box */}
        <div className="guest-detail-dates-card">
          <div className="guest-dates-col">
            <span className="guest-dates-label">{tr("guest:bookingPages.checkIn")}</span>
            <strong className="guest-dates-value">{inDate.dayMonth || b.checkIn}</strong>
            <span className="guest-dates-sub">{tr("guest:bookingPages.valueFrom1400", { value0: (inDate.weekday) })}</span>
            <span className="sr-only">{tr("guest:bookingPages.valueFrom14002", { value0: (b.checkIn) })}</span>
          </div>

          <div className="guest-dates-divider" aria-hidden="true">
            <span className="guest-dates-nights-badge">{tr("guest:bookingPages.valueNights", { value0: (b.nights) })}</span>
            <ArrowRight size={18} />
          </div>

          <div className="guest-dates-col">
            <span className="guest-dates-label">{tr("guest:bookingPages.checkOut2")}</span>
            <strong className="guest-dates-value">{outDate.dayMonth || b.checkOut}</strong>
            <span className="guest-dates-sub">{tr("guest:bookingPages.valueBefore1200", { value0: (outDate.weekday) })}</span>
            <span className="sr-only">{tr("guest:bookingPages.valueBefore12002", { value0: (b.checkOut) })}</span>
          </div>
        </div>

        {billing.isPending ? <Skeleton /> : billing.error ? (
          <ErrorState message={safeError(billing.error)} retry={() => void billing.refetch()} />
        ) : !isCancelled && billing.data && (
          <section aria-label={tr("guest:bookingPages.roomAndServiceCharges")} className="guest-detail-billing-section">
            <div className="guest-detail-section-title">
              <ReceiptText size={16} />
              <h3>{tr("guest:bookingPages.roomServiceCharges")}</h3>
            </div>
            <dl className="guest-facts detail-facts-sheet">
              <div>
                <dt>{tr("guest:bookingPages.roomChargesValueNights", { value0: (b.nights) })}</dt>
                <dd>{money(b.totalRoomAmount)}</dd>
              </div>
              {billing.data.serviceAmount && Number(billing.data.serviceAmount) > 0 ? (
                <div>
                  <dt>{tr("guest:bookingPages.servicesChargedToRoom")}</dt>
                  <dd>{money(billing.data.serviceAmount)}</dd>
                </div>
              ) : null}
              {billing.data.counterPaidAmount && (
                <div>
                  <dt>{tr("guest:bookingPages.servicesPaidSeparately")}</dt>
                  <dd>{money(billing.data.counterPaidAmount)}</dd>
                </div>
              )}
              <div className="fact-total-highlight">
                <dt>{tr("guest:bookingPages.totalRoomServiceCharges")}</dt>
                <dd><strong className="fact-total-price">{money(billing.data.totalAmount)}</strong></dd>
              </div>
              <div>
                <dt>{tr("guest:contracts.paid")}</dt>
                <dd>{money(billing.data.paidAmount ?? '0')}</dd>
              </div>
              <div>
                <dt>{tr("guest:bookingPages.balanceDue")}</dt>
                <dd><strong className="fact-balance-due">{money(billing.data.balance ?? billing.data.totalAmount)}</strong></dd>
              </div>
            </dl>
            {billing.data.completedOrders.length > 0 && (
              <div className="completed-orders-section">
                <h3>{tr("guest:bookingPages.servicesChargedToRoomDetails")}</h3>
                {billing.data.completedOrders.map(order => (
                  <div key={order.id} className="completed-order-group">
                    {order.items.map(item => (
                      <p key={item.id} className="completed-item-line">
                        <span>{tr("guest:bookingPages.valueValueValueUnit", { value0: (catalogName(item.serviceName)), value1: (item.quantity), value2: (money(item.unitPrice)) })}</span>
                        <strong>{money(item.subtotal)}</strong>
                      </p>
                    ))}
                  </div>
                ))}
              </div>
            )}
            {billing.data.pendingOrderCount > 0 && (
              <p className="pending-orders-alert">{tr("guest:bookingPages.valueServiceOrdersArePendingAndAreNotIncludedInTheTotal", { value0: (billing.data.pendingOrderCount) })}</p>
            )}
          </section>
        )}

        {/* Hospitality & Front Desk Support Info */}
        <div className="guest-detail-support-box">
          <div className="support-col">
            <MapPin size={18} />
            <div>
              <strong>{tr("guest:bookingPages.checkInLocation")}</strong>
              <p>{tr("guest:bookingPages.anNhienHotelSuitesReceptionFloor1")}</p>
            </div>
          </div>
          <div className="support-col">
            <Phone size={18} />
            <div>
              <strong>{tr("guest:bookingPages.247ReceptionSupport")}</strong>
              <p>{tr("guest:bookingPages.hotline19000000InternalExtension101")}</p>
            </div>
          </div>
        </div>

        {b.status === 'CHECKED_IN' && b.checkoutRequestedAt && (
          <p role="status" className="pending-orders-alert">{tr("guest:bookingPages.checkOutRequestSentAwaitingReception")}</p>
        )}
        {b.onlinePaymentRequired && <BookingPayment booking={b} />}
        {/* Action Buttons */}
        <div className="guest-actions detail-actions-bar">
          {!isCancelled && <LinkButton to={`/guest/bookings/${id}/billing`}>
            <ReceiptText size={16} /> {tr("guest:bookingPages.viewChargesInvoice2")}</LinkButton>}

          {b.status === 'CHECKED_IN' && (
            <LinkButton to={`/guest/services?bookingId=${id}`} variant="secondary">
              <BellRing size={16} /> {tr("guest:bookingPages.orderRoomService2")}</LinkButton>
          )}

          {b.status === 'CHECKED_IN' && (
            <Button variant="secondary" disabled={!!b.checkoutRequestedAt} onClick={() => { requestCheckout.reset(); setCheckoutConfirm(true); }}>
              {b.checkoutRequestedAt ? tr("guest:bookingPages.awaitingCheckOut") : tr("guest:bookingPages.requestCheckOut")}
            </Button>
          )}
          {(['PENDING', 'CONFIRMED'].includes(b.status) && !(b.onlinePaymentRequired && b.status === 'CONFIRMED')) && (
            <Button
              variant="secondary"
              onClick={() => {
                cancel.reset();
                setConfirm(true);
              }}
              className="guest-cancel-booking-btn"
            >{tr("guest:bookingPages.cancelReservation")}</Button>
          )}
        </div>
      </section>

      <Dialog open={checkoutConfirm} onClose={() => { if (!requestCheckout.isPending) setCheckoutConfirm(false); }} title={tr("guest:bookingPages.sendCheckOutRequest")}>
        <p>{tr("guest:bookingPages.receptionWillInspectTheRoomFinalizeChargesAndAssistWithPaymentTo")}</p>
        {billing.data && <p><Trans ns="guest" i18nKey="bookingPages.estimatedRoomAndServiceChargesValue" values={{ value0: (money(billing.data.totalAmount)) }} components={{ part0: <strong /> }} /></p>}
        {requestCheckout.error && <p role="alert" className="form-error">{guestError(requestCheckout.error)}</p>}
        <div className="dialog-actions">
          <Button variant="secondary" disabled={requestCheckout.isPending} onClick={() => setCheckoutConfirm(false)}>{tr("guest:bookingPages.back")}</Button>
          <Button busy={requestCheckout.isPending} onClick={() => requestCheckout.mutate()}>{tr("guest:bookingPages.confirmRequest")}</Button>
        </div>
      </Dialog>
      {/* Cancellation Dialog */}
      <Dialog
        open={confirm}
        onClose={() => {
          if (!cancel.isPending) setConfirm(false);
        }}
        title={tr("guest:bookingPages.cancelThisReservation")}
      >
        <div className="guest-dialog-warning-box">
          <ShieldAlert size={22} className="warning-icon" />
          <p><Trans ns="guest" i18nKey="bookingPages.areYouSureYouWantToCancelReservationValueForRoomValue" values={{ value0: (formatBookingReference(b.reference)), value1: (b.roomNumber) }} components={{ part0: <strong />, part1: <strong /> }} /></p>
        </div>

        {cancel.error && (
          <p role="alert" className="form-error">
            {guestError(cancel.error)}
          </p>
        )}

        <div className="dialog-actions">
          <Button
            variant="secondary"
            disabled={cancel.isPending}
            onClick={() => setConfirm(false)}
          >{tr("guest:bookingPages.keepReservation")}</Button>
          <Button
            busy={cancel.isPending}
            disabled={!!cancel.error}
            onClick={() => cancel.mutate()}
            className="confirm-cancel-danger-btn"
          >{tr("guest:bookingPages.confirmCancellation")}</Button>
        </div>
      </Dialog>
    </div>
  );
}
