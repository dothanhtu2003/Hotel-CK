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
  const guestName = b.customer?.fullName ?? b.reference;

  return (
    <div className="space-y-6" data-booking-id={b.id}>
      {/* Top Breadcrumb & Action Header */}
      <div>
        <Link
          to={`${base}/bookings`}
          className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-brand-700 transition-colors mb-2"
        >
          ← Trở lại danh sách booking
        </Link>

        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 pb-4">
          <div className="flex items-center gap-3">
            <Avatar name={guestName} className="size-11 text-sm" />
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold text-zinc-900 tracking-tight">
                  {guestName}
                </h1>
                <Badge tone={STATUS_TONES[b.status] || "zinc"}>
                  {statusLabels[b.status] ?? b.status}
                </Badge>
              </div>
              <p className="text-xs text-zinc-500 mt-0.5">
                Mã: <strong className="font-semibold text-zinc-700">{b.reference}</strong> · Phòng{" "}
                <strong className="font-semibold text-zinc-700">{b.roomNumber}</strong> · {b.checkIn} →{" "}
                {b.checkOut} ({b.nights} đêm)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {b.status === "CONFIRMED" && <CheckInWizard bookingId={b.id} />}
            {b.status === "PENDING" && (
              <DeskAction
                action="confirm"
                path={`/bookings/${id}/confirm`}
                label="Xác nhận booking"
                description={`Xác nhận booking ${b.reference}, xếp phòng ${b.roomNumber}?`}
              />
            )}
            {b.status === "CHECKED_IN" && (
              <Link
                to={`${base}/bookings/${id}/billing`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 shadow-2xs transition-colors"
              >
                <LogOut className="size-3.5 text-amber-700" />
                Trả phòng & Hóa đơn
              </Link>
            )}
            <Link
              to={`${base}/bookings/${id}/billing`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
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
              />
            )}
          </div>
        </div>
      </div>

      {/* Reservation 360 Grid matching Kamra's ReservationDetail.tsx */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Card 1: Khách hàng */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="size-4 text-zinc-500" />
              <CardTitle>Thông tin khách hàng</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <dt className="text-xs text-zinc-400">Họ và tên</dt>
              <dd className="font-medium text-zinc-900 mt-0.5">{b.customer?.fullName ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-400">Số điện thoại</dt>
              <dd className="font-medium text-zinc-800 mt-0.5">{b.customer?.phone ?? "Chưa có SĐT"}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-400">Email liên hệ</dt>
              <dd className="font-medium text-zinc-800 mt-0.5">{b.customer?.email ?? "—"}</dd>
            </div>
            <div className="border-t border-zinc-100 pt-2 text-xs text-zinc-400">
              Tạo hồ sơ lúc: {new Date(b.createdAt).toLocaleString("vi-VN")}
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Phòng & Kỳ nghỉ */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <BedDouble className="size-4 text-zinc-500" />
              <CardTitle>Phòng & Kỳ nghỉ</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <div>
                <dt className="text-xs text-zinc-400">Số phòng</dt>
                <dd className="text-base font-bold text-zinc-900 mt-0.5">Phòng {b.roomNumber}</dd>
              </div>
              <span className="text-xs text-zinc-500">{b.room?.roomType.name}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <dt className="text-zinc-400">Nhận phòng</dt>
                <dd className="font-medium text-zinc-800 mt-0.5">{b.checkIn}</dd>
              </div>
              <div>
                <dt className="text-zinc-400">Trả phòng</dt>
                <dd className="font-medium text-zinc-800 mt-0.5">{b.checkOut}</dd>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs border-t border-zinc-100 pt-2">
              <span className="text-zinc-500">Số đêm & khách:</span>
              <strong className="text-zinc-800">
                {b.nights} đêm · {b.guestCount} khách
              </strong>
            </div>
            {b.room && (
              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-zinc-500">Trạng thái phòng:</span>
                <Badge
                  tone={
                    b.room.housekeepingStatus === "CLEAN"
                      ? "green"
                      : b.room.housekeepingStatus === "DIRTY"
                      ? "amber"
                      : "zinc"
                  }
                >
                  {b.room.operationalStatus} · {b.room.housekeepingStatus}
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card 3: Chi phí & Hóa đơn */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Receipt className="size-4 text-zinc-500" />
              <CardTitle>Chi phí & Hóa đơn</CardTitle>
            </div>
            <Link
              to={`${base}/bookings/${id}/billing`}
              className="text-xs font-medium text-brand-700 hover:underline"
            >
              Mở hóa đơn →
            </Link>
          </CardHeader>
          <CardContent className="space-y-2.5 text-sm">
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
                <span className="text-zinc-500">Dịch vụ hoàn thành:</span>
                <span className="tabular-nums font-medium text-zinc-800">
                  {money(preview.data.serviceAmount)}
                </span>
              </div>
            )}
            <div className="border-t border-zinc-100 pt-2 flex items-center justify-between font-semibold">
              <span className="text-zinc-700">Tổng chi phí:</span>
              <span className="tabular-nums text-brand-700 text-base">
                {preview.data ? money(preview.data.totalAmount) : money(b.totalRoomAmount)}
              </span>
            </div>
            {invoice.data && (
              <div className="flex items-center justify-between text-xs pt-1 border-t border-zinc-100">
                <span className="text-zinc-500">Còn phải thu:</span>
                <span
                  className={`tabular-nums font-bold ${
                    Number(invoice.data.balance) > 0 ? "text-amber-700" : "text-emerald-700"
                  }`}
                >
                  {money(invoice.data.balance)}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Service Orders & Recorded Payments Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Service Orders */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="size-4 text-zinc-500" />
              <CardTitle>Đơn dịch vụ phòng đã đặt</CardTitle>
            </div>
            {orders.data && (
              <span className="text-xs text-zinc-400">
                {orders.data.meta.total} đơn
              </span>
            )}
          </CardHeader>
          <CardContent className="pt-1">
            {!orders.data?.data.length ? (
              <p className="py-6 text-center text-xs text-zinc-400">
                Chưa có đơn dịch vụ phát sinh trong kỳ nghỉ này.
              </p>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {orders.data.data.map((o) => (
                  <li key={o.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="font-medium text-zinc-800">
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
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CreditCard className="size-4 text-zinc-500" />
              <CardTitle>Khoản thanh toán ghi nhận</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-1">
            {!invoice.data?.payments.length ? (
              <p className="py-6 text-center text-xs text-zinc-400">
                Chưa có khoản thu nào được ghi nhận cho hóa đơn này.
              </p>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {invoice.data.payments.map((p) => (
                  <li key={p.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="font-medium text-zinc-800">
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
    </div>
  );
}
