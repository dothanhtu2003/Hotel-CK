import "../features/reception/billing-workspace.css";
import { useState } from "react";
import { Link, useParams } from "react-router";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  LogOut,
  Receipt,
    Users,
} from "lucide-react";
import {
  ErrorState,
  Pagination,
  Table,
} from "../components/ui";
import { Skeleton } from "../features/guest/components";
import {
  money,
  statusLabels,
  type Invoice,
  type Order,
  type Page,
  type Preview,
} from "../features/guest/contracts";
import { DeskAction, OrderItems } from "../features/reception/components";
import {
  canCheckout,
  canIssue,
  type Checkout,
  type DeskBooking,
} from "../features/reception/contracts";
import { PaymentForm } from "../features/reception/payment-form";
import {
  useDeskBase,
  useDeskGet,
  useDeskInvoice,
} from "../features/reception/queries";
import {
  Avatar,
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  StatCard,
} from "../components/kamra-ui";

export function ReceptionBillingPage() {
  const { id = "" } = useParams();
  const base = useDeskBase();
  const [checkoutResult, setCheckoutResult] = useState<Checkout | null>(null);
  const guest = useDeskGet<DeskBooking>(`/front-desk/bookings/${id}`);
  const preview = useDeskGet<Preview>(`/bookings/${id}/billing-preview`);
  const invoice = useDeskInvoice(id);
  if (guest.isPending || preview.isPending || invoice.isPending) return <Skeleton />;
  const error = guest.error || preview.error || invoice.error;
  if (error) return <ErrorState message={error.message} retry={() => { void guest.refetch(); void preview.refetch(); void invoice.refetch(); }} />;
  const b = guest.data!, p = preview.data!, i = invoice.data;
  const formatDate = (value: string) => value.split("-").reverse().join("/");
  const amount = i?.totalAmount ?? p.totalAmount;
  const paid = i?.paidAmount ?? "0";
  const balance = i?.balance ?? p.totalAmount;
  return <div className="billing-workspace">
    <Link className="billing-back" to={`${base}/billing`}><ArrowLeft className="size-4" /> Danh sách thu ngân</Link>
    <header className="billing-title">
      <div><h1>Thanh toán & trả phòng</h1><p>Phòng {b.roomNumber} · {b.customer?.fullName ?? "Khách tại quầy"}</p></div>
      <Badge tone={b.status === "CHECKED_IN" ? "green" : "zinc"}>{statusLabels[b.status]}</Badge>
    </header>
    <div className="billing-context"><span>{formatDate(b.checkIn)} → {formatDate(b.checkOut)} · {b.nights} đêm</span><Link to={`${base}/bookings/${id}`}>Hồ sơ {b.reference}</Link></div>
    <div className="billing-columns">
      <main className="billing-breakdown">
        <section className="billing-box">
          <h2>Chi tiết chi phí</h2>
          <div className="billing-line"><div><strong>Tiền phòng {b.roomNumber}</strong><small>{b.nights} đêm · {formatDate(b.checkIn)} → {formatDate(b.checkOut)}</small></div><strong>{money(i?.roomAmount ?? p.roomAmount)}</strong></div>
          <div className="billing-line"><span>Dịch vụ đã hoàn thành</span><strong>{money(i?.serviceAmount ?? p.serviceAmount)}</strong></div>
          <div className="billing-line billing-total"><strong>Tổng chi phí{i ? "" : " tạm tính"}</strong><strong>{money(amount)}</strong></div>
          {!i && <p className="billing-help">Chỉ dịch vụ đã hoàn thành được tính tiền. Kiểm tra các khoản bên dưới trước khi chốt hóa đơn.</p>}
        </section>
        {p.pendingOrderCount > 0 && <section className="billing-pending"><h2>Cần xử lý {p.pendingOrderCount} đơn dịch vụ</h2><p>Hoàn thành hoặc hủy các đơn này trước khi phát hành hóa đơn.</p><PendingServiceQueue bookingId={id} /></section>}
        <section className="billing-box">
          <h2>Dịch vụ đã sử dụng</h2>
          {!p.completedOrders.length ? <p className="billing-help">Chưa phát sinh dịch vụ đã hoàn thành.</p> : <Table caption="Dịch vụ đã hoàn thành" rows={p.completedOrders.flatMap(o => o.items.map(item => ({ ...item, key: `${o.id}-${item.id ?? item.serviceName}` })))} rowKey={item => item.key} columns={[
            { title: "DỊCH VỤ", render: item => item.serviceName },
            { title: "SL", render: item => item.quantity },
            { title: "ĐƠN GIÁ", render: item => money(item.unitPrice) },
            { title: "THÀNH TIỀN", render: item => money(item.subtotal) },
          ]} />}
        </section>
        {i && <details className="billing-box"><summary>Lịch sử thanh toán ({i.payments.length})</summary>{i.payments.length === 0 ? <p className="billing-help">Chưa ghi nhận khoản thu.</p> : i.payments.map(payment => <div className="billing-line" key={payment.id}><div>{payment.method === "CASH" ? "Tiền mặt" : "Chuyển khoản"}<small>{payment.paidAt ? new Date(payment.paidAt).toLocaleString("vi-VN") : "Chưa ghi nhận"} · {payment.status === "COMPLETED" ? "Đã thu" : payment.status === "FAILED" ? "Thất bại" : "Đang chờ"}</small></div><strong>{money(payment.amount)}</strong></div>)}</details>}
      </main>
      <aside className="billing-checkout">
        <section className="billing-box billing-summary">
          <h2>{i ? "Thanh toán" : "Chốt hóa đơn"}</h2>
          <div className="billing-line"><span>Tổng chi phí</span><strong>{money(amount)}</strong></div>
          <div className="billing-line"><span>Đã thu</span><strong>{money(paid)}</strong></div>
          <div className="billing-due"><span>{i ? "Còn phải thu" : "Cần thanh toán · tạm tính"}</span><strong>{money(balance)}</strong></div>
          {!i ? <>
            {canIssue(p.booking, p.pendingOrderCount, null) ? <><p className="billing-help">Các dịch vụ đã xử lý xong. Phát hành hóa đơn để chốt chi phí và bắt đầu thu tiền.</p><DeskAction path={`/bookings/${id}/invoice`} action="invoice" label="Phát hành hóa đơn" description={`Chốt hóa đơn ${b.reference} với tổng tiền ${money(amount)}? Sau khi phát hành, không thể thêm hoặc sửa chi phí.`} variant="primary" className="billing-main-action" /></> : <p className="billing-blocked">{p.pendingOrderCount > 0 ? "Hãy xử lý các đơn dịch vụ đang chờ ở bên trái trước." : "Chỉ phát hành hóa đơn khi khách đang lưu trú."}</p>}
            <p className="billing-help">Sau khi phát hành, không thể thêm hoặc sửa chi phí.</p>
          </> : <>
            <Link className="billing-invoice-link" to={`${base}/invoices/${i.id}`}>Xem / in hóa đơn</Link>
            {i.status !== "PAID" && b.status !== "CANCELLED" && <PaymentForm key={i.id} invoice={i} />}
            {i.status === "PAID" && <p className="billing-success">Đã thanh toán đủ.</p>}
            {canCheckout(p.booking, p.pendingOrderCount, i) && <DeskAction path={`/bookings/${id}/check-out`} action="check-out" label="Xác nhận trả phòng" description={`Trả phòng ${b.roomNumber} cho ${b.customer?.fullName ?? "khách"}?`} variant="primary" className="billing-main-action" onDone={result => setCheckoutResult(result as Checkout)} />}
            {b.status === "CHECKED_OUT" && <p className="billing-success">Đã trả phòng. Phòng đã chuyển sang chờ dọn.</p>}
            {i.status === "PAID" && b.status === "CHECKED_IN" && p.pendingOrderCount > 0 && <p className="billing-blocked">Cần xử lý dịch vụ đang chờ trước khi trả phòng.</p>}
          </>}
          {checkoutResult && <p role="status" className="billing-success">Trả phòng thành công · Phòng {b.roomNumber} cần dọn.</p>}
        </section>
      </aside>
    </div>
  </div>;
}

