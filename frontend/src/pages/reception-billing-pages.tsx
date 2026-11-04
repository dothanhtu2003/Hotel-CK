import "../features/reception/billing-workspace.css";
import { useState } from "react";
import { Link, useParams } from "react-router";
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
  const usedOrders = [...p.completedOrders, ...(p.counterPaidOrders ?? [])];
  const formatDate = (value: string) => value.split("-").reverse().join("/");
  const amount = i?.totalAmount ?? p.totalAmount;
  const paid = i?.paidAmount ?? p.paidAmount ?? "0";
  const balance = i?.balance ?? p.balance ?? p.totalAmount;
  const separatePaid = p.counterPaidAmount ?? "0";
  const overallTotal = decimal(cents(amount) + cents(separatePaid));
  const overallPaid = decimal(cents(paid) + cents(separatePaid));
  const isPaidInFull = Number(balance) <= 0;

  return (
    <div className="billing-workspace">
      <Link className="billing-back" to={`${base}/billing`}>
        <ArrowLeft className="size-3.5" /> Danh sách thu ngân
      </Link>

      <header className="billing-header-card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="billing-room-hero">
              <span className="billing-room-hero-num">{b.roomNumber}</span>
              <span className="billing-room-hero-label">Phòng</span>
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="billing-guest-name">
                  {b.customer?.fullName ?? "Khách tại quầy"}
                </h1>
                <Badge tone={b.status === "CHECKED_IN" ? "green" : "zinc"} className="text-xs px-2.5 py-0.5 font-semibold">
                  {statusLabels[b.status]}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 text-xs text-zinc-500 mt-1">
                <span className="inline-flex items-center gap-1.5 font-medium text-zinc-700">
                  <Calendar className="size-3.5 text-zinc-400" />
                  {formatDate(b.checkIn)} → {formatDate(b.checkOut)} · {b.nights} đêm
                </span>
                <span className="text-zinc-300">•</span>
                <span className="font-mono text-zinc-600">
                  Hồ sơ <strong>{b.reference}</strong>
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to={`${base}/bookings/${id}`}
              className="billing-profile-link"
            >
              Hồ sơ đặt phòng →
            </Link>
          </div>
        </div>
      </header>

      <div className="billing-columns">
        <main className="billing-breakdown">
          {/* Folio Breakdown */}
          <section className="billing-box">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-100">
              <h2 className="flex items-center gap-2 text-sm font-bold text-zinc-900">
                <Receipt className="size-4 text-emerald-700" />
                Chi tiết chi phí lưu trú
              </h2>
              <span className="text-xs text-zinc-400 font-medium">
                Phòng {b.roomNumber}
              </span>
            </div>

            <div className="billing-receipt-lines">
              <div className="billing-receipt-row">
                <div className="billing-receipt-label">
                  <span className="font-semibold text-zinc-800">Tiền phòng ({b.nights} đêm)</span>
                </div>
                <div className="billing-receipt-leader" />
                <strong className="billing-receipt-value font-semibold text-zinc-900">{money(i?.roomAmount ?? p.roomAmount)}</strong>
              </div>

              <div className="billing-receipt-row">
                <div className="billing-receipt-label">
                  <span className="font-semibold text-zinc-800">Dịch vụ ghi vào hóa đơn phòng</span>
                </div>
                <div className="billing-receipt-leader" />
                <strong className="billing-receipt-value font-semibold text-zinc-900">{money(i?.serviceAmount ?? p.serviceAmount)}</strong>
              </div>

              {Number(separatePaid) > 0 && (
                <div className="billing-receipt-row">
                  <div className="billing-receipt-label">
                    <span className="font-semibold text-zinc-800">Dịch vụ đã thu tại quầy</span>
                    <span className="billing-receipt-sub">{usedOrders.length} món thanh toán trực tiếp</span>
                  </div>
                  <div className="billing-receipt-leader" />
                  <strong className="billing-receipt-value font-semibold text-zinc-900">{money(separatePaid)}</strong>
                </div>
              )}

              <div className="billing-receipt-row billing-receipt-total">
                <div className="billing-receipt-label">
                  <strong className="text-base font-bold text-zinc-900">Tổng chi phí lưu trú</strong>
                  {Number(separatePaid) > 0 && (
                    <span className="billing-receipt-sub text-emerald-800 font-medium">
                      Hóa đơn phòng: {money(amount)} · Dịch vụ quầy: {money(separatePaid)}
                    </span>
                  )}
                </div>
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
                  <h2>Cần xử lý {p.pendingOrderCount} đơn dịch vụ</h2>
                  <p className="billing-help">Các đơn dưới đây còn chờ ghi nhận hoặc thanh toán nên chưa thể trả phòng.</p>
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
                Dịch vụ đã sử dụng
              </h2>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600">
                {usedOrders.length} đơn
              </span>
            </div>
            {!usedOrders.length ? (
              <p className="billing-help">Chưa có dịch vụ nào được ghi nhận.</p>
            ) : (
              <div className="rounded-lg border border-zinc-200/80 overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-semibold">
                    <tr>
                      <th className="py-2.5 px-3.5 text-left">DỊCH VỤ</th>
                      <th className="py-2.5 px-2 text-center">HÌNH THỨC</th>
                      <th className="py-2.5 px-3 text-center">SL</th>
                      <th className="py-2.5 px-3.5 text-right">ĐƠN GIÁ</th>
                      <th className="py-2.5 px-3.5 text-right">THÀNH TIỀN</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {usedOrders.flatMap(o => o.items.map(item => ({ ...item, paymentMethod: o.paymentMethod, key: `${o.id}-${item.id ?? item.serviceName}` }))).map(item => (
                      <tr key={item.key} className="hover:bg-zinc-50/50 transition-colors">
                        <td className="py-2.5 px-3.5 font-medium text-zinc-900">
                          {cleanServiceName(item.serviceName)}
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <span className={item.paymentMethod === 'CASH' ? 'billing-pill-cash' : item.paymentMethod === 'BANK_TRANSFER' ? 'billing-pill-transfer' : 'billing-pill-room'}>
                            {item.paymentMethod === 'CASH' ? 'Tiền mặt' : item.paymentMethod === 'BANK_TRANSFER' ? 'Chuyển khoản' : 'Ghi phòng'}
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
                Quyết toán & Trả phòng
              </h2>
              {i && (
                <span className="text-xs text-zinc-500 font-mono font-medium">
                  HĐ #{i.id.slice(0, 8)}
                </span>
              )}
            </div>

            <dl className="space-y-2.5 text-xs pb-3 border-b border-zinc-100">
              <div className="flex justify-between items-center text-zinc-600">
                <dt>Tổng chi phí lưu trú</dt>
                <dd className="font-bold text-zinc-900 text-sm tabular-nums">{money(overallTotal)}</dd>
              </div>
              <div className="flex justify-between items-center text-zinc-600">
                <dt>Đã thu tiền phòng</dt>
                <dd className="text-zinc-800 font-medium tabular-nums">{money(paid)}</dd>
              </div>
              {Number(separatePaid) > 0 && (
                <div className="flex justify-between items-center text-zinc-600">
                  <dt>Dịch vụ đã thu tại quầy</dt>
                  <dd className="text-zinc-800 font-medium tabular-nums">{money(separatePaid)}</dd>
                </div>
              )}
              <div className="flex justify-between items-center pt-2 border-t border-zinc-100">
                <dt className="font-semibold text-zinc-800">Tổng đã thu</dt>
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
                      ĐÃ TẤT TOÁN
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-amber-900">
                      <AlertCircle className="size-4 text-amber-600" />
                      CÒN PHẢI THU
                    </span>
                  )}
                </span>
                <span className="billing-status-amount">
                  {money(balance)}
                </span>
              </div>
              <p className="billing-status-sub">
                {isPaidInFull ? "Đã thanh toán đủ." : "Cần thu đủ số tiền trước khi trả phòng."}
              </p>
            </div>

            {!i ? (
              <div className="space-y-3 pt-1">
                {canIssue(p.booking, p.pendingOrderCount, null) ? (
                  <DeskAction
                    path={`/bookings/${id}/invoice`}
                    action="invoice"
                    label="Phát hành hóa đơn"
                    description={`Chốt hóa đơn ${b.reference} với tổng tiền ${money(amount)}? Sau khi phát hành, không thể thêm hoặc sửa chi phí.`}
                    variant="primary"
                    className="billing-main-action"
                  />
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
              </div>
            ) : (
              <div className="space-y-3 pt-1">
                <Link className="billing-invoice-btn" to={`${base}/invoices/${i.id}`}>
                  <Receipt className="size-4" />
                  Xem & in hóa đơn
                </Link>
                {i.status !== "PAID" && b.status !== "CANCELLED" && (
                  <PaymentForm key={i.id} invoice={i} />
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
  const rawName = guest.data?.customer?.fullName || (i.booking as { customer?: { fullName?: string } }).customer?.fullName || "Khách tại quầy";
  const guestName = rawName
    .split(" ")
    .filter(Boolean)
    .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  return (
    <div className="desk-page space-y-5 max-w-5xl mx-auto pb-12">
      {/* Top Breadcrumb */}
      <div>
        <Link
          to={`${base}/bookings/${i.bookingId}/billing`}
          className="billing-back"
        >
          <ArrowLeft className="size-3.5" /> Quay lại chi phí booking
        </Link>
      </div>

      {/* Header Card */}
      <header className="billing-header-card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="billing-room-hero">
              <span className="billing-room-hero-num">{i.booking.roomNumber}</span>
              <span className="billing-room-hero-label">Phòng</span>
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="billing-guest-name">
                  Hóa đơn #{i.id.slice(0, 8)}
                </h1>
                <Badge tone={isPaid ? "green" : "amber"} className="text-xs px-2.5 py-0.5 font-semibold">
                  {isPaid ? "Đã thanh toán" : "Chưa thanh toán"}
                </Badge>
                <Badge tone={i.booking.status === "CHECKED_OUT" ? "zinc" : i.booking.status === "CHECKED_IN" ? "green" : "sky"} className="text-xs px-2.5 py-0.5 font-semibold">
                  {statusLabels[i.booking.status]}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 text-xs text-zinc-500 mt-1">
                <span className="font-semibold text-zinc-800">{guestName}</span>
                <span className="text-zinc-300">•</span>
                <span>Mã: <strong className="text-zinc-700 font-mono">{i.booking.reference}</strong></span>
                <span className="text-zinc-300">•</span>
                <span>{new Date(i.issuedAt).toLocaleString("vi-VN")}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5"
            >
              <Printer className="size-3.5" /> In hóa đơn
            </Button>
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
                Bảng kê chi phí
              </span>
              <span className="text-xs text-zinc-400 font-normal">
                Phòng {i.booking.roomNumber}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-3">
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-zinc-100">
                <span className="text-zinc-600">Tiền phòng ({i.booking.nights} đêm)</span>
                <span className="font-semibold text-zinc-900 tabular-nums">{money(i.roomAmount)}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-zinc-100">
                <span className="text-zinc-600">Dịch vụ phòng</span>
                <span className="font-semibold text-zinc-900 tabular-nums">{money(i.serviceAmount)}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-t border-zinc-200 text-sm font-bold">
                <span className="text-zinc-900">Tổng hóa đơn</span>
                <span className="text-zinc-900 tabular-nums">{money(i.totalAmount)}</span>
              </div>
              <div className="flex items-center justify-between py-1.5 text-emerald-700 font-medium">
                <span>Đã thanh toán</span>
                <span className="tabular-nums font-semibold">- {money(i.paidAmount)}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-t border-zinc-200 text-sm font-bold">
                <span className={Number(i.balance) > 0 ? "text-rose-700" : "text-emerald-800"}>
                  {Number(i.balance) > 0 ? "Còn phải thu" : "Số dư còn lại"}
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
                Thu ngân & Thanh toán
              </CardTitle>
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
                  Biên nhận thanh toán ({i.payments.length})
                </span>
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
                      <span className="font-mono text-xs text-zinc-700 font-medium">
                        #{p.id.slice(0, 8)}
                      </span>
                    ),
                  },
                  {
                    title: "SỐ TIỀN",
                    render: (p) => (
                      <span className="font-bold text-xs text-zinc-900 tabular-nums">
                        {money(p.amount)}
                      </span>
                    ),
                  },
                  {
                    title: "HÌNH THỨC",
                    render: (p) => (
                      <span className="text-xs text-zinc-700">
                        {p.method === "CASH" ? "Tiền mặt" : "Chuyển khoản"}
                      </span>
                    ),
                  },
                  {
                    title: "THỜI ĐIỂM",
                    render: (p) => (
                      <span className="text-xs text-zinc-500">
                        {p.paidAt ? new Date(p.paidAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "—"}
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
            <CardTitle className="text-sm font-bold text-zinc-900">
              Biên nhận đã thu ({i.payments.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <Table
              caption="Danh sách payment"
              rows={i.payments}
              rowKey={(p) => p.id}
              columns={[
                {
                  title: "MÃ",
                  render: (p) => <span className="font-mono text-xs">#{p.id.slice(0, 8)}</span>,
                },
                {
                  title: "SỐ TIỀN",
                  render: (p) => <strong className="text-xs tabular-nums">{money(p.amount)}</strong>,
                },
                {
                  title: "HÌNH THỨC",
                  render: (p) => <span className="text-xs">{p.method === "CASH" ? "Tiền mặt" : "Chuyển khoản"}</span>,
                },
                {
                  title: "THỜI ĐIỂM",
                  render: (p) => <span className="text-xs text-zinc-500">{p.paidAt ? new Date(p.paidAt).toLocaleString("vi-VN") : "—"}</span>,
                },
              ]}
            />
          </CardContent>
        </Card>
      )}

      {/* Check-Out Quick Action (if in-house & ready) */}
      {i.booking.status === "CHECKED_IN" && preview.data && canCheckout(i.booking, preview.data.pendingOrderCount, i) && (
        <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-50 border border-emerald-200 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="size-5 text-emerald-600 shrink-0" />
            <span className="text-sm font-bold text-emerald-950">
              Hóa đơn đã tất toán · Sẵn sàng trả phòng
            </span>
          </div>
          <DeskAction
            path={`/bookings/${i.bookingId}/check-out`}
            action="check-out"
            label="Xác nhận trả phòng"
            description=""
            variant="primary"
            onDone={(data) => setCheckoutResult(data as Checkout)}
          />
        </div>
      )}

      {checkoutResult && (
        <p role="status" className="billing-success flex items-center gap-2">
          <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
          Đã hoàn tất trả phòng · Phòng {i.booking.roomNumber} đã chuyển sang chờ dọn.
        </p>
      )}
    </div>
  );
}

function PendingServiceQueue({ bookingId }: { bookingId: string }) {
  const [page, setPage] = useState(1);
  const query = useDeskGet<Page<Order>>(
    `/front-desk/orders?bookingId=${bookingId}&view=checkout&page=${page}&pageSize=5`,
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
              <Badge tone="amber">{o.requestedPaymentMethod && !o.paymentMethod ? 'Chờ thanh toán' : 'Chờ ghi nhận'}</Badge>
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
