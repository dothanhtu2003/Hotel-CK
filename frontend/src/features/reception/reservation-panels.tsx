import { catalogName } from "../../i18n/catalog";
import { safeError, t as tr, useLocale } from "../../i18n";

import { Trans } from "react-i18next";
import { DeskLink } from "./navigation";
import { useState } from "react";
import { ErrorState, Pagination, Table } from "../../components/ui";
import { Skeleton } from "../guest/components";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { money, cents, decimal, type Order, type Page, type Preview } from "../guest/contracts";
import { useDeskBase, useDeskGet, useDeskInvoice } from "./queries";
import { serviceOrderLabel } from './service-order-label';

export function ReservationPanels({ bookingId }: { bookingId: string }) {
  useLocale();
  const [tab, setTab] = useState("charges"),
    [page, setPage] = useState(1),
    base = useDeskBase();
  const preview = useDeskGet<Preview>(`/bookings/${bookingId}/billing-preview`);
  const invoice = useDeskInvoice(bookingId);
  const orders = useDeskGet<Page<Order>>(
    `/front-desk/orders?bookingId=${bookingId}&page=${page}&pageSize=5`,
    tab === "orders",
  );
  return (
    <section className="panel guest-box">
      <div
        className="reservation-tabs"
        role="tablist"
        aria-label={tr("reception:reservationPanels.stayInformation")}
      >
        {[
          ["charges", tr("reception:reservationPanels.charges")],
          ["orders", tr("reception:cashier.services")],
          ["payments", tr("reception:paymentForm.pay")],
        ].map(([key, title]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            className={tab === key ? "active" : ""}
            onClick={() => setTab(key)}
          >
            {title}
          </button>
        ))}
      </div>
      {tab === "charges" &&
        (preview.isPending ? (
          <Skeleton />
        ) : preview.error ? (
          <ErrorState
            message={safeError(preview.error)}
            retry={() => void preview.refetch()}
          />
        ) : (
          <>
            <dl className="guest-facts">
              <div>
                <dt>{tr("reception:cashier.roomCharges")}</dt>
                <dd>{money(preview.data!.roomAmount)}</dd>
              </div>
              <div>
                <dt>{tr("reception:reservationPanels.servicesChargedToRoom")}</dt>
                <dd>{money(preview.data!.serviceAmount)}</dd>
              </div>
              <div>
                <dt>{tr("reception:reservationPanels.estimatedTotal")}</dt>
                <dd>{money(preview.data!.totalAmount)}</dd>
              </div>
            </dl>
            {preview.data!.counterPaidAmount && <p>{tr("reception:reservationPanels.servicesPaidSeparatelyValue", { value0: (money(preview.data!.counterPaidAmount)) })}</p>}
            <p>{tr("reception:reservationPanels.valueServiceOrdersPending", { value0: (preview.data!.pendingOrderCount) })}</p>
            <DeskLink to={`${base}/bookings/${bookingId}/billing`}>{tr("reception:reservationPanels.chargesInvoice")}</DeskLink>
          </>
        ))}
      {tab === "orders" &&
        (orders.isPending ? (
          <Skeleton />
        ) : orders.error ? (
          <ErrorState
            message={safeError(orders.error)}
            retry={() => void orders.refetch()}
          />
        ) : (
          <>
            <Table
              caption={tr("reception:reservationPanels.servicesDuringThisStay")}
              rows={orders.data!.data}
              rowKey={(o) => o.id}
              columns={[
                {
                  title: tr("reception:cashier.services"),
                  render: (o) => (
                    <DeskLink to={`${base}/service-orders/${o.id}`}>
                      {o.items
                        .map((i) => tr("reception:reservationPanels.valueValue", { value0: (catalogName(i.serviceName)), value1: (i.quantity) }))
                        .join(", ")}
                    </DeskLink>
                  ),
                },
                {
                  title: tr("reception:reservationPanels.status"),
                  render: (o) => serviceOrderLabel(o),
                },
                { title: tr("reception:reservationPanels.subtotal"), render: (o) => money(o.totalAmount) },
              ]}
            />
            <Pagination {...orders.data!.meta} onChange={setPage} />
          </>
        ))}
      {tab === "payments" &&
        (invoice.isPending ? (
          <Skeleton />
        ) : invoice.error ? (
          <ErrorState
            message={safeError(invoice.error)}
            retry={() => void invoice.refetch()}
          />
        ) : invoice.data ? (
          <>
            <dl className="guest-facts">
              <div>
                <dt>{tr("reception:cashier.paid")}</dt>
                <dd>{money(invoice.data.paidAmount)}</dd>
              </div>
              <div>
                <dt>{tr("reception:cashier.balanceDue")}</dt>
                <dd>{money(invoice.data.balance)}</dd>
              </div>
            </dl>
            <Table
              caption={tr("reception:reservationPanels.stayPayments")}
              rows={invoice.data.payments}
              rowKey={(p) => p.id}
              columns={[
                { title: tr("reception:paymentForm.method"), render: (p) => p.method },
                { title: tr("reception:reservationPanels.amount"), render: (p) => money(p.amount) },
                { title: tr("reception:reservationPanels.status"), render: (p) => p.status },
              ]}
            />
            <DeskLink to={`${base}/invoices/${invoice.data.id}`}>{tr("reception:reservationPanels.openInvoiceReceipts")}</DeskLink>
          </>
        ) : (
          <p>{tr("reception:reservationPanels.invoiceNotIssuedYet")}</p>
        ))}
    </section>
  );
}

