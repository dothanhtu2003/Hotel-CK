import { serviceOrderLabel } from '../features/reception/service-order-label';
import { useState } from "react";
import "./reception-service-pages.css";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { CreateServiceOrder } from "../features/reception/create-service-order";
import {
  ArrowLeft,
  BedDouble,
  Car,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Package,
  Plus,
  Phone,
  Printer,
  Search,
  Sparkles,
  Utensils,
  X,
  XCircle,
} from "lucide-react";
import { Button } from "../components/ui";
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
  type Order,
  type Page,
} from "../features/guest/contracts";
import { ServiceOrderActions } from "../features/reception/service-order-actions";
import { pageNumber, type DeskBooking } from "../features/reception/contracts";
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

type DeskOrder = Order & {
  reference: string;
  roomNumber: string;
  customerName: string;
  canProcess: boolean;
};

export function ReceptionOrdersPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const base = useDeskBase();
  const page = pageNumber(params.get("page"));
  const raw = params.get("status") ?? "";
  const [search, setSearch] = useState(params.get("q") ?? "");
  const status = ["PENDING", "COMPLETED", "CANCELLED"].includes(raw) ? raw : "";

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    next.delete("page");
    if (value || key === "status") next.set(key, value);
    else next.delete(key);
    setParams(next);
  };

  const query = useDeskGet<Page<DeskOrder> & { counts: Record<string, number> }>(
    `/front-desk/orders?page=${page}&pageSize=10${status ? "&status=" + status : ""}${
      params.get("bookingId")
        ? "&bookingId=" + encodeURIComponent(params.get("bookingId")!)
        : ""
    }${params.get("q") ? "&q=" + encodeURIComponent(params.get("q")!) : ""}${params.get("date") ? "&date=" + encodeURIComponent(params.get("date")!) : ""}`,
  );

  return (
    <div className="service-orders-page max-w-6xl mx-auto pb-10">
      {createOpen && <CreateServiceOrder onClose={() => setCreateOpen(false)} onCreated={order => { setCreateOpen(false); navigate(`${base}/service-orders/${order.id}`); }} />}
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-zinc-900">
              Quản lý đơn dịch vụ
            </h1>
            <span className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">
              <Utensils className="size-3" />
              Room Service
            </span>
          </div>
          
        </div>

        <div>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="h-8.5 px-3.5 text-xs font-semibold rounded-lg bg-brand-700 hover:bg-brand-800 text-white transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
          >
            <Plus className="size-3.5" /> Thêm đơn dịch vụ
          </button>
        </div>
      </div>
      {/* Unified Compact Toolbar: Status Filter Tabs + Search & Date Filter */}
      <div className="service-order-toolbar">
        {/* Status Filter Tab Pills */}
        <div className="service-order-tabs">
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
            Yêu cầu từ khách ({query.data?.counts.PENDING ?? "…"})
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
            Đã ghi nhận ({query.data?.counts.COMPLETED ?? "…"})
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
            Đã hủy ({query.data?.counts.CANCELLED ?? "…"})
          </button>

          {params.get("bookingId") && (
            <div className="flex items-center gap-1.5 text-xs text-brand-700 bg-brand-50 border border-brand-200/60 px-2.5 py-1 rounded-md ml-1">
              <span>Lọc booking: {params.get("bookingId")?.slice(0, 8)}</span>
              <button
                type="button"
                className="text-zinc-400 hover:text-zinc-700 p-0.5 rounded cursor-pointer inline-flex items-center"
                onClick={() => update("bookingId", "")}
                title="Bỏ lọc theo booking"
              >
                <X className="size-3" />
              </button>
            </div>
          )}
        </div>

        {/* Search & Date Filter Form */}
        <form
          className="service-order-filter-form"
          onSubmit={(e) => {
            e.preventDefault();
            update("q", search.trim());
          }}
        >
          <div className="relative">
            <Search className="size-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              aria-label="Tìm phòng hoặc khách"
              placeholder="Số phòng, tên khách, mã booking…"
              maxLength={120}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8.5 w-44 sm:w-60 pl-8 pr-2.5 text-xs border border-zinc-200 rounded-lg bg-zinc-50/50 focus:bg-white focus:border-brand-600 focus:outline-none transition-colors"
            />
          </div>

          <input
            type="date"
            aria-label="Ngày đặt đơn"
            title="Lọc theo ngày đặt đơn"
            value={params.get("date") ?? ""}
            onChange={(e) => update("date", e.target.value)}
            className="h-8.5 px-2 text-xs border border-zinc-200 rounded-lg bg-zinc-50/50 focus:bg-white focus:border-brand-600 focus:outline-none transition-colors text-zinc-700"
          />

          <button
            type="submit"
            className="h-8.5 px-3 text-xs font-medium rounded-lg bg-brand-700 hover:bg-brand-800 text-white transition-colors cursor-pointer shrink-0"
          >
            Tìm kiếm
          </button>

          {(params.get("q") || params.get("date")) && (
            <button
              type="button"
              className="h-8.5 px-2.5 text-xs font-medium rounded-lg border border-zinc-200 hover:bg-zinc-100 text-zinc-600 transition-colors cursor-pointer shrink-0 inline-flex items-center gap-1"
              onClick={() => {
                const next = new URLSearchParams(params);
                ["q", "date", "page"].forEach((k) => next.delete(k));
                setSearch("");
                setParams(next);
              }}
            >
              <X className="size-3" /> Xóa bộ lọc
            </button>
          )}
        </form>
      </div>

      {/* Orders Table Card */}
      <Card>
        <CardHeader className="pb-2 border-b border-zinc-100">
          <CardTitle className="service-orders-heading text-sm font-semibold text-zinc-900 flex items-center justify-between">
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
                            {o.customerName}
                          </Link>
                        </div>
                        <span className="text-xs text-zinc-500 block">
                          {o.reference}
                        </span>
                      </div>
                    ),
                  },
                  {
                    title: "CHI TIẾT MÓN",
                    render: (o) => (
                      <div className="max-w-xs text-xs text-zinc-700 leading-snug">
                        {o.items.map((i) => (
                          <span key={i.id} className="service-order-item">
                            {i.serviceName.replace(/^TEST-\d{8}\s+/, "")}{" "}
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
                        {serviceOrderLabel(o)}
                      </Badge>
                    ),
                  },
                  {
                    title: "THAO TÁC",
                    render: (o) => (
                      <div className="service-order-actions">
                        <LinkButton
                          variant="secondary"
                          to={`${base}/service-orders/${o.id}`}
                        >
                          Chi tiết
                        </LinkButton>
                        {o.canProcess && <ServiceOrderActions order={o} />}
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

function cleanServiceName(name: string) {
  return name.replace(/^TEST\s*-\s*\d{8}\s*/i, "").trim() || name;
}

function getServiceIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes("ăn") || lower.includes("bữa") || lower.includes("tối") || lower.includes("sáng") || lower.includes("trưa") || lower.includes("food") || lower.includes("uống") || lower.includes("nước") || lower.includes("buffet")) {
    return <Utensils className="size-4 text-amber-600" />;
  }
  if (lower.includes("sân bay") || lower.includes("xe") || lower.includes("đón") || lower.includes("tiễn") || lower.includes("car") || lower.includes("transfer")) {
    return <Car className="size-4 text-sky-600" />;
  }
  if (lower.includes("giặt") || lower.includes("ủi") || lower.includes("laundry") || lower.includes("dọn") || lower.includes("vệ sinh")) {
    return <Sparkles className="size-4 text-teal-600" />;
  }
  return <Package className="size-4 text-emerald-600" />;
}

export function ReceptionOrderDetailPage() {
  const { id = "" } = useParams();
  const base = useDeskBase();
  const [copied, setCopied] = useState(false);

  const query = useDeskGet<Order>("/service-orders/" + id);
  const booking = useDeskGet<DeskBooking>(
    "/front-desk/bookings/" + (query.data?.bookingId ?? ""),
    !!query.data,
  );
  const invoice = useDeskInvoice(query.data?.bookingId ?? "");

  const handleCopyId = () => {
    if (id) {
      navigator.clipboard.writeText(id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

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
    o.status !== "CANCELLED" &&
    booking.data?.status === "CHECKED_IN" &&
    invoice.isSuccess &&
    invoice.data === null;

  const roomNum = booking.data?.roomNumber ?? "—";
  const customer = booking.data?.customer;

  return (
    <div className="desk-page space-y-4 max-w-5xl mx-auto pb-12">
      {/* 1. Top Navigation & Order ID */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs service-order-no-print">
        <Link
          to={base + "/service-orders"}
          className="inline-flex items-center gap-1.5 font-medium text-zinc-600 hover:text-zinc-900 transition-colors"
        >
          <ArrowLeft className="size-4" />
          <span>Quay lại danh sách đơn dịch vụ</span>
        </Link>
        <button
          type="button"
          onClick={handleCopyId}
          title="Sao chép toàn bộ mã UUID"
          className="inline-flex items-center gap-1.5 text-zinc-500 hover:text-zinc-800 font-mono text-xs bg-white hover:bg-zinc-50 border border-zinc-200/90 px-2.5 py-1 rounded-lg transition-colors cursor-pointer shadow-2xs"
        >
          {copied ? (
            <>
              <Check className="size-3 text-emerald-600" />
              <span className="text-emerald-700 font-sans font-medium">Đã sao chép</span>
            </>
          ) : (
            <>
              <Copy className="size-3 text-zinc-400" />
              <span>Mã đơn: {o.id.slice(0, 8)}…{o.id.slice(-6)}</span>
            </>
          )}
        </button>
      </div>

      {/* 2. Order Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-xl border border-zinc-200/90 shadow-2xs">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900">
              Đơn dịch vụ #{o.id.slice(0, 8)}
            </h1>
            <Badge
              className="px-2.5 py-1 text-xs font-semibold"
              tone={
                o.status === "COMPLETED"
                  ? "green"
                  : o.status === "PENDING"
                  ? "amber"
                  : "zinc"
              }
            >
              {o.status === "PENDING" && (
                <span className="inline-block size-1.5 rounded-full bg-amber-600 animate-pulse mr-1.5" />
              )}
              {o.status === "COMPLETED" && (
                <CheckCircle2 className="size-3.5 mr-1 text-emerald-700 inline" />
              )}
              {serviceOrderLabel(o)}
            </Badge>
          </div>
          <p className="text-xs text-zinc-500 mt-1 flex items-center gap-1.5">
            <Clock className="size-3.5 text-zinc-400" />
            Thời gian đặt:{" "}
            <span className="text-zinc-700 font-medium">
              {new Date(o.orderedAt).toLocaleString("vi-VN", {
                timeZone: "Asia/Bangkok",
                hour: "2-digit",
                minute: "2-digit",
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })}
            </span>
          </p>
        </div>

        <div className="text-right">
          <div className="text-xs text-zinc-400">Tổng thanh toán</div>
          <div className="text-xl sm:text-2xl font-black text-brand-900 tabular-nums">
            {money(o.totalAmount)}
          </div>
        </div>
      </div>

      {/* 3. Main 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: 7 cols */}
        <div className="lg:col-span-7 space-y-4">
          {/* Guest & Room Destination */}
          {booking.data ? (
            <div className="rounded-xl border border-zinc-200/90 bg-white p-4 shadow-2xs flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-brand-50 border border-brand-200/80 text-brand-900 font-bold text-sm">
                  <BedDouble className="size-4 text-brand-700" />
                  Phòng {booking.data.roomNumber}
                </span>
                <span className="font-semibold text-zinc-900 text-sm">
                  {customer?.fullName || "Khách lẻ tại quầy"}
                </span>
                {customer?.phone && (
                  <span className="text-xs text-zinc-500 flex items-center gap-1">
                    <Phone className="size-3 text-zinc-400" />
                    {customer.phone}
                  </span>
                )}
                <span className="text-xs text-zinc-400">
                  ({booking.data.checkIn} → {booking.data.checkOut})
                </span>
              </div>

              <Link
                to={`${base}/bookings/${o.bookingId}`}
                className="text-xs font-medium text-brand-700 hover:underline inline-flex items-center gap-1 shrink-0"
              >
                <span>Booking #{booking.data.reference}</span>
                <ExternalLink className="size-3" />
              </Link>
            </div>
          ) : null}

          {/* Service Items Table */}
          <div className="rounded-xl border border-zinc-200/90 bg-white overflow-hidden shadow-2xs">
            <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-600">
                Chi tiết dịch vụ ({o.items.length} món)
              </span>
              <span className="text-xs text-zinc-400">
                Đơn giá snapshot chốt khi đặt
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 text-[11px] font-bold uppercase tracking-wider text-zinc-500 bg-white">
                    <th className="py-2.5 px-4">Dịch vụ</th>
                    <th className="py-2.5 px-3 text-center">Số lượng</th>
                    <th className="py-2.5 px-3 text-right">Đơn giá</th>
                    <th className="py-2.5 px-4 text-right">Thành tiền</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {o.items.map((item, idx) => {
                    const cleanName = cleanServiceName(item.serviceName);
                    const icon = getServiceIcon(item.serviceName);
                    return (
                      <tr
                        key={item.id || idx}
                        className="hover:bg-zinc-50/50 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <span className="p-1.5 rounded-lg bg-zinc-100 text-zinc-600 shrink-0">
                              {icon}
                            </span>
                            <span className="font-semibold text-zinc-900">
                              {cleanName}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center font-medium tabular-nums">
                          ×{item.quantity}
                        </td>
                        <td className="py-3 px-3 text-right text-zinc-600 tabular-nums">
                          {money(item.unitPrice)}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-zinc-900 tabular-nums">
                          {money(item.subtotal)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-zinc-200 bg-zinc-50/60">
                    <td colSpan={3} className="py-3 px-4 font-bold text-zinc-700 text-right">
                      Tổng cộng:
                    </td>
                    <td className="py-3 px-4 text-right text-base sm:text-lg font-extrabold text-brand-900 tabular-nums">
                      {money(o.totalAmount)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: 5 cols */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-xl border border-zinc-200/90 bg-white p-5 shadow-2xs space-y-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-1">
                Phương thức & Trạng thái
              </span>
              <p className="text-xs text-zinc-600 leading-relaxed">
                {o.status === 'CANCELLED'
                  ? (o.refundedAt ? 'Đơn đã hủy và đã ghi nhận hoàn đủ tiền cho khách.' : 'Đơn đã hủy, không tính phí.')
                  : o.paymentMethod
                  ? 'Đã thu tại quầy. Khoản này không cộng vào hóa đơn phòng và không thu lại khi trả phòng.'
                  : o.status === 'PENDING'
                  ? 'Yêu cầu từ khách, chưa ghi nhận phí. Tiếp nhận đơn bên dưới.'
                  : `Đã ghi vào hóa đơn phòng ${roomNum}, thanh toán khi trả phòng.`}
              </p>
              {o.paidAt && (
                <div className="mt-1 text-[11px] text-zinc-500 font-medium">
                  Đã thu lúc {new Date(o.paidAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} ({o.paymentMethod === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản'})
                </div>
              )}
              {o.refundedAt && (
                <div className="mt-1 text-[11px] text-zinc-500 font-medium">
                  Đã hoàn lúc {new Date(o.refundedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                </div>
              )}
            </div>

            {/* Execution Actions */}
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
              <div className="pt-2 border-t border-zinc-100 flex flex-wrap gap-2">
                <ServiceOrderActions order={o} />
              </div>
            ) : (
              <div className="pt-2 border-t border-zinc-100 text-xs text-zinc-500">
                {o.status === "COMPLETED" && (
                  <span className="inline-flex items-center gap-1.5 text-emerald-700 font-medium">
                    <CheckCircle2 className="size-3.5" /> Đơn đã ghi nhận hoàn tất
                  </span>
                )}
                {o.status === "CANCELLED" && (
                  <span className="inline-flex items-center gap-1.5 text-rose-600 font-medium">
                    <XCircle className="size-3.5" /> Đơn dịch vụ đã hủy
                  </span>
                )}
              </div>
            )}

            {/* Utility Quick Links */}
            <div className="pt-3 border-t border-zinc-100 space-y-2 service-order-no-print">
              {o.status === "COMPLETED" && (
              <Button
                variant="secondary"
                onClick={() => window.print()}
                className="w-full justify-center py-2 text-xs font-medium text-zinc-700 rounded-lg gap-2 cursor-pointer shadow-2xs"
              >
                <Printer className="size-3.5 text-zinc-500" />
                In phiếu dịch vụ phòng (Ticket)
              </Button>
              )}

              {booking.data && (
                <LinkButton
                  to={`${base}/bookings/${o.bookingId}`}
                  variant="secondary"
                  className="w-full justify-center py-2 text-xs font-medium text-zinc-700 rounded-lg gap-2 shadow-2xs"
                >
                  <ExternalLink className="size-3.5 text-zinc-500" />
                  Xem chi tiết booking #{booking.data.reference}
                </LinkButton>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
