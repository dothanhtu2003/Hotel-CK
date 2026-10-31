import { useState } from "react";
import { Link, useLocation, useParams } from "react-router";
import {
  Clock,
  LogOut,
  Plus,
  Receipt,
  Utensils,
} from "lucide-react";
import { ErrorState } from "../components/ui";
import {
  Avatar,
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  type BadgeTone,
} from "../components/kamra-ui";
import { Skeleton } from "../features/guest/components";
import {
  money,
  statusLabels,
  type Order,
  type Page,
  type Preview,
} from "../features/guest/contracts";
import { CheckInWizard } from "../features/reception/check-in";
import { DeskAction } from "../features/reception/components";
import { type DeskBooking } from "../features/reception/contracts";
import {
  useDeskBase,
  useDeskGet,
  useDeskInvoice,
} from "../features/reception/queries";
import { CreateServiceOrder } from "../features/reception/create-service-order";

const STATUS_TONES: Record<string, BadgeTone> = {
  CONFIRMED: "sky",
  CHECKED_IN: "green",
  CHECKED_OUT: "zinc",
  CANCELLED: "rose",
  PENDING: "amber",
};

function cleanServiceName(name: string) {
  return name.replace(/^TEST\s*-\s*\d{8}\s*/i, "").trim() || name;
}

