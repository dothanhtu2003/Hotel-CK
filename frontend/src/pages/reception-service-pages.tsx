import { Link, useParams, useSearchParams } from "react-router";
import {
  ArrowLeft,
  BellRing,
  Calendar,
  CheckCircle2,
  Clock,
  ConciergeBell,
  Utensils,
  XCircle,
} from "lucide-react";
import {
  EmptyState,
  ErrorState,
  LinkButton,
  Pagination,
  Table,
} from "../components/ui";
import { Skeleton } from "../features/guest/components";
import {
  money,
  statusLabels,
  type Order,
  type Page,
} from "../features/guest/contracts";
import { DeskAction, OrderItems } from "../features/reception/components";
import { pageNumber, type DeskBooking } from "../features/reception/contracts";
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
} from "../components/kamra-ui";

type DeskOrder = Order & {
  reference: string;
  roomNumber: string;
  customerName: string;
  canProcess: boolean;
};

export function ReceptionOrdersPage() {
  const [params, setParams] = useSearchParams();
  const base = useDeskBase();
  const page = pageNumber(params.get("page"));
  const raw = params.get("status") ?? "";
  const status = ["PENDING", "COMPLETED", "CANCELLED"].includes(raw) ? raw : "";

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    next.delete("page");
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  };

  const query = useDeskGet<Page<DeskOrder>>(
    `/front-desk/orders?page=${page}&pageSize=10${status ? "&status=" + status : ""}${
      params.get("bookingId")
        ? "&bookingId=" + encodeURIComponent(params.get("bookingId")!)
        : ""
    }`,
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-700">
          <Utensils className="size-3.5" />
          Dịch vụ phòng · Room Service
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
              Quản lý đơn dịch vụ
            </h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              Theo dõi, hoàn thành hoặc hủy đơn dịch vụ của khách. Giá tiền được lưu theo snapshot lúc khách đặt.
            </p>
          </div>
        </div>
      </div>

      {/* Status Filter Tab Pills */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-3 shadow-2xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors cursor-pointer ${
              !status
                ? "bg-brand-50 text-brand-700 font-semibold"
                : "text-zinc-600 hover:bg-zinc-100"
            }`}
            onClick={() => update("status", "")}
          >
            Tất cả đơn
          </button>
          <button
            type="button"
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors cursor-pointer ${
              status === "PENDING"
                ? "bg-amber-50 text-amber-800 font-semibold border border-amber-200"
                : "text-zinc-600 hover:bg-zinc-100"
            }`}
            onClick={() => update("status", "PENDING")}
          >
            Chờ xử lý (Pending)
          </button>
          <button
            type="button"
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors cursor-pointer ${
              status === "COMPLETED"
                ? "bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200"
                : "text-zinc-600 hover:bg-zinc-100"
            }`}
            onClick={() => update("status", "COMPLETED")}
          >
            Đã hoàn thành (Completed)
          </button>
          <button
            type="button"
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors cursor-pointer ${
              status === "CANCELLED"
                ? "bg-zinc-100 text-zinc-700 font-semibold"
                : "text-zinc-600 hover:bg-zinc-100"
            }`}
            onClick={() => update("status", "CANCELLED")}
          >
            Đã hủy (Cancelled)
          </button>
        </div>

        {params.get("bookingId") && (
          <div className="flex items-center gap-2 text-xs text-brand-700 bg-brand-50 px-2.5 py-1 rounded-md">
            <span>Lọc theo booking: {params.get("bookingId")?.slice(0, 8)}</span>
            <button
              type="button"
              className="text-zinc-400 hover:text-zinc-700 font-bold ml-1 cursor-pointer"
              onClick={() => update("bookingId", "")}
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Orders Table Card */}
      <Card>
        <CardHeader className="pb-2 border-b border-zinc-100">
          <CardTitle className="text-sm font-semibold text-zinc-900 flex items-center justify-between">
            <span>Danh sách yêu cầu dịch vụ</span>
            {query.data?.meta && (
              <span className="text-xs text-zinc-500 font-normal">
                Tổng cộng: {query.data.meta.total} đơn
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          {query.isPending ? (
            <Skeleton />
          ) : query.error ? (
            <ErrorState
              message={query.error.message}
              retry={() => void query.refetch()}
            />
          ) : (
            <>
              <Table
                caption="Danh sách đơn dịch vụ"
                rows={query.data!.data}
                rowKey={(o) => o.id}
                empty={
                  <EmptyState
                    title="Không có đơn dịch vụ phù hợp"
                    description="Thử chọn trạng thái khác hoặc quay lại khi khách tạo yêu cầu mới."
                  />
                }
                columns={[
                  {
                    title: "MÃ ĐƠN",
                    render: (o) => (
                      <div className="space-y-0.5">
                        <Link
                          to={`${base}/service-orders/${o.id}`}
                          className="font-mono text-xs font-semibold text-brand-700 hover:underline block"
                        >
                          {o.id.slice(0, 8)}
                        </Link>
                        <span className="text-[11px] text-zinc-400 flex items-center gap-1">
                          <Clock className="size-3" />
                          {new Date(o.orderedAt).toLocaleString("vi-VN", {
                            hour: "2-digit",
                            minute: "2-digit",
                            day: "2-digit",
                            month: "2-digit",
                          })}
                        </span>
                      </div>
                    ),
                  },
                  {
                    title: "PHÒNG & KHÁCH",
                    render: (o) => (
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex items-center rounded bg-brand-50 px-1.5 py-0.5 text-xs font-bold text-brand-800">
                            P.{o.roomNumber}
                          </span>
                          <Link
                            to={`${base}/bookings/${o.bookingId}`}
                            className="text-xs font-medium text-zinc-900 hover:text-brand-700"
                          >
                            {o.reference}
                          </Link>
                        </div>
                        <span className="text-xs text-zinc-500 block">
                          {o.customerName}
                        </span>
                      </div>
                    ),
                  },
                  {
                    title: "CHI TIẾT MÓN",
                    render: (o) => (
                      <div className="max-w-xs text-xs text-zinc-700 leading-snug">
                        {o.items.map((i) => (
                          <span key={i.id} className="inline-block mr-2">
                            {i.serviceName}{" "}
                            <strong className="text-zinc-900">×{i.quantity}</strong>
                          </span>
                        ))}
                      </div>
                    ),
                  },
                  {
                    title: "TỔNG TIỀN",
                    render: (o) => (
                      <span className="font-semibold text-xs text-zinc-900 tabular-nums">
                        {money(o.totalAmount)}
                      </span>
                    ),
                  },
                  {
                    title: "TRẠNG THÁI",
                    render: (o) => (
                      <Badge
                        tone={
                          o.status === "COMPLETED"
                            ? "green"
                            : o.status === "PENDING"
                            ? "amber"
                            : "zinc"
                        }
                      >
                        {statusLabels[o.status] ?? o.status}
                      </Badge>
                    ),
                  },
                  {
                    title: "THAO TÁC",
                    render: (o) => (
                      <div className="flex items-center gap-2">
                        <LinkButton
                          variant="secondary"
                          to={`${base}/service-orders/${o.id}`}
                        >
                          Chi tiết
                        </LinkButton>
                        {o.status === "PENDING" && o.canProcess && (
                          <>
                            <DeskAction
                              path={`/service-orders/${o.id}/complete`}
                              action="complete"
                              label="Xong"
                              description={`Xác nhận đã cung cấp dịch vụ phòng ${o.roomNumber}?`}
                            />
                            <DeskAction
                              path={`/service-orders/${o.id}/cancel`}
                              action="cancel"
                              label="Hủy"
                              description={`Hủy đơn của phòng ${o.roomNumber}?`}
                            />
                          </>
                        )}
                      </div>
                    ),
                  },
                ]}
              />
              <Pagination
                {...query.data!.meta}
                onChange={(p) => {
                  const next = new URLSearchParams(params);
                  next.set("page", String(p));
                  setParams(next);
                }}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function ReceptionOrderDetailPage() {
  const { id = "" } = useParams();
  const base = useDeskBase();

  const query = useDeskGet<Order>("/service-orders/" + id);
  const booking = useDeskGet<DeskBooking>(
    "/front-desk/bookings/" + (query.data?.bookingId ?? ""),
    !!query.data,
  );
  const invoice = useDeskInvoice(query.data?.bookingId ?? "");

  if (query.isPending) return <Skeleton />;
  if (query.error) {
    return (
      <ErrorState
        message={query.error.message}
        retry={() => void query.refetch()}
      />
    );
  }

  const o = query.data!;
  const eligible =
    o.status === "PENDING" &&
    booking.data?.status === "CHECKED_IN" &&
    invoice.isSuccess &&
    invoice.data === null;

  return (
    <div className="desk-page space-y-6 max-w-4xl mx-auto pb-12">
      {/* Top Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          to={base + "/service-orders"}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900 transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          Quay lại danh sách đơn dịch vụ
        </Link>
        <span className="text-xs text-zinc-400 font-mono">
          Mã đơn: {o.id}
        </span>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-700">
            <ConciergeBell className="size-3.5" />
            Chi tiết yêu cầu dịch vụ
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 mt-1">
            Đơn #{o.id.slice(0, 8)}
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5 flex items-center gap-1.5">
            <Clock className="size-3 text-zinc-400" />
            Đặt lúc: {new Date(o.orderedAt).toLocaleString("vi-VN")}
          </p>
        </div>
        <Badge
          className="status-badge"
          tone={
            o.status === "COMPLETED"
              ? "green"
              : o.status === "PENDING"
              ? "amber"
              : "zinc"
          }
        >
          {statusLabels[o.status] ?? o.status}
        </Badge>
      </div>

      {/* Booking and Guest Context Card */}
      {booking.data && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center gap-3">
            <Avatar
              name={booking.data.customer?.fullName ?? "Khách"}
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-zinc-900">
                  {booking.data.customer?.fullName}
                </span>
                <span className="text-xs text-zinc-500">
                  ({booking.data.customer?.email})
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-zinc-500 mt-0.5">
                <span className="font-semibold text-brand-800">
                  Phòng {booking.data.roomNumber}
                </span>
                <span>•</span>
                <span className="inline-flex items-center gap-1">
                  <Calendar className="size-3 text-zinc-400" />
                  {booking.data.checkIn} → {booking.data.checkOut}
                </span>
              </div>
            </div>
          </div>
          <Link
            to={`${base}/bookings/${o.bookingId}`}
            className="text-xs font-medium text-brand-700 hover:text-brand-800 underline underline-offset-2"
          >
            Mã booking: {booking.data.reference}
          </Link>
        </div>
      )}

      {/* Items Breakdown Card */}
      <Card>
        <CardHeader className="pb-3 border-b border-zinc-100">
          <CardTitle className="text-sm font-semibold text-zinc-900 flex items-center justify-between">
            <span>Danh mục dịch vụ & Đơn giá</span>
            <span className="text-xs text-zinc-500 font-normal">
              Snapshot giá tại thời điểm đặt
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <OrderItems order={o} />
          <div className="flex items-center justify-between pt-3 border-t border-zinc-200 text-sm">
            <span className="font-semibold text-zinc-900">
              Tổng tiền thanh toán đã chốt
            </span>
            <span className="text-base font-bold text-brand-900 tabular-nums">
              {money(o.totalAmount)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Action / Resolution Card */}
      <Card>
        <CardHeader className="pb-2 border-b border-zinc-100">
          <CardTitle className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
            <BellRing className="size-4 text-brand-700" />
            Xử lý & Cập nhật trạng thái
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          {booking.isPending || invoice.isPending ? (
            <Skeleton />
          ) : booking.error || invoice.error ? (
            <ErrorState
              message={(booking.error ?? invoice.error)!.message}
              retry={() => {
                void booking.refetch();
                void invoice.refetch();
              }}
            />
          ) : eligible ? (
            <div className="space-y-3">
              <p className="text-xs text-zinc-600">
                Xác nhận cung cấp dịch vụ hoặc hủy đơn theo yêu cầu của khách. Khi hoàn thành, khoản phí sẽ được tự động cộng vào dự toán chi phí lưu trú của booking.
              </p>
              <div className="flex items-center gap-3 pt-2">
                <DeskAction
                  path={`/service-orders/${id}/complete`}
                  action="complete"
                  label="Hoàn thành dịch vụ"
                  description="Xác nhận đã cung cấp toàn bộ dịch vụ trong đơn? Giá snapshot sẽ được tính vào billing khi hoàn thành."
                />
                <DeskAction
                  path={`/service-orders/${id}/cancel`}
                  action="cancel"
                  label="Hủy đơn dịch vụ"
                  description="Hủy toàn bộ các dịch vụ đang chờ trong đơn?"
                />
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3.5 text-xs text-zinc-600 space-y-1">
              <div className="flex items-center gap-2 font-medium text-zinc-800">
                {o.status === "COMPLETED" ? (
                  <>
                    <CheckCircle2 className="size-4 text-emerald-600" />
                    <span>Đơn dịch vụ đã hoàn thành</span>
                  </>
                ) : o.status === "CANCELLED" ? (
                  <>
                    <XCircle className="size-4 text-zinc-500" />
                    <span>Đơn dịch vụ đã bị hủy</span>
                  </>
                ) : (
                  <>
                    <Clock className="size-4 text-amber-600" />
                    <span>Đơn đang chờ nhưng chưa thể cập nhật</span>
                  </>
                )}
              </div>
              <p className="text-zinc-500">
                {o.status === "COMPLETED"
                  ? "Dịch vụ đã được ghi nhận vào billing của phòng và không thể thay đổi."
                  : o.status === "CANCELLED"
                  ? "Đơn dịch vụ đã bị hủy bỏ và không tính phí."
                  : invoice.data !== null
                  ? "Hóa đơn của booking này đã được phát hành; không thể sửa đổi đơn dịch vụ."
                  : "Chỉ cập nhật được đơn của booking đang lưu trú (CHECKED_IN)."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
