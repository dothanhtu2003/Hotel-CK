import { ExtendStayDialog } from './extend-stay-dialog';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  FileText,
  Search,
  X,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useState } from "react";
import { Link } from "react-router";
import { Dialog, ErrorState, Pagination, Table } from "../../components/ui";
import { Badge } from "../../components/kamra-ui";
import { Skeleton } from "../guest/components";
import { money, statusLabels, type Page } from "../guest/contracts";
import type { DeskBooking } from "./contracts";
import { useDeskBase, useDeskGet, useDeskInvoice } from "./queries";
import { hotelToday } from "./room-state";
import { PaymentForm } from "./payment-form";
import "./cashier.css";

type BillingRow = DeskBooking & {
  invoiceId: string | null;
  roomAmount: string; serviceAmount: string; totalAmount: string;
  paidAmount: string; balance: string; pendingOrderCount: number;
  paymentState: "OUTSTANDING" | "PAID" | "CANCELLED" | "REVIEW_REFUND";
};

const groups = [
  { id: "departures", label: "Trả hôm nay" },
  { id: "outstanding", label: "Còn phải thu" },
  { id: "history", label: "Lịch sử" },
] as const;

function shiftDay(isoDate: string, days: number): string {
  try {
    const parts = isoDate.split("-");
    if (parts.length !== 3) return isoDate;
    const d = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])));
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  } catch {
    return isoDate;
  }
}

