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
  { id: "departures", label: "Cần thu khi trả phòng", hint: "Khách đang ở, trả phòng vào ngày đã chọn" },
  { id: "outstanding", label: "Còn phải thu", hint: "Tất cả booking còn khoản chưa thanh toán" },
  { id: "paid", label: "Đã thanh toán đủ", hint: "Tra cứu hóa đơn và khoản thu" },
] as const;

export function CashierPage() {
  const base = useDeskBase();
  const [group, setGroup] = useState("departures"), [date, setDate] = useState(hotelToday);
  const [search, setSearch] = useState(""), [q, setQ] = useState(""), [page, setPage] = useState(1);
  const [selected, setSelected] = useState<BillingRow | null>(null);
  const params = new URLSearchParams({ group, date, q, page: String(page), pageSize: "15" });
  const query = useDeskGet<Page<BillingRow> & { counts: Record<string, number> }>(`/front-desk/billing?${params}`);
  const selectGroup = (value: string) => { setGroup(value); setPage(1); };
  return <div className="cashier-page">
    <header className="cashier-heading">
      <div><h1>Thu ngân & hóa đơn</h1><p>Kiểm tra chi phí, ghi nhận tiền đã nhận và tra cứu hóa đơn.</p></div>
      <label>Ngày trả phòng <input aria-label="Ngày trả phòng cần thu" type="date" value={date} onChange={e => { if (e.target.value) { setDate(e.target.value); setPage(1); } }} /></label>
    </header>
    <div className="cashier-groups" aria-label="Nhóm thanh toán">
      {groups.map(g => <button key={g.id} type="button" aria-pressed={group === g.id} onClick={() => selectGroup(g.id)}>
        <span>{g.label}</span><strong>{query.data?.counts[g.id] ?? "—"}</strong><small>{g.hint}</small>
      </button>)}
    </div>
    <section className="cashier-list">
      <form className="cashier-filters" onSubmit={e => { e.preventDefault(); setQ(search.trim()); setPage(1); }}>
        <button type="button" aria-pressed={group === "all"} onClick={() => selectGroup("all")}>Tất cả ({query.data?.counts.all ?? "—"})</button>
        <input aria-label="Tìm khách, phòng hoặc mã booking" placeholder="Tên khách, số phòng, mã booking, SĐT…" value={search} onChange={e => setSearch(e.target.value)} />
        <button type="submit">Tìm kiếm</button>
      </form>
      <p className="cashier-note">Chi phí chưa có hóa đơn là tạm tính, chỉ gồm dịch vụ đã hoàn tất. Khoản thu chỉ được ghi nhận sau khi phát hành hóa đơn.</p>
      {query.isPending ? <Skeleton /> : query.error ? <ErrorState message={query.error.message} retry={() => void query.refetch()} /> : <>
        <Table caption="Danh sách thu ngân" rows={query.data!.data} rowKey={r => r.id}
          empty={<div className="cashier-empty"><strong>Không có khoản nào trong nhóm này</strong><p>Chọn “Còn phải thu” hoặc “Tất cả” để tra cứu thêm.</p><button type="button" onClick={() => selectGroup("outstanding")}>Xem khoản còn phải thu</button></div>}
          columns={[
            { title: "KHÁCH / PHÒNG", render: r => <div><strong>{r.customer?.fullName ?? "Khách tại quầy"}</strong><small>Phòng {r.roomNumber} · {r.reference}</small><small>Trả: {r.checkOut.split("-").reverse().join("/")} · {statusLabels[r.status]}</small></div> },
            { title: "TIỀN PHÒNG", render: r => money(r.roomAmount) },
            { title: "DỊCH VỤ", render: r => <div>{money(r.serviceAmount)}{r.pendingOrderCount > 0 && <small>{r.pendingOrderCount} đơn chờ xử lý</small>}</div> },
            { title: "TỔNG CHI PHÍ", render: r => <div><strong>{money(r.totalAmount)}</strong>{!r.invoiceId && <small>Tạm tính</small>}</div> },
            { title: "ĐÃ THU", render: r => money(r.paidAmount) },
            { title: "CÒN PHẢI THU", render: r => <div><strong className={r.paymentState === "OUTSTANDING" ? "cashier-balance" : ""}>{r.paymentState === "CANCELLED" || r.paymentState === "REVIEW_REFUND" ? "—" : money(r.balance)}</strong><small>{r.paymentState === "PAID" ? "Đã thanh toán đủ" : r.paymentState === "CANCELLED" ? "Booking đã hủy" : r.paymentState === "REVIEW_REFUND" ? "Cần kiểm tra hoàn tiền" : r.invoiceId ? "Chưa thanh toán đủ" : "Chưa phát hành hóa đơn"}</small></div> },
            { title: "THAO TÁC", render: r => <div className="cashier-actions"><button type="button" className="cashier-primary" onClick={() => setSelected(r)}>{r.invoiceId && r.paymentState === "OUTSTANDING" ? "Thu tiền" : "Chi tiết"}</button>{r.invoiceId && <Link to={`${base}/invoices/${r.invoiceId}`}>Hóa đơn</Link>}</div> },
          ]} />
        <footer><span>{query.data!.meta.total} booking</span><Pagination {...query.data!.meta} onChange={setPage} /></footer>
      </>}
    </section>
    {selected && <BillingDrawer booking={selected} onClose={() => setSelected(null)} />}
  </div>;
}

