import { useState } from "react";
import { Link } from "react-router";
import { ErrorState, Pagination, Table } from "../../components/ui";
import { GuestBadge, Skeleton } from "../guest/components";
import { money, type Order, type Page, type Preview } from "../guest/contracts";
import { useDeskBase, useDeskGet, useDeskInvoice } from "./queries";

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
                <dt>Dịch vụ hoàn thành</dt>
                <dd>{money(preview.data!.serviceAmount)}</dd>
              </div>
              <div>
                <dt>Tổng dự kiến</dt>
                <dd>{money(preview.data!.totalAmount)}</dd>
              </div>
            </dl>
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
                  render: (o) => <GuestBadge status={o.status} />,
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
  return invoice.isPending ? (
    <Skeleton />
  ) : invoice.error ? (
    <ErrorState message={invoice.error.message} />
  ) : invoice.data ? (
    <dl className="guest-facts">
      <div>
        <dt>Phòng / booking</dt>
        <dd>
          {invoice.data.booking.roomNumber} · {invoice.data.booking.reference}
        </dd>
      </div>
      <div>
        <dt>Tiền phòng</dt>
        <dd>{money(invoice.data.roomAmount)}</dd>
      </div>
      <div>
        <dt>Dịch vụ</dt>
        <dd>{money(invoice.data.serviceAmount)}</dd>
      </div>
      <div>
        <dt>Tổng hóa đơn</dt>
        <dd>{money(invoice.data.totalAmount)}</dd>
      </div>
      <div>
        <dt>Đã thanh toán</dt>
        <dd>{money(invoice.data.paidAmount)}</dd>
      </div>
      <div>
        <dt>Còn phải thu</dt>
        <dd>{money(invoice.data.balance)}</dd>
      </div>
    </dl>
  ) : (
    <p role="alert">Chưa có hóa đơn.</p>
  );
}
