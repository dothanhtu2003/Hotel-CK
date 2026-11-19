import { formatDate as localizedDate } from "../i18n/format";
import { enumLabel } from "../i18n/status";
import { displayLocale, safeError, t as tr, useLocale } from "../i18n";

import { catalogName } from "../i18n/catalog";

import { Trans } from "react-i18next";
import { Link, useParams } from 'react-router';
import {
  ArrowLeft,
  Banknote,
  CreditCard,
  Info,
  Printer,
} from 'lucide-react';
import { ErrorState, LinkButton, PageHeading } from '../components/ui';
import { GuestBadge, Skeleton } from '../features/guest/components';
import { formatBookingReference, money, type Invoice, type Preview } from '../features/guest/contracts';
import { useGet, useInvoice } from '../features/guest/queries';
import { PayosPayment } from '../features/guest/payos-payment';
import { BookingPayment } from '../features/guest/booking-payment';

/* ========================================================
   HELPER FORMATTERS (CLEAN UP UUIDs & ENUMS)
   ======================================================== */
function friendlyPaymentMethod(method: string) {
  switch (method) {
    case 'BANK_TRANSFER':
      return tr("guest:billingPages.bankTransfer");
    case 'CASH':
      return tr("guest:billingPages.cash");
    case 'CREDIT_CARD':
      return tr("guest:billingPages.creditCard");
    default:
      return enumLabel("PaymentMethod", method);
  }
}

function friendlyPaymentStatus(status: string) {
  switch (status) {
    case 'COMPLETED':
    case 'SUCCESS':
      return tr("guest:contracts.confirmed");
    case 'PENDING':
      return tr("guest:bookingStatus.awaitingConfirmation");
    case 'FAILED':
      return tr("guest:billingPages.unsuccessful");
    default:
      return enumLabel("PaymentStatus", status);
  }
}

function formatShortId(prefix: string, id: string) {
  if (!id) return '';
  return `${prefix}-${id.slice(0, 8).toUpperCase()}`;
}

/* ========================================================
   AMOUNTS BREAKDOWN COMPONENT
   ======================================================== */
function Amounts({
  room,
  services,
  total,
}: {
  room: string;
  services: string;
  total: string;
}) {
  useLocale();
  return (
    <dl className="guest-facts folio-amounts-breakdown">
      <div>
        <dt>{tr("guest:billingPages.roomCharges")}</dt>
        <dd>{money(room)}</dd>
      </div>
      <div>
        <dt>{tr("guest:billingPages.completedServices")}</dt>
        <dd>{money(services)}</dd>
      </div>
      <div className="folio-total-row">
        <dt>{tr("guest:billingPages.total")}</dt>
        <dd>
          <strong>{money(total)}</strong>
        </dd>
      </div>
    </dl>
  );
}

/* ========================================================
   INVOICE VIEW (HOTEL FOLIO BILL)
   ======================================================== */
