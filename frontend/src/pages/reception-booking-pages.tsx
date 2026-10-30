import { Link, useParams } from "react-router";
import {
  BedDouble,
  CreditCard,
  FileText,
  LogOut,
  Receipt,
  User,
} from "lucide-react";
import { ErrorState } from "../components/ui";
import { Avatar, Badge, Card, CardContent, CardHeader, CardTitle, type BadgeTone } from "../components/kamra-ui";
import { Skeleton } from "../features/guest/components";
import { money, statusLabels, type Order, type Page, type Preview } from "../features/guest/contracts";
import { CheckInWizard } from "../features/reception/check-in";
import { DeskAction } from "../features/reception/components";
import { ReservationPanels } from "../features/reception/reservation-panels";
import { type DeskBooking } from "../features/reception/contracts";
import { useDeskBase, useDeskGet, useDeskInvoice } from "../features/reception/queries";

const STATUS_TONES: Record<string, BadgeTone> = {
  CONFIRMED: "sky",
  CHECKED_IN: "green",
  CHECKED_OUT: "zinc",
  CANCELLED: "rose",
  PENDING: "amber",
};

export function ReceptionBookingDetailPage() {
  const { id = "" } = useParams(),
    base = useDeskBase();
  const query = useDeskGet<DeskBooking>("/front-desk/bookings/" + id);
  const preview = useDeskGet<Preview>(`/bookings/${id}/billing-preview`);
  const invoice = useDeskInvoice(id);
  const orders = useDeskGet<Page<Order>>(`/front-desk/orders?bookingId=${id}&pageSize=20`);

  if (query.isPending) {
    return (
      <div className="p-6">
        <Skeleton />
      </div>
    );
  }

  if (query.error) {
    return (
      <div className="p-6">
        <ErrorState message={query.error.message} retry={() => void query.refetch()} />
      </div>
    );
  }

  const b = query.data!;
  const rawName = b.customer?.fullName?.trim();
  const guestName = rawName
    ? rawName
        .split(" ")
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ")
    : b.reference;

  return (
    <div className="desk-page space-y-6" data-booking-id={b.id}>
      {/* Top Breadcrumb & Action Header */}
      <div className="space-y-3">
        <Link
          to={`${base}/bookings`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-brand-700 transition-colors"
        >
          ← Trở lại danh sách booking
        </Link>

        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-zinc-200/90 bg-white p-4 sm:p-5 shadow-2xs">
          <div className="flex items-center gap-3.5">
            <Avatar name={guestName} className="size-12 text-sm font-bold shadow-2xs shrink-0" />
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold font-mono text-zinc-900 tracking-tight">
                  {b.reference}
                </h1>
                <Badge tone={STATUS_TONES[b.status] || "zinc"} className="status-badge text-xs px-2.5 py-0.5">
                  {statusLabels[b.status] ?? b.status}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-xs sm:text-sm text-zinc-600 mt-1 flex-wrap">
                <span className="font-semibold text-zinc-900 capitalize">
                  👤 {guestName}
                </span>
                <span>·</span>
                <span className="font-medium text-zinc-800">
                  🛏️ Phòng {b.roomNumber} ({b.room?.roomType.name ?? "Standard"})
                </span>
                <span>·</span>
                <span className="text-zinc-600 tabular-nums">
                  📅 {b.checkIn.split("-").reverse().join("/")} → {b.checkOut.split("-").reverse().join("/")} ({b.nights} đêm · {b.guestCount} khách)
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {b.status === "CONFIRMED" && (
              <CheckInWizard
                bookingId={b.id}
                variant="primary"
                className="!bg-brand-600 !text-white hover:!bg-brand-700 !border-transparent px-3.5 py-1.5 font-semibold text-xs shadow-2xs"
              />
            )}
            {b.status === "PENDING" && (
              <DeskAction
                action="confirm"
                path={`/bookings/${id}/confirm`}
                label="Xác nhận booking"
                description={`Xác nhận booking ${b.reference}, xếp phòng ${b.roomNumber}?`}
                variant="primary"
                className="!bg-brand-600 !text-white hover:!bg-brand-700 !border-transparent px-3.5 py-1.5 font-semibold text-xs shadow-2xs"
              />
            )}
            {b.status === "CHECKED_IN" && (
              <Link
                to={`${base}/bookings/${id}/billing`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 shadow-2xs transition-colors"
              >
                <LogOut className="size-3.5" />
                Trả phòng & Hóa đơn
              </Link>
            )}
            <Link
              to={`${base}/bookings/${id}/billing`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition-colors shadow-2xs"
            >
              <Receipt className="size-3.5 text-zinc-500" />
              Chi phí & Thanh toán
            </Link>
            {["PENDING", "CONFIRMED"].includes(b.status) && (
              <DeskAction
                action="cancel"
                path={`/bookings/${id}/cancel`}
                label="Hủy booking"
                description={`Hủy booking ${b.reference}? Phòng có thể được mở lại cho khách khác.`}
                variant="ghost"
                className="!text-rose-600 hover:!bg-rose-50 !border-transparent text-xs py-1.5 px-2"
              />
            )}
          </div>
        </div>
      </div>

      {/* Reservation 360 Grid matching Kamra's ReservationDetail.tsx */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Card 1: Khách hàng */}
        <Card className="rounded-2xl border-zinc-200/90 shadow-2xs flex flex-col justify-between">
          <CardHeader className="pb-3 border-b border-zinc-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-zinc-100 text-zinc-700">
                  <User className="size-4" />
                </div>
                <CardTitle className="text-sm font-bold text-zinc-900">Thông tin khách hàng</CardTitle>
              </div>
              <span className="text-[11px] font-medium text-brand-700 bg-brand-50 px-2 py-0.5 rounded-md">
                Khách lưu trú
              </span>
            </div>
          </CardHeader>
          <CardContent className="pt-3.5 space-y-3 text-sm flex-1 flex flex-col justify-between">
            <dl className="guest-facts space-y-2.5 !m-0">
              <div className="!flex !justify-between !items-center !py-1.5 !border-0 border-b border-zinc-100/70">
                <dt className="text-xs font-medium text-zinc-500">Họ và tên</dt>
                <dd className="font-semibold text-zinc-900 text-sm capitalize text-right">
                  {b.customer?.fullName ?? "—"}
                </dd>
              </div>
              <div className="!flex !justify-between !items-center !py-1.5 !border-0 border-b border-zinc-100/70">
                <dt className="text-xs font-medium text-zinc-500">Số điện thoại</dt>
                <dd className="font-medium text-zinc-800 text-xs sm:text-sm text-right">
                  {b.customer?.phone ? (
                    <a href={`tel:${b.customer.phone}`} className="hover:text-brand-700 hover:underline text-zinc-800 font-mono">
                      {b.customer.phone}
                    </a>
                  ) : (
                    <span className="text-zinc-400 italic">Chưa có SĐT</span>
                  )}
                </dd>
              </div>
              <div className="!flex !justify-between !items-center !py-1.5 !border-0 border-b border-zinc-100/70">
                <dt className="text-xs font-medium text-zinc-500">Email liên hệ</dt>
                <dd className="font-medium text-zinc-800 text-xs text-right truncate max-w-[200px]" title={b.customer?.email ?? undefined}>
                  {b.customer?.email ? (
                    <a href={`mailto:${b.customer.email}`} className="hover:text-brand-700 hover:underline text-zinc-800 font-mono">
                      {b.customer.email}
                    </a>
                  ) : (
                    <span className="text-zinc-400 italic">—</span>
                  )}
                </dd>
              </div>
              <div className="!flex !justify-between !items-center !pt-2 !border-0 text-xs text-zinc-400">
                <dt className="text-[11px] text-zinc-400">Tạo hồ sơ lúc</dt>
                <dd className="text-[11px] font-mono text-zinc-500">
                  {new Date(b.createdAt).toLocaleString("vi-VN")}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Card 2: Phòng & Kỳ nghỉ */}
        <Card className="rounded-2xl border-zinc-200/90 shadow-2xs flex flex-col justify-between">
          <CardHeader className="pb-3 border-b border-zinc-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-zinc-100 text-zinc-700">
                  <BedDouble className="size-4" />
                </div>
                <CardTitle className="text-sm font-bold text-zinc-900">Phòng & Kỳ nghỉ</CardTitle>
              </div>
              <span className="text-xs font-semibold text-zinc-700 bg-zinc-100 px-2 py-0.5 rounded-md">
                {b.room?.roomType.name ?? "Phòng"}
              </span>
            </div>
          </CardHeader>
          <CardContent className="pt-3.5 space-y-3 text-sm flex-1 flex flex-col justify-between">
            {/* Room highlight banner */}
            <div className="flex items-center justify-between bg-zinc-50/80 p-2.5 rounded-xl border border-zinc-100">
              <div>
                <span className="text-[11px] font-medium text-zinc-500 block">Số phòng xếp:</span>
                <span className="text-lg font-bold text-zinc-900">Phòng {b.roomNumber}</span>
              </div>
              {b.room && (
                <Badge
                  tone={
                    b.room.housekeepingStatus === "CLEAN"
                      ? "green"
                      : b.room.housekeepingStatus === "DIRTY"
                      ? "amber"
                      : "zinc"
                  }
                  className="status-badge"
                >
                  {b.room.operationalStatus} · {b.room.housekeepingStatus}
                </Badge>
              )}
            </div>

            {/* Stay Timeline block */}
            <div className="grid grid-cols-2 gap-2 bg-zinc-50/80 p-2.5 rounded-xl border border-zinc-100 text-xs">
              <div className="border-r border-zinc-200/70 pr-2">
                <span className="text-[11px] font-medium text-zinc-500 block">Nhận phòng:</span>
                <span className="font-semibold text-zinc-900 text-xs sm:text-sm block mt-0.5 tabular-nums">
                  {b.checkIn.split("-").reverse().join("/")}
                </span>
                <span className="text-[10px] text-zinc-400">Từ 14:00</span>
              </div>
              <div className="pl-2">
                <span className="text-[11px] font-medium text-zinc-500 block">Trả phòng:</span>
                <span className="font-semibold text-zinc-900 text-xs sm:text-sm block mt-0.5 tabular-nums">
                  {b.checkOut.split("-").reverse().join("/")}
                </span>
                <span className="text-[10px] text-zinc-400">Trước 12:00</span>
              </div>
            </div>

            {/* Nights and guests */}
            <div className="flex items-center justify-between text-xs pt-1 border-t border-zinc-100">
              <span className="text-zinc-500 font-medium">Thời lượng lưu trú:</span>
              <strong className="text-zinc-900 font-semibold bg-zinc-100 px-2 py-0.5 rounded">
                {b.nights} đêm · {b.guestCount} khách
              </strong>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Chi phí & Hóa đơn */}
        <Card className="rounded-2xl border-zinc-200/90 shadow-2xs flex flex-col justify-between">
          <CardHeader className="pb-3 border-b border-zinc-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-zinc-100 text-zinc-700">
                  <Receipt className="size-4" />
                </div>
                <CardTitle className="text-sm font-bold text-zinc-900">Chi phí & Hóa đơn</CardTitle>
              </div>
              <Link
                to={`${base}/bookings/${id}/billing`}
                className="text-xs font-semibold text-brand-700 hover:text-brand-800 hover:underline"
              >
                Mở hóa đơn →
              </Link>
            </div>
          </CardHeader>
          <CardContent className="pt-3.5 space-y-3 text-xs sm:text-sm flex-1 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-500">Giá mỗi đêm:</span>
                <span className="tabular-nums font-medium text-zinc-800">{money(b.nightlyPrice)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-500">Tiền phòng ({b.nights} đêm):</span>
                <span className="tabular-nums font-semibold text-zinc-900">{money(b.totalRoomAmount)}</span>
              </div>
              {preview.data && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500">Dịch vụ phòng:</span>
                  <span className="tabular-nums font-medium text-zinc-800">
                    {money(preview.data.serviceAmount)}
                  </span>
                </div>
              )}
            </div>

            <div className="border-t border-zinc-100 pt-2 flex items-center justify-between">
              <span className="font-semibold text-zinc-800 text-xs sm:text-sm">Tổng chi phí:</span>
              <span className="tabular-nums font-bold text-brand-700 text-base sm:text-lg">
                {preview.data ? money(preview.data.totalAmount) : money(b.totalRoomAmount)}
              </span>
            </div>

            {invoice.data && (
              <div
                className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                  Number(invoice.data.balance) > 0
                    ? "bg-amber-50/70 border-amber-200 text-amber-900"
                    : "bg-emerald-50/70 border-emerald-200 text-emerald-900"
                }`}
              >
                <span className="font-medium">
                  {Number(invoice.data.balance) > 0 ? "⚠️ Còn phải thu:" : "✓ Đã thanh toán đủ:"}
                </span>
                <span className="tabular-nums font-bold text-sm">
                  {money(invoice.data.balance)}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Service Orders & Recorded Payments Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Service Orders */}
        <Card className="rounded-2xl border-zinc-200/90 shadow-2xs">
          <CardHeader className="border-b border-zinc-100 pb-3">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-zinc-100 text-zinc-700">
                  <FileText className="size-4" />
                </div>
                <CardTitle className="text-sm font-bold text-zinc-900">Đơn dịch vụ phòng đã đặt</CardTitle>
              </div>
              {orders.data && (
                <span className="text-xs font-semibold text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded-md">
                  {orders.data.meta.total} đơn
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-3">
            {!orders.data?.data.length ? (
              <p className="py-6 text-center text-xs text-zinc-400">
                Chưa có đơn dịch vụ phát sinh trong kỳ nghỉ này.
              </p>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {orders.data.data.map((o) => (
                  <li key={o.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="font-semibold text-zinc-800">
                        {o.items.map((i) => `${i.serviceName} × ${i.quantity}`).join(", ")}
                      </div>
                      <div className="text-[11px] text-zinc-400">
                        {new Date(o.orderedAt).toLocaleString("vi-VN")}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-semibold tabular-nums text-zinc-800">
                        {money(o.totalAmount)}
                      </span>
                      <Badge
                        tone={
                          o.status === "COMPLETED"
                            ? "green"
                            : o.status === "PENDING"
                            ? "amber"
                            : "zinc"
                        }
                      >
                        {o.status}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Payments Recorded */}
        <Card className="rounded-2xl border-zinc-200/90 shadow-2xs">
          <CardHeader className="border-b border-zinc-100 pb-3">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-zinc-100 text-zinc-700">
                  <CreditCard className="size-4" />
                </div>
                <CardTitle className="text-sm font-bold text-zinc-900">Khoản thanh toán ghi nhận</CardTitle>
              </div>
              {invoice.data?.payments && (
                <span className="text-xs font-semibold text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded-md">
                  {invoice.data.payments.length} khoản
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-3">
            {!invoice.data?.payments.length ? (
              <p className="py-6 text-center text-xs text-zinc-400">
                Chưa có khoản thu nào được ghi nhận cho hóa đơn này.
              </p>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {invoice.data.payments.map((p) => (
                  <li key={p.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="font-semibold text-zinc-800">
                        {p.method === "CASH" ? "Tiền mặt" : "Chuyển khoản ngân hàng"}
                      </div>
                      <div className="text-[11px] text-zinc-400">
                        {p.paidAt ? new Date(p.paidAt).toLocaleString("vi-VN") : "Đang chờ"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-semibold tabular-nums text-emerald-700">
                        +{money(p.amount)}
                      </span>
                      <Badge tone="green">{p.status}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <ReservationPanels bookingId={b.id} />

      {b.status === "CONFIRMED" && (
        <Card>
          <CardHeader>
            <CardTitle>Điều kiện nhận phòng</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-zinc-600">
            <p>
              Ngày hiện tại phải thuộc khoảng nhận phòng đến trước ngày trả phòng; khách phải đang hoạt động. Phòng cần ACTIVE và CLEAN, không có công việc buồng phòng còn mở. Hệ thống kiểm tra toàn bộ điều kiện khi gửi.
            </p>
            <p>
              Phòng: {b.room?.operationalStatus === "ACTIVE" ? "Đang hoạt động" : "Ngưng hoạt động"} · {b.room?.housekeepingStatus === "CLEAN" ? "Đã dọn sạch" : "Chưa sạch"} · {b.openTaskCount ?? 0} công việc còn mở.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
