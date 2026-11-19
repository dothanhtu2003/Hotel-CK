import { formatDate as localizedDate } from "../../i18n/format";
import { displayLocale, localized, message as uiMessage, resolveMessage, safeError, t as tr, useLocale } from "../../i18n";


import { useSearchParams } from 'react-router';
import { DeskLink } from "./navigation";
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

const groups = localized(() => ([
  { id: "departures", label: tr("reception:cashier.dueToday") },
  { id: "outstanding", label: tr("reception:cashier.balanceDue") },
  { id: "history", label: tr("reception:cashier.history") },
] as const));

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
  useLocale();
  const base = useDeskBase();
  const [filters, setFilters] = useSearchParams();
  const group = groups.find(({ id }) => id === filters.get("group"))?.id ?? "departures";
  const date = filters.get("date") || hotelToday();
  const q = filters.get("q") || "";
  const page = Math.max(1, Number.parseInt(filters.get("page") ?? "", 10) || 1);
  const [search, setSearch] = useState(q);
  const [overdue, setOverdue] = useState<BillingRow | null>(null);
  const [selected, setSelected] = useState<BillingRow | null>(null);
  const params = new URLSearchParams({ group, date, q, page: String(page), pageSize: "15" });
  const query = useDeskGet<Page<BillingRow> & { counts: Record<string, number> }>(`/front-desk/billing?${params}`);
  const updateFilters = (changes: Record<string, string>) => {
    const next = new URLSearchParams(filters);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setFilters(next, { replace: true });
  };
  const selectGroup = (value: string) => updateFilters({ group: value, page: "" });
  const selectDate = (value: string) => updateFilters({ date: value, page: "" });

  const isToday = date === hotelToday();

  return (
    <div className="cashier-page">
      <header className="cashier-heading">
        <div>
          <h1>{tr("reception:cashier.cashierInvoices")}</h1>
          <p className="cashier-heading-sub">{tr("reception:cashier.managePaymentsInvoicesAndOutstandingStayCharges")}</p>
        </div>

        {group === "departures" && (
          <div className="cashier-date-nav">
            <button
              type="button"
              className="cashier-date-arrow-btn"
              aria-label={tr("reception:cashier.previousDay")}
              onClick={() => selectDate(shiftDay(date, -1))}
            >
              <ChevronLeft size={16} />
            </button>

            <label className="cashier-date-picker-wrap">
              <span className="cashier-date-display">
                <Calendar size={14} className="text-emerald-700" />
                <span className="font-semibold text-stone-800">
                  {isToday ? tr("reception:cashier.today") : ""}{localizedDate(date)}
                </span>
              </span>
              <input
                aria-label={tr("reception:cashier.checkOutDateForCollection")}
                type="date"
                value={date}
                onChange={e => {
                  if (e.target.value) {
                    selectDate(e.target.value);
                  }
                }}
              />
            </label>

            <button
              type="button"
              className="cashier-date-arrow-btn"
              aria-label={tr("reception:cashier.nextDay")}
              onClick={() => selectDate(shiftDay(date, 1))}
            >
              <ChevronRight size={16} />
            </button>

            {!isToday && (
              <button
                type="button"
                className="cashier-today-btn"
                onClick={() => selectDate(hotelToday())}
              >{tr("reception:cashier.goToToday")}</button>
            )}
          </div>
        )}
      </header>

      {/* Merged Interactive Tab Cards */}
      <div className="cashier-groups cashier-tab-cards-grid" aria-label={tr("reception:cashier.paymentGroup")} >
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
                    <span className="cashier-debt-pill">{tr("reception:cashier.toCollect")}</span>
                  )}
                </div>
                <div className="cashier-tab-card-count-row">
                  <strong className="cashier-tab-card-num">
                    {hasCount ? count : "—"}
                  </strong>{" "}
                  <span className="cashier-tab-card-unit">{tr("reception:cashier.rooms")}</span>
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
            updateFilters({ q: search.trim(), page: "" });
          }}
        >
          <div className="cashier-search-wrap">
            <Search size={15} className="cashier-search-icon" />
            <input
              aria-label={tr("reception:cashier.searchGuestRoomOrReservationCode")}
              placeholder={tr("reception:cashier.guestNameRoomReservationCodePhone")}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                className="cashier-search-clear-btn"
                aria-label={tr("reception:cashier.clearSearch")}
                onClick={() => {
                  setSearch("");
                  updateFilters({ q: "", page: "" });
                }}
              >
                <X size={13} />
              </button>
            )}
          </div>
          <button type="submit" className="cashier-search-btn">{tr("reception:cashier.search")}</button>
        </form>

        {query.isPending ? (
          <Skeleton />
        ) : query.error ? (
          <ErrorState message={safeError(query.error)} retry={() => void query.refetch()} />
        ) : (
          <>
            <Table
              caption={tr("reception:cashier.cashierList")}
              rows={query.data!.data}
              rowKey={r => r.id}
              onRowClick={setSelected}
              empty={
                <div className="cashier-empty">
                  <strong>{tr("reception:cashier.noEntriesInThisGroup")}</strong>
                  <p></p>
                  <button type="button" onClick={() => selectGroup("outstanding")}>{tr("reception:cashier.viewOutstandingCharges")}</button>
                </div>
              }
              columns={[
                {
                  title: tr("reception:cashier.guestRoom"),
                  render: r => (
                    <div className="cashier-room-cell">
                      <span className="cashier-room-badge" title={tr("reception:cashier.roomValue", { value0: (r.roomNumber) })}>
                        {r.roomNumber}
                      </span>
                      <div className="cashier-guest-info">
                        <button
                          type="button"
                          className="cashier-customer"
                          onClick={() => setSelected(r)}
                          aria-label={tr("reception:cashier.viewChargesForRoomValue", { value0: (r.roomNumber) })}
                        >
                          {r.customer?.fullName ?? tr("reception:cashier.walkInGuest")}
                        </button>
                        <div className="cashier-submeta">
                          <span className="cashier-ref-code">{r.reference}</span>
                          <span className="cashier-meta-dot">·</span>
                          <span>{tr("reception:cashier.checkOutValue", { value0: (localizedDate(r.checkOut)) })}</span>
                          <span className="cashier-meta-dot">·</span>
                          <span className="cashier-status-text">{statusLabels[r.status] ?? tr("common:status.unknown")}</span>
                          {r.status === "CHECKED_IN" && r.checkOut < hotelToday() && <Badge tone="amber">{tr("reception:cashier.valueDaysOverdue", { value0: (Math.round((Date.parse(hotelToday()) - Date.parse(r.checkOut)) / 86400000)) })}</Badge>}
                        </div>
                      </div>
                    </div>
                  ),
                },
                {
                  title: tr("reception:cashier.total"),
                  render: r => (
                    <div className="cashier-amount-cell">
                      <strong className="cashier-amount-val">{money(r.totalAmount)}</strong>
                      {!r.invoiceId && <span className="cashier-amount-sub">{tr("reception:cashier.estimated")}</span>}
                    </div>
                  ),
                },
                {
                  title: tr("reception:cashier.collected"),
                  render: r => (
                    <div className="cashier-amount-cell">
                      <span className="cashier-amount-paid">{money(r.paidAmount)}</span>
                    </div>
                  ),
                },
                {
                  title: tr("reception:cashier.balanceDue2"),
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
                            ? tr("reception:cashier.fullyPaid")
                            : isCancelled
                            ? tr("reception:cashier.reservationCancelled")
                            : isReviewRefund
                            ? tr("reception:cashier.refundReviewRequired")
                            : r.invoiceId
                            ? tr("reception:cashier.notFullyPaid")
                            : tr("reception:cashier.invoiceNotIssued")}
                        </span>
                      </div>
                    );
                  },
                },
                {
                  title: tr("reception:cashier.status"),
                  render: r => (
                    <div className="cashier-status-cell">
                      <Badge tone={r.paymentState === 'PAID' ? 'green' : r.paymentState === 'OUTSTANDING' ? 'amber' : 'zinc'}>
                        {r.paymentState === 'PAID'
                          ? tr("reception:cashier.paid")
                          : r.paymentState === 'CANCELLED'
                          ? tr("reception:cashier.cancelled")
                          : r.paymentState === 'REVIEW_REFUND'
                          ? tr("reception:cashier.refundRequired")
                          : tr("reception:cashier.toCollect")}
                        {r.pendingOrderCount > 0 ? tr("reception:cashier.valuePendingOrders", { value0: (r.pendingOrderCount) }) : ''}
                      </Badge>
                    </div>
                  ),
                },
                {
                  title: tr("reception:cashier.actions"),
                  render: r => (
                    <div className="cashier-row-actions" onClick={e => e.stopPropagation()}>
                      {r.status === "CHECKED_IN" && r.checkOut < hotelToday() ? <button type="button" className="cashier-action-btn btn-collect" onClick={() => setOverdue(r)}>{tr("reception:cashier.process")}</button> : r.paymentState === "OUTSTANDING" ? (
                        <button
                          type="button"
                          className="cashier-action-btn btn-collect"
                          onClick={() => setSelected(r)}
                          title={tr("reception:cashier.collectPaymentForRoomValue", { value0: (r.roomNumber) })}
                        >
                          <CreditCard size={13} />
                          <span>{tr("reception:cashier.collectPayment")}</span>
                        </button>
                      ) : r.invoiceId ? (
                        <DeskLink
                          className="cashier-action-btn btn-invoice"
                          to={`${base}/invoices/${r.invoiceId}`}
                          aria-label={tr("reception:cashier.viewInvoiceForRoomValue", { value0: (r.roomNumber) })}
                          title={tr("reception:cashier.viewPrintInvoice")}
                        >
                          <FileText size={13} />
                          <span>{tr("reception:cashier.invoice")}</span>
                        </DeskLink>
                      ) : (
                        <button
                          type="button"
                          className="cashier-action-btn btn-view"
                          onClick={() => setSelected(r)}
                          title={tr("reception:cashier.viewDetailsForRoomValue", { value0: (r.roomNumber) })}
                        >
                          <span>{tr("reception:cashier.details")}</span>
                        </button>
                      )}
                    </div>
                  ),
                },
              ]}
            />
            <footer>
              <span>{tr("common:supplement.reservationCount", { value0: query.data!.meta.total })}</span>
              <Pagination {...query.data!.meta} onChange={(value) => updateFilters({ page: String(value) })} />
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
  useLocale();
  const base = useDeskBase();
  const invoice = useDeskInvoice(booking.id);
  return (
    <Dialog open onClose={onClose} title={tr("reception:cashier.chargesAndPaymentDetails")} className="cashier-drawer">
      <header className="cashier-drawer-header">
        <div className="cashier-drawer-header-info">
          <div className="flex items-center gap-2.5">
            <span className="cashier-room-badge large">{booking.roomNumber}</span>
            <div>
              <h2>{booking.customer?.fullName ?? tr("reception:cashier.walkInGuest")}</h2>
              <p className="cashier-drawer-sub">{tr("reception:cashier.reservationCodeValue", { value0: (booking.reference) })}</p>
            </div>
          </div>
        </div>
      </header>

      {invoice.isPending ? (
        <Skeleton />
      ) : invoice.error ? (
        <ErrorState message={safeError(invoice.error)} retry={() => void invoice.refetch()} />
      ) : (
        <>
          <dl className="cashier-totals">
            {[
              ["room", tr("reception:cashier.roomCharges"), invoice.data?.roomAmount ?? booking.roomAmount],
              ["services", tr("reception:cashier.services"), invoice.data?.serviceAmount ?? booking.serviceAmount],
              ["total", tr("reception:cashier.totalCharges"), invoice.data?.totalAmount ?? booking.totalAmount],
              ["collected", tr("reception:cashier.collected2"), invoice.data?.paidAmount ?? booking.paidAmount],
              ["balance", tr("reception:cashier.balanceDue"), invoice.data?.balance ?? booking.balance],
            ].map(([id, label, value]) => (
              <div key={id} className={id === "balance" ? "cashier-total-balance" : ""}>
                <dt>{label}</dt>
                <dd className={id === "balance" && Number(value) > 0 ? "text-amber-800 font-bold" : ""}>
                  {money(value)}
                </dd>
              </div>
            ))}
          </dl>

          {invoice.data ? (
            <>
              <DeskLink className="cashier-link" to={`${base}/invoices/${invoice.data.id}`}>{tr("reception:cashier.viewPrintInvoice")}</DeskLink>
              {booking.status !== "CANCELLED" && <PaymentForm invoice={invoice.data} />}
              <h3>{tr("reception:cashier.paymentHistory")}</h3>
              {!invoice.data.payments.length && <p className="text-stone-500 text-xs">{tr("reception:cashier.noPaymentsRecorded")}</p>}
              {invoice.data.payments.map(p => (
                <div className="cashier-payment" key={p.id}>
                  <div>
                    <span className="font-semibold">{p.method === "CASH" ? tr("reception:cashier.cash") : tr("reception:cashier.bankTransfer")}</span>
                    <small>{p.paidAt ? new Date(p.paidAt).toLocaleString(displayLocale(), { timeZone: 'Asia/Ho_Chi_Minh' }) : tr("reception:cashier.noCollectionDate")}</small>
                  </div>
                  <div>
                    {money(p.amount)}{" "}
                    <Badge tone={p.status === "COMPLETED" ? "green" : p.status === "FAILED" ? "rose" : "amber"}>
                      {p.status === "COMPLETED" ? tr("reception:cashier.collected2") : p.status === "FAILED" ? tr("reception:cashier.failed") : tr("reception:cashier.pending")}
                    </Badge>
                  </div>
                </div>
              ))}
            </>
          ) : (
            <div className="cashier-empty">
              <p>
                {booking.status === "CANCELLED"
                  ? tr("reception:cashier.reservationCancelledCheckDetailsBeforeProcessingCharges")
                  : tr("reception:cashier.estimatedChargesOpenTheRecordToCheckServicesAndIssueAnInvoice")}
              </p>
              <DeskLink className="cashier-link" to={`${base}/bookings/${booking.id}/billing`}>{tr("reception:cashier.openChargesIssueInvoice")}</DeskLink>
            </div>
          )}
        </>
      )}
    </Dialog>
  );
}

