import { useState } from "react";
import { Link } from "react-router";
import { ErrorState, Pagination, Table } from "../../components/ui";
import { Skeleton } from "../guest/components";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { money, cents, decimal, type Order, type Page, type Preview } from "../guest/contracts";
import { useDeskBase, useDeskGet, useDeskInvoice } from "./queries";
import { serviceOrderLabel } from './service-order-label';

export function ReservationPanels({ bookingId }: { bookingId: string }) {
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
        aria-label="Thông tin kỳ nghỉ"
      >
        {[
          ["charges", "Chi phí"],
          ["orders", "Dịch vụ"],
          ["payments", "Thanh toán"],
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
            message={preview.error.message}
            retry={() => void preview.refetch()}
          />
        ) : (
          <>
            <dl className="guest-facts">
              <div>
                <dt>Tiền phòng</dt>
                <dd>{money(preview.data!.roomAmount)}</dd>
              </div>
              <div>
                <dt>Dịch vụ ghi vào phòng</dt>
                <dd>{money(preview.data!.serviceAmount)}</dd>
              </div>
              <div>
                <dt>Tổng dự kiến</dt>
                <dd>{money(preview.data!.totalAmount)}</dd>
              </div>
            </dl>
            {preview.data!.counterPaidAmount && <p>Dịch vụ đã thu riêng: {money(preview.data!.counterPaidAmount)}.</p>}
            <p>{preview.data!.pendingOrderCount} đơn dịch vụ chờ xử lý.</p>
            <Link to={`${base}/bookings/${bookingId}/billing`}>
              Chi phí & hóa đơn →
            </Link>
          </>
        ))}
      {tab === "orders" &&
        (orders.isPending ? (
          <Skeleton />
        ) : orders.error ? (
          <ErrorState
            message={orders.error.message}
            retry={() => void orders.refetch()}
          />
        ) : (
          <>
            <Table
              caption="Dịch vụ của kỳ nghỉ"
              rows={orders.data!.data}
              rowKey={(o) => o.id}
              columns={[
                {
                  title: "Dịch vụ",
                  render: (o) => (
                    <Link to={`${base}/service-orders/${o.id}`}>
                      {o.items
                        .map((i) => `${i.serviceName} × ${i.quantity}`)
                        .join(", ")}
                    </Link>
                  ),
                },
                {
                  title: "Trạng thái",
                  render: (o) => serviceOrderLabel(o),
                },
                { title: "Thành tiền", render: (o) => money(o.totalAmount) },
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
            message={invoice.error.message}
            retry={() => void invoice.refetch()}
          />
        ) : invoice.data ? (
          <>
            <dl className="guest-facts">
              <div>
                <dt>Đã thanh toán</dt>
                <dd>{money(invoice.data.paidAmount)}</dd>
              </div>
              <div>
                <dt>Còn phải thu</dt>
                <dd>{money(invoice.data.balance)}</dd>
              </div>
            </dl>
            <Table
              caption="Thanh toán của kỳ nghỉ"
              rows={invoice.data.payments}
              rowKey={(p) => p.id}
              columns={[
                { title: "Phương thức", render: (p) => p.method },
                { title: "Số tiền", render: (p) => money(p.amount) },
                { title: "Trạng thái", render: (p) => p.status },
              ]}
            />
            <Link to={`${base}/invoices/${invoice.data.id}`}>
              Mở hóa đơn & biên nhận →
            </Link>
          </>
        ) : (
          <p>Chưa phát hành hóa đơn.</p>
        ))}
    </section>
  );
}

export function CheckoutSummary({ bookingId }: { bookingId: string }) {
  const invoice = useDeskInvoice(bookingId);
  const preview = useDeskGet<Preview>(`/bookings/${bookingId}/billing-preview`);

  if (invoice.isPending || preview.isPending) return <Skeleton />;
  if (invoice.error) return <ErrorState message={invoice.error.message} />;
  const inv = invoice.data;
  if (!inv) return <p role="alert">Chưa có hóa đơn.</p>;

  const prev = preview.data;
  const separatePaid = prev?.counterPaidAmount ?? "0";
  const overallTotal = decimal(cents(inv.totalAmount) + cents(separatePaid));
  const isSettled = Number(inv.balance) <= 0;

  const rawName = (prev?.booking as { customer?: { fullName?: string } } | undefined)?.customer?.fullName || (inv.booking as { customer?: { fullName?: string } }).customer?.fullName || "Khách tại quầy";
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
          <span className="checkout-dialog-room-tag">Phòng</span>
        </div>
        <div className="checkout-dialog-guest-meta">
          <h3 className="checkout-dialog-guest-name">{guestName}</h3>
          <p className="checkout-dialog-ref">
            Mã: <strong>{inv.booking.reference}</strong>
          </p>
        </div>
      </div>

      {/* Financial Status Summary */}
      <div className={`checkout-dialog-finance ${isSettled ? "checkout-finance-settled" : "checkout-finance-due"}`}>
        <div className="checkout-dialog-row">
          <span className="text-xs text-zinc-600 font-medium">Tổng chi phí</span>
          <strong className="text-sm font-bold text-zinc-900 tabular-nums">{money(overallTotal)}</strong>
        </div>
        <div className="checkout-dialog-row mt-1.5 pt-1.5 border-t border-zinc-200/60">
          <span className="text-xs text-zinc-600 font-medium">Thanh toán</span>
          {isSettled ? (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
              <CheckCircle2 className="size-3.5 text-emerald-600" />
              Đã tất toán (0 đ)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-700">
              <AlertCircle className="size-3.5 text-rose-600" />
              Còn nợ: {money(inv.balance)}
            </span>
          )}
        </div>
      </div>

    </div>
  );
}