export function CashierPage() {
  const base = useDeskBase();
  const [group, setGroup] = useState("departures"), [date, setDate] = useState(hotelToday);
  const [search, setSearch] = useState(""), [q, setQ] = useState(""), [page, setPage] = useState(1);
  const [overdue, setOverdue] = useState<BillingRow | null>(null);
  const [selected, setSelected] = useState<BillingRow | null>(null);
  const params = new URLSearchParams({ group, date, q, page: String(page), pageSize: "15" });
  const query = useDeskGet<Page<BillingRow> & { counts: Record<string, number> }>(`/front-desk/billing?${params}`);
  const selectGroup = (value: string) => { setGroup(value); setPage(1); };

  const isToday = date === hotelToday();

  return (
    <div className="cashier-page">
      <header className="cashier-heading">
        <div>
          <h1>Thu ngân & hóa đơn</h1>
          <p className="cashier-heading-sub">Quản lý thanh toán, hóa đơn và thu hồi công nợ lưu trú.</p>
        </div>

        {group === "departures" && (
          <div className="cashier-date-nav">
            <button
              type="button"
              className="cashier-date-arrow-btn"
              aria-label="Ngày trước"
              onClick={() => { setDate(shiftDay(date, -1)); setPage(1); }}
            >
              <ChevronLeft size={16} />
            </button>

            <label className="cashier-date-picker-wrap">
              <span className="cashier-date-display">
                <Calendar size={14} className="text-emerald-700" />
                <span className="font-semibold text-stone-800">
                  {isToday ? "Hôm nay · " : ""}{date.split("-").reverse().join("/")}
                </span>
              </span>
              <input
                aria-label="Ngày trả phòng cần thu"
                type="date"
                value={date}
                onChange={e => {
                  if (e.target.value) {
                    setDate(e.target.value);
                    setPage(1);
                  }
                }}
              />
            </label>

            <button
              type="button"
              className="cashier-date-arrow-btn"
              aria-label="Ngày sau"
              onClick={() => { setDate(shiftDay(date, 1)); setPage(1); }}
            >
              <ChevronRight size={16} />
            </button>

            {!isToday && (
              <button
                type="button"
                className="cashier-today-btn"
                onClick={() => { setDate(hotelToday()); setPage(1); }}
              >
                Về hôm nay
              </button>
            )}
          </div>
        )}
      </header>

      {/* Merged Interactive Tab Cards */}
      <div className="cashier-groups cashier-tab-cards-grid" aria-label="Nhóm thanh toán" >
        {groups.map(g => {
          const isSelected = group === g.id;
          const isOutstanding = g.id === "outstanding";
          const count = query.data?.counts[g.id];
          const hasCount = typeof count === "number";

          return (
            <button
              key={g.id}
              type="button"


              aria-pressed={isSelected}
              onClick={() => selectGroup(g.id)}
              className={`cashier-tab-card ${isSelected ? "is-active" : ""} ${
                isOutstanding && count && count > 0 ? "has-debt" : ""
              }`}
            >
              <div className={`cashier-tab-card-icon tone-${g.id}`}>
                {g.id === "departures" && <Clock size={19} />}
                {g.id === "outstanding" && <AlertCircle size={19} />}
                {g.id === "history" && <CheckCircle2 size={19} />}
              </div>

              <div className="cashier-tab-card-body">
                <div className="cashier-tab-card-header">
                  <span className="cashier-tab-card-title">{g.label}</span>
                  {isOutstanding && count && count > 0 && (
                    <span className="cashier-debt-pill">Cần thu</span>
                  )}
                </div>
                <div className="cashier-tab-card-count-row">
                  <strong className="cashier-tab-card-num">
                    {hasCount ? count : "—"}
                  </strong>{" "}
                  <span className="cashier-tab-card-unit">phòng</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <PaymentReviewQueue />

      <section className="cashier-list">
        <form
          className="cashier-filters"
          onSubmit={e => {
            e.preventDefault();
            setQ(search.trim());
            setPage(1);
          }}
        >
          <div className="cashier-search-wrap">
            <Search size={15} className="cashier-search-icon" />
            <input
              aria-label="Tìm khách, phòng hoặc mã booking"
              placeholder="Tên khách, số phòng, mã booking, SĐT…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                className="cashier-search-clear-btn"
                aria-label="Xóa tìm kiếm"
                onClick={() => {
                  setSearch("");
                  setQ("");
                  setPage(1);
                }}
              >
                <X size={13} />
              </button>
            )}
          </div>
          <button type="submit" className="cashier-search-btn">Tìm kiếm</button>
        </form>

        {query.isPending ? (
          <Skeleton />
        ) : query.error ? (
          <ErrorState message={query.error.message} retry={() => void query.refetch()} />
        ) : (
          <>
            <Table
              caption="Danh sách thu ngân"
              rows={query.data!.data}
              rowKey={r => r.id}
              onRowClick={setSelected}
              empty={
                <div className="cashier-empty">
                  <strong>Không có khoản nào trong nhóm này</strong>
                  <p></p>
                  <button type="button" onClick={() => selectGroup("outstanding")}>
                    Xem khoản còn phải thu
                  </button>
                </div>
              }
              columns={[
                {
                  title: "KHÁCH / PHÒNG",
                  render: r => (
                    <div className="cashier-room-cell">
                      <span className="cashier-room-badge" title={`Phòng ${r.roomNumber}`}>
                        {r.roomNumber}
                      </span>
                      <div className="cashier-guest-info">
                        <button
                          type="button"
                          className="cashier-customer"
                          onClick={() => setSelected(r)}
                          aria-label={`Xem chi phí phòng ${r.roomNumber}`}
                        >
                          {r.customer?.fullName ?? "Khách tại quầy"}
                        </button>
                        <div className="cashier-submeta">
                          <span className="cashier-ref-code">{r.reference}</span>
                          <span className="cashier-meta-dot">·</span>
                          <span>Trả: {r.checkOut.split("-").reverse().join("/")}</span>
                          <span className="cashier-meta-dot">·</span>
                          <span className="cashier-status-text">{statusLabels[r.status] ?? r.status}</span>
                          {r.status === "CHECKED_IN" && r.checkOut < hotelToday() && <Badge tone="amber">Quá hạn {Math.round((Date.parse(hotelToday()) - Date.parse(r.checkOut)) / 86400000)} ngày</Badge>}
                        </div>
                      </div>
                    </div>
                  ),
                },
                {
                  title: "TỔNG TIỀN",
                  render: r => (
                    <div className="cashier-amount-cell">
                      <strong className="cashier-amount-val">{money(r.totalAmount)}</strong>
                      {!r.invoiceId && <span className="cashier-amount-sub">Tạm tính</span>}
                    </div>
                  ),
                },
                {
                  title: "ĐÃ THU",
                  render: r => (
                    <div className="cashier-amount-cell">
                      <span className="cashier-amount-paid">{money(r.paidAmount)}</span>
                    </div>
                  ),
                },
                {
                  title: "CÒN PHẢI THU",
                  render: r => {
                    const isDue = r.paymentState === "OUTSTANDING";
                    const isPaid = r.paymentState === "PAID";
                    const isCancelled = r.paymentState === "CANCELLED";
                    const isReviewRefund = r.paymentState === "REVIEW_REFUND";

                    return (
                      <div className="cashier-amount-cell">
                        <strong
                          className={`cashier-amount-val ${
                            isDue ? "cashier-balance-due" : isPaid ? "cashier-balance-zero" : ""
                          }`}
                        >
                          {isCancelled || isReviewRefund ? "—" : money(r.balance)}
                        </strong>
                        <span className={`cashier-balance-label ${isDue ? "label-due" : isPaid ? "label-paid" : ""}`}>
                          {isPaid
                            ? "✓ Đã thanh toán đủ"
                            : isCancelled
                            ? "Booking đã hủy"
                            : isReviewRefund
                            ? "Cần đối soát hoàn tiền"
                            : r.invoiceId
                            ? "Chưa thanh toán đủ"
                            : "Chưa phát hành HĐ"}
                        </span>
                      </div>
                    );
                  },
                },
                {
                  title: "TRẠNG THÁI",
                  render: r => (
                    <div className="cashier-status-cell">
                      <Badge tone={r.paymentState === 'PAID' ? 'green' : r.paymentState === 'OUTSTANDING' ? 'amber' : 'zinc'}>
                        {r.paymentState === 'PAID'
                          ? 'Đã thanh toán'
                          : r.paymentState === 'CANCELLED'
                          ? 'Đã hủy'
                          : r.paymentState === 'REVIEW_REFUND'
                          ? 'Cần hoàn tiền'
                          : 'Cần thu'}
                        {r.pendingOrderCount > 0 ? ` · ${r.pendingOrderCount} đơn chờ` : ''}
                      </Badge>
                    </div>
                  ),
                },
                {
                  title: "THAO TÁC",
                  render: r => (
                    <div className="cashier-row-actions" onClick={e => e.stopPropagation()}>
                      {r.status === "CHECKED_IN" && r.checkOut < hotelToday() ? <button type="button" className="cashier-action-btn btn-collect" onClick={() => setOverdue(r)}>Xử lý</button> : r.paymentState === "OUTSTANDING" ? (
                        <button
                          type="button"
                          className="cashier-action-btn btn-collect"
                          onClick={() => setSelected(r)}
                          title={`Thu tiền phòng ${r.roomNumber}`}
                        >
                          <CreditCard size={13} />
                          <span>Thu tiền</span>
                        </button>
                      ) : r.invoiceId ? (
                        <Link
                          className="cashier-action-btn btn-invoice"
                          to={`${base}/invoices/${r.invoiceId}`}
                          aria-label={`Xem hóa đơn phòng ${r.roomNumber}`}
                          title="Xem / in hóa đơn"
                        >
                          <FileText size={13} />
                          <span>Hóa đơn</span>
                        </Link>
                      ) : (
                        <button
                          type="button"
                          className="cashier-action-btn btn-view"
                          onClick={() => setSelected(r)}
                          title={`Xem chi tiết phòng ${r.roomNumber}`}
                        >
                          <span>Chi tiết</span>
                        </button>
                      )}
                    </div>
                  ),
                },
              ]}
            />
            <footer>
              <span>{query.data!.meta.total} booking</span>
              <Pagination {...query.data!.meta} onChange={setPage} />
            </footer>
          </>
        )}
      </section>

      {overdue && <OverdueStay booking={overdue} onClose={() => setOverdue(null)} />}
      {selected && <BillingDrawer booking={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function BillingDrawer({ booking, onClose }: { booking: BillingRow; onClose: () => void }) {
  const base = useDeskBase();
  const invoice = useDeskInvoice(booking.id);
  return (
    <Dialog open onClose={onClose} title="Chi tiết chi phí và thanh toán" className="cashier-drawer">
      <header className="cashier-drawer-header">
        <div className="cashier-drawer-header-info">
          <div className="flex items-center gap-2.5">
            <span className="cashier-room-badge large">{booking.roomNumber}</span>
            <div>
              <h2>{booking.customer?.fullName ?? "Khách tại quầy"}</h2>
              <p className="cashier-drawer-sub">Mã đặt phòng: {booking.reference}</p>
            </div>
          </div>
        </div>
      </header>

      {invoice.isPending ? (
        <Skeleton />
      ) : invoice.error ? (
        <ErrorState message={invoice.error.message} retry={() => void invoice.refetch()} />
      ) : (
        <>
          <dl className="cashier-totals">
            {[
              ["Tiền phòng", invoice.data?.roomAmount ?? booking.roomAmount],
              ["Dịch vụ", invoice.data?.serviceAmount ?? booking.serviceAmount],
              ["Tổng chi phí", invoice.data?.totalAmount ?? booking.totalAmount],
              ["Đã thu", invoice.data?.paidAmount ?? booking.paidAmount],
              ["Còn phải thu", invoice.data?.balance ?? booking.balance],
            ].map(([label, value]) => (
              <div key={label} className={label === "Còn phải thu" ? "cashier-total-balance" : ""}>
                <dt>{label}</dt>
                <dd className={label === "Còn phải thu" && Number(value) > 0 ? "text-amber-800 font-bold" : ""}>
                  {money(value)}
                </dd>
              </div>
            ))}
          </dl>

          {invoice.data ? (
            <>
              <Link className="cashier-link" to={`${base}/invoices/${invoice.data.id}`}>
                Xem / in hóa đơn
              </Link>
              {booking.status !== "CANCELLED" && <PaymentForm invoice={invoice.data} />}
              <h3>Lịch sử thanh toán</h3>
              {!invoice.data.payments.length && <p className="text-stone-500 text-xs">Chưa ghi nhận khoản thu.</p>}
              {invoice.data.payments.map(p => (
                <div className="cashier-payment" key={p.id}>
                  <div>
                    <span className="font-semibold">{p.method === "CASH" ? "Tiền mặt" : "Chuyển khoản"}</span>
                    <small>{p.paidAt ? new Date(p.paidAt).toLocaleString("vi-VN") : "Chưa có ngày thu"}</small>
                  </div>
                  <div>
                    {money(p.amount)}{" "}
                    <Badge tone={p.status === "COMPLETED" ? "green" : p.status === "FAILED" ? "rose" : "amber"}>
                      {p.status === "COMPLETED" ? "Đã thu" : p.status === "FAILED" ? "Thất bại" : "Đang chờ"}
                    </Badge>
                  </div>
                </div>
              ))}
            </>
          ) : (
            <div className="cashier-empty">
              <p>
                {booking.status === "CANCELLED"
                  ? "Booking đã hủy. Kiểm tra chi tiết trước khi xử lý chi phí."
                  : "Chi phí tạm tính. Mở hồ sơ để kiểm tra dịch vụ và phát hành hóa đơn trước khi thu tiền."}
              </p>
              <Link className="cashier-link" to={`${base}/bookings/${booking.id}/billing`}>
                Mở chi phí & phát hành hóa đơn
              </Link>
            </div>
          )}
        </>
      )}
    </Dialog>
  );
}

function PaymentReviewQueue() {
  const base = useDeskBase();
  const query = useDeskGet<{
    payments: { id: string; bookingId: string; reference: string; amount: string; customerName: string }[];
    staleCounterBookings: { id: string; reference: string }[];
  }>('/payments/booking-reviews');

  if (query.isPending) return null;
  if (query.error) return <ErrorState message="Không tải được hàng chờ đối soát thanh toán." retry={() => void query.refetch()} />;
  const data = query.data!;
  if (!data.payments.length) return null;

  return (
    <section className="cashier-list cashier-reviews">
      <h2>Đối soát thanh toán</h2>
      {data.payments.map(p => (
        <div key={p.id}>
          <p>
            <Link to={`${base}/bookings/${p.bookingId}`}>
              {p.reference} · {p.customerName}
            </Link>{" "}
            · Đã nhận {money(p.amount)} · Cần kiểm tra hoàn tiền. Chỉ xác nhận hoàn sau khi kiểm tra giao dịch ngân hàng.
          </p>
          <ResolveRefund id={p.id} onDone={() => void query.refetch()} />
        </div>
      ))}
    </section>
  );
}

function ResolveRefund({ id, onDone }: { id: string; onDone: () => void }) {
  const [reference, setReference] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');

  return (
    <form
      onSubmit={async e => {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
          await api.request(`/payments/booking-reviews/${id}/resolve`, {
            method: 'POST',
            body: { refundReference: reference },
          });
          onDone();
        } catch {
          setError('Chưa ghi nhận được. Kiểm tra giao dịch và thử lại.');
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        Mã giao dịch hoàn tiền đã xác minh{" "}
        <input required maxLength={200} value={reference} onChange={e => setReference(e.target.value)} />
      </label>
      <button disabled={busy || !reference.trim()}>Xác nhận đã hoàn tiền</button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}

export function StaleBookingQueue() {
  const base = useDeskBase();
  const query = useDeskGet<{ staleCounterBookings: { id: string; reference: string }[] }>('/payments/booking-reviews');
  const rows = query.data?.staleCounterBookings ?? [];
  if (!rows.length) return null;

  return (
    <details className="cashier-list cashier-reviews">
      <summary>Booking chờ quá 24 giờ ({rows.length})</summary>
      {rows.map(b => (
        <p key={b.id}>
          <Link to={`${base}/bookings/${b.id}`}>{b.reference}</Link>
        </p>
      ))}
    </details>
  );
}

function OverdueStay({ booking, onClose }: { booking: BillingRow; onClose: () => void }) {
  return <ExtendStayDialog booking={booking} onClose={onClose} />;
}