function PaymentReviewQueue() {
  useLocale();
  const base = useDeskBase();
  const query = useDeskGet<{
    payments: { id: string; bookingId: string; reference: string; amount: string; customerName: string }[];
    staleCounterBookings: { id: string; reference: string }[];
  }>('/payments/booking-reviews');

  if (query.isPending) return null;
  if (query.error) return <ErrorState message={tr("reception:cashier.unableToLoadThePaymentReviewQueue")} retry={() => void query.refetch()} />;
  const data = query.data!;
  if (!data.payments.length) return null;

  return (
    <section className="cashier-list cashier-reviews">
      <h2>{tr("reception:cashier.paymentReview")}</h2>
      {data.payments.map(p => (
        <div key={p.id}>
          <p>
            <DeskLink to={`${base}/bookings/${p.bookingId}`}>
              {p.reference} · {p.customerName}
            </DeskLink>{" "}
            {tr("reception:cashier.received")}{money(p.amount)} {tr("reception:cashier.refundReviewRequiredConfirmARefundOnlyAfterCheckingTheBankTransaction")}</p>
          <ResolveRefund id={p.id} onDone={() => void query.refetch()} />
        </div>
      ))}
    </section>
  );
}

function ResolveRefund({ id, onDone }: { id: string; onDone: () => void }) {
  useLocale();
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
          setError(uiMessage("reception:cashier.unableToRecordThisCheckTheTransactionAndTryAgain"));
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        {tr("reception:cashier.verifiedRefundTransactionReference")}{" "}
        <input required maxLength={200} value={reference} onChange={e => setReference(e.target.value)} />
      </label>
      <button disabled={busy || !reference.trim()}>{tr("reception:cashier.confirmRefundCompleted")}</button>
      {error && <p role="alert">{resolveMessage(error)}</p>}
    </form>
  );
}

export function StaleBookingQueue() {
  useLocale();
  const base = useDeskBase();
  const query = useDeskGet<{ staleCounterBookings: { id: string; reference: string }[] }>('/payments/booking-reviews');
  const rows = query.data?.staleCounterBookings ?? [];
  if (!rows.length) return null;

  return (
    <details className="cashier-list cashier-reviews">
      <summary>{tr("reception:cashier.reservationsPendingOver24HoursValue", { value0: (rows.length) })}</summary>
      {rows.map(b => (
        <p key={b.id}>
          <DeskLink to={`${base}/bookings/${b.id}`}>{b.reference}</DeskLink>
        </p>
      ))}
    </details>
  );
}

function OverdueStay({ booking, onClose }: { booking: BillingRow; onClose: () => void }) {
  useLocale();
  return <ExtendStayDialog booking={booking} onClose={onClose} />;
}