export function ReceptionInvoicePage() {
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
        message={query.error.message}
        retry={() => void query.refetch()}
      />
    );
  }

  const i = query.data!;
  const isPaid = i.status === "PAID" || Number(i.balance) <= 0;

  return (
    <div className="desk-page space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Breadcrumb & Link */}
      <div className="flex items-center justify-between">
        <Link
          to={`${base}/bookings/${i.bookingId}/billing`}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900 transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          Quay lại chi phí booking
        </Link>
        <span className="text-xs text-zinc-400 font-mono">
          Mã hóa đơn: {i.id}
        </span>
      </div>

      {/* Header & Status */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-700">
              <Receipt className="size-3.5" />
              Chi tiết hóa đơn & Quyết toán
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 mt-1">
              Hóa đơn #{i.id.slice(0, 8)}
            </h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              Phát hành lúc: {new Date(i.issuedAt).toLocaleString("vi-VN")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="status-badge" tone={isPaid ? "green" : "amber"}>
              {isPaid ? "Đã thanh toán" : "Chưa thanh toán"}
            </Badge>
            <Badge
              tone={
                i.booking.status === "CHECKED_OUT"
                  ? "zinc"
                  : i.booking.status === "CHECKED_IN"
                  ? "green"
                  : "sky"
              }
             
            >
              {i.booking.status}
            </Badge>
          </div>
        </div>

        {/* Step Flow indicator */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-2.5 text-center">
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wide block">
              ✓ Bước 1
            </span>
            <span className="text-xs font-medium text-emerald-900">
              Hóa đơn đã phát hành
            </span>
          </div>
          <div className={`rounded-lg border p-2.5 text-center ${isPaid ? "border-emerald-200 bg-emerald-50/70" : "border-brand-200 bg-brand-50/70"}`}>
            <span className={`text-[11px] font-bold uppercase tracking-wide block ${isPaid ? "text-emerald-800" : "text-brand-800"}`}>
              {isPaid ? "✓ Bước 2" : "Bước 2"}
            </span>
            <span className={`text-xs font-medium ${isPaid ? "text-emerald-900" : "text-brand-900"}`}>
              {isPaid ? "Đã thu đủ tiền" : "Ghi nhận khoản thu"}
            </span>
          </div>
          <div className={`rounded-lg border p-2.5 text-center ${i.booking.status === "CHECKED_OUT" ? "border-emerald-200 bg-emerald-50/70" : "border-zinc-200 bg-zinc-50"}`}>
            <span className={`text-[11px] font-bold uppercase tracking-wide block ${i.booking.status === "CHECKED_OUT" ? "text-emerald-800" : "text-zinc-500"}`}>
              {i.booking.status === "CHECKED_OUT" ? "✓ Bước 3" : "Bước 3"}
            </span>
            <span className={`text-xs font-medium ${i.booking.status === "CHECKED_OUT" ? "text-emerald-900" : "text-zinc-700"}`}>
              Xác nhận trả phòng
            </span>
          </div>
        </div>
      </div>

      {/* Guest Summary pill */}
      {guest.data && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-3.5 shadow-2xs text-xs">
          <div className="flex items-center gap-2.5">
            <Avatar name={guest.data.customer?.fullName ?? "Guest"} />
            <div>
              <span className="font-semibold text-zinc-900">
                {guest.data.customer?.fullName}
              </span>
              <span className="text-zinc-500 ml-2">
                Phòng <strong className="text-zinc-800">{i.booking.roomNumber}</strong>
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3 text-zinc-500">
            <span className="inline-flex items-center gap-1">
              <Calendar className="size-3 text-zinc-400" />
              {guest.data.checkIn} → {guest.data.checkOut}
            </span>
            <span>•</span>
            <span className="inline-flex items-center gap-1">
              <Users className="size-3 text-zinc-400" />
              {guest.data.guestCount} khách
            </span>
            <span>•</span>
            <Link
              to={`${base}/bookings/${i.bookingId}`}
              className="text-brand-700 hover:text-brand-800 underline font-medium"
            >
              Booking {i.booking.reference}
            </Link>
          </div>
        </div>
      )}

      {/* Top 3 Stat Cards for Amounts */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Tổng hóa đơn"
          value={money(i.totalAmount)}
          icon={<Receipt className="size-4" />}
          sub="Đã chốt phát hành"
        />
        <StatCard
          label="Đã thanh toán"
          value={money(i.paidAmount)}
          icon={<CreditCard className="size-4" />}
          delta={{ value: `${i.payments.length} lần giao dịch`, dir: "up" }}
        />
        <StatCard
          label="Số dư còn lại"
          value={money(i.balance)}
          icon={<Clock className="size-4" />}
          delta={{ value: isPaid ? "Đã tất toán" : "Cần thu đủ", dir: isPaid ? "up" : "down" }}
        />
      </div>

      {/* Breakdown and Payment grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Folio Breakdown */}
        <Card>
          <CardHeader className="pb-3 border-b border-zinc-100">
            <CardTitle className="text-sm font-semibold text-zinc-900 flex items-center justify-between">
              <span>Bảng kê chi phí (Folio)</span>
              <span className="text-xs text-zinc-500 font-normal">
                Phòng {i.booking.roomNumber}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-3 space-y-3">
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between py-1.5 border-b border-zinc-50">
                <span className="text-zinc-600">Tiền phòng ({guest.data?.checkIn} → {guest.data?.checkOut})</span>
                <span className="font-semibold text-zinc-900 tabular-nums">{money(i.roomAmount)}</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-zinc-50">
                <span className="text-zinc-600">Dịch vụ phòng & đồ uống</span>
                <span className="font-semibold text-zinc-900 tabular-nums">{money(i.serviceAmount)}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-t border-zinc-200 text-sm font-bold">
                <span className="text-zinc-900">Tổng cộng</span>
                <span className="text-brand-900 tabular-nums">{money(i.totalAmount)}</span>
              </div>
              <div className="flex items-center justify-between py-1.5 text-emerald-700">
                <span>Đã thanh toán</span>
                <span className="font-semibold tabular-nums">- {money(i.paidAmount)}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-t border-zinc-200 text-sm font-bold">
                <span className={Number(i.balance) > 0 ? "text-rose-700" : "text-emerald-700"}>
                  Số dư cần thanh toán
                </span>
                <span className={`tabular-nums ${Number(i.balance) > 0 ? "text-rose-700" : "text-emerald-700"}`}>
                  {money(i.balance)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment Recorder */}
        <Card>
          <CardHeader className="pb-3 border-b border-zinc-100">
            <CardTitle className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
              <CreditCard className="size-4 text-brand-600" />
              Thu ngân & Thanh toán
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-3">
            <PaymentForm key={id} invoice={i} />
          </CardContent>
        </Card>
      </div>

      {/* Receipts History Table */}
      <Card>
        <CardHeader className="pb-2 border-b border-zinc-100">
          <CardTitle className="text-sm font-semibold text-zinc-900 flex items-center justify-between">
            <span>Biên nhận thanh toán đã ghi nhận ({i.payments.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          <Table
            caption="Danh sách payment"
            rows={i.payments}
            rowKey={(p) => p.id}
            columns={[
              {
                title: "MÃ BIÊN NHẬN",
                render: (p) => (
                  <span className="font-mono text-xs text-zinc-800">
                    {p.id.slice(0, 10)}...
                  </span>
                ),
              },
              {
                title: "SỐ TIỀN",
                render: (p) => (
                  <span className="font-semibold text-xs text-zinc-900 tabular-nums">
                    {money(p.amount)}
                  </span>
                ),
              },
              {
                title: "PHƯƠNG THỨC",
                render: (p) => (
                  <span className="text-xs text-zinc-700">
                    {p.method === "CASH" ? "Tiền mặt" : "Chuyển khoản"}
                  </span>
                ),
              },
              {
                title: "TRẠNG THÁI",
                render: (p) => (
                  <Badge
                    tone={p.status === "COMPLETED" ? "green" : "rose"}
                   
                  >
                    {p.status === "FAILED" ? "Thất bại" : p.status}
                  </Badge>
                ),
              },
              {
                title: "THỜI ĐIỂM",
                render: (p) => (
                  <span className="text-xs text-zinc-500">
                    {p.paidAt
                      ? new Date(p.paidAt).toLocaleString("vi-VN")
                      : "Chưa ghi nhận"}
                  </span>
                ),
              },
            ]}
          />
        </CardContent>
      </Card>

      {/* Check-Out Execution Section */}
      <Card className="border-zinc-200">
        <CardHeader className="pb-2 border-b border-zinc-100">
          <CardTitle className="text-base font-semibold text-zinc-900 flex items-center gap-2">
            <LogOut className="size-4 text-brand-700" />
            Quy trình trả phòng (Check-out)
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          {preview.isPending ? (
            <Skeleton />
          ) : preview.error ? (
            <ErrorState
              message={preview.error.message}
              retry={() => void preview.refetch()}
            />
          ) : (
            <>
              {i.booking.status === "CHECKED_OUT" ? (
                <div className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-zinc-700">
                  <CheckCircle2 className="size-5 text-emerald-600 shrink-0" />
                  <div>
                    <p className="font-medium">Booking đã hoàn tất trả phòng.</p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Phòng đã được chuyển giao cho bộ phận buồng phòng.
                    </p>
                  </div>
                </div>
              ) : canCheckout(i.booking, preview.data!.pendingOrderCount, i) ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="size-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-emerald-900 text-sm">
                        Đủ điều kiện trả phòng
                      </h3>
                      <p className="text-xs text-emerald-800 mt-0.5">
                        Hóa đơn đã được thanh toán đầy đủ, không còn đơn dịch vụ chờ xử lý. Khi xác nhận trả phòng, phòng {i.booking.roomNumber} sẽ tự động chuyển trạng thái sang <strong>DIRTY</strong> và tạo công việc cho đội buồng phòng.
                      </p>
                    </div>
                  </div>
                  <div className="pt-1">
                    <DeskAction
                      path={`/bookings/${i.bookingId}/check-out`}
                      action="check-out"
                      label="Trả phòng"
                      description={`Hoàn tất trả phòng cho booking ${i.booking.reference}? Phòng ${i.booking.roomNumber} sẽ chuyển sang DIRTY.`}
                      onDone={(data) => setCheckoutResult(data as Checkout)}
                    />
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 space-y-2">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="size-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-amber-900 text-sm">
                        Chưa đủ điều kiện trả phòng
                      </h3>
                      <ul className="list-disc list-inside space-y-1 text-xs text-amber-800 mt-1">
                        {Number(i.balance) > 0 && (
                          <li>
                            Hóa đơn còn số dư chưa thanh toán:{" "}
                            <strong>{money(i.balance)}</strong>. Vui lòng ghi nhận thanh toán ở trên.
                          </li>
                        )}
                        {preview.data && preview.data.pendingOrderCount > 0 && (
                          <li>
                            Còn {preview.data.pendingOrderCount} đơn dịch vụ chưa hoàn thành hoặc chưa hủy.
                          </li>
                        )}
                        {i.booking.status !== "CHECKED_IN" && (
                          <li>
                            Booking hiện không ở trạng thái CHECKED_IN (Hiện tại: {i.booking.status}).
                          </li>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {checkoutResult?.invoice.id === id && (
            <div
              className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-xs text-emerald-900 space-y-1"
              role="status"
            >
              <div className="flex items-center gap-2 font-bold text-sm text-emerald-950">
                <CheckCircle2 className="size-4 text-emerald-600" />
                <h2 className="text-sm font-bold text-emerald-950">Đã hoàn tất trả phòng</h2>
              </div>
              <p>
                Trạng thái buồng phòng:{" "}
                <Badge tone="amber">
                  {checkoutResult.room.housekeepingStatus}
                </Badge>
              </p>
              <p className="text-zinc-600">
                Mã công việc buồng phòng:{" "}
                <code>{checkoutResult.housekeepingTask?.id ?? "Tự động phân bổ"}</code>
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PendingServiceQueue({ bookingId }: { bookingId: string }) {
  const [page, setPage] = useState(1);
  const query = useDeskGet<Page<Order>>(
    `/front-desk/orders?bookingId=${bookingId}&status=PENDING&page=${page}&pageSize=5`,
  );

  return (
    <Card className="border-amber-200 bg-amber-50/20" aria-label="Dịch vụ cần xử lý trước trả phòng">
      <CardHeader className="pb-2 border-b border-amber-100">
        <CardTitle className="text-sm font-semibold text-amber-950 flex items-center gap-2">
          <Clock className="size-4 text-amber-700" />
          Dịch vụ đang chờ cần giải quyết trước khi trả phòng
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-3 space-y-3">
        {query.isPending ? (
          <Skeleton />
        ) : query.error ? (
          <ErrorState
            message={query.error.message}
            retry={() => void query.refetch()}
          />
        ) : (
          <>
            {query.data!.data.map((o) => (
              <div
                key={o.id}
                className="rounded-lg border border-zinc-200 bg-white p-3 shadow-2xs space-y-2"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-zinc-900">
                    Đơn #{o.id.slice(0, 8)}
                  </span>
                  <Badge tone="amber">Đang chờ</Badge>
                </div>
                <OrderItems order={o} />
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100">
                  <DeskAction
                    path={`/service-orders/${o.id}/complete`}
                    action="complete"
                    label="Hoàn thành dịch vụ"
                    description="Xác nhận đã cung cấp các dịch vụ trong đơn?"
                  />
                  <DeskAction
                    path={`/service-orders/${o.id}/cancel`}
                    action="cancel"
                    label="Hủy đơn dịch vụ"
                    description="Xác nhận hủy các dịch vụ đang chờ trong đơn?"
                  />
                </div>
              </div>
            ))}
            <Pagination {...query.data!.meta} onChange={setPage} />
          </>
        )}
      </CardContent>
    </Card>
  );
}