export function CheckoutSummary({ bookingId }: { bookingId: string }) {
  useLocale();
  const customer = useDeskGet<{ customer?: { fullName?: string } }>(`/front-desk/bookings/${bookingId}`);
  const invoice = useDeskInvoice(bookingId);
  const preview = useDeskGet<Preview>(`/bookings/${bookingId}/billing-preview`);

  if (invoice.isPending || preview.isPending || customer.isPending) return <Skeleton />;
  if (invoice.error || customer.error) return <ErrorState message={safeError((invoice.error || customer.error)!)} />;
  const inv = invoice.data;
  if (!inv) return <p role="alert">{tr("reception:reservationPanels.noInvoiceYet")}</p>;

  const prev = preview.data;
  const separatePaid = prev?.counterPaidAmount ?? "0";
  const overallTotal = decimal(cents(inv.totalAmount) + cents(separatePaid));
  const isSettled = Number(inv.balance) <= 0;

  const rawName = customer.data?.customer?.fullName?.trim() || (prev?.booking as { customer?: { fullName?: string } } | undefined)?.customer?.fullName || (inv.booking as { customer?: { fullName?: string } }).customer?.fullName || tr("reception:cashier.walkInGuest");
  const guestName = rawName
    .split(" ")
    .filter(Boolean)
    .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  return (
    <div className="checkout-dialog-content">
      {/* Room & Guest Hero Banner */}
      <div className="checkout-dialog-guest">
        <div className="checkout-dialog-room">
          <span className="checkout-dialog-room-num">{inv.booking.roomNumber}</span>
          <span className="checkout-dialog-room-tag">{tr("reception:reservationPanels.room")}</span>
        </div>
        <div className="checkout-dialog-guest-meta">
          <h3 className="checkout-dialog-guest-name">{guestName}</h3>
          <p className="checkout-dialog-ref"><Trans ns="reception" i18nKey="reservationPanels.codeValue" values={{ value0: (inv.booking.reference) }} components={{ part0: <strong /> }} /></p>
        </div>
      </div>

      {/* Financial Status Summary */}
      <div className={`checkout-dialog-finance ${isSettled ? "checkout-finance-settled" : "checkout-finance-due"}`}>
        <div className="checkout-dialog-row">
          <span className="text-xs text-zinc-600 font-medium">{tr("reception:cashier.totalCharges")}</span>
          <strong className="text-sm font-bold text-zinc-900 tabular-nums">{money(overallTotal)}</strong>
        </div>
        <div className="checkout-dialog-row mt-1.5 pt-1.5 border-t border-zinc-200/60">
          <span className="text-xs text-zinc-600 font-medium">{tr("reception:paymentForm.pay")}</span>
          {isSettled ? (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
              <CheckCircle2 className="size-3.5 text-emerald-600" />
              {tr("reception:reservationPanels.settledVnd0")}</span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-700">
              <AlertCircle className="size-3.5 text-rose-600" />
              {tr("reception:reservationPanels.balanceDue")}{money(inv.balance)}
            </span>
          )}
        </div>
      </div>

    </div>
  );
}
