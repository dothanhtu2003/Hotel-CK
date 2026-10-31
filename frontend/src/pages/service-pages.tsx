import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  Minus,
  Plus,
  ShoppingBag,
  UtensilsCrossed,
} from 'lucide-react';
import {
  Button,
  Dialog,
  EmptyState,
  ErrorState,
  Input,
  LinkButton,
  PageHeading,
  Pagination,
} from '../components/ui';
import { GuestBadge, Skeleton } from '../features/guest/components';
import {
  cents,
  decimal,
  guestError,
  money,
  type Booking,
  type Order,
  type Page,
} from '../features/guest/contracts';
import { useGet, useInvoice, useServices, useStays } from '../features/guest/queries';
import { api } from '../lib/api';
import { useToast } from '../components/toast-context';

/* ========================================================
   SERVICES ORDERING PAGE (ROOM SERVICE)
   ======================================================== */
export function ServicesPage() {
  const [params] = useSearchParams();
  const [selected, setSelected] = useState(params.get('bookingId') ?? '');
  const stays = useStays();
  const catalog = useServices();
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [confirm, setConfirm] = useState(false);
  const qc = useQueryClient();
  const toast = useToast();

  const bookingId = selected || stays.data?.[0]?.id || '';
  const invoice = useInvoice(bookingId);
  const eligible =
    stays.data?.some((b) => b.id === bookingId) &&
    invoice.isSuccess &&
    !invoice.data;

  const items = Object.entries(quantities)
    .filter(([, q]) => q > 0)
    .map(([serviceId, quantity]) => ({ serviceId, quantity }));

  const valid =
    Object.values(quantities).every(
      (q) => Number.isInteger(q) && q >= 0 && q <= 2147483647
    ) &&
    items.length > 0 &&
    items.length <= 50 &&
    items.every(
      (i) =>
        Number.isInteger(i.quantity) &&
        i.quantity > 0 &&
        i.quantity <= 2147483647
    );

  const total = (catalog.data ?? []).reduce(
    (sum, s) =>
      sum +
      (Number.isInteger(quantities[s.id]) && quantities[s.id] > 0
        ? cents(s.currentPrice) * BigInt(quantities[s.id])
        : 0n),
    0n
  );

  const totalSelectedCount = items.reduce((sum, item) => sum + item.quantity, 0);

  const updateQuantity = (serviceId: string, delta: number) => {
    setQuantities((prev) => {
      const current = prev[serviceId] ?? 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [serviceId]: next };
    });
  };

  const create = useMutation({
    retry: false,
    mutationFn: () =>
      api.request<Order>('/service-orders', {
        method: 'POST',
        body: { bookingId, items },
      }),
    onSuccess: () => {
      setConfirm(false);
      setQuantities({});
      toast('Đã gửi đơn dịch vụ thành công.');
      void qc.invalidateQueries({ queryKey: ['guest'] });
    },
    onError: () => {
      void qc.invalidateQueries({ queryKey: ['guest'] });
    },
  });

  return (
    <div className="guest-services-space">
      <PageHeading
        eyebrow="CHĂM CHÚT KỲ NGHỈ"
        title="Dịch vụ phòng"
        description="Giá hiển thị là giá hiện tại. Đơn thành công sẽ lưu giá do hệ thống xác nhận."
        action={
          <LinkButton to="/guest/service-orders" variant="secondary">
            Đơn dịch vụ của tôi
          </LinkButton>
        }
      />

      {stays.isPending || catalog.isPending ? (
        <Skeleton />
      ) : stays.error || catalog.error ? (
        <ErrorState
          message={(stays.error ?? catalog.error)!.message}
          retry={() => {
            void stays.refetch();
            void catalog.refetch();
          }}
        />
      ) : (
        <>
          {/* Booking Stay Selector Bar */}
          <div className="guest-room-stay-selector-card">
            <label className="filter-label">
              Booking đang lưu trú
              <select
                className="input quick-select"
                value={bookingId}
                onChange={(e) => {
                  setSelected(e.target.value);
                  setQuantities({});
                  create.reset();
                }}
              >
                {!stays.data?.length && (
                  <option value="">Chưa có booking đang lưu trú</option>
                )}
                {stays.data?.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.reference} · Phòng {b.roomNumber} ({b.checkIn} → {b.checkOut})
                  </option>
                ))}
              </select>
            </label>

            {!stays.data?.length && (
              <p className="notice">
                Bạn chỉ có thể đặt dịch vụ sau khi nhận phòng.
              </p>
            )}

            {invoice.isPending && bookingId && <Skeleton />}
            {invoice.error && (
              <ErrorState
                message={invoice.error.message}
                retry={() => void invoice.refetch()}
              />
            )}
            {invoice.data && (
              <p className="notice">
                Booking đã có hóa đơn nên không thể đặt thêm dịch vụ.
              </p>
            )}
          </div>

          {/* Service Menu Grid */}
          {catalog.data?.length ? (
            <div className="service-grid guest-service-catalog-grid">
              {catalog.data
                .filter((s) => s.isActive)
                .map((s) => {
                  const qty = quantities[s.id] ?? 0;
                  return (
                    <article key={s.id} className="panel guest-box guest-service-menu-item">
                      <div className="service-item-head">
                        <div className="service-item-icon">
                          <UtensilsCrossed size={20} strokeWidth={1.5} />
                        </div>
                        <div className="service-item-titles">
                          <h2>{s.name}</h2>
                          <strong className="service-item-price">
                            {money(s.currentPrice)}
                          </strong>
                        </div>
                      </div>

                      <p className="service-item-desc">{s.description}</p>

                      {/* Stepper Quantity Control */}
                      <div className="service-quantity-control-wrap">
                        <label htmlFor={s.id} className="service-qty-label">
                          Số lượng {s.name}
                        </label>

                        <div className="service-qty-stepper">
                          <button
                            type="button"
                            className="qty-btn"
                            aria-label={`Giảm số lượng ${s.name}`}
                            disabled={!eligible || create.isPending || qty <= 0}
                            onClick={() => updateQuantity(s.id, -1)}
                          >
                            <Minus size={14} />
                          </button>

                          <Input
                            id={s.id}
                            type="number"
                            min="0"
                            max="2147483647"
                            step="1"
                            disabled={!eligible || create.isPending}
                            value={quantities[s.id] ?? 0}
                            onChange={(e) =>
                              setQuantities((prev) => ({
                                ...prev,
                                [s.id]: Number(e.target.value),
                              }))
                            }
                            className="service-qty-input"
                          />

                          <button
                            type="button"
                            className="qty-btn"
                            aria-label={`Tăng số lượng ${s.name}`}
                            disabled={!eligible || create.isPending}
                            onClick={() => updateQuantity(s.id, 1)}
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
            </div>
          ) : (
            <EmptyState
              title="Chưa có dịch vụ"
              description="Danh mục dịch vụ hiện chưa có lựa chọn đang hoạt động."
            />
          )}

          {/* Sticky/Floating Cart Summary Bar */}
          <section className="panel guest-box guest-cart-summary-card">
            <div className="cart-summary-details">
              <div className="cart-summary-stat">
                <ShoppingBag size={20} />
                <span>
                  Đã chọn: <strong>{totalSelectedCount}</strong> món
                </span>
              </div>
              <div className="cart-summary-total">
                <span>Tổng dự kiến:</span>
                <strong>{money(decimal(total))}</strong>
              </div>
            </div>

            <p className="cart-summary-note">
              Chọn tối đa 50 dịch vụ. Số lượng được chọn phải là số nguyên dương.
            </p>

            <div className="cart-summary-action">
              <Button
                disabled={!eligible || !valid || create.isPending}
                onClick={() => {
                  create.reset();
                  setConfirm(true);
                }}
                className="cart-checkout-btn"
              >
                Xem lại đơn dịch vụ
              </Button>
            </div>
          </section>

          {/* Order Created Success Banner */}
          {create.data && (
            <section
              className="panel guest-box guest-order-created-banner"
              role="status"
            >
              <div className="order-created-head">
                <CheckCircle2 size={24} className="text-emerald-700" />
                <h2>Đơn dịch vụ đã được tạo</h2>
              </div>
              <OrderContents order={create.data} />
              <div className="order-created-actions">
                <LinkButton to="/guest/service-orders">
                  Xem đơn dịch vụ
                </LinkButton>
              </div>
            </section>
          )}
        </>
      )}

      {/* Confirmation Dialog */}
      <Dialog
        open={confirm}
        onClose={() => {
          if (!create.isPending) setConfirm(false);
        }}
        title="Xác nhận đơn dịch vụ"
      >
        <div className="guest-dialog-order-review">
          <p className="order-review-booking-ref">
            Booking: <strong>{stays.data?.find((b) => b.id === bookingId)?.reference}</strong>
          </p>

          <div className="order-review-items-list">
            {items.map((i) => {
              const svc = catalog.data?.find((s) => s.id === i.serviceId);
              return (
                <div key={i.serviceId} className="order-review-item-line">
                  <span>
                    {svc?.name} × {i.quantity}
                  </span>
                  <strong>
                    {svc ? money(decimal(cents(svc.currentPrice) * BigInt(i.quantity))) : ''}
                  </strong>
                </div>
              );
            })}
          </div>

          <div className="order-review-total-box">
            <span>Tổng dự kiến:</span>
            <strong>{money(decimal(total))}</strong>
          </div>
          <p className="order-review-disclaimer">
            Tổng dự kiến: {money(decimal(total))}. Giá chính thức được chốt khi gửi đơn.
          </p>
        </div>

        {create.error && (
          <div className="dialog-error-wrap">
            <p className="form-error" role="alert">
              {guestError(create.error, 'create')}
            </p>
            <LinkButton to="/guest/service-orders" variant="secondary">
              Kiểm tra đơn đã gửi
            </LinkButton>
          </div>
        )}

        <div className="dialog-actions">
          <Button
            variant="secondary"
            disabled={create.isPending}
            onClick={() => setConfirm(false)}
          >
            Quay lại
          </Button>
          <Button
            busy={create.isPending}
            disabled={!!create.error || !eligible || !valid}
            onClick={() => create.mutate()}
          >
            Xác nhận đặt dịch vụ
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

/* ========================================================
   ORDER CONTENTS COMPONENT
   ======================================================== */
function OrderContents({ order: o }: { order: Order }) {
  return (
    <div className="guest-order-contents-block">
      <div className="order-badge-row">
        <GuestBadge status={o.status} />
      </div>

      <div className="order-items-breakdown">
        {o.items.map((i) => (
          <div key={i.id} className="order-item-detail-line">
            <p>
              {i.serviceName} × {i.quantity} · {money(i.unitPrice)} / đơn vị · {money(i.subtotal)}
            </p>
          </div>
        ))}
      </div>

      <div className="order-locked-total-row">
        <span>Tổng giá đã chốt:</span>
        <strong>{money(o.totalAmount)}</strong>
      </div>
    </div>
  );
}

/* ========================================================
   ORDER CARD COMPONENT
   ======================================================== */
function OrderCard({ order: o }: { order: Order }) {
  const booking = useGet<Booking>('/bookings/' + o.bookingId);
  const invoice = useInvoice(o.bookingId);
  const [confirm, setConfirm] = useState(false);
  const qc = useQueryClient();
  const toast = useToast();

  const cancel = useMutation({
    retry: false,
    mutationFn: () => api.request(`/service-orders/${o.id}/cancel`, { method: 'PATCH' }),
    onSuccess: () => {
      setConfirm(false);
      toast('Đã hủy đơn dịch vụ.');
      void qc.invalidateQueries({ queryKey: ['guest'] });
    },
    onError: () => {
      void qc.invalidateQueries({ queryKey: ['guest'] });
    },
  });

  return (
    <article className="panel guest-box guest-order-card">
      <div className="guest-row order-card-header">
        <div className="order-card-title-block">
          <h2>Đơn {o.id.slice(0, 8)}</h2>
          <Link className="text-link order-booking-link" to={'/guest/bookings/' + o.bookingId}>
            Booking {booking.data?.reference ?? o.bookingId}
          </Link>
        </div>
        <p className="order-timestamp">
          {new Date(o.orderedAt).toLocaleString('vi-VN')}
        </p>
      </div>

      <OrderContents order={o} />

      {booking.error && (
        <ErrorState
          message={booking.error.message}
          retry={() => void booking.refetch()}
        />
      )}
      {invoice.error && (
        <ErrorState
          message={invoice.error.message}
          retry={() => void invoice.refetch()}
        />
      )}

      {o.status === 'PENDING' &&
        booking.data?.status === 'CHECKED_IN' &&
        invoice.isSuccess &&
        !invoice.data && (
          <div className="order-actions-bar">
            <Button
              variant="secondary"
              onClick={() => {
                cancel.reset();
                setConfirm(true);
              }}
              className="guest-cancel-order-btn"
            >
              Hủy đơn dịch vụ
            </Button>
          </div>
        )}

      {/* Cancel Order Dialog */}
      <Dialog
        open={confirm}
        onClose={() => {
          if (!cancel.isPending) setConfirm(false);
        }}
        title="Hủy đơn dịch vụ?"
      >
        <p>Hủy toàn bộ dịch vụ trong đơn {o.id.slice(0, 8)}?</p>

        {cancel.error && (
          <p className="form-error" role="alert">
            {guestError(cancel.error)}
          </p>
        )}

        <div className="dialog-actions">
          <Button
            disabled={cancel.isPending}
            variant="secondary"
            onClick={() => setConfirm(false)}
          >
            Giữ đơn
          </Button>
          <Button
            busy={cancel.isPending}
            disabled={!!cancel.error}
            onClick={() => cancel.mutate()}
            className="confirm-cancel-danger-btn"
          >
            Xác nhận hủy đơn
          </Button>
        </div>
      </Dialog>
    </article>
  );
}

/* ========================================================
   MY SERVICE ORDERS PAGE
   ======================================================== */
export function MyServiceOrdersPage() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page')) || 1);
  const status = params.get('status') ?? '';

  const queryPath = `/service-orders/my?page=${page}&pageSize=6${
    ['PENDING', 'COMPLETED', 'CANCELLED'].includes(status) ? '&status=' + status : ''
  }`;
  const query = useGet<Page<Order>>(queryPath);

  return (
    <div className="guest-my-orders-space">
      <PageHeading
        title="Đơn dịch vụ của tôi"
        action={<LinkButton to="/guest/services">Đặt dịch vụ</LinkButton>}
      />

      {/* Status Filter */}
      <div className="guest-filter-bar">
        <label className="filter-label">
          Trạng thái đơn
          <select
            className="input quick-select"
            value={status}
            onChange={(e) =>
              setParams(e.target.value ? { status: e.target.value } : {})
            }
          >
            <option value="">Tất cả trạng thái</option>
            <option value="PENDING">Chờ xử lý</option>
            <option value="COMPLETED">Hoàn thành</option>
            <option value="CANCELLED">Đã hủy</option>
          </select>
        </label>
      </div>

      {query.isPending ? (
        <Skeleton />
      ) : query.error ? (
        <ErrorState
          message={query.error.message}
          retry={() => void query.refetch()}
        />
      ) : (
        query.data && (
          <>
            {query.data.data.length ? (
              <div className="booking-list guest-order-cards-list">
                {query.data.data.map((o) => (
                  <OrderCard key={o.id} order={o} />
                ))}
              </div>
            ) : (
              <EmptyState
                title="Chưa có đơn dịch vụ"
                description="Các đơn dịch vụ của bạn sẽ xuất hiện tại đây."
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
        )
      )}
    </div>
  );
}