function InvoiceView({ invoice: i }: { invoice: Invoice }) {
  useLocale();
  const isPaidInFull = i.status === 'PAID';

  return (
    <section className="panel guest-box folio-invoice-sheet print-document">
      {/* Folio Header */}
      <div className="folio-header">
        <div className="folio-brand">
          <span className="brand-symbol" aria-hidden="true">A<span>✦</span></span>
          <div><Trans ns="guest" i18nKey="billingPages.anNhienHotelSuitesAccommodationGuestServicesInvoice" components={{ part0: <strong />, part1: <small /> }} /></div>
        </div>
        <div className="folio-meta-tags">
          <GuestBadge status={i.status} />
        </div>
      </div>

      <div className="guest-row folio-title-row">
        <h2>{tr("guest:billingPages.invoiceIssued")}</h2>
        <span className="folio-serial-badge">{formatShortId(tr("guest:billingPages.inv"), i.id)}</span>
      </div>

      {/* Primary Folio Facts */}
      <div className="folio-info-grid">
        <div className="folio-info-item">
          <span>{tr("guest:billingPages.invoiceId")}</span>
          <strong>{formatShortId(tr("guest:billingPages.inv"), i.id)}</strong>
          <small className="folio-raw-id">(ID: {i.id})</small>
        </div>
        <div className="folio-info-item">
          <span>{tr("guest:billingPages.stay")}</span>
          <strong>{tr("common:supplement.reservationReference", { reference: formatBookingReference(i.booking.reference) })}</strong>
        </div>
        <div className="folio-info-item">
          <span>{tr("guest:billingPages.room")}</span>
          <strong>{tr("guest:roomCompare.roomValue", { value0: (i.booking.roomNumber) })}</strong>
        </div>
        <div className="folio-info-item">
          <span>{tr("guest:billingPages.issuedOn")}</span>
          <strong>{new Date(i.issuedAt).toLocaleString(displayLocale(), { timeZone: 'Asia/Ho_Chi_Minh' })}</strong>
        </div>
      </div>

      {/* Amounts breakdown */}
      <div className="folio-table-wrap">
        <Amounts room={i.roomAmount} services={i.serviceAmount} total={i.totalAmount} />
      </div>

      {/* Balance & Paid Summary */}
      <dl className="guest-facts folio-balance-summary">
        <div>
          <dt>{tr("guest:contracts.paid")}</dt>
          <dd className="text-emerald-700 font-semibold">{money(i.paidAmount)}</dd>
        </div>
        <div className={isPaidInFull ? 'balance-zero-highlight' : 'balance-due-highlight'}>
          <dt>{tr("guest:billingPages.remainingBalance")}</dt>
          <dd>
            <strong>{money(i.balance)}</strong>
          </dd>
        </div>
      </dl>

      {/* Payment Receipts Section */}
      {i.payments.length > 0 && (
        <div className="folio-receipts-section">
          <h3>{tr("guest:billingPages.paymentReceiptHistory")}</h3>
          <div className="folio-receipts-list">
            {i.payments.map((p) => (
              <div key={p.id} className="folio-receipt-item">
                <div className="receipt-item-icon">
                  {p.method === 'BANK_TRANSFER' ? (
                    <CreditCard size={16} />
                  ) : (
                    <Banknote size={16} />
                  )}
                </div>
                <div className="receipt-item-details">
                  <div className="receipt-item-top">
                    <strong>{formatShortId('BN', p.id)}</strong>
                    <span className="receipt-method-pill">
                      {friendlyPaymentMethod(p.method)}
                    </span>
                    <span className="receipt-status-pill">
                      {friendlyPaymentStatus(p.status)}
                    </span>
                  </div>
                  <p className="receipt-raw-text">{tr("guest:billingPages.receiptValueValueValueValue", { value0: (p.id), value1: (money(p.amount)), value2: (p.method), value3: (p.status) })}</p>
                </div>
                <strong className="receipt-item-amount">{money(p.amount)}</strong>
              </div>
            ))}
          </div>
        </div>
      )}

      <PayosPayment invoice={i} />
      {/* Front Desk Assistance Notice */}
      <div className="folio-notice-box">
        <Info size={18} />
        <p>{tr("guest:billingPages.pleaseContactReceptionForPaymentAndCheckOut")}</p>
      </div>

      {/* Actions */}
      <div className="folio-footer-actions">
        <button
          type="button"
          onClick={() => window.print()}
          className="button button-secondary folio-print-btn"
        >
          <Printer size={16} /> {tr("guest:billingPages.printInvoice")}</button>
      </div>
    </section>
  );
}

/* ========================================================
   BOOKING BILLING PAGE
   ======================================================== */
