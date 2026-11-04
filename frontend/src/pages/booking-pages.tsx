import { useState, useEffect } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
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
  Users,
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
  isUuid,
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
    const weekday = new Intl.DateTimeFormat('vi-VN', { weekday: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(date);
    const day = String(d).padStart(2, '0');
    const month = String(m + 1).padStart(2, '0');
    return {
      weekday: weekday.startsWith('Th') ? weekday : `Thứ ${weekday}`,
      dayMonth: `${day}/${month}`,
      year: String(y),
      formatted: `${day}/${month}/${y}`,
    };
  } catch {
    return { weekday: '', dayMonth: isoDate, year: '', formatted: isoDate };
  }
}

function getDepartureNotice(checkOutIso: string, overdue: string | null) {
  if (overdue === 'departure') {
    return { text: 'Quá hạn trả phòng', tone: 'danger' };
  }
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  if (checkOutIso === today) {
    return { text: 'Trả phòng hôm nay · Trước 12:00', tone: 'urgent' };
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
    return { text: 'Trả phòng ngày mai · Trước 12:00', tone: 'warning' };
  }
  const outDate = formatStayDateDisplay(checkOutIso);
  const outLabel = outDate.dayMonth || checkOutIso;
  return { text: 'Trả phòng: ' + outLabel + ' · Trước 12:00', tone: 'normal' };
}

const FILTER_TABS: { id: string; label: string }[] = [
  { id: '', label: 'Tất cả' },
  { id: 'CHECKED_IN', label: 'Đang lưu trú' },
  { id: 'CONFIRMED', label: 'Đã xác nhận' },
  { id: 'PENDING', label: 'Chờ thanh toán / xác nhận' },
  { id: 'CHECKED_OUT', label: 'Đã trả phòng' },
  { id: 'CANCELLED', label: 'Đã hủy' },
];

/* ========================================================
   MY BOOKINGS PAGE (LIST & FILTER)
   ======================================================== */