function BillingDrawer({ booking, onClose }: { booking: BillingRow; onClose: () => void }) {
  const base = useDeskBase();
  const invoice = useDeskInvoice(booking.id);
  return <Dialog open onClose={onClose} title="Chi tiết chi phí và thanh toán" className="cashier-drawer">
      <header><div><h2>{booking.customer?.fullName ?? "Khách tại quầy"}</h2><p>Phòng {booking.roomNumber} · {booking.reference}</p></div></header>
      {invoice.isPending ? <Skeleton /> : invoice.error ? <ErrorState message={invoice.error.message} retry={() => void invoice.refetch()} /> : <>
        <dl className="cashier-totals">{[
          ["Tiền phòng", invoice.data?.roomAmount ?? booking.roomAmount],
          ["Dịch vụ", invoice.data?.serviceAmount ?? booking.serviceAmount],
          ["Tổng chi phí", invoice.data?.totalAmount ?? booking.totalAmount],
          ["Đã thu", invoice.data?.paidAmount ?? booking.paidAmount],
          ["Còn phải thu", invoice.data?.balance ?? booking.balance],
        ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{money(value)}</dd></div>)}</dl>
        {invoice.data ? <>
          <Link className="cashier-link" to={`${base}/invoices/${invoice.data.id}`}>Xem / in hóa đơn</Link>
          {booking.status !== "CANCELLED" && <PaymentForm invoice={invoice.data} />}
          <h3>Lịch sử thanh toán</h3>
          {!invoice.data.payments.length && <p>Chưa ghi nhận khoản thu.</p>}
          {invoice.data.payments.map(p => <div className="cashier-payment" key={p.id}><div>{p.method === "CASH" ? "Tiền mặt" : "Chuyển khoản"}<small>{p.paidAt ? new Date(p.paidAt).toLocaleString("vi-VN") : "Chưa có ngày thu"}</small></div><div>{money(p.amount)} <Badge>{p.status === "COMPLETED" ? "Đã thu" : p.status === "FAILED" ? "Thất bại" : "Đang chờ"}</Badge></div></div>)}
        </> : <div className="cashier-empty"><p>{booking.status === "CANCELLED" ? "Booking đã hủy. Kiểm tra chi tiết trước khi xử lý chi phí." : "Chi phí tạm tính. Mở hồ sơ để kiểm tra dịch vụ và phát hành hóa đơn trước khi thu tiền."}</p><Link className="cashier-link" to={`${base}/bookings/${booking.id}/billing`}>Mở chi phí & phát hành hóa đơn</Link></div>}
      </>}
  </Dialog>;
}