export function BookingBillingPage() {
  useLocale();
  const { id = '' } = useParams();
  const preview = useGet<Preview>(`/bookings/${id}/billing-preview`);
  const invoice = useInvoice(id);

  if (preview.data?.booking.status === 'CANCELLED' && !invoice.isPending && !invoice.error && !invoice.data) return (
    <div className="guest-billing-page-space">
      <div className="guest-detail-top-nav">
        <Link to={'/guest/bookings/' + id} className="guest-detail-back-link">
          <ArrowLeft size={16} />
          <span>{tr("guest:billingPages.reservationDetails")}</span>
        </Link>
      </div>
      <div className="guest-detail-header-card">
        <div className="guest-detail-header-info">
          <span className="guest-detail-ref-label">{tr("guest:billingPages.reservationInformation")}</span>
          <h1 className="guest-detail-title">{tr("guest:bookingPayment.reservationCancelled")}</h1>
        </div>
      </div>
      {preview.data.booking.onlinePaymentRequired ? <BookingPayment booking={preview.data.booking} /> : <p className="notice">{tr("guest:billingPages.thisReservationWasCancelledThereIsNoAccommodationInvoiceToPay")}</p>}
    </div>
  );

  return (
    <div className="guest-billing-page-space">
      <div className="guest-detail-top-nav">
        <Link to={'/guest/bookings/' + id} className="guest-detail-back-link">
          <ArrowLeft size={16} />
          <span>{tr("guest:billingPages.reservationDetails")}</span>
        </Link>
      </div>

      <div className="guest-detail-header-card">
        <div className="guest-detail-header-info">
          <span className="guest-detail-ref-label">{tr("guest:billingPages.paymentsInvoices")}</span>
          <h1 className="guest-detail-title">{tr("guest:billingPages.chargesInvoices")}</h1>
        </div>
        {preview.data?.booking && <GuestBadge status={preview.data.booking.status} />}
      </div>

      {preview.isPending || invoice.isPending ? <Skeleton /> : preview.error || invoice.error ? (
        <ErrorState message={safeError((preview.error || invoice.error)!)} retry={() => { void preview.refetch(); void invoice.refetch(); }} />
      ) : preview.data && (() => {
        const p = preview.data;
        const summary = p.guestSummary;
        const orders = summary?.orders ?? p.completedOrders;
        const hasPending = orders.some(o => o.status === 'PENDING');
        return <>
          <section className="panel guest-box guest-cost-overview" aria-label={tr("guest:billingPages.totalStayCharges")}>
            <div className="guest-row">
              <div>
                <h2>{tr("guest:roomCompare.roomValue", { value0: (p.booking.roomNumber) })}</h2>
                <p className="preview-meta">
                  {formatBookingReference(p.booking.reference)} · {localizedDate(p.booking.checkIn)} → {localizedDate(p.booking.checkOut)}
                </p>
              </div>
            </div>
            <dl className="guest-facts">
              <div><dt>{tr("guest:billingPages.roomChargesValueNights", { value0: (p.booking.nights) })}</dt><dd>{money(p.roomAmount)}</dd></div>
              <div><dt>{tr("guest:billingPages.servicesOrderedValue", { value0: (hasPending ? tr("common:supplement.estimated") : '') })}</dt><dd>{money(summary?.serviceAmount ?? p.serviceAmount)}</dd></div>
              <div className="folio-total-row"><dt>{tr("guest:billingPages.totalChargesValue", { value0: (hasPending ? tr("common:supplement.estimated") : '') })}</dt><dd><strong>{money(summary?.totalAmount ?? p.totalAmount)}</strong></dd></div>
              <div><dt>{tr("guest:contracts.paid")}</dt><dd>{money(summary?.paidAmount ?? p.paidAmount ?? '0')}</dd></div>
              <div className={Number(summary?.balance ?? p.balance ?? p.totalAmount) === 0 ? 'balance-zero-highlight' : 'balance-due-highlight'}><dt>{tr("guest:billingPages.balanceDueValue", { value0: (hasPending ? tr("common:supplement.estimated") : '') })}</dt><dd><strong>{money(summary?.balance ?? p.balance ?? p.totalAmount)}</strong></dd></div>
            </dl>
            {hasPending && <p className="billing-help">{tr("guest:billingPages.includesServicesStillPending")}</p>}
            {orders.length > 0 && <details className="guest-cost-details"><summary>{tr("guest:billingPages.detailsOfValueServiceOrders", { value0: (orders.length) })}</summary>
              <div className="guest-cost-orders-list">
                {orders.map(o => <div key={o.id} className="guest-cost-order">
                  {o.items.map(item => <div className="guest-row" key={item.id}><span>{tr("guest:billingPages.valueValue", { value0: (catalogName(item.serviceName)), value1: (item.quantity) })}</span><strong>{money(item.subtotal)}</strong></div>)}
                  <small>{o.paymentMethod ? tr("guest:billingPages.paidSeparately") : o.requestedPaymentMethod === 'CASH' ? tr("guest:billingPages.cash") : o.requestedPaymentMethod === 'BANK_TRANSFER' ? tr("guest:billingPages.bankTransfer") : o.status === 'PENDING' ? tr("guest:bookingStatus.awaitingConfirmation") : tr("guest:billingPages.chargeToRoom")}</small>
                </div>)}
                <div className="guest-cost-orders-footer">
                  <Link to="/guest/service-orders" className="guest-cost-orders-link">{tr("guest:billingPages.viewAndManageServiceOrders")}</Link>
                </div>
              </div>
            </details>}
          </section>
          {p.booking.onlinePaymentRequired && Number(p.prepaidAmount ?? p.paidAmount ?? '0') < Number(p.roomAmount) && p.booking.status === 'PENDING' && <BookingPayment booking={p.booking} />}
          {invoice.data && <details className="panel guest-box guest-cost-details"><summary>{tr("guest:billingPages.invoicesPaymentHistory")}</summary>
            <div className="guest-cost-orders-list">
              <InvoiceView invoice={invoice.data} />
              <div className="guest-cost-orders-footer">
                <LinkButton variant="secondary" to={'/guest/invoices/' + invoice.data.id}>{tr("guest:billingPages.openInvoice")}</LinkButton>
              </div>
            </div>
          </details>}
        </>;
      })()}

    </div>
  );
}

/* ========================================================
   STANDALONE INVOICE PAGE
   ======================================================== */
export function InvoicePage() {
  useLocale();
  const { id = '' } = useParams();
  const query = useGet<Invoice>('/invoices/' + id);

  return (
    <div className="guest-standalone-invoice-space">
      <Link to="/guest/billing" className="text-link">{tr("guest:billingPages.chargesInvoices2")}</Link>
      <PageHeading title={tr("guest:billingPages.accommodationInvoice")} />
      {query.isPending ? (
        <Skeleton />
      ) : query.error ? (
        <ErrorState
          message={safeError(query.error)}
          retry={() => void query.refetch()}
        />
      ) : (
        query.data && <InvoiceView invoice={query.data} />
      )}
    </div>
  );
}
