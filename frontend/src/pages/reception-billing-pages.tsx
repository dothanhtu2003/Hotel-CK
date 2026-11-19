import { formatDate as localizedDate } from "../i18n/format";
import { catalogName } from "../i18n/catalog";
import { displayLocale, safeError, t as tr, useLocale } from "../i18n";


import { Trans } from "react-i18next";
import { DeskLink, DeskBackLink } from "../features/reception/navigation";
import "../features/reception/billing-workspace.css";
import { useState } from "react";
import { useParams } from "react-router";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ConciergeBell,
  CreditCard,
  Receipt,
  Printer,
} from "lucide-react";

function cleanServiceName(name: string) {
  return name.replace(/^TEST\s*-\s*\d{8}\s*/i, "").trim() || name;
}
import {
  Button,
  ErrorState,
  Pagination,
  Table,
} from "../components/ui";
import { Skeleton } from "../features/guest/components";
import {
  money,
  cents,
  decimal,
  statusLabels,
  type Invoice,
  type Order,
  type Page,
  type Preview,
} from "../features/guest/contracts";
import { DeskAction } from "../features/reception/components";
import { ServiceOrderActions } from '../features/reception/service-order-actions';
import {
  canCheckout,
  canIssue,
  type Checkout,
  type DeskBooking,
} from "../features/reception/contracts";
import { PaymentForm } from "../features/reception/payment-form";
import { ExtendStayDialog } from "../features/reception/extend-stay-dialog";
import { hotelToday } from "../features/reception/room-state";
import {
  useDeskBase,
  useDeskGet,
  useDeskInvoice,
} from "../features/reception/queries";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/kamra-ui";

