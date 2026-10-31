import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  BellRing,
  Calendar,
  CheckCircle2,
  MapPin,
  Phone,
  ReceiptText,
  ShieldAlert,
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
import { GuestBadge, Skeleton } from '../features/guest/components';
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

/* ========================================================
   MY BOOKINGS PAGE (LIST & FILTER)
   ======================================================== */
export function MyBookingsPage({ billing = false }: { billing?: boolean }) {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page')) || 1);
  const status = params.get('status') ?? '';

  const queryPath = `/bookings/my?page=${page}&pageSize=6${
    bookingStatuses.includes(status as Booking['status']) ? '&status=' + status : ''
  }`;
  const query = useGet<Page<Booking>>(queryPath);

  return (
    <div className="guest-bookings-page-space">
      <PageHeading
        eyebrow="HÀNH TRÌNH CỦA BẠN"
        title={billing ? 'Hóa đơn & thanh toán' : 'Booking của tôi'}
        description={
          billing
            ? 'Chọn booking để xem chi phí dự kiến hoặc hóa đơn đã phát hành.'
            : 'Thông tin lưu trú và giá đã được xác nhận từ hệ thống.'
        }
        action={<LinkButton to="/rooms">Tìm phòng</LinkButton>}
      />

      {/* Filter Bar */}
      <div className="guest-filter-bar">
        <label className="filter-label">
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

      {query.isPending ? (
        <Skeleton />
      ) : query.error ? (
        <ErrorState message={query.error.message} retry={() => void query.refetch()} />
      ) : query.data && (
        <>
          {query.data.data.length ? (
            <div className="booking-list guest-stay-passes-grid">
              {query.data.data.map((b) => (
                <article key={b.id} className="panel guest-box guest-stay-pass-card">
                  {/* Card Header: Reference & Status */}
                  <div className="guest-row stay-pass-header">
                    <div className="stay-pass-ref-block">
                      <span className="stay-pass-tag">MÃ ĐẶT PHÒNG</span>
                      <h2>{formatBookingReference(b.reference)}</h2>
                    </div>
                    <GuestBadge status={b.status} label={b.status === 'PENDING' ? 'Chờ xác nhận' : undefined} />
                  </div>

                  {/* Card Room & Guest Meta */}
                  <div className="stay-pass-room-meta">
                    <div className="stay-pass-room-number">
                      <strong>Phòng {b.roomNumber}</strong>
                      <span>· {b.guestCount} khách</span>
                    </div>
                    <div className="stay-pass-nights-pill">
                      {b.nights} đêm nghỉ dưỡng
                    </div>
                  </div>

                  {/* Stay Dates */}
                  <div className="stay-pass-dates">
                    <div className="stay-date-col">
                      <small>NHẬN PHÒNG</small>
                      <strong>{b.checkIn}</strong>
                    </div>
                    <div className="stay-date-arrow">→</div>
                    <div className="stay-date-col">
                      <small>TRẢ PHÒNG</small>
                      <strong>{b.checkOut}</strong>
                    </div>
                  </div>

                  {/* Pricing Overview */}
                  <div className="stay-pass-price-row">
                    <div className="stay-pass-rate">
                      <span>Giá đã chốt:</span>
                      <strong>{money(b.nightlyPrice)} / đêm</strong>
                    </div>
                    <div className="stay-pass-total">
                      <span>Tổng phòng:</span>
                      <strong>{money(b.totalRoomAmount)}</strong>
                    </div>
                  </div>

                  {/* Card Action Link Button */}
                  <div className="stay-pass-action">
                    <LinkButton
                      variant="secondary"
                      to={`/guest/bookings/${b.id}${billing ? '/billing' : ''}`}
                      className="w-full"
                    >
                      {billing ? 'Xem chi phí & hóa đơn' : 'Chi tiết booking'}
                      <ArrowRight size={15} />
                    </LinkButton>
                  </div>
                </article>
              ))}
            </div>
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
    mutationFn: () => api.request<Booking>(`/bookings/${id}/cancel`, { method: 'PATCH' }),
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
    { key: 'PENDING', label: 'Chờ xác nhận' },
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
          <GuestBadge status={b.status} label={b.status === 'PENDING' ? 'Chờ xác nhận' : undefined} />
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
        ) : billing.data && (
          <section aria-label="Chi phí phòng và dịch vụ">
            <dl className="guest-facts detail-facts-sheet">
              <div>
                <dt>Dịch vụ hoàn thành · ghi vào tiền phòng</dt>
                <dd>{money(billing.data.serviceAmount)}</dd>
              </div>
              {billing.data.counterPaidAmount && (
                <div>
                  <dt>Dịch vụ đã thanh toán tại quầy · không thu lại</dt>
                  <dd>{money(billing.data.counterPaidAmount)}</dd>
                </div>
              )}
              <div className="fact-total-highlight">
                <dt>Tổng tiền phòng & dịch vụ ghi vào phòng</dt>
                <dd><strong className="fact-total-price">{money(billing.data.totalAmount)}</strong></dd>
              </div>
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
        {/* Action Buttons */}
        <div className="guest-actions detail-actions-bar">
          <LinkButton to={`/guest/bookings/${id}/billing`}>
            <ReceiptText size={16} /> Xem chi phí & hóa đơn
          </LinkButton>

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
          {['PENDING', 'CONFIRMED'].includes(b.status) && (
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
