import { BankTransferQr } from '../features/reception/bank-transfer-qr';
import { useRef, useState } from 'react';
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
  formatBookingReference,
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
  const [paymentOrder, setPaymentOrder] = useState<Order | null>(null);
  const qc = useQueryClient();
  const toast = useToast();

  const activeStays = (stays.data ?? []).filter(b => b.status === 'CHECKED_IN');
  const bookingId = activeStays.some(b => b.id === selected) ? selected : activeStays.length === 1 ? activeStays[0].id : '';
  const deliveryRoom = activeStays.find(b => b.id === bookingId);
  const hasStays = activeStays.length > 0;
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'BANK_TRANSFER'>('CASH');
  const requestId = useRef<string | null>(null);
  const eligible = stays.data?.some((b) => b.id === bookingId);

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
        body: { bookingId, items, requestedPaymentMethod: paymentMethod, requestId: requestId.current ??= crypto.randomUUID() },
      }),
    onSuccess: (order) => {
      if (order.requestedPaymentMethod === 'BANK_TRANSFER') setPaymentOrder(order);
      requestId.current = null;
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
        title="Dịch vụ phòng"
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
          {!hasStays && <p className="notice">Bạn chỉ có thể đặt dịch vụ sau khi nhận phòng.</p>}

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
                        <label htmlFor={s.id} className="service-qty-label sr-only">
                          Số lượng {s.name}
                        </label>
                        <span className="service-qty-caption" aria-hidden="true">
                          Số lượng
                        </span>

                        <div className="service-qty-stepper">
                          <button
                            type="button"
                            className="qty-btn"
                            aria-label={`Giảm số lượng ${s.name}`}
                            disabled={!hasStays || create.isPending || qty <= 0}
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
                            disabled={!hasStays || create.isPending}
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
                            disabled={!hasStays || create.isPending}
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



            <div className="cart-summary-action">
              <Button
                disabled={!hasStays || !valid || create.isPending}
                onClick={() => {
                  requestId.current = null;
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
              <OrderContents key={create.data.id} order={create.data} showPayment={false} />
              <div className="order-created-actions">
                {create.data.requestedPaymentMethod === 'BANK_TRANSFER' && !create.data.paymentMethod && <Button onClick={() => setPaymentOrder(create.data)}>Mở QR thanh toán</Button>}
                <LinkButton to="/guest/service-orders">
                  Xem đơn dịch vụ
                </LinkButton>
              </div>
            </section>
          )}
        </>
      )}

      {paymentOrder && <Dialog open title="Thanh toán dịch vụ qua payOS" onClose={() => setPaymentOrder(null)}>
        <OrderContents key={paymentOrder.id} order={paymentOrder} />
        <div className="dialog-actions"><Button variant="secondary" onClick={() => setPaymentOrder(null)}>Đóng</Button></div>
      </Dialog>}
      {/* Confirmation Dialog */}
      <Dialog
        open={confirm}
        onClose={() => {
          if (!create.isPending) setConfirm(false);
        }}
        title="Xác nhận đơn dịch vụ"
      >
        <div className="guest-dialog-order-review">
          <div className="order-review-delivery-room">
            {activeStays.length > 1 ? <label className="filter-label">Giao đến phòng
              <select aria-label="Giao đến phòng" className="input" value={bookingId} disabled={create.isPending || !!create.error} onChange={event => { setSelected(event.target.value); requestId.current = null; }}>
                <option value="">Chọn phòng nhận dịch vụ</option>
                {activeStays.map(b => <option key={b.id} value={b.id}>Phòng {b.roomNumber} · {b.reference}</option>)}
              </select>
            </label> : <p>Giao đến <strong className="order-review-room-number">{deliveryRoom ? `Phòng ${deliveryRoom.roomNumber}` : 'phòng chưa được chọn'}</strong></p>}
            {deliveryRoom && <small>{deliveryRoom.reference} · Đang lưu trú</small>}
          </div>

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
          <label className="filter-label">Cách thanh toán
            <select aria-label="Cách thanh toán" className="input" value={paymentMethod} disabled={create.isPending} onChange={event => setPaymentMethod(event.target.value as 'CASH' | 'BANK_TRANSFER')}>
              <option value="CASH">Tiền mặt</option><option value="BANK_TRANSFER">Chuyển khoản qua QR payOS</option>
            </select>
          </label>

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
            {deliveryRoom ? `Đặt dịch vụ · Phòng ${deliveryRoom.roomNumber}` : 'Chọn phòng để đặt dịch vụ'}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

