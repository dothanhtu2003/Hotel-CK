import "../features/reception/billing-workspace.css";
import { useState } from "react";
import { Link, useParams } from "react-router";
import {
  AlertCircle,
  ArrowLeft,
  BedDouble,
  Calendar,
  CheckCircle2,
  Clock,
  ConciergeBell,
  CreditCard,
  LogOut,
  Receipt,
  User,
  Users,
} from "lucide-react";

function cleanServiceName(name: string) {
  return name.replace(/^TEST\s*-\s*\d{8}\s*/i, "").trim() || name;
}
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
import { DeskAction } from "../features/reception/components";
import { ServiceOrderActions } from '../features/reception/service-order-actions';
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

  return (
    <div className="billing-workspace">
      <Link className="billing-back" to={`${base}/billing`}>
        <ArrowLeft className="size-3.5" /> Danh sách thu ngân
      </Link>

      <header className="billing-header-card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="billing-title-wrap">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-800">
              <Receipt className="size-3.5 text-emerald-700" />
              Thu ngân & Quyết toán phòng
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 mt-1 mb-2">
              Thanh toán & trả phòng
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-900 text-white font-semibold tabular-nums shadow-2xs">
                <BedDouble className="size-3.5 text-zinc-300" />
                Phòng {b.roomNumber}
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-100 text-zinc-800 font-medium">
                <User className="size-3.5 text-zinc-500" />
                {b.customer?.fullName ?? "Khách tại quầy"}
              </span>
              <span className="inline-flex items-center gap-1.5 text-zinc-600 px-2 py-1">
                <Calendar className="size-3.5 text-zinc-400" />
                {formatDate(b.checkIn)} → {formatDate(b.checkOut)} · {b.nights} đêm
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <Badge tone={b.status === "CHECKED_IN" ? "green" : "zinc"} className="text-xs px-2.5 py-1 font-semibold">
              {statusLabels[b.status]}
            </Badge>
            <Link
              to={`${base}/bookings/${id}`}
              className="inline-flex items-center gap-1 text-xs font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-md border border-emerald-200 transition-colors"
            >
              Hồ sơ {b.reference}
            </Link>
          </div>
        </div>
      </header>

      <div className="billing-columns">
        <main className="billing-breakdown">
          {/* Folio Breakdown */}
          <section className="billing-box">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-100">
              <h2 className="flex items-center gap-2">
                <Receipt className="size-4 text-emerald-700" />
                Chi tiết chi phí
              </h2>
              <span className="text-xs text-zinc-500 font-medium">
                Phòng {b.roomNumber}
              </span>
            </div>

            <div className="billing-receipt-lines">
              <div className="billing-receipt-row">
                <div className="billing-receipt-label">
                  <span className="font-semibold text-zinc-800">Tiền phòng {b.roomNumber}</span>
                  <span className="billing-receipt-sub">{b.nights} đêm · {formatDate(b.checkIn)} → {formatDate(b.checkOut)}</span>
                </div>
                <div className="billing-receipt-leader" />
                <strong className="billing-receipt-value font-semibold text-zinc-900">{money(i?.roomAmount ?? p.roomAmount)}</strong>
              </div>

              <div className="billing-receipt-row">
                <div className="billing-receipt-label">
                  <span className="font-semibold text-zinc-800">Dịch vụ ghi vào phòng</span>
                  <span className="billing-receipt-sub">Gồm {p.completedOrders.length} đơn dịch vụ đã xác nhận</span>
                </div>
                <div className="billing-receipt-leader" />
                <strong className="billing-receipt-value font-semibold text-zinc-900">{money(i?.serviceAmount ?? p.serviceAmount)}</strong>
              </div>

              <div className="billing-receipt-row billing-receipt-total">
                <div className="billing-receipt-label">
                  <strong className="text-base font-bold text-zinc-900">Tổng chi phí{i ? "" : " tạm tính"}</strong>
                </div>
                <div className="billing-receipt-leader billing-leader-thick" />
                <strong className="billing-receipt-value text-base font-bold text-emerald-800">{money(amount)}</strong>
              </div>
            </div>

            {!i && (
              <p className="billing-help mt-3 pt-3 border-t border-zinc-100 text-xs text-zinc-500 flex items-center gap-1.5">
                <span className="inline-block size-1.5 rounded-full bg-zinc-400" />
                Các khoản đã thu tại quầy không tính vào hóa đơn này.
              </p>
            )}
          </section>

          {/* Counter Paid Services Notice */}
          {Number(p.counterPaidAmount ?? 0) > 0 && (
            <section className="billing-box border-emerald-200 bg-emerald-50/40">
              <h2 className="text-emerald-950 flex items-center gap-2 mb-1.5">
                <CheckCircle2 className="size-4 text-emerald-600" />
                Dịch vụ đã thu riêng tại quầy
              </h2>
              <p className="text-xs text-emerald-800">
                <strong>{money(p.counterPaidAmount!)}</strong> · Không nằm trong tổng hóa đơn phòng và không thu lại khi trả phòng.
              </p>
            </section>
          )}

          {/* Pending Services Section */}
          {p.pendingOrderCount > 0 && (
            <section className="billing-pending-card">
              <div className="billing-pending-header">
                <div className="p-2 rounded-lg bg-amber-100 text-amber-800 shrink-0 mt-0.5">
                  <AlertCircle className="size-5" />
                </div>
                <div>
                  <h2>Cần xử lý {p.pendingOrderCount} đơn dịch vụ</h2>
                  <p>Chọn cách thanh toán để ghi nhận, hoặc hủy yêu cầu từ khách trước khi phát hành hóa đơn.</p>
                </div>
              </div>
              <PendingServiceQueue bookingId={id} />
            </section>
          )}

          {/* Completed Services */}
          <section className="billing-box">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-100">
              <h2 className="flex items-center gap-2">
                <ConciergeBell className="size-4 text-emerald-700" />
                Dịch vụ đã sử dụng
              </h2>
              <span className="text-xs text-zinc-500">
                {p.completedOrders.length} đơn hoàn thành
              </span>
            </div>
            {!p.completedOrders.length ? (
              <p className="billing-help">Chưa phát sinh dịch vụ ghi vào hóa đơn phòng.</p>
            ) : (
              <div className="rounded-lg border border-zinc-200/80 overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-semibold">
                    <tr>
                      <th className="py-2.5 px-3.5 text-left">DỊCH VỤ</th>
                      <th className="py-2.5 px-3 text-center">SL</th>
                      <th className="py-2.5 px-3.5 text-right">ĐƠN GIÁ</th>
                      <th className="py-2.5 px-3.5 text-right">THÀNH TIỀN</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {p.completedOrders.flatMap(o => o.items.map(item => ({ ...item, key: `${o.id}-${item.id ?? item.serviceName}` }))).map(item => (
                      <tr key={item.key} className="hover:bg-zinc-50/50 transition-colors">
                        <td className="py-2.5 px-3.5 font-medium text-zinc-900">{cleanServiceName(item.serviceName)}</td>
                        <td className="py-2.5 px-3 text-center tabular-nums text-zinc-600">{item.quantity}</td>
                        <td className="py-2.5 px-3.5 text-right tabular-nums text-zinc-600">{money(item.unitPrice)}</td>
                        <td className="py-2.5 px-3.5 text-right tabular-nums font-semibold text-zinc-900">{money(item.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Payment History if Invoice Exists */}
          {i && (
            <details className="billing-box group">
              <summary className="text-sm font-bold text-zinc-900 flex items-center justify-between cursor-pointer select-none">
                <span className="flex items-center gap-2">
                  <CreditCard className="size-4 text-emerald-700" />
                  Lịch sử thanh toán ({i.payments.length})
                </span>
                <span className="text-xs text-zinc-400 font-normal">Bấm để xem</span>
              </summary>
              <div className="pt-3 mt-2 border-t border-zinc-100 space-y-2">
                {i.payments.length === 0 ? (
                  <p className="billing-help">Chưa ghi nhận khoản thu.</p>
                ) : (
                  i.payments.map((payment) => (
                    <div className="billing-receipt-row text-xs" key={payment.id}>
                      <div>
                        <span className="font-semibold text-zinc-800">
                          {payment.method === "CASH" ? "Tiền mặt" : "Chuyển khoản"}
                        </span>
                        <small className="block text-zinc-400 mt-0.5">
                          {payment.paidAt ? new Date(payment.paidAt).toLocaleString("vi-VN") : "Chưa ghi nhận"} ·{" "}
                          {payment.status === "COMPLETED" ? "Đã thu" : payment.status === "FAILED" ? "Thất bại" : "Đang chờ"}
                        </small>
                      </div>
                      <div className="billing-receipt-leader" />
                      <strong className="tabular-nums font-semibold text-zinc-900">{money(payment.amount)}</strong>
                    </div>
                  ))
                )}
              </div>
            </details>
          )}
        </main>

        {/* Right Summary Column */}
        <aside className="billing-checkout">
          <section className="billing-box billing-summary shadow-xs">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-100">
              <h2 className="flex items-center gap-2">
                <CreditCard className="size-4 text-emerald-700" />
                {i ? "Thanh toán" : "Chốt hóa đơn"}
              </h2>
              <span className="text-xs text-zinc-400 font-mono">
                {i ? `HD #${i.id.slice(0, 8)}` : `Mã ${b.reference}`}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center py-1 text-zinc-600">
                <span>Tổng chi phí</span>
                <strong className="text-zinc-900 font-semibold tabular-nums text-sm">{money(amount)}</strong>
              </div>
              <div className="flex justify-between items-center py-1 text-zinc-600">
                <span>Đã thu</span>
                <strong className="text-emerald-700 font-semibold tabular-nums text-sm">{money(paid)}</strong>
              </div>
            </div>

            <div className={`billing-due-card ${Number(balance) <= 0 ? "billing-due-paid" : "billing-due-pending"}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider">
                  {i ? "Còn phải thu" : "Cần thanh toán · tạm tính"}
                </span>
                {Number(balance) <= 0 && (
                  <CheckCircle2 className="size-4 text-emerald-600" />
                )}
              </div>
              <div className="billing-due-amount">
                {money(balance)}
              </div>
              {Number(balance) <= 0 && (
                <span className="text-[11px] text-emerald-700 font-medium">Hóa đơn đã được tất toán</span>
              )}
            </div>

            {!i ? (
              <div className="space-y-3 pt-1">
                {canIssue(p.booking, p.pendingOrderCount, null) ? (
                  <>
                    <p className="billing-help">
                      Các dịch vụ đã xử lý xong. Phát hành hóa đơn để chốt chi phí và bắt đầu thu tiền.
                    </p>
                    <DeskAction
                      path={`/bookings/${id}/invoice`}
                      action="invoice"
                      label="Phát hành hóa đơn"
                      description={`Chốt hóa đơn ${b.reference} với tổng tiền ${money(amount)}? Sau khi phát hành, không thể thêm hoặc sửa chi phí.`}
                      variant="primary"
                      className="billing-main-action"
                    />
                  </>
                ) : (
                  <div className="billing-blocked flex items-start gap-2.5">
                    <AlertCircle className="size-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-xs leading-relaxed text-amber-800 m-0">
                      {p.pendingOrderCount > 0
                        ? "Hãy xử lý các đơn dịch vụ đang chờ ở bên trái trước."
                        : "Chỉ phát hành hóa đơn khi khách đang lưu trú."}
                    </p>
                  </div>
                )}
                <p className="billing-help text-[11px] text-zinc-400">
                  Sau khi phát hành, không thể thêm hoặc sửa chi phí.
                </p>
              </div>
            ) : (
              <div className="space-y-3 pt-1">
                <Link className="billing-invoice-link" to={`${base}/invoices/${i.id}`}>
                  <Receipt className="size-3.5" />
                  Xem / in hóa đơn
                </Link>
                {i.status !== "PAID" && b.status !== "CANCELLED" && (
                  <PaymentForm key={i.id} invoice={i} />
                )}
                {i.status === "PAID" && (
                  <p className="billing-success flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                    Đã thanh toán đủ.
                  </p>
                )}
                {canCheckout(p.booking, p.pendingOrderCount, i) && (
                  <DeskAction
                    path={`/bookings/${id}/check-out`}
                    action="check-out"
                    label="Xác nhận trả phòng"
                    description={`Trả phòng ${b.roomNumber} cho ${b.customer?.fullName ?? "khách"}?`}
                    variant="primary"
                    className="billing-main-action"
                    onDone={(result) => setCheckoutResult(result as Checkout)}
                  />
                )}
                {b.status === "CHECKED_OUT" && (
                  <p className="billing-success flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                    Đã trả phòng. Phòng đã chuyển sang chờ dọn.
                  </p>
                )}
                {i.status === "PAID" && b.status === "CHECKED_IN" && p.pendingOrderCount > 0 && (
                  <p className="billing-blocked flex items-start gap-2">
                    <AlertCircle className="size-4 text-amber-600 shrink-0 mt-0.5" />
                    Cần xử lý dịch vụ đang chờ trước khi trả phòng.
                  </p>
                )}
              </div>
            )}
            {checkoutResult && (
              <p role="status" className="billing-success flex items-center gap-2 mt-3">
                <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                Trả phòng thành công · Phòng {b.roomNumber} cần dọn.
              </p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
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
                            Còn {preview.data.pendingOrderCount} yêu cầu dịch vụ từ khách chưa được ghi nhận hoặc hủy.
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

  if (query.isPending) return <Skeleton />;
  if (query.error) {
    return (
      <ErrorState
        message={query.error.message}
        retry={() => void query.refetch()}
      />
    );
  }

  const orders = query.data?.data ?? [];
  if (orders.length === 0) return null;

  return (
    <div className="space-y-3" aria-label="Dịch vụ cần xử lý trước trả phòng">
      {orders.map((o) => (
        <div
          key={o.id}
          className="rounded-xl border border-amber-200/90 bg-white p-3.5 shadow-2xs space-y-3"
        >
          <div className="flex items-center justify-between text-xs pb-2 border-b border-zinc-100">
            <div className="flex items-center gap-2">
              <span className="font-bold text-zinc-900 font-mono">
                Đơn #{o.id.slice(0, 8)}
              </span>
              <Badge tone="amber">Đang chờ</Badge>
            </div>
            <div className="text-xs font-semibold text-zinc-600">
              Tổng đơn: <strong className="text-sm font-bold text-zinc-900 tabular-nums">{money(o.totalAmount)}</strong>
            </div>
          </div>

          <div className="rounded-lg border border-zinc-100 bg-zinc-50/60 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-200/60 text-zinc-500 font-medium text-left">
                  <th className="py-2 px-3">Dịch vụ</th>
                  <th className="py-2 px-3 text-center">SL</th>
                  <th className="py-2 px-3 text-right">Đơn giá</th>
                  <th className="py-2 px-3 text-right">Thành tiền</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {o.items.map((item) => (
                  <tr key={item.id} className="text-zinc-800">
                    <td className="py-2 px-3 font-medium text-zinc-900">
                      {cleanServiceName(item.serviceName)}
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