export function ReceptionBookingDetailPage() {
  const location = useLocation();
  const { id = "" } = useParams(),
    base = useDeskBase();
  const [createOrderOpen, setCreateOrderOpen] = useState(false);
  const query = useDeskGet<DeskBooking>("/front-desk/bookings/" + id);
  const preview = useDeskGet<Preview>(`/bookings/${id}/billing-preview`);
  const invoice = useDeskInvoice(id);
  const orders = useDeskGet<Page<Order>>(
    `/front-desk/orders?bookingId=${id}&pageSize=20`,
  );

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
        <ErrorState
          message={query.error.message}
          retry={() => void query.refetch()}
        />
      </div>
    );
  }

  const b = query.data!;
  const origin = location.state as { returnTo?: string; returnLabel?: string } | null;
  const returnTo = origin?.returnTo;
  const fromToday = typeof returnTo === 'string' && (returnTo === base || returnTo.startsWith(base + '?'));
  const beforeArrival = b.status === 'PENDING' || b.status === 'CONFIRMED';
  const rawName = b.customer?.fullName?.trim();
  const guestName = rawName
    ? rawName
        .split(" ")
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ")
    : b.reference;

  return (
    <div className="desk-page space-y-4 max-w-6xl mx-auto pb-10" data-booking-id={b.id}>
      {createOrderOpen && (
        <CreateServiceOrder
          onClose={() => setCreateOrderOpen(false)}
          onCreated={() => {
            setCreateOrderOpen(false);
            void orders.refetch();
            void preview.refetch();
            void invoice.refetch();
          }}
        />
      )}

      {/* Breadcrumb */}
      <div>
        <Link
          to={fromToday ? returnTo : `${base}/bookings`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-brand-700 transition-colors"
        >
          ← {fromToday ? 'Trở lại Hôm nay' : 'Trở lại danh sách booking'}
        </Link>
      </div>

      {/* Top Banner: Tất cả thông tin khách & phòng trên 1 khối gọn gàng duy nhất */}
      <div className="rounded-2xl border border-zinc-200/90 bg-white p-4 sm:p-5 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <Avatar
              name={guestName}
              className="size-12 text-sm font-bold shadow-2xs shrink-0"
            />
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="inline-flex items-center rounded-md bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand-800">
                  Phòng {b.roomNumber}
                </span>
                <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 tracking-tight">
                  {guestName}
                </h1>
                {b.customer?.phone && (
                  <a
                    href={`tel:${b.customer.phone}`}
                    className="text-xs font-mono font-medium text-zinc-600 hover:text-brand-700 hover:underline bg-zinc-100 px-2 py-0.5 rounded-md"
                  >
                    📞 {b.customer.phone}
                  </a>
                )}
                <Badge
                  tone={STATUS_TONES[b.status] || "zinc"}
                  className="status-badge text-xs px-2.5 py-0.5"
                >
                  {beforeArrival ? "Chờ nhận phòng" : statusLabels[b.status] ?? b.status}
                </Badge>
              </div>

              <div className="flex items-center gap-2 text-xs sm:text-sm text-zinc-500 mt-1 flex-wrap">
                <span className="font-medium text-zinc-700">
                  {b.room?.roomType.name ?? "Standard"}
                </span>
                <span>·</span>
                <span className="tabular-nums">
                  📅 {b.checkIn.split("-").reverse().join("/")} →{" "}
                  {b.checkOut.split("-").reverse().join("/")} ({b.nights} đêm ·{" "}
                  {b.guestCount} khách)
                </span>
                <span>·</span>
                <span className="font-mono text-zinc-400 text-xs">
                  {b.reference}
                </span>
                {b.room && (
                  <>
                    <span>·</span>
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                        b.room.housekeepingStatus === "CLEAN"
                          ? "text-emerald-700"
                          : "text-amber-700"
                      }`}
                    >
                      {b.room.housekeepingStatus === "CLEAN"
                        ? "🟢 Phòng sạch"
                        : "🟠 Cần dọn"}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {b.status === "CHECKED_IN" && (
              <>
                <button
                  type="button"
                  onClick={() => setCreateOrderOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition-colors shadow-2xs cursor-pointer"
                >
                  <Utensils className="size-3.5 text-brand-700" />
                  + Thêm dịch vụ phòng
                </button>
                <Link
                  to={`${base}/bookings/${id}/billing`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 shadow-2xs transition-colors"
                >
                  <LogOut className="size-3.5" />
                  Trả phòng & Hóa đơn
                </Link>
              </>
            )}
            {beforeArrival && (
              <>
                <CheckInWizard
                  bookingId={b.id}
                  variant="primary"
                  className="!bg-brand-600 !text-white hover:!bg-brand-700 !border-transparent px-3.5 py-1.5 font-semibold text-xs shadow-2xs"
                />
                <DeskAction
                  action="cancel"
                  path={`/bookings/${id}/cancel`}
                  label="Hủy booking"
                  description={`Hủy booking ${b.reference}? Phòng có thể được mở lại cho khách khác.`}
                  variant="ghost"
                  className="!text-rose-600 hover:!bg-rose-50 !border-transparent text-xs py-1.5 px-2"
                />
              </>
            )}
            {b.status === "CHECKED_OUT" && (
              <Link
                to={`${base}/bookings/${id}/billing`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition-colors shadow-2xs"
              >
                <Receipt className="size-3.5 text-zinc-500" />
                Xem chi phí & hóa đơn
              </Link>
            )}
          </div>
        </div>
      </div>

      {beforeArrival ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="rounded-2xl border-zinc-200/90 shadow-2xs">
            <CardHeader><CardTitle>Thông tin đặt phòng</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="rounded-xl bg-brand-50 p-4 text-brand-900">
                <p className="font-semibold">Chờ nhận phòng</p>
                
              </div>
              <dl className="grid grid-cols-2 gap-4">
                <div><dt className="text-xs text-zinc-500">Khách hàng</dt><dd className="mt-1 font-semibold">{guestName}</dd></div>
                <div><dt className="text-xs text-zinc-500">Số điện thoại</dt><dd className="mt-1">{b.customer?.phone || 'Chưa cung cấp'}</dd></div>
                <div><dt className="text-xs text-zinc-500">Ngày nhận phòng</dt><dd className="mt-1">{b.checkIn.split('-').reverse().join('/')}</dd></div>
                <div><dt className="text-xs text-zinc-500">Ngày trả phòng</dt><dd className="mt-1">{b.checkOut.split('-').reverse().join('/')}</dd></div>
                <div><dt className="text-xs text-zinc-500">Phòng</dt><dd className="mt-1">{b.roomNumber} · {b.room?.roomType.name}</dd></div>
                <div><dt className="text-xs text-zinc-500">Lưu trú</dt><dd className="mt-1">{b.nights} đêm · {b.guestCount} khách</dd></div>
              </dl>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-zinc-200/90 shadow-2xs">
            <CardHeader><CardTitle>Tiền phòng dự kiến</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex justify-between"><span className="text-zinc-500">Giá mỗi đêm</span><span>{money(b.nightlyPrice)}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Số đêm</span><span>{b.nights} đêm</span></div>
              <div className="flex justify-between border-t border-zinc-200 pt-4 font-bold"><span>Tổng tiền phòng</span><span className="text-lg text-brand-800">{money(b.totalRoomAmount)}</span></div>
            </CardContent>
          </Card>
        </div>
      ) : (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* CỘT TRÁI: Dịch vụ phòng đã gọi */}
        <Card className="rounded-2xl border-zinc-200/90 shadow-2xs flex flex-col justify-between">
          <CardHeader className="border-b border-zinc-100 pb-3 flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-brand-50 text-brand-700">
                <Utensils className="size-4" />
              </div>
              <CardTitle className="text-sm font-bold text-zinc-900">
                Dịch vụ phòng đã dùng
              </CardTitle>
            </div>
            <div className="flex items-center gap-2">
              {orders.data && (
                <span className="text-xs font-semibold text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded-md">
                  {orders.data.meta.total} đơn
                </span>
              )}
              {b.status === "CHECKED_IN" && (
                <button
                  type="button"
                  onClick={() => setCreateOrderOpen(true)}
                  className="text-xs font-semibold text-brand-700 hover:text-brand-800 hover:underline cursor-pointer"
                >
                  + Thêm món
                </button>
              )}
            </div>
          </CardHeader>

          <CardContent className="pt-3 flex-1 flex flex-col justify-between">
            {!orders.data?.data.length ? (
              <div className="py-10 text-center">
                <p className="text-xs text-zinc-400">
                  Chưa có dịch vụ phòng nào phát sinh trong kỳ nghỉ này.
                </p>
                {b.status === "CHECKED_IN" && (
                  <button
                    type="button"
                    onClick={() => setCreateOrderOpen(true)}
                    className="mt-2 text-xs font-semibold text-brand-700 hover:underline cursor-pointer inline-flex items-center gap-1"
                  >
                    <Plus className="size-3" /> Gọi dịch vụ ngay
                  </button>
                )}
              </div>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {orders.data.data.map((o) => (
                  <li
                    key={o.id}
                    className="py-3 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="font-semibold text-zinc-900 text-xs sm:text-sm">
                        {o.items
                          .map(
                            (i) =>
                              `${cleanServiceName(i.serviceName)} × ${i.quantity}`,
                          )
                          .join(", ")}
                      </div>
                      <div className="text-[11px] text-zinc-400 flex items-center gap-1 mt-0.5">
                        <Clock className="size-3" />
                        {new Date(o.orderedAt).toLocaleString("vi-VN", {
                          hour: "2-digit",
                          minute: "2-digit",
                          day: "2-digit",
                          month: "2-digit",
                        })}
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className="font-bold tabular-nums text-zinc-900 text-xs sm:text-sm">
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
                        className="text-[11px] px-2 py-0.5"
                      >
                        {statusLabels[o.status] ?? o.status}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* CỘT PHẢI: Bảng kê chi phí & Quyết toán */}
        <Card className="rounded-2xl border-zinc-200/90 shadow-2xs flex flex-col justify-between">
          <CardHeader className="border-b border-zinc-100 pb-3 flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700">
                <Receipt className="size-4" />
              </div>
              <CardTitle className="text-sm font-bold text-zinc-900">
                Chi phí & Quyết toán
              </CardTitle>
            </div>
            <Link
              to={`${base}/bookings/${id}/billing`}
              className="text-xs font-semibold text-brand-700 hover:text-brand-800 hover:underline"
            >
              Hồ sơ chi phí →
            </Link>
          </CardHeader>

          <CardContent className="pt-3.5 space-y-4 text-xs sm:text-sm flex-1 flex flex-col justify-between">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-500">
                  Tiền phòng ({b.nights} đêm):
                </span>
                <span className="tabular-nums font-semibold text-zinc-900">
                  {money(b.totalRoomAmount)}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-500">
                  Dịch vụ phòng{" "}
                  {orders.data?.data.length
                    ? `(${orders.data.meta.total} đơn)`
                    : ""}
                  :
                </span>
                <span className="tabular-nums font-semibold text-zinc-900">
                  {preview.data ? money(preview.data.serviceAmount) : "0 ₫"}
                </span>
              </div>

              <div className="border-t border-zinc-200/80 pt-2.5 flex items-baseline justify-between">
                <span className="font-bold text-zinc-900 text-sm">
                  TỔNG CHI PHÍ:
                </span>
                <span className="tabular-nums font-bold text-brand-800 text-lg">
                  {preview.data
                    ? money(preview.data.totalAmount)
                    : money(b.totalRoomAmount)}
                </span>
              </div>

              {/* Trạng thái công nợ / Còn phải thu */}
              <div className="pt-1">
                {invoice.data ? (
                  <div
                    className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                      Number(invoice.data.balance) > 0
                        ? "bg-amber-50/80 border-amber-200 text-amber-900"
                        : "bg-emerald-50/80 border-emerald-200 text-emerald-900"
                    }`}
                  >
                    <div>
                      <span className="font-bold block">
                        {Number(invoice.data.balance) > 0
                          ? "⚠️ CÒN PHẢI THU:"
                          : "✓ ĐÃ THANH TOÁN ĐỦ:"}
                      </span>
                      <span className="text-[11px] opacity-75">
                        Đã thu: {money(invoice.data.paidAmount)}
                      </span>
                    </div>
                    <span className="tabular-nums font-extrabold text-base">
                      {money(invoice.data.balance)}
                    </span>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl border bg-amber-50/80 border-amber-200 text-amber-900 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold block">
                        ⚠️ CÒN PHẢI THU (Tạm tính):
                      </span>
                      <span className="text-[11px] opacity-75">
                        Chưa phát hành hóa đơn
                      </span>
                    </div>
                    <span className="tabular-nums font-extrabold text-base">
                      {preview.data
                        ? money(preview.data.totalAmount)
                        : money(b.totalRoomAmount)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Nút thanh toán & trả phòng */}
            {(b.status === 'CHECKED_IN' || b.status === 'CHECKED_OUT') && <div className="pt-2">
              <Link
                to={`${base}/bookings/${id}/billing`}
                className="w-full h-9 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors cursor-pointer shadow-2xs flex items-center justify-center gap-1.5"
              >
                <LogOut className="size-3.5" />
                {b.status === 'CHECKED_IN' ? 'Trả phòng & Thu tiền' : 'Xem hóa đơn'} (
                {preview.data
                  ? money(preview.data.totalAmount)
                  : money(b.totalRoomAmount)}
                )
              </Link>
            </div>}
          </CardContent>
        </Card>
      </div>
      )}


    </div>
  );
}