function formatOrderDate(isoDate: string) {
  try {
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return isoDate;
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${hours}:${mins} · ${day}/${month}/${year}`;
  } catch {
    return isoDate;
  }
}

const ORDER_STATUS_TABS: { id: string; label: string }[] = [
  { id: '', label: 'Tất cả' },
  { id: 'PENDING', label: 'Chờ xử lý' },
  { id: 'COMPLETED', label: 'Hoàn thành' },
  { id: 'CANCELLED', label: 'Đã hủy' },
];

/* ========================================================
   ORDER CONTENTS COMPONENT
   ======================================================== */
function OrderContents({ order: o, showPayment = true, showStatusBadge = false }: { order: Order; showPayment?: boolean; showStatusBadge?: boolean }) {
  const [paid, setPaid] = useState(false);
  const isPaid = o.paymentMethod || paid;

  return (
    <div className="guest-order-contents-block">
      {showStatusBadge && (
        <div className="order-badge-row">
          <GuestBadge status={o.status} />
        </div>
      )}

      {o.status !== 'CANCELLED' && o.requestedPaymentMethod && (
        <div className="order-payment-status-tag">
          <span className={`order-payment-pill ${isPaid ? 'is-paid' : 'is-pending'}`}>
            {isPaid
              ? 'Đã thanh toán'
              : o.requestedPaymentMethod === 'CASH'
              ? 'Chờ thu tiền mặt'
              : 'Chờ thanh toán chuyển khoản'}
          </span>
        </div>
      )}

      {showPayment && o.status !== 'CANCELLED' && !o.paymentMethod && !paid && o.requestedPaymentMethod === 'BANK_TRANSFER' && (
        <BankTransferQr
          orderId={o.id}
          amount={o.totalAmount}
          expiresAt={Date.parse(o.orderedAt) + 15 * 60_000}
          guest
          onPaid={() => setPaid(true)}
          onClosed={() => {}}
        />
      )}

      <div className="order-items-breakdown">
        {o.items.map((i) => (
          <div key={i.id} className="order-item-detail-line">
            <span className="order-item-title">
              {i.serviceName} × {i.quantity}
            </span>
            <strong className="order-item-amount">{money(i.subtotal)}</strong>
          </div>
        ))}
      </div>

      <div className="order-locked-total-row">
        <span>Tổng tiền:</span>
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
      <div className="order-card-header">
        <div className="order-card-title-block">
          <div className="order-room-line">
            <span className="order-room-title">
              {booking.data?.roomNumber ? `Phòng ${booking.data.roomNumber}` : 'Dịch vụ phòng'}
            </span>
            <GuestBadge status={o.status} />
          </div>
          <div className="order-meta-subline">
            <h2 className="order-code-badge">Đơn {o.id.slice(0, 8)}</h2>
            <span className="order-dot" aria-hidden="true">·</span>
            <Link className="order-booking-link" to={'/guest/bookings/' + o.bookingId}>
              Booking {booking.data?.reference ? formatBookingReference(booking.data.reference) : o.bookingId}
            </Link>
          </div>
        </div>
        <p className="order-timestamp">
          {formatOrderDate(o.orderedAt)}
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
        (!invoice.data || !!o.requestedPaymentMethod) && !o.paymentMethod && o.payosStatus !== 'PENDING' && (
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
        action={<LinkButton to="/guest/services">+ Đặt dịch vụ</LinkButton>}
      />

      {/* Status Filter Tabs */}
      <div className="guest-filter-bar">
        <div className="guest-filter-tabs" role="tablist" aria-label="Lọc theo trạng thái đơn">
          {ORDER_STATUS_TABS.map((tab) => {
            const isActive = status === tab.id;
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
              </button>
            );
          })}
        </div>

        {query.data && (
          <span className="guest-booking-count-chip">
            {query.data.meta.total} đơn
          </span>
        )}

        <label className="sr-only">
          Trạng thái đơn
          <select
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
