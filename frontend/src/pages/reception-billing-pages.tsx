import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  FileText,
  LogOut,
  Receipt,
    Users,
} from "lucide-react";
import {
  ErrorState,
  LinkButton,
  Pagination,
  Table,
} from "../components/ui";
import { Skeleton } from "../features/guest/components";
import {
  money,
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
  const navigate = useNavigate();

  const guest = useDeskGet<DeskBooking>(`/front-desk/bookings/${id}`);
  const preview = useDeskGet<Preview>(`/bookings/${id}/billing-preview`);
  const invoice = useDeskInvoice(id);

  return (
    <div className="desk-page space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Breadcrumb & Navigation */}
      <div className="flex items-center justify-between">
        <Link
          to={`${base}/bookings/${id}`}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900 transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          Quay lại chi tiết booking
        </Link>
        <span className="text-xs text-zinc-400 font-mono">
          ID: {id.slice(0, 8)}
        </span>
      </div>

      {/* Page Title & Kamra StepFlow */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-700">
              <Receipt className="size-3.5" />
              Lễ tân · Thu ngân & Hóa đơn
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 mt-1">
              Chi phí & phát hành hóa đơn
            </h1>
          </div>
          {preview.data && (
            <Badge
              tone={
                preview.data.booking.status === "CHECKED_IN"
                  ? "green"
                  : preview.data.booking.status === "CONFIRMED"
                  ? "sky"
                  : "zinc"
              }
             
            >
              {preview.data.booking.status}
            </Badge>
          )}
        </div>

        {/* Step Flow indicator */}
        <div className="grid grid-cols-3 gap-2 pt-2">
          <div className="rounded-lg border border-brand-200 bg-brand-50/70 p-2.5 text-center">
            <span className="text-[11px] font-bold text-brand-800 uppercase tracking-wide block">
              Bước 1
            </span>
            <span className="text-xs font-medium text-brand-900">
              Kiểm tra dịch vụ
            </span>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-2.5 text-center">
            <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wide block">
              Bước 2
            </span>
            <span className="text-xs font-medium text-zinc-700">
              Phát hành hóa đơn
            </span>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-2.5 text-center">
            <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wide block">
              Bước 3
            </span>
            <span className="text-xs font-medium text-zinc-700">
              Thanh toán & Trả phòng
            </span>
          </div>
        </div>
      </div>

      {/* Guest & Stay Context Card */}
      {guest.data && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center gap-3">
            <Avatar name={guest.data.customer?.fullName ?? "Khách"} />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-zinc-900">
                  {guest.data.customer?.fullName}
                </span>
                <span className="text-xs text-zinc-500">
                  ({guest.data.customer?.email})
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-zinc-500 mt-0.5">
                <span className="font-medium text-brand-700">
                  Phòng {guest.data.roomNumber}
                </span>
                
                <span>•</span>
                <span className="inline-flex items-center gap-1">
                  <Calendar className="size-3 text-zinc-400" />
                  {guest.data.checkIn} → {guest.data.checkOut}
                </span>
              </div>
            </div>
          </div>
          <Link
            to={`${base}/bookings/${id}`}
            className="text-xs font-medium text-brand-700 hover:text-brand-800 underline underline-offset-2"
          >
            Mã {guest.data.reference}
          </Link>
        </div>
      )}

      {/* Preview Costs & Breakdown */}
      {preview.isPending ? (
        <Skeleton />
      ) : preview.error ? (
        <ErrorState
          message={preview.error.message}
          retry={() => void preview.refetch()}
        />
      ) : (
        preview.data && (
          <div className="space-y-5">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-zinc-100">
                <CardTitle className="text-base font-semibold text-zinc-900 flex items-center gap-2">
                  <Receipt className="size-4 text-brand-600" />
                  Dự toán chi phí lưu trú
                </CardTitle>
                <span className="text-xs text-zinc-500">
                  Chỉ các dịch vụ COMPLETED mới tính vào hóa đơn
                </span>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-3.5">
                    <span className="text-xs text-zinc-500 block">Tiền phòng ({preview.data.booking.checkIn} → {preview.data.booking.checkOut})</span>
                    <span className="text-lg font-bold text-zinc-900 tabular-nums mt-0.5 block">
                      {money(preview.data.roomAmount)}
                    </span>
                  </div>
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-3.5">
                    <span className="text-xs text-zinc-500 block">Dịch vụ phòng (Đã hoàn thành)</span>
                    <span className="text-lg font-bold text-zinc-900 tabular-nums mt-0.5 block">
                      {money(preview.data.serviceAmount)}
                    </span>
                  </div>
                  <div className="rounded-xl border border-brand-200 bg-brand-50/50 p-3.5">
                    <span className="text-xs text-brand-700 font-medium block">Tổng cộng ước tính</span>
                    <span className="text-lg font-bold text-brand-900 tabular-nums mt-0.5 block">
                      {money(preview.data.totalAmount)}
                    </span>
                  </div>
                </div>

                {preview.data.pendingOrderCount > 0 ? (
                  <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-900">
                    <AlertCircle className="size-4 shrink-0 text-amber-600 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-semibold">
                        Có {preview.data.pendingOrderCount} đơn dịch vụ đang chờ xử lý!
                      </p>
                      <p className="text-amber-800">
                        Hệ thống chỉ phát hành hóa đơn khi toàn bộ đơn dịch vụ được xác nhận HOÀN THÀNH hoặc HỦY. Hãy xử lý các đơn bên dưới.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50/70 border border-emerald-200 rounded-lg p-2.5">
                    <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                    <span>Không còn đơn dịch vụ chờ xử lý. Đủ điều kiện phát hành hóa đơn nếu khách đang lưu trú.</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pending orders queue if any */}
            {preview.data.pendingOrderCount > 0 && (
              <PendingServiceQueue bookingId={id} />
            )}

            {/* Completed Service Orders list */}
            {preview.data.completedOrders.length > 0 && (
              <Card>
                <CardHeader className="pb-2 border-b border-zinc-100">
                  <CardTitle className="text-sm font-semibold text-zinc-900">
                    Dịch vụ phòng đã cung cấp ({preview.data.completedOrders.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-3 divide-y divide-zinc-100">
                  {preview.data.completedOrders.map((o) => (
                    <div key={o.id} className="py-2.5 first:pt-0 last:pb-0">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium text-zinc-800">
                          Đơn #{o.id.slice(0, 8)}
                        </span>
                        <Badge tone="green">Hoàn thành</Badge>
                      </div>
                      <OrderItems order={o} />
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        )
      )}

      {/* Invoice Section */}
      {invoice.isPending ? (
        <Skeleton />
      ) : invoice.error ? (
        <ErrorState
          message={invoice.error.message}
          retry={() => void invoice.refetch()}
        />
      ) : invoice.data ? (
        <Card className="border-brand-200 bg-brand-50/30">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-zinc-900 flex items-center gap-2">
                <FileText className="size-4 text-brand-600" />
                Hóa đơn đã được phát hành
              </CardTitle>
              <Badge tone={invoice.data.status === "PAID" ? "green" : "amber"}>
                {invoice.data.status === "PAID" ? "Đã thanh toán đủ" : "Chờ thanh toán"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-zinc-600">
              <div>
                <span className="block text-zinc-500">Mã hóa đơn:</span>
                <span className="font-mono font-semibold text-zinc-900">{invoice.data.id}</span>
              </div>
              <div>
                <span className="block text-zinc-500">Tổng thanh toán:</span>
                <span className="font-bold text-zinc-900 text-sm">{money(invoice.data.totalAmount)}</span>
              </div>
              <div>
                <span className="block text-zinc-500">Đã thu:</span>
                <span className="font-semibold text-emerald-700">{money(invoice.data.paidAmount)}</span>
              </div>
              <div>
                <span className="block text-zinc-500">Còn lại:</span>
                <span className={`font-bold ${invoice.data.balance === "0" ? "text-emerald-700" : "text-rose-700"}`}>
                  {money(invoice.data.balance)}
                </span>
              </div>
            </div>
            <div className="pt-2">
              <LinkButton to={`${base}/invoices/${invoice.data.id}`}>
                Xem hóa đơn & Ghi nhận thanh toán →
              </LinkButton>
            </div>
          </CardContent>
        </Card>
      ) : (
        preview.data && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-zinc-900 flex items-center gap-2">
                <Receipt className="size-4 text-zinc-500" />
                Phát hành hóa đơn mới
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-zinc-600">
                Hóa đơn sẽ chốt snapshot giá tiền phòng và toàn bộ dịch vụ đã hoàn thành. Khi đã phát hành, các khoản phí không thể chỉnh sửa thêm.
              </p>
              {canIssue(preview.data.booking, preview.data.pendingOrderCount, null) ? (
                <DeskAction
                  path={`/bookings/${id}/invoice`}
                  action="invoice"
                  label="Phát hành hóa đơn"
                  description={`Phát hành hóa đơn cho booking ${preview.data.booking.reference} theo giá dự toán ${money(preview.data.totalAmount)}?`}
                  onDone={(data) => navigate(`${base}/invoices/${(data as Invoice).id}`)}
                />
              ) : (
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600">
                  <p className="font-medium text-zinc-800 mb-1">Chưa đủ điều kiện phát hành:</p>
                  <ul className="list-disc list-inside space-y-0.5 text-zinc-500">
                    <li>Booking phải có trạng thái CHECKED_IN (đang lưu trú).</li>
                    <li>Không còn đơn dịch vụ PENDING nào chưa xử lý.</li>
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )
      )}
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