export function MyBookingsPage({ billing = false }: { billing?: boolean }) {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const page = Math.max(1, Number(params.get('page')) || 1);
  const status = params.get('status') ?? '';

  const queryPath = `/bookings/my?page=${page}&pageSize=6${
    bookingStatuses.includes(status as Booking['status']) ? '&status=' + status : ''
  }`;
  const query = useGet<Page<Booking>>(queryPath);

  // Status counts for tabs
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!query.data) return;
    setStatusCounts((prev) => {
      const next = { ...prev };
      if (!status) {
        next[''] = query.data.meta.total;
        FILTER_TABS.forEach((tab) => {
          if (tab.id) {
            next[tab.id] = query.data.data.filter((b) => b.status === tab.id).length;
          }
        });
      } else {
        next[status] = query.data.meta.total;
      }
      return next;
    });
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
            <span className="guest-hero-live-chip">Đang diễn ra</span>
          </div>

          <div className="guest-card-ref-badge">
            <span className="guest-hero-ref-label">Mã đặt phòng:</span>
            <h2 className="guest-card-ref-title">{refCode}</h2>
            <button
              type="button"
              className="guest-card-copy-btn"
              title="Sao chép mã"
              aria-label={`Sao chép mã ${refCode}`}
              onClick={(e) => {
                e.stopPropagation();
                void navigator.clipboard?.writeText(refCode);
                toast?.('Đã sao chép mã đặt phòng');
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
              <strong className="guest-hero-room-number">Phòng {b.roomNumber}</strong>
              <div className={`guest-departure-pill tone-${departureNotice.tone}`}>
                <Clock size={13} />
                <span>{departureNotice.text}</span>
              </div>
            </div>
            <div className="guest-card-room-line guest-hero-sub-line">
              <span className="guest-card-guests">{b.guestCount} khách</span>
              <span className="guest-card-dot" aria-hidden="true">·</span>
              <span className="guest-card-nights">{b.nights} đêm nghỉ dưỡng</span>
            </div>
          </div>

          <div className="guest-card-dates guest-hero-dates">
            <div className="guest-card-date-col">
              <span className="guest-card-date-eyebrow">NHẬN PHÒNG</span>
              <span className="guest-card-date-main">{inDate.dayMonth || b.checkIn}</span>
              <span className="guest-card-date-sub">{inDate.weekday} · từ 14:00</span>
              <span className="sr-only">{b.checkIn}</span>
            </div>

            <div className="guest-card-date-arrow" aria-hidden="true">
              <ArrowRight size={20} strokeWidth={1.8} />
            </div>

            <div className="guest-card-date-col">
              <span className="guest-card-date-eyebrow">TRẢ PHÒNG</span>
              <span className="guest-card-date-main">{outDate.dayMonth || b.checkOut}</span>
              <span className="guest-card-date-sub">{outDate.weekday} · trước 12:00</span>
              <span className="sr-only">{b.checkOut}</span>
            </div>
          </div>
        </div>

        {/* Footer: Price & Primary Context Actions */}
        <div className="guest-card-footer guest-hero-footer">
          <div className="guest-card-price-group">
            <span className="guest-card-price-label">Tổng:</span>
            <strong className="guest-hero-price-amount whitespace-nowrap">
              {money(b.totalRoomAmount)}
            </strong>
            {b.nights > 1 && (
              <span className="guest-card-price-sub whitespace-nowrap">
                ({money(b.nightlyPrice)} / đêm)
              </span>
            )}
          </div>

          <div className="guest-hero-actions">
            {!billing && (
              <Link
                to={`/guest/services?bookingId=${b.id}`}
                className="guest-card-service-shortcut guest-hero-service-shortcut"
                onClick={(e) => e.stopPropagation()}
                title="Đặt dịch vụ phòng"
              >
                <BellRing size={13} />
                <span>Dịch vụ phòng</span>
              </Link>
            )}
            <Link
              to={`/guest/bookings/${b.id}/billing`}
              className="guest-card-secondary-shortcut"
              onClick={(e) => e.stopPropagation()}
              title="Chi phí & Hóa đơn"
            >
              <ReceiptText size={13} />
              <span>Hóa đơn</span>
            </Link>
            <Link
              to={detailUrl}
              className="guest-card-main-link guest-hero-detail-link"
            >
              <span>{billing && b.status !== 'CANCELLED' ? 'Xem chi phí & hóa đơn' : 'Chi tiết booking'}</span>
              <ArrowRight size={14} className="guest-card-link-arrow" />
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
              title="Sao chép mã"
              aria-label={`Sao chép mã ${refCode}`}
              onClick={(e) => {
                e.stopPropagation();
                void navigator.clipboard?.writeText(refCode);
                toast?.('Đã sao chép mã đặt phòng');
              }}
            >
              <Copy size={11} />
            </button>
          </div>
        </div>

        {/* 2. Room & Guest Meta Line: Gộp 1 dòng gọn đẹp */}
        <div className="guest-card-room-line">
          <strong className="guest-card-room-number">Phòng {b.roomNumber}</strong>
          <span className="guest-card-dot" aria-hidden="true">·</span>
          <span className="guest-card-guests">{b.guestCount} khách</span>
          <span className="guest-card-dot" aria-hidden="true">·</span>
          <span className="guest-card-nights">{b.nights} đêm nghỉ dưỡng</span>
        </div>

        {/* 3. Main Stay Dates: Lớn nhất, thoáng đãng, không ô lồng nhau */}
        <div className="guest-card-dates">
          <div className="guest-card-date-col">
            <span className="guest-card-date-eyebrow">NHẬN PHÒNG</span>
            <span className="guest-card-date-main">{inDate.dayMonth || b.checkIn}</span>
            <span className="guest-card-date-sub">{inDate.weekday} · từ 14:00</span>
            <span className="sr-only">{b.checkIn}</span>
          </div>

          <div className="guest-card-date-arrow" aria-hidden="true">
            <ArrowRight size={18} strokeWidth={1.8} />
          </div>

          <div className="guest-card-date-col">
            <span className="guest-card-date-eyebrow">TRẢ PHÒNG</span>
            <span className="guest-card-date-main">{outDate.dayMonth || b.checkOut}</span>
            <span className="guest-card-date-sub">{outDate.weekday} · trước 12:00</span>
            <span className="sr-only">{b.checkOut}</span>
          </div>
        </div>

        {/* 4. Footer: Giá (Tổng tiền) & Link Chi tiết booking */}
        <div className="guest-card-footer">
          <div className="guest-card-price-group">
            <span className="guest-card-price-label">Tổng:</span>
            <strong className="guest-card-price-amount whitespace-nowrap">
              {money(b.totalRoomAmount)}
            </strong>
            {b.nights > 1 && (
              <span className="guest-card-price-sub whitespace-nowrap">
                ({money(b.nightlyPrice)} / đêm)
              </span>
            )}
          </div>

          <div className="guest-card-action-links">
            {isCheckedIn && !billing && (
              <Link
                to={`/guest/services?bookingId=${b.id}`}
                className="guest-card-service-shortcut"
                onClick={(e) => e.stopPropagation()}
                title="Đặt dịch vụ phòng"
              >
                <BellRing size={12} />
                <span>Dịch vụ</span>
              </Link>
            )}
            {isCheckedOut && !billing && (
              <>
                <Link
                  to={`/guest/bookings/${b.id}/billing`}
                  className="guest-card-secondary-shortcut"
                  onClick={(e) => e.stopPropagation()}
                  title="Xem chi phí & hóa đơn"
                >
                  <ReceiptText size={12} />
                  <span>Hóa đơn</span>
                </Link>
                <Link
                  to="/rooms"
                  className="guest-card-secondary-shortcut"
                  onClick={(e) => e.stopPropagation()}
                  title="Đặt lại phòng"
                >
                  <RotateCcw size={12} />
                  <span>Đặt lại</span>
                </Link>
              </>
            )}
            <Link
              to={b.status === 'CANCELLED' ? `/guest/bookings/${b.id}` : detailUrl}
              className="guest-card-main-link"
            >
              <span>{billing && b.status !== 'CANCELLED' ? 'Xem chi phí & hóa đơn' : 'Chi tiết booking'}</span>
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
        eyebrow="HÀNH TRÌNH CỦA BẠN"
        title={billing ? 'Hóa đơn & thanh toán' : 'Booking của tôi'}
        description={
          billing
            ? 'Chọn booking để xem chi phí dự kiến hoặc hóa đơn đã phát hành.'
            : 'Chi tiết kỳ nghỉ của bạn.'
        }
      />

      {/* Filter Bar with Tabs & Dropdown */}
      <div className="guest-filter-bar">
        <div className="guest-filter-tabs" role="tablist" aria-label="Lọc theo trạng thái kỳ nghỉ">
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
                  <span className="guest-filter-tab-count">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="guest-filter-meta-wrap">
          {query.data && (
            <span className="guest-booking-count-chip">
              {query.data.meta.total} kỳ nghỉ
            </span>
          )}
          <label className="filter-label quick-select-label sr-only">
            Trạng thái booking
            <select
              className="input quick-select"
              value={status}
              onChange={(e) =>
                setParams(e.target.value ? { status: e.target.value } : {})
              }
            >
              <option value="">Tất cả trạng thái</option>
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
        <ErrorState message={query.error.message} retry={() => void query.refetch()} />
      ) : query.data && (
        <>
          {query.data.data.length ? (
            hasActiveAndPast ? (
              <div className="guest-grouped-sections">
                {stayingBookings.length > 0 && (
                  <section className="guest-booking-group-section" aria-label="Kỳ nghỉ đang diễn ra">
                    <div className="guest-group-header">
                      <Sparkles size={16} className="text-emerald-700" />
                      <h3 className="guest-group-title">
                        Kỳ nghỉ đang diễn ra
                        <span className="guest-group-count">{stayingBookings.length}</span>
                      </h3>
                    </div>
                    <div className="guest-hero-stay-wrap">
                      {stayingBookings.map(renderHeroBookingCard)}
                    </div>
                  </section>
                )}

                {upcomingBookings.length > 0 && (
                  <section className="guest-booking-group-section" aria-label="Kỳ nghỉ sắp tới">
                    <div className="guest-group-header">
                      <Calendar size={16} className="text-emerald-700" />
                      <h3 className="guest-group-title">
                        Kỳ nghỉ sắp tới
                        <span className="guest-group-count">{upcomingBookings.length}</span>
                      </h3>
                    </div>
                    <div className="booking-list guest-stay-passes-grid">
                      {upcomingBookings.map(renderBookingCard)}
                    </div>
                  </section>
                )}

                {pastBookings.length > 0 && (
                  <section className="guest-booking-group-section is-past" aria-label="Kỳ nghỉ trước đây">
                    <div className="guest-group-header past-header">
                      <Clock size={16} className="text-stone-500" />
                      <h3 className="guest-group-title">
                        Kỳ nghỉ trước đây
                        <span className="guest-group-count">{pastBookings.length}</span>
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
              title="Chưa có booking"
              description="Không có booking phù hợp với bộ lọc hiện tại."
              action={<LinkButton to="/rooms">Khám phá phòng</LinkButton>}
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
      toast('Đã hủy booking.');
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
      toast('Đã gửi yêu cầu trả phòng đến lễ tân.');
      void qc.invalidateQueries({ queryKey: ['guest'] });
      void qc.invalidateQueries({ queryKey: ['reception'] });
    },
    onError: () => { void qc.invalidateQueries({ queryKey: ['guest'] }); },
  });

  if (query.isPending) return <Skeleton />;
  if (query.error)
    return (
      <ErrorState message={query.error.message} retry={() => void query.refetch()} />
    );

  const b = query.data!;

  // Status Stepper Progress
  const isCancelled = b.status === 'CANCELLED';
  const steps = [
    { key: 'PENDING', label: b.onlinePaymentRequired ? 'Chờ thanh toán' : 'Chờ xác nhận' },
    { key: 'CONFIRMED', label: 'Đã xác nhận' },
    { key: 'CHECKED_IN', label: 'Đang lưu trú' },
    { key: 'CHECKED_OUT', label: 'Đã hoàn tất' },
  ];
  const currentStepIndex = steps.findIndex((s) => s.key === b.status);

  return (
    <div className="guest-booking-detail-space">
      <Link to="/guest/bookings" className="text-link">
        ← Booking của tôi
      </Link>

      <PageHeading
        eyebrow="CHI TIẾT BOOKING"
        title={`Booking ${formatBookingReference(b.reference)}`}
        description={isUuid(b.reference) ? `Mã hệ thống: ${b.reference}` : undefined}
      />

      {/* Main Reservation Ticket Card */}
      <section className="panel guest-box guest-detail-card">
        <div className="guest-row detail-card-header">
          <div className="detail-room-info">
            <span className="eyebrow">THÔNG TIN PHÒNG NGHỈ</span>
            <h2>Phòng {b.roomNumber}</h2>
          </div>
          <BookingStatus booking={b} detail />
        </div>

        {/* Stay Journey Stepper (if not cancelled) */}
        {!isCancelled && currentStepIndex >= 0 && (
          <div className="guest-stay-stepper" aria-label="Tiến trình lưu trú">
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

        {/* Fact Sheet */}
        <dl className="guest-facts detail-facts-sheet">
          <div>
            <dt>
              <Calendar size={15} /> Nhận phòng
            </dt>
            <dd>
              <strong>{b.checkIn}</strong> (từ 14:00)
            </dd>
          </div>
          <div>
            <dt>
              <Calendar size={15} /> Trả phòng
            </dt>
            <dd>
              <strong>{b.checkOut}</strong> (trước 12:00)
            </dd>
          </div>
          <div>
            <dt>
              <Users size={15} /> Lưu trú
            </dt>
            <dd>
              <strong>
                {b.nights} đêm · {b.guestCount} khách
              </strong>
            </dd>
          </div>
          <div>
            <dt>Giá mỗi đêm đã chốt</dt>
            <dd>{money(b.nightlyPrice)}</dd>
          </div>
          <div>
            <dt>Tổng tiền phòng</dt>
            <dd>
              <strong className="fact-total-price">{money(b.totalRoomAmount)}</strong>
            </dd>
          </div>
        </dl>

        {billing.isPending ? <Skeleton /> : billing.error ? (
          <ErrorState message={billing.error.message} retry={() => void billing.refetch()} />
        ) : !isCancelled && billing.data && (
          <section aria-label="Chi phí phòng và dịch vụ">
            <dl className="guest-facts detail-facts-sheet">
              <div>
                <dt>Dịch vụ hoàn thành · ghi vào tiền phòng</dt>
                <dd>{money(billing.data.serviceAmount)}</dd>
              </div>
              {billing.data.counterPaidAmount && (
                <div>
                  <dt>Dịch vụ đã thanh toán riêng</dt>
                  <dd>{money(billing.data.counterPaidAmount)}</dd>
                </div>
              )}
              <div className="fact-total-highlight">
                <dt>Tổng tiền phòng & dịch vụ ghi vào phòng</dt>
                <dd><strong className="fact-total-price">{money(billing.data.totalAmount)}</strong></dd>
              </div>
              <div><dt>Đã thanh toán vào hóa đơn phòng</dt><dd>{money(billing.data.paidAmount ?? '0')}</dd></div>
              <div><dt>Còn phải thanh toán · chi phí hiện tại</dt><dd><strong>{money(billing.data.balance ?? billing.data.totalAmount)}</strong></dd></div>
            </dl>
            {billing.data.completedOrders.length > 0 && (
              <div className="completed-orders-section">
                <h3>Chi tiết dịch vụ ghi vào phòng</h3>
                {billing.data.completedOrders.map(order => (
                  <div key={order.id} className="completed-order-group">
                    {order.items.map(item => (
                      <p key={item.id} className="completed-item-line">
                        <span>{item.serviceName} × {item.quantity} · {money(item.unitPrice)} / đơn vị</span>
                        <strong>{money(item.subtotal)}</strong>
                      </p>
                    ))}
                  </div>
                ))}
              </div>
            )}
            {billing.data.pendingOrderCount > 0 && (
              <p className="pending-orders-alert">
                {billing.data.pendingOrderCount} đơn dịch vụ đang chờ, chưa tính vào tổng tiền.
              </p>
            )}
          </section>
        )}

        {/* Hospitality & Front Desk Support Info */}
        <div className="guest-detail-support-box">
          <div className="support-col">
            <MapPin size={18} />
            <div>
              <strong>Địa chỉ nhận phòng</strong>
              <p>Quầy lễ tân An Nhiên Hotel & Suites, Tầng 1</p>
            </div>
          </div>
          <div className="support-col">
            <Phone size={18} />
            <div>
              <strong>Hỗ trợ lễ tân 24/7</strong>
              <p>Hotline: 1900 0000 · Số máy bàn nội bộ: 101</p>
            </div>
          </div>
        </div>

        {b.status === 'CHECKED_IN' && b.checkoutRequestedAt && (
          <p role="status" className="pending-orders-alert">Đã gửi yêu cầu trả phòng · Đang chờ lễ tân xử lý.</p>
        )}
        {b.onlinePaymentRequired && <BookingPayment booking={b} />}
        {/* Action Buttons */}
        <div className="guest-actions detail-actions-bar">
          {!isCancelled && <LinkButton to={`/guest/bookings/${id}/billing`}>
            <ReceiptText size={16} /> Xem chi phí & hóa đơn
          </LinkButton>}

          {b.status === 'CHECKED_IN' && (
            <LinkButton to={`/guest/services?bookingId=${id}`} variant="secondary">
              <BellRing size={16} /> Đặt dịch vụ phòng
            </LinkButton>
          )}

          {b.status === 'CHECKED_IN' && (
            <Button variant="secondary" disabled={!!b.checkoutRequestedAt} onClick={() => { requestCheckout.reset(); setCheckoutConfirm(true); }}>
              {b.checkoutRequestedAt ? 'Đang chờ trả phòng' : 'Yêu cầu trả phòng'}
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
            >
              Hủy booking
            </Button>
          )}
        </div>
      </section>

      <Dialog open={checkoutConfirm} onClose={() => { if (!requestCheckout.isPending) setCheckoutConfirm(false); }} title="Gửi yêu cầu trả phòng?">
        <p>Lễ tân sẽ kiểm tra phòng, chốt chi phí và hỗ trợ thanh toán để hoàn tất trả phòng.</p>
        {billing.data && <p>Chi phí phòng và dịch vụ tạm tính: <strong>{money(billing.data.totalAmount)}</strong></p>}
        {requestCheckout.error && <p role="alert" className="form-error">{guestError(requestCheckout.error)}</p>}
        <div className="dialog-actions">
          <Button variant="secondary" disabled={requestCheckout.isPending} onClick={() => setCheckoutConfirm(false)}>Quay lại</Button>
          <Button busy={requestCheckout.isPending} onClick={() => requestCheckout.mutate()}>Xác nhận gửi yêu cầu</Button>
        </div>
      </Dialog>
      {/* Cancellation Dialog */}
      <Dialog
        open={confirm}
        onClose={() => {
          if (!cancel.isPending) setConfirm(false);
        }}
        title="Hủy booking này?"
      >
        <div className="guest-dialog-warning-box">
          <ShieldAlert size={22} className="warning-icon" />
          <p>
            Bạn có chắc muốn hủy booking <strong>{formatBookingReference(b.reference)}</strong> cho Phòng{' '}
            <strong>{b.roomNumber}</strong>? Sau khi hủy, lịch phòng sẽ được mở lại cho khách khác.
          </p>
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
          >
            Giữ booking
          </Button>
          <Button
            busy={cancel.isPending}
            disabled={!!cancel.error}
            onClick={() => cancel.mutate()}
            className="confirm-cancel-danger-btn"
          >
            Xác nhận hủy booking
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
