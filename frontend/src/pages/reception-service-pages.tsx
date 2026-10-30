import { useState } from "react";
import "./reception-service-pages.css";
import { Link, useParams, useSearchParams } from "react-router";
import {
  ArrowLeft,
  Building2,
  Calendar,
  Car,
  Check,
  CheckCircle2,
  Clock,
  ConciergeBell,
  Copy,
  ExternalLink,
  Mail,
  Package,
  Phone,
  Printer,
  Sparkles,
  User,
  Utensils,
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
  statusLabels,
  type Order,
  type Page,
} from "../features/guest/contracts";
import { DeskAction } from "../features/reception/components";
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
  const [params, setParams] = useSearchParams();
  const base = useDeskBase();
  const page = pageNumber(params.get("page"));
  const raw = params.get("status") ?? "PENDING";
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
    <div className="service-orders-page space-y-6 max-w-6xl mx-auto pb-12">
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
              Theo dõi, hoàn thành hoặc hủy đơn dịch vụ của khách. Giá được lưu tại thời điểm đặt.
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
            Chờ xử lý ({query.data?.counts.PENDING ?? "…"})
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
            Đã hoàn thành ({query.data?.counts.COMPLETED ?? "…"})
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

      <form className="service-order-filters" onSubmit={e => { e.preventDefault(); update('q', search.trim()); }}>
        <label>Tìm phòng hoặc khách<input className="input" type="search" placeholder="Số phòng, tên khách, mã booking…" maxLength={120} value={search} onChange={e => setSearch(e.target.value)} /></label>
        <label>Ngày đặt đơn<input className="input" type="date" value={params.get('date') ?? ''} onChange={e => update('date', e.target.value)} /></label>
        <button className="service-filter-submit" type="submit">Tìm kiếm</button>
        {(params.get('q') || params.get('date')) && <button type="button" onClick={() => { const next = new URLSearchParams(params); ['q', 'date', 'page'].forEach(k => next.delete(k)); setSearch(''); setParams(next); }}>Xóa bộ lọc</button>}
      </form>

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
                        {statusLabels[o.status] ?? o.status}
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
                        {o.status === "PENDING" && o.canProcess && (
                          <>
                            <DeskAction
                              path={`/service-orders/${o.id}/complete`}
                              action="complete"
                              label="Hoàn thành"
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
    o.status === "PENDING" &&
    booking.data?.status === "CHECKED_IN" &&
    invoice.isSuccess &&
    invoice.data === null;

  const roomNum = booking.data?.roomNumber ?? "—";
  const customer = booking.data?.customer;

  return (
    <div className="desk-page space-y-6 max-w-6xl mx-auto pb-16">
      {/* 1. Top Breadcrumb & Metadata Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs service-order-no-print">
        <Link
          to={base + "/service-orders"}
          className="inline-flex items-center gap-1.5 font-medium text-zinc-500 hover:text-zinc-900 transition-colors bg-white px-3 py-1.5 rounded-lg border border-zinc-200 shadow-2xs hover:border-zinc-300"
        >
          <ArrowLeft className="size-3.5" />
          Quay lại danh sách đơn dịch vụ
        </Link>
        <button
          type="button"
          onClick={handleCopyId}
          title="Sao chép toàn bộ mã UUID"
          className="inline-flex items-center gap-1.5 text-zinc-500 hover:text-zinc-800 font-mono bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="size-3 text-emerald-600" />
              <span className="text-emerald-700 font-sans font-medium">Đã sao chép</span>
            </>
          ) : (
            <>
              <Copy className="size-3 text-zinc-400" />
              <span>Mã đơn: {o.id}</span>
            </>
          )}
        </button>
      </div>

      {/* 2. Page Hero Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 bg-white p-5 rounded-2xl border border-zinc-200 shadow-2xs">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-brand-50 border border-brand-200/80 text-brand-800 flex items-center justify-center shrink-0 shadow-2xs">
            <ConciergeBell className="size-6 text-brand-700" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-brand-700">
                Chi tiết yêu cầu dịch vụ
              </span>
              <span className="text-zinc-300">•</span>
              <span className="text-xs text-zinc-500 font-mono">
                Phòng {roomNum}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900 mt-1">
              Đơn dịch vụ #{o.id.slice(0, 8)}
            </h1>
            <p className="text-xs text-zinc-500 mt-1 flex items-center gap-1.5">
              <Clock className="size-3.5 text-zinc-400" />
              Thời gian đặt:{" "}
              <strong className="text-zinc-700 font-semibold">
                {new Date(o.orderedAt).toLocaleString("vi-VN", {
                  timeZone: "Asia/Bangkok",
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })}
              </strong>
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:items-end gap-2">
          <Badge
            className="px-3.5 py-1.5 text-xs font-semibold shadow-2xs"
            tone={
              o.status === "COMPLETED"
                ? "green"
                : o.status === "PENDING"
                ? "amber"
                : "zinc"
            }
          >
            {o.status === "PENDING" && (
              <span className="inline-block size-2 rounded-full bg-amber-600 animate-pulse mr-1.5" />
            )}
            {o.status === "COMPLETED" && (
              <CheckCircle2 className="size-3.5 mr-1 text-emerald-700 inline" />
            )}
            {statusLabels[o.status] ?? o.status}
          </Badge>
          <span className="text-[11px] text-zinc-400">
            {o.items.length} hạng mục trong đơn
          </span>
        </div>
      </div>

      {/* 3. Main 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: 7 cols */}
        <div className="lg:col-span-7 space-y-6">
          {/* Guest & Room Destination Hero Card */}
          {booking.data ? (
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                  <Building2 className="size-3.5 text-brand-700" />
                  Điểm giao & Thông tin khách
                </span>
                <Link
                  to={`${base}/bookings/${o.bookingId}`}
                  className="text-xs font-semibold text-brand-700 hover:text-brand-900 flex items-center gap-1 group"
                >
                  <span>Mã booking: {booking.data.reference}</span>
                  <ExternalLink className="size-3 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-800 text-white font-black text-xl flex items-center justify-center shadow-md shadow-emerald-950/20 ring-4 ring-emerald-50 shrink-0">
                    {booking.data.roomNumber}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-zinc-900 tracking-tight">
                        Phòng {booking.data.roomNumber}
                      </h2>
                      <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        Đang lưu trú
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-zinc-500 mt-1">
                      <Calendar className="size-3.5 text-zinc-400" />
                      <span>
                        {booking.data.checkIn} → {booking.data.checkOut} ({booking.data.nights} đêm · {booking.data.guestCount} khách)
                      </span>
                    </div>
                  </div>
                </div>

                <div className="sm:border-l sm:border-zinc-100 sm:pl-4 space-y-1 text-xs">
                  <div className="flex items-center gap-1.5 font-semibold text-zinc-900">
                    <User className="size-3.5 text-zinc-400" />
                    <span>{customer?.fullName || "Khách lẻ tại quầy"}</span>
                  </div>
                  {customer?.phone && (
                    <div className="flex items-center gap-1.5 text-zinc-500 font-medium">
                      <Phone className="size-3 text-zinc-400" />
                      <span>{customer.phone}</span>
                    </div>
                  )}
                  {customer?.email && (
                    <div className="flex items-center gap-1.5 text-zinc-400 text-[11px] truncate max-w-[200px]">
                      <Mail className="size-3 text-zinc-400" />
                      <span className="truncate">{customer.email}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {/* Service Items Card */}
          <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden shadow-2xs">
            <div className="p-4 sm:p-5 border-b border-zinc-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-zinc-900">
                  Danh mục dịch vụ & Đơn giá
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Đơn giá snapshot đã chốt cố định tại thời điểm khách đặt
                </p>
              </div>
              <span className="text-xs font-semibold text-zinc-500 bg-zinc-100 px-2.5 py-1 rounded-full">
                {o.items.length} món/dịch vụ
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-50/80 border-b border-zinc-100 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                    <th className="py-3 px-4">Dịch vụ</th>
                    <th className="py-3 px-3 text-center">Số lượng</th>
                    <th className="py-3 px-3 text-right">Giá đã chốt</th>
                    <th className="py-3 px-4 text-right">Thành tiền</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {o.items.map((item, idx) => {
                    const cleanName = cleanServiceName(item.serviceName);
                    const icon = getServiceIcon(item.serviceName);
                    return (
                      <tr
                        key={item.id || idx}
                        className="hover:bg-zinc-50/60 transition-colors"
                      >
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center shrink-0">
                              {icon}
                            </div>
                            <div>
                              <strong className="text-xs sm:text-sm font-semibold text-zinc-900 block">
                                {cleanName}
                              </strong>
                              <span className="text-[11px] text-zinc-400 font-mono">
                                Mã SP: {item.serviceId ? item.serviceId.slice(0, 8) : `#${idx + 1}`}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-zinc-100 text-zinc-800 tabular-nums">
                            ×{item.quantity}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-right text-xs font-medium text-zinc-600 tabular-nums">
                          {money(item.unitPrice)}
                        </td>
                        <td className="py-3.5 px-4 text-right text-xs sm:text-sm font-bold text-zinc-900 tabular-nums">
                          {money(item.subtotal)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="p-4 sm:p-5 bg-zinc-50/60 border-t border-zinc-200 flex items-center justify-between">
              <div>
                <span className="text-xs sm:text-sm font-bold text-zinc-900 block">
                  Tổng tiền thanh toán đã chốt
                </span>
                <span className="text-[11px] text-zinc-500 block mt-0.5">
                  Đã bao gồm thuế và phí phục vụ khách sạn
                </span>
              </div>
              <strong className="text-lg sm:text-2xl font-extrabold text-emerald-800 tabular-nums">
                {money(o.totalAmount)}
              </strong>
            </div>
          </div>

          {/* Order Lifecycle Timeline */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs space-y-4">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 block">
              Tiến trình xử lý đơn
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-emerald-900">
                  <CheckCircle2 className="size-4 text-emerald-700" />
                  <span>1. Đặt dịch vụ</span>
                </div>
                <p className="text-[11px] text-emerald-700">
                  Khách gửi lúc {new Date(o.orderedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>

              <div
                className={`p-3 rounded-xl border text-xs space-y-1 ${
                  o.status === "PENDING"
                    ? "bg-amber-50/80 border-amber-300 text-amber-900 ring-2 ring-amber-400/30"
                    : o.status === "COMPLETED"
                    ? "bg-emerald-50/70 border-emerald-200 text-emerald-900"
                    : "bg-zinc-50 border-zinc-200 text-zinc-500"
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold">
                  {o.status === "PENDING" ? (
                    <Clock className="size-4 text-amber-600 animate-spin" />
                  ) : o.status === "COMPLETED" ? (
                    <CheckCircle2 className="size-4 text-emerald-700" />
                  ) : (
                    <XCircle className="size-4 text-zinc-400" />
                  )}
                  <span>2. Tiếp nhận & Chuẩn bị</span>
                </div>
                <p className="text-[11px]">
                  {o.status === "PENDING"
                    ? "Lễ tân đang điều phối"
                    : o.status === "COMPLETED"
                    ? "Đã chuẩn bị xong"
                    : "Đã hủy đơn"}
                </p>
              </div>

              <div
                className={`p-3 rounded-xl border text-xs space-y-1 ${
                  o.status === "COMPLETED"
                    ? "bg-emerald-50/70 border-emerald-200 text-emerald-900"
                    : o.status === "CANCELLED"
                    ? "bg-rose-50 border-rose-200 text-rose-900"
                    : "bg-zinc-50 border-zinc-200 text-zinc-400"
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold">
                  {o.status === "COMPLETED" ? (
                    <CheckCircle2 className="size-4 text-emerald-700" />
                  ) : o.status === "CANCELLED" ? (
                    <XCircle className="size-4 text-rose-600" />
                  ) : (
                    <Clock className="size-4 text-zinc-300" />
                  )}
                  <span>3. Giao phòng & Xong</span>
                </div>
                <p className="text-[11px]">
                  {o.status === "COMPLETED"
                    ? "Đã hoàn thành phục vụ"
                    : o.status === "CANCELLED"
                    ? "Đã hủy bỏ"
                    : "Chờ xác nhận phục vụ"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: 5 cols (Action & Summary Panel) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Financial Summary & Action Hub */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-brand-700" />
                Tổng quan & Thao tác
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
                {statusLabels[o.status] ?? o.status}
              </Badge>
            </div>

            {/* Total Money Card */}
            <div className="p-4.5 rounded-2xl bg-gradient-to-br from-emerald-50/80 to-teal-50/40 border border-emerald-200/90 text-center">
              <span className="text-[11px] font-bold text-emerald-900 uppercase tracking-wider block">
                Tổng thanh toán đơn dịch vụ
              </span>
              <strong className="text-3xl font-black text-emerald-950 block mt-1.5 tabular-nums">
                {money(o.totalAmount)}
              </strong>
              <p className="text-xs text-emerald-700 mt-2 leading-relaxed">
                Khi hoàn thành, khoản phí sẽ tự động được ghi nhận vào chi phí lưu trú của phòng {roomNum} để thanh toán khi trả phòng.
              </p>
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
              <div className="space-y-3 pt-1">
                <DeskAction
                  path={`/service-orders/${id}/complete`}
                  action="complete"
                  label="✓ Hoàn thành dịch vụ"
                  description="Xác nhận đã cung cấp toàn bộ dịch vụ trong đơn? Giá tại thời điểm đặt sẽ được ghi nhận vào hóa đơn khi hoàn thành."
                  variant="primary"
                  className="w-full justify-center py-3 text-sm font-bold bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl shadow-xs hover:shadow-md transition-all cursor-pointer"
                />
                <DeskAction
                  path={`/service-orders/${id}/cancel`}
                  action="cancel"
                  label="Hủy đơn dịch vụ"
                  description="Hủy toàn bộ các dịch vụ đang chờ trong đơn?"
                  variant="secondary"
                  className="w-full justify-center py-2.5 text-xs font-semibold text-rose-700 hover:text-rose-800 hover:bg-rose-50 border-rose-200 rounded-xl cursor-pointer"
                />
              </div>
            ) : (
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-600 space-y-2">
                <div className="flex items-center gap-2 font-bold text-zinc-800">
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
                <p className="text-zinc-500 text-[11px] leading-relaxed">
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

            {/* Utility Quick Links */}
            <div className="pt-3 border-t border-zinc-100 space-y-2 service-order-no-print">
              <Button
                variant="secondary"
                onClick={() => window.print()}
                className="w-full justify-center py-2.5 text-xs font-medium text-zinc-700 rounded-xl gap-2 cursor-pointer"
              >
                <Printer className="size-3.5 text-zinc-500" />
                In phiếu dịch vụ phòng (Ticket)
              </Button>

              <LinkButton
                to={`${base}/bookings/${o.bookingId}`}
                variant="secondary"
                className="w-full justify-center py-2.5 text-xs font-medium text-zinc-700 rounded-xl gap-2"
              >
                <ExternalLink className="size-3.5 text-zinc-500" />
                Xem chi tiết booking #{booking.data?.reference || ""}
              </LinkButton>
            </div>
          </div>

          {/* Operational Notes Card */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <Building2 className="size-3.5 text-zinc-500" />
              Lưu ý vận hành cho lễ tân
            </span>
            <ul className="space-y-2 text-xs text-zinc-600">
              <li className="flex items-start gap-2">
                <span className="size-1.5 rounded-full bg-emerald-600 mt-1.5 shrink-0" />
                <span>Kiểm tra chính xác số <strong>Phòng {roomNum}</strong> trước khi giao đồ.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="size-1.5 rounded-full bg-emerald-600 mt-1.5 shrink-0" />
                <span>Đối với đưa đón sân bay hoặc ẩm thực, xác nhận yêu cầu đặc biệt của khách (nếu có).</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="size-1.5 rounded-full bg-emerald-600 mt-1.5 shrink-0" />
                <span>Sau khi hoàn thành, hệ thống tự động đồng bộ sang bảng kê chi phí lưu trú của phòng.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