export function ReceptionBillingPage() {
  useLocale();
  const { id = "" } = useParams();
  const base = useDeskBase();
  const [checkoutResult, setCheckoutResult] = useState<Checkout | null>(null);
  const [settlingOverdue, setSettlingOverdue] = useState(false);
  const guest = useDeskGet<DeskBooking>(`/front-desk/bookings/${id}`);
  const preview = useDeskGet<Preview>(`/bookings/${id}/billing-preview`);
  const invoice = useDeskInvoice(id);
  if (guest.isPending || preview.isPending || invoice.isPending) return <Skeleton />;
  const error = guest.error || preview.error || invoice.error;
  if (error) return <ErrorState message={safeError(error)} retry={() => { void guest.refetch(); void preview.refetch(); void invoice.refetch(); }} />;
  const b = guest.data!, p = preview.data!, i = invoice.data;
  const overdue = b.status === 'CHECKED_IN' && b.checkOut < hotelToday();
  const usedOrders = [...p.completedOrders, ...(p.counterPaidOrders ?? [])];
  const formatDate = (value: string) => localizedDate(value);
  const amount = i?.totalAmount ?? p.totalAmount;
  const paid = i?.paidAmount ?? p.paidAmount ?? "0";
  const balance = i?.balance ?? p.balance ?? p.totalAmount;
  const separatePaid = p.counterPaidAmount ?? "0";
  const overallTotal = decimal(cents(amount) + cents(separatePaid));
  const overallPaid = decimal(cents(paid) + cents(separatePaid));
  const isPaidInFull = Number(balance) <= 0;
  const roomAmount = i?.roomAmount ?? p.roomAmount;
  const extension = p.roomExtension;
  const roomCharges = extension ? [
    { label: tr("reception:receptionBillingPages.initialRoomChargesValueNights", { value0: (b.nights - extension.addedNights) }), amount: decimal(cents(roomAmount) - cents(extension.addedAmount)) },
    { label: tr("reception:receptionBillingPages.extensionOverdueChargesValueNights", { value0: (extension.addedNights) }), amount: extension.addedAmount },
  ] : [{ label: tr("reception:receptionBillingPages.roomChargesValueNights", { value0: (b.nights) }), amount: roomAmount }];

  return (
    <div className="billing-workspace">
      <DeskBackLink className="billing-back" to={`${base}/billing`}>
        <ArrowLeft className="size-3.5" /> {tr("reception:receptionBillingPages.cashierList")}</DeskBackLink>

      <header className="billing-header-card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 flex-wrap items-center gap-3.5">
            <div className="billing-room-hero">
              <span className="billing-room-hero-num">{b.roomNumber}</span>
              <span className="billing-room-hero-label">{tr("reception:reservationPanels.room")}</span>
            </div>
            <div className="min-w-0 max-w-full">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="billing-guest-name">
                  {b.customer?.fullName ?? tr("reception:cashier.walkInGuest")}
                </h1>
                <Badge tone={b.status === "CHECKED_IN" ? "green" : "zinc"} className="text-xs px-2.5 py-0.5 font-semibold">
                  {statusLabels[b.status]}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 text-xs text-zinc-500 mt-1">
                <span className="inline-flex items-center gap-1.5 font-medium text-zinc-700">
                  <Calendar className="size-3.5 text-zinc-400" />
                  {tr("common:supplement.stayDateRange", { value0: formatDate(b.checkIn), value1: formatDate(b.checkOut), value2: b.nights })}</span>
                <span className="text-zinc-300">•</span>
                <span className="font-mono text-zinc-600"><Trans ns="reception" i18nKey="receptionBillingPages.recordValue" values={{ value0: (b.reference) }} components={{ part0: <strong /> }} /></span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <DeskLink
              to={`${base}/bookings/${id}`}
              className="billing-profile-link"
            >{tr("reception:receptionBillingPages.reservationRecord")}</DeskLink>
          </div>
        </div>
      </header>

      {overdue && <section className="billing-pending-card" role="alert">
        <h2>{tr("reception:receptionBillingPages.theGuestSCheckOutIsOverdue")}</h2>
        {i ? <p>{tr("reception:receptionBillingPages.theInvoiceWasIssuedBeforeTheStayEndedAFinalizedInvoiceCannot")}</p> : <>
          <p className="billing-help">{tr("reception:receptionBillingPages.confirmAdditionalNightChargesThroughTodayBeforeFinalizingTheInvoiceAdditionalRate")}</p>
          <Button onClick={() => setSettlingOverdue(true)}>{tr("reception:receptionBillingPages.calculateChargesThroughToday")}</Button>
        </>}
      </section>}
      {settlingOverdue && <ExtendStayDialog booking={b} checkoutToday onClose={() => setSettlingOverdue(false)} />}

      <div className="billing-columns">
        <main className="billing-breakdown">
          {/* Folio Breakdown */}
          <section className="billing-box">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-100">
              <h2 className="flex items-center gap-2 text-sm font-bold text-zinc-900">
                <Receipt className="size-4 text-emerald-700" />
                {tr("reception:receptionBillingPages.stayChargeDetails")}</h2>
              <span className="text-xs text-zinc-400 font-medium">{tr("reception:cashier.roomValue", { value0: (b.roomNumber) })}</span>
            </div>

            <div className="billing-receipt-lines">
              <h3 className="px-2.5 text-xs font-bold text-zinc-700">{tr("reception:receptionBillingPages.roomInvoice")}</h3>
              {roomCharges.map(charge => (
                <div key={charge.label} className="billing-receipt-row">
                  <span className="billing-receipt-label font-semibold text-zinc-800">{charge.label}</span>
                  <div className="billing-receipt-leader" />
                  <strong className="billing-receipt-value font-semibold text-zinc-900">{money(charge.amount)}</strong>
                </div>
              ))}

              <div className="billing-receipt-row">
                <div className="billing-receipt-label">
                  <span className="font-semibold text-zinc-800">{tr("reception:receptionBillingPages.servicesChargedToRoom")}</span>
                </div>
                <div className="billing-receipt-leader" />
                <strong className="billing-receipt-value font-semibold text-zinc-900">{money(i?.serviceAmount ?? p.serviceAmount)}</strong>
              </div>

              {Number(separatePaid) > 0 && (
                <div className="billing-receipt-row rounded-lg bg-zinc-50">
                  <span className="billing-receipt-label font-semibold text-zinc-800">{tr("reception:receptionBillingPages.servicesPaidSeparately")}</span>
                  <strong className="billing-receipt-value font-semibold text-zinc-900">{money(separatePaid)}</strong>
                </div>
              )}

              <div className="billing-receipt-row billing-receipt-total">
                <strong className="billing-receipt-label text-base font-bold text-zinc-900">{tr("reception:receptionBillingPages.totalStayCharges")}</strong>
                <div className="billing-receipt-leader billing-leader-thick" />
                <strong className="billing-receipt-value text-base font-bold text-emerald-800">{money(overallTotal)}</strong>
              </div>
            </div>
          </section>

          {/* Pending Services Section */}
          {p.pendingOrderCount > 0 && (
            <section className="billing-pending-card">
              <div className="billing-pending-header">
                <div className="p-2 rounded-lg bg-amber-100 text-amber-800 shrink-0 mt-0.5">
                  <AlertCircle className="size-5" />
                </div>
                <div>
                  <h2>{tr("reception:receptionBillingPages.valueServiceOrdersNeedAttention", { value0: (p.pendingOrderCount) })}</h2>
                  <p className="billing-help">{tr("reception:receptionBillingPages.theOrdersBelowAreAwaitingRecordingOrPaymentSoCheckOutIs")}</p>
                </div>
              </div>
              <PendingServiceQueue bookingId={id} />
            </section>
          )}

          {/* Completed Services */}
          <section className="billing-box">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-100">
              <h2 className="flex items-center gap-2 text-sm font-bold text-zinc-900">
                <ConciergeBell className="size-4 text-emerald-700" />
                {tr("reception:receptionBillingPages.servicesUsed")}</h2>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600">{tr("reception:receptionBillingPages.valueOrders", { value0: (usedOrders.length) })}</span>
            </div>
            {!usedOrders.length ? (
              <p className="billing-help">{tr("reception:receptionBillingPages.noServicesRecordedYet")}</p>
            ) : (
              <div className="rounded-lg border border-zinc-200/80 overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-semibold">
                    <tr>
                      <th className="py-2.5 px-3.5 text-left">{tr("reception:components.service")}</th>
                      <th className="py-2.5 px-2 text-center">{tr("reception:receptionBillingPages.method")}</th>
                      <th className="py-2.5 px-3 text-center">{tr("reception:receptionBillingPages.qty")}</th>
                      <th className="py-2.5 px-3.5 text-right">{tr("reception:receptionBillingPages.unitPrice")}</th>
                      <th className="py-2.5 px-3.5 text-right">{tr("reception:components.subtotal")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {usedOrders.flatMap(o => o.items.map(item => ({ ...item, paymentMethod: o.paymentMethod, key: `${o.id}-${item.id ?? catalogName(item.serviceName)}` }))).map(item => (
                      <tr key={item.key} className={`transition-colors ${!item.paymentMethod && !isPaidInFull ? "bg-amber-50 hover:bg-amber-100/70" : "hover:bg-zinc-50/50"}`}>
                        <td className="py-2.5 px-3.5 font-medium text-zinc-900">
                          {catalogName(cleanServiceName(item.serviceName))}
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <span className={item.paymentMethod === 'CASH' ? 'billing-pill-cash' : item.paymentMethod === 'BANK_TRANSFER' ? 'billing-pill-transfer' : 'billing-pill-room'}>
                            {item.paymentMethod === 'CASH' ? tr("reception:cashier.cash") : item.paymentMethod === 'BANK_TRANSFER' ? tr("reception:cashier.bankTransfer") : isPaidInFull ? tr("reception:receptionBillingPages.chargeToRoom") : tr("reception:receptionBillingPages.chargeToRoomCollectAtCheckOut")}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center tabular-nums text-zinc-700 font-semibold">{item.quantity}</td>
                        <td className="py-2.5 px-3.5 text-right tabular-nums text-zinc-600">{money(item.unitPrice)}</td>
                        <td className="py-2.5 px-3.5 text-right tabular-nums font-bold text-zinc-900">{money(item.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

        </main>

        {/* Right Summary Column */}
        <aside className="billing-checkout">
          <section className="billing-box billing-summary shadow-xs">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-100">
              <h2 className="flex items-center gap-2 text-sm font-bold text-zinc-900">
                <CreditCard className="size-4 text-emerald-700" />
                {tr("reception:receptionBillingPages.settlementCheckOut")}</h2>
              {i && (
                <span className="text-xs text-zinc-500 font-mono font-medium">{tr("reception:receptionBillingPages.invValue", { value0: (i.id.slice(0, 8)) })}</span>
              )}
            </div>

            <dl className="space-y-2.5 text-xs pb-3 border-b border-zinc-100">
              <div className="flex justify-between items-center text-zinc-600">
                <dt>{tr("reception:receptionBillingPages.totalStayCharges")}</dt>
                <dd className="font-bold text-zinc-900 text-sm tabular-nums">{money(overallTotal)}</dd>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-zinc-100">
                <dt className="font-semibold text-zinc-800">{tr("reception:receptionBillingPages.totalCollected")}</dt>
                <dd className="text-emerald-700 font-bold text-sm tabular-nums">{money(overallPaid)}</dd>
              </div>
            </dl>

            {/* Hero Due/Status Box */}
            <div className={`billing-hero-status ${isPaidInFull ? "billing-status-settled" : "billing-status-unpaid"}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider">
                  {isPaidInFull ? (
                    <span className="flex items-center gap-1.5 text-emerald-800">
                      <CheckCircle2 className="size-4 text-emerald-600" />
                      {tr("reception:receptionBillingPages.settled")}</span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-amber-900">
                      <AlertCircle className="size-4 text-amber-600" />
                      {tr("reception:cashier.balanceDue2")}</span>
                  )}
                </span>
                <span className="billing-status-amount">
                  {money(balance)}
                </span>
              </div>
              {isPaidInFull && <p className="billing-status-sub">{tr("reception:receptionBillingPages.fullyPaid")}</p>}
            </div>

            {!i ? (
              <div className="space-y-3 pt-1">
                {!overdue && canIssue(p.booking, p.pendingOrderCount, null) ? (
                  <DeskAction
                    path={`/bookings/${id}/invoice`}
                    action="invoice"
                    label={tr("reception:receptionBillingPages.issueInvoice")}
                    description={tr("reception:receptionBillingPages.finalizeInvoiceValueForValueChargesCannotBeAddedOrChangedAfter", { value0: (b.reference), value1: (money(amount)) })}
                    variant="primary"
                    className="billing-main-action"
                  />
                ) : (
                  <div className="billing-blocked flex items-start gap-2.5">
                    <AlertCircle className="size-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-xs leading-relaxed text-amber-800 m-0">
                      {overdue ? tr("reception:receptionBillingPages.confirmOverdueChargesThroughTodayFirst")
                        : p.pendingOrderCount > 0
                        ? tr("reception:receptionBillingPages.resolvePendingServiceOrdersOnTheLeftFirst")
                        : tr("reception:receptionBillingPages.anInvoiceCanOnlyBeIssuedForAnInHouseGuest")}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3 pt-1">
                <DeskLink className="billing-invoice-btn" to={`${base}/invoices/${i.id}`}>
                  <Receipt className="size-4" />
                  {tr("reception:receptionBillingPages.viewPrintInvoice")}</DeskLink>
                {i.status !== "PAID" && b.status !== "CANCELLED" && (
                  <PaymentForm key={i.id} invoice={i} />
                )}
                {!overdue && canCheckout(p.booking, p.pendingOrderCount, i) && (
                  <DeskAction
                    path={`/bookings/${id}/check-out`}
                    action="check-out"
                    label={tr("reception:receptionBillingPages.confirmCheckOut")}
                    description={tr("reception:receptionBillingPages.checkOutRoomValueForValue", { value0: (b.roomNumber), value1: (b.customer?.fullName ?? tr("common:supplement.guest")) })}
                    variant="primary"
                    className="billing-main-action"
                    onDone={(result) => setCheckoutResult(result as Checkout)}
                  />
                )}
                {b.status === "CHECKED_OUT" && (
                  <p className="billing-success flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                    {tr("reception:receptionBillingPages.checkedOutTheRoomIsNowAwaitingCleaning")}</p>
                )}
                {i.status === "PAID" && b.status === "CHECKED_IN" && p.pendingOrderCount > 0 && (
                  <p className="billing-blocked flex items-start gap-2">
                    <AlertCircle className="size-4 text-amber-600 shrink-0 mt-0.5" />
                    {tr("reception:receptionBillingPages.resolvePendingServicesBeforeCheckOut")}</p>
                )}
              </div>
            )}
            {checkoutResult && (
              <p role="status" className="billing-success flex items-center gap-2 mt-3">
                <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                {tr("common:supplement.checkoutRoomNeedsCleaning", { value0: b.roomNumber })}</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

export function ReceptionInvoicePage() {
  useLocale();
  const [checkoutResult, setCheckoutResult] = useState<Checkout | null>(null);
  const { id = "" } = useParams();
  const base = useDeskBase();

  const query = useDeskGet<Invoice>("/invoices/" + id);
  const preview = useDeskGet<Preview>(
    `/bookings/${query.data?.bookingId ?? ""}/billing-preview`,
    !!query.data,
  );
  const guest = useDeskGet<DeskBooking>(
    `/front-desk/bookings/${query.data?.bookingId ?? ""}`,
    !!query.data,
  );

  if (query.isPending) return <Skeleton />;
  if (query.error) {
    return (
      <ErrorState
        message={safeError(query.error)}
        retry={() => void query.refetch()}
      />
    );
  }

  const i = query.data!;
  const isPaid = i.status === "PAID" || Number(i.balance) <= 0;
  const rawName = guest.data?.customer?.fullName || (i.booking as { customer?: { fullName?: string } }).customer?.fullName || tr("reception:cashier.walkInGuest");
  const guestName = rawName
    .split(" ")
    .filter(Boolean)
    .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  return (
    <div className="print-document desk-page space-y-5 max-w-5xl mx-auto pb-12">
      {/* Top Breadcrumb */}
      <div>
        <DeskBackLink
          to={`${base}/bookings/${i.bookingId}/billing`}
          className="billing-back print-hidden"
        >
          <ArrowLeft className="size-3.5" /> {tr("reception:receptionBillingPages.backToReservationCharges")}</DeskBackLink>
      </div>

      {/* Header Card */}
      <header className="billing-header-card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 flex-wrap items-center gap-4">
            <div className="billing-room-hero">
              <span className="billing-room-hero-num">{i.booking.roomNumber}</span>
              <span className="billing-room-hero-label">{tr("reception:reservationPanels.room")}</span>
            </div>
            <div className="min-w-0 max-w-full">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="billing-guest-name">{tr("reception:receptionBillingPages.invoiceValue", { value0: (i.id.slice(0, 8)) })}</h1>
                <Badge tone={isPaid ? "green" : "amber"} className="text-xs px-2.5 py-0.5 font-semibold">
                  {isPaid ? tr("reception:cashier.paid") : tr("reception:receptionBillingPages.unpaid")}
                </Badge>
                <Badge tone={i.booking.status === "CHECKED_OUT" ? "zinc" : i.booking.status === "CHECKED_IN" ? "green" : "sky"} className="text-xs px-2.5 py-0.5 font-semibold">
                  {statusLabels[i.booking.status]}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 text-xs text-zinc-500 mt-1">
                <span className="font-semibold text-zinc-800">{guestName}</span>
                <span className="text-zinc-300">•</span>
                <span><Trans ns="reception" i18nKey="reservationPanels.codeValue" values={{ value0: (i.booking.reference) }} components={{ part0: <strong className="text-zinc-700 font-mono" /> }} /></span>
                <span className="text-zinc-300">•</span>
                <span>{new Date(i.issuedAt).toLocaleString(displayLocale(), { timeZone: 'Asia/Ho_Chi_Minh' })}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5"
            >
              <Printer className="size-3.5" /> {tr("reception:receptionBillingPages.printInvoice")}</Button>
          </div>
        </div>
      </header>

      {/* Financial Breakdown & Payments Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Folio Breakdown */}
        <Card>
          <CardHeader className="pb-3 border-b border-zinc-100">
            <CardTitle className="text-sm font-bold text-zinc-900 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Receipt className="size-4 text-emerald-700" />
                {tr("reception:receptionBillingPages.statementOfCharges")}</span>
              <span className="text-xs text-zinc-400 font-normal">{tr("reception:cashier.roomValue", { value0: (i.booking.roomNumber) })}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-3">
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-zinc-100">
                <span className="text-zinc-600">{tr("reception:receptionBillingPages.roomChargesValueNights", { value0: (i.booking.nights) })}</span>
                <span className="font-semibold text-zinc-900 tabular-nums">{money(i.roomAmount)}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-zinc-100">
                <span className="text-zinc-600">{tr("reception:receptionBillingPages.roomService")}</span>
                <span className="font-semibold text-zinc-900 tabular-nums">{money(i.serviceAmount)}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-t border-zinc-200 text-sm font-bold">
                <span className="text-zinc-900">{tr("reception:receptionBillingPages.invoiceTotal")}</span>
                <span className="text-zinc-900 tabular-nums">{money(i.totalAmount)}</span>
              </div>
              <div className="flex items-center justify-between py-1.5 text-emerald-700 font-medium">
                <span>{tr("reception:cashier.paid")}</span>
                <span className="tabular-nums font-semibold">- {money(i.paidAmount)}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-t border-zinc-200 text-sm font-bold">
                <span className={Number(i.balance) > 0 ? "text-rose-700" : "text-emerald-800"}>
                  {Number(i.balance) > 0 ? tr("reception:cashier.balanceDue") : tr("reception:receptionBillingPages.remainingBalance")}
                </span>
                <span className={`tabular-nums ${Number(i.balance) > 0 ? "text-rose-700" : "text-emerald-800 font-black text-base"}`}>
                  {money(i.balance)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Either Payment Form (if unpaid) or Receipts Table (if paid) */}
        {!isPaid ? (
          <Card>
            <CardHeader className="pb-3 border-b border-zinc-100">
              <CardTitle className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                <CreditCard className="size-4 text-emerald-700" />
                {tr("reception:receptionBillingPages.cashierPayments")}</CardTitle>
            </CardHeader>
            <CardContent className="pt-3">
              <PaymentForm key={id} invoice={i} />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-2 border-b border-zinc-100">
              <CardTitle className="text-sm font-bold text-zinc-900 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <CreditCard className="size-4 text-emerald-700" />
                  {tr("common:supplement.paymentReceipts", { count: i.payments.length })}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              <Table
                caption={tr("reception:receptionBillingPages.paymentList")}
                rows={i.payments}
                rowKey={(p) => p.id}
                columns={[
                  {
                    title: tr("reception:receptionBillingPages.receiptId"),
                    render: (p) => (
                      <span className="font-mono text-xs text-zinc-700 font-medium">
                        #{p.id.slice(0, 8)}
                      </span>
                    ),
                  },
                  {
                    title: tr("reception:receptionBillingPages.amount"),
                    render: (p) => (
                      <span className="font-bold text-xs text-zinc-900 tabular-nums">
                        {money(p.amount)}
                      </span>
                    ),
                  },
                  {
                    title: tr("reception:receptionBillingPages.method"),
                    render: (p) => (
                      <span className="text-xs text-zinc-700">
                        {p.method === "CASH" ? tr("reception:cashier.cash") : tr("reception:cashier.bankTransfer")}
                      </span>
                    ),
                  },
                  {
                    title: tr("reception:receptionBillingPages.time"),
                    render: (p) => (
                      <span className="text-xs text-zinc-500">
                        {p.paidAt ? new Date(p.paidAt).toLocaleTimeString(displayLocale(), { timeZone: 'Asia/Ho_Chi_Minh', hour: "2-digit", minute: "2-digit" }) : "—"}
                      </span>
                    ),
                  },
                ]}
              />
            </CardContent>
          </Card>
        )}
      </div>

      {/* If unpaid, show Receipts below */}
      {!isPaid && i.payments.length > 0 && (
        <Card>
          <CardHeader className="pb-2 border-b border-zinc-100">
            <CardTitle className="text-sm font-bold text-zinc-900">{tr("reception:receptionBillingPages.collectedReceiptsValue", { value0: (i.payments.length) })}</CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <Table
              caption={tr("reception:receptionBillingPages.paymentList")}
              rows={i.payments}
              rowKey={(p) => p.id}
              columns={[
                {
                  title: tr("reception:receptionBillingPages.code"),
                  render: (p) => <span className="font-mono text-xs">#{p.id.slice(0, 8)}</span>,
                },
                {
                  title: tr("reception:receptionBillingPages.amount"),
                  render: (p) => <strong className="text-xs tabular-nums">{money(p.amount)}</strong>,
                },
                {
                  title: tr("reception:receptionBillingPages.method"),
                  render: (p) => <span className="text-xs">{p.method === "CASH" ? tr("reception:cashier.cash") : tr("reception:cashier.bankTransfer")}</span>,
                },
                {
                  title: tr("reception:receptionBillingPages.time"),
                  render: (p) => <span className="text-xs text-zinc-500">{p.paidAt ? new Date(p.paidAt).toLocaleString(displayLocale(), { timeZone: 'Asia/Ho_Chi_Minh' }) : "—"}</span>,
                },
              ]}
            />
          </CardContent>
        </Card>
      )}

      {/* Check-Out Quick Action (if in-house & ready) */}
      {i.booking.status === "CHECKED_IN" && preview.data && canCheckout(i.booking, preview.data.pendingOrderCount, i) && (
        <div className="print-hidden flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="size-5 text-emerald-600 shrink-0" />
            <span className="text-sm font-bold text-emerald-950">{tr("reception:receptionBillingPages.invoiceSettledReadyForCheckOut")}</span>
          </div>
          <DeskAction
            path={`/bookings/${i.bookingId}/check-out`}
            action="check-out"
            label={tr("reception:receptionBillingPages.confirmCheckOut")}
            description=""
            variant="primary"
            onDone={(data) => setCheckoutResult(data as Checkout)}
          />
        </div>
      )}

      {checkoutResult && (
        <p role="status" className="billing-success flex items-center gap-2">
          <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
          {tr("common:supplement.checkoutRoomAwaitingCleaning", { value0: i.booking.roomNumber })}</p>
      )}
    </div>
  );
}

function PendingServiceQueue({ bookingId }: { bookingId: string }) {
  useLocale();
  const [page, setPage] = useState(1);
  const query = useDeskGet<Page<Order>>(
    `/front-desk/orders?bookingId=${bookingId}&view=checkout&page=${page}&pageSize=5`,
  );

  if (query.isPending) return <Skeleton />;
  if (query.error) {
    return (
      <ErrorState
        message={safeError(query.error)}
        retry={() => void query.refetch()}
      />
    );
  }

  const orders = query.data?.data ?? [];
  if (orders.length === 0) return null;

  return (
    <div className="space-y-3" aria-label={tr("reception:receptionBillingPages.servicesToResolveBeforeCheckOut")}>
      {orders.map((o) => (
        <div
          key={o.id}
          className="rounded-xl border border-amber-200/90 bg-white p-3.5 shadow-2xs space-y-3"
        >
          <div className="flex items-center justify-between text-xs pb-2 border-b border-zinc-100">
            <div className="flex items-center gap-2">
              <span className="font-bold text-zinc-900 font-mono">{tr("reception:receptionBillingPages.orderValue", { value0: (o.id.slice(0, 8)) })}</span>
              <Badge tone="amber">{o.requestedPaymentMethod && !o.paymentMethod ? tr("reception:contracts.awaitingPayment") : tr("reception:receptionBillingPages.awaitingRecording")}</Badge>
            </div>
            <div className="text-xs font-semibold text-zinc-600"><Trans ns="reception" i18nKey="receptionBillingPages.orderTotalValue" values={{ value0: (money(o.totalAmount)) }} components={{ part0: <strong className="text-sm font-bold text-zinc-900 tabular-nums" /> }} /></div>
          </div>

          <div className="rounded-lg border border-zinc-100 bg-zinc-50/60 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-200/60 text-zinc-500 font-medium text-left">
                  <th className="py-2 px-3">{tr("reception:cashier.services")}</th>
                  <th className="py-2 px-3 text-center">{tr("reception:receptionBillingPages.qty")}</th>
                  <th className="py-2 px-3 text-right">{tr("reception:receptionBillingPages.unitPrice2")}</th>
                  <th className="py-2 px-3 text-right">{tr("reception:reservationPanels.subtotal")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {o.items.map((item) => (
                  <tr key={item.id} className="text-zinc-800">
                    <td className="py-2 px-3 font-medium text-zinc-900">
                      {catalogName(cleanServiceName(item.serviceName))}
                    </td>
                    <td className="py-2 px-3 text-center tabular-nums text-zinc-600">
                      {item.quantity}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums text-zinc-600">
                      {money(item.unitPrice)}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums font-semibold text-zinc-900">
                      {money(item.subtotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <ServiceOrderActions order={o} />
          </div>
        </div>
      ))}
      {query.data!.meta.totalPages > 1 && (
        <Pagination {...query.data!.meta} onChange={setPage} />
      )}
    </div>
  );
}
