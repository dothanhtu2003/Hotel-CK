import { catalogName } from "../i18n/catalog";
import { displayLocale, safeError, t as tr, useLocale } from "../i18n";


import { Trans } from "react-i18next";
import { DeskLink, DeskLinkButton, DeskBackLink } from "../features/reception/navigation";
import { useDeskNavigate } from "../features/reception/navigation-state";
import { serviceOrderLabel } from '../features/reception/service-order-label';
import { useState } from "react";
import "./reception-service-pages.css";
import { useParams, useSearchParams } from "react-router";
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
import { Button, EmptyState, ErrorState, Pagination, Table } from "../components/ui";

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
  useLocale();
  const [createOpen, setCreateOpen] = useState(false);
  const navigate = useDeskNavigate();
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
            <h1 className="text-xl font-bold tracking-tight text-zinc-900">{tr("reception:receptionServicePages.manageServiceOrders")}</h1>
            <span className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">
              <Utensils className="size-3" />
              {tr("reception:receptionServicePages.roomService")}</span>
          </div>
          
        </div>

        <div>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="h-8.5 px-3.5 text-xs font-semibold rounded-lg bg-brand-700 hover:bg-brand-800 text-white transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
          >
            <Plus className="size-3.5" /> {tr("reception:receptionServicePages.addServiceOrder")}</button>
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
          >{tr("reception:receptionServicePages.allOrders")}</button>
          <button
            type="button"
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors cursor-pointer ${
              status === "PENDING"
                ? "bg-amber-50 text-amber-800 font-semibold border border-amber-200"
                : "text-zinc-600 hover:bg-zinc-100"
            }`}
            onClick={() => update("status", "PENDING")}
          >{tr("reception:receptionServicePages.needsAttentionValue", { value0: (query.data?.counts.PENDING ?? "…") })}</button>
          <button
            type="button"
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors cursor-pointer ${
              status === "COMPLETED"
                ? "bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200"
                : "text-zinc-600 hover:bg-zinc-100"
            }`}
            onClick={() => update("status", "COMPLETED")}
          >{tr("reception:receptionServicePages.recordedValue", { value0: (query.data?.counts.COMPLETED ?? "…") })}</button>
          <button
            type="button"
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors cursor-pointer ${
              status === "CANCELLED"
                ? "bg-zinc-100 text-zinc-700 font-semibold"
                : "text-zinc-600 hover:bg-zinc-100"
            }`}
            onClick={() => update("status", "CANCELLED")}
          >{tr("reception:receptionServicePages.cancelledValue", { value0: (query.data?.counts.CANCELLED ?? "…") })}</button>

          {params.get("bookingId") && (
            <div className="flex items-center gap-1.5 text-xs text-brand-700 bg-brand-50 border border-brand-200/60 px-2.5 py-1 rounded-md ml-1">
              <span>{tr("reception:receptionServicePages.reservationFilterValue", { value0: (params.get("bookingId")?.slice(0, 8)) })}</span>
              <button
                type="button"
                className="text-zinc-400 hover:text-zinc-700 p-0.5 rounded cursor-pointer inline-flex items-center"
                onClick={() => update("bookingId", "")}
                title={tr("reception:receptionServicePages.clearReservationFilter")}
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
              aria-label={tr("reception:receptionServicePages.searchRoomOrGuest")}
              placeholder={tr("reception:receptionServicePages.roomNumberGuestNameReservationCode")}
              maxLength={120}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8.5 w-44 sm:w-60 pl-8 pr-2.5 text-xs border border-zinc-200 rounded-lg bg-zinc-50/50 focus:bg-white focus:border-brand-600 focus:outline-none transition-colors"
            />
          </div>

          <input
            type="date"
            aria-label={tr("reception:receptionServicePages.orderDate")}
            title={tr("reception:receptionServicePages.filterByOrderDate")}
            value={params.get("date") ?? ""}
            onChange={(e) => update("date", e.target.value)}
            className="h-8.5 px-2 text-xs border border-zinc-200 rounded-lg bg-zinc-50/50 focus:bg-white focus:border-brand-600 focus:outline-none transition-colors text-zinc-700"
          />

          <button
            type="submit"
            className="h-8.5 px-3 text-xs font-medium rounded-lg bg-brand-700 hover:bg-brand-800 text-white transition-colors cursor-pointer shrink-0"
          >{tr("reception:cashier.search")}</button>

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
              <X className="size-3" /> {tr("reception:frontDeskPages.clearFilters")}</button>
          )}
        </form>
      </div>

      {/* Orders Table Card */}
      <Card>
        <CardHeader className="pb-2 border-b border-zinc-100">
          <CardTitle className="service-orders-heading text-sm font-semibold text-zinc-900 flex items-center justify-between">
            <span>{tr("reception:receptionServicePages.serviceRequestList")}</span>
            {query.data?.meta && (
              <span className="text-xs text-zinc-500 font-normal">{tr("reception:receptionServicePages.totalValueOrders", { value0: (query.data.meta.total) })}</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          {query.isPending ? (
            <Skeleton />
          ) : query.error ? (
            <ErrorState
              message={safeError(query.error)}
              retry={() => void query.refetch()}
            />
          ) : (
            <>
              <Table
                caption={tr("reception:receptionServicePages.serviceOrderList")}
                rows={query.data!.data}
                rowKey={(o) => o.id}
                empty={
                  <EmptyState
                    title={tr("reception:receptionServicePages.noMatchingServiceOrders")}
                    description={tr("reception:receptionServicePages.tryAnotherStatusOrReturnWhenAGuestCreatesANewRequest")}
                  />
                }
                columns={[
                  {
                    title: tr("reception:receptionServicePages.orderId"),
                    render: (o) => (
                      <div className="space-y-0.5">
                        <DeskLink
                          to={`${base}/service-orders/${o.id}`}
                          className="font-mono text-xs font-semibold text-brand-700 hover:underline block"
                        >
                          {o.id.slice(0, 8)}
                        </DeskLink>
                        <span className="text-[11px] text-zinc-400 flex items-center gap-1">
                          <Clock className="size-3" />
                          {new Date(o.orderedAt).toLocaleString(displayLocale(), { timeZone: 'Asia/Ho_Chi_Minh',
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
                    title: tr("reception:receptionServicePages.roomGuest"),
                    render: (o) => (
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex items-center rounded bg-brand-50 px-1.5 py-0.5 text-xs font-bold text-brand-800">
                            {tr("reception:createServiceOrder.rm")}{o.roomNumber}
                          </span>
                          <DeskLink
                            to={`${base}/bookings/${o.bookingId}`}
                            className="text-xs font-medium text-zinc-900 hover:text-brand-700"
                          >
                            {o.customerName}
                          </DeskLink>
                        </div>
                        <span className="text-xs text-zinc-500 block">
                          {o.reference}
                        </span>
                      </div>
                    ),
                  },
                  {
                    title: tr("reception:receptionServicePages.itemDetails"),
                    render: (o) => (
                      <div className="max-w-xs text-xs text-zinc-700 leading-snug">
                        {o.items.map((i) => (
                          <span key={i.id} className="service-order-item"><Trans ns="reception" i18nKey="receptionServicePages.valueValue" values={{ value0: (catalogName(i.serviceName).replace(/^TEST-\d{8}\s+/, "")), value1: (i.quantity) }} components={{ part0: <strong className="text-zinc-900" /> }} /></span>
                        ))}
                      </div>
                    ),
                  },
                  {
                    title: tr("reception:cashier.total"),
                    render: (o) => (
                      <span className="font-semibold text-xs text-zinc-900 tabular-nums">
                        {money(o.totalAmount)}
                      </span>
                    ),
                  },
                  {
                    title: tr("reception:cashier.status"),
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
                    title: tr("reception:cashier.actions"),
                    render: (o) => (
                      <div className="service-order-actions">
                        <DeskLinkButton
                          variant="secondary"
                          to={`${base}/service-orders/${o.id}`}
                        >{tr("reception:cashier.details")}</DeskLinkButton>
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
  useLocale();
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
        message={safeError(query.error)}
        retry={() => void query.refetch()}
      />
    );
  }

  const o = query.data!;
  const eligible =
    o.status !== "CANCELLED" &&
    booking.data?.status === "CHECKED_IN" &&
    invoice.isSuccess &&
    (invoice.data === null || !!o.requestedPaymentMethod);

  const roomNum = booking.data?.roomNumber ?? "—";
  const customer = booking.data?.customer;

  return (
    <div className="print-document desk-page space-y-4 max-w-5xl mx-auto pb-12">
      {/* 1. Top Navigation & Order ID */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs service-order-no-print">
        <DeskBackLink
          to={base + "/service-orders"}
          className="inline-flex items-center gap-1.5 font-medium text-zinc-600 hover:text-zinc-900 transition-colors"
        >
          <ArrowLeft className="size-4" />
          <span>{tr("reception:receptionServicePages.backToServiceOrders")}</span>
        </DeskBackLink>
        <button
          type="button"
          onClick={handleCopyId}
          title={tr("reception:receptionServicePages.copyFullUuid")}
          className="inline-flex items-center gap-1.5 text-zinc-500 hover:text-zinc-800 font-mono text-xs bg-white hover:bg-zinc-50 border border-zinc-200/90 px-2.5 py-1 rounded-lg transition-colors cursor-pointer shadow-2xs"
        >
          {copied ? (
            <>
              <Check className="size-3 text-emerald-600" />
              <span className="text-emerald-700 font-sans font-medium">{tr("reception:receptionServicePages.copied")}</span>
            </>
          ) : (
            <>
              <Copy className="size-3 text-zinc-400" />
              <span>{tr("reception:receptionServicePages.orderIdValueValue", { value0: (o.id.slice(0, 8)), value1: (o.id.slice(-6)) })}</span>
            </>
          )}
        </button>
      </div>

      {/* 2. Order Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-xl border border-zinc-200/90 shadow-2xs">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900">{tr("reception:receptionServicePages.serviceOrderValue", { value0: (o.id.slice(0, 8)) })}</h1>
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
            {tr("reception:receptionServicePages.orderedAt")}{" "}
            <span className="text-zinc-700 font-medium">
              {new Date(o.orderedAt).toLocaleString(displayLocale(), {
                timeZone: "Asia/Ho_Chi_Minh",
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
          <div className="text-xs text-zinc-400">{tr("reception:receptionServicePages.totalPayment")}</div>
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
                  {tr("reception:components.room2")}{booking.data.roomNumber}
                </span>
                <span className="font-semibold text-zinc-900 text-sm">
                  {customer?.fullName || tr("reception:today.walkInGuest")}
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

              <DeskLink
                to={`${base}/bookings/${o.bookingId}`}
                className="text-xs font-medium text-brand-700 hover:underline inline-flex items-center gap-1 shrink-0"
              >
                <span>{tr("reception:receptionServicePages.reservation")}{booking.data.reference}</span>
                <ExternalLink className="size-3" />
              </DeskLink>
            </div>
          ) : null}

          {/* Service Items Table */}
          <div className="rounded-xl border border-zinc-200/90 bg-white overflow-hidden shadow-2xs">
            <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-600">{tr("reception:receptionServicePages.serviceDetailsValueItems", { value0: (o.items.length) })}</span>
              <span className="text-xs text-zinc-400">{tr("reception:receptionBillingPages.unitPrice2")}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 text-[11px] font-bold uppercase tracking-wider text-zinc-500 bg-white">
                    <th className="py-2.5 px-4">{tr("reception:cashier.services")}</th>
                    <th className="py-2.5 px-3 text-center">{tr("reception:receptionServicePages.quantity")}</th>
                    <th className="py-2.5 px-3 text-right">{tr("reception:receptionBillingPages.unitPrice2")}</th>
                    <th className="py-2.5 px-4 text-right">{tr("reception:reservationPanels.subtotal")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {o.items.map((item, idx) => {
                    const cleanName = catalogName(cleanServiceName(item.serviceName));
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
                        <td className="py-3 px-3 text-center font-medium tabular-nums">{tr("reception:receptionServicePages.value", { value0: (item.quantity) })}</td>
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
                    <td colSpan={3} className="py-3 px-4 font-bold text-zinc-700 text-right">{tr("reception:receptionServicePages.total")}</td>
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
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-1">{tr("reception:receptionServicePages.methodStatus")}</span>
              <p className="text-xs text-zinc-600 leading-relaxed">
                {o.status === 'CANCELLED'
                  ? (o.refundedAt ? tr("reception:receptionServicePages.cancelledAndRefunded") : tr("reception:receptionServicePages.orderCancelledNoCharge"))
                  : o.requestedPaymentMethod && o.paymentMethod
                  ? (o.deliveredAt ? tr("reception:receptionServicePages.paidAndDeliveredToTheGuest") : tr("reception:receptionServicePages.paidDeliverTheServicesToRoomValue", { value0: (roomNum) }))
                  : o.requestedPaymentMethod === 'CASH'
                  ? tr("reception:receptionServicePages.cashPaymentOnDelivery")
                  : o.requestedPaymentMethod === 'BANK_TRANSFER'
                  ? tr("reception:receptionServicePages.awaitingBankTransfer")
                  : o.paymentMethod
                  ? tr("reception:receptionServicePages.paidSeparately")
                  : o.status === 'PENDING'
                  ? tr("reception:receptionServicePages.newGuestRequest")
                  : tr("reception:receptionServicePages.chargedToRoomInvoiceValuePayableAtCheckOut", { value0: (roomNum) })}
              </p>
              {o.paidAt && (
                <div className="mt-1 text-[11px] text-zinc-500 font-medium">{tr("reception:receptionServicePages.collectedAtValueValue", { value0: (new Date(o.paidAt).toLocaleTimeString(displayLocale(), { timeZone: 'Asia/Ho_Chi_Minh', hour: "2-digit", minute: "2-digit" })), value1: (o.paymentMethod === 'CASH' ? tr("common:supplement.cash") : tr("common:supplement.bankTransfer")) })}</div>
              )}
              {o.refundedAt && (
                <div className="mt-1 text-[11px] text-zinc-500 font-medium">{tr("reception:receptionServicePages.refundedAtValue", { value0: (new Date(o.refundedAt).toLocaleTimeString(displayLocale(), { timeZone: 'Asia/Ho_Chi_Minh', hour: "2-digit", minute: "2-digit" })) })}</div>
              )}
            </div>

            {/* Execution Actions */}
            {booking.isPending || invoice.isPending ? (
              <Skeleton />
            ) : booking.error || invoice.error ? (
              <ErrorState
                message={safeError((booking.error ?? invoice.error)!)}
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
                    <CheckCircle2 className="size-3.5" /> {tr("reception:receptionServicePages.orderRecordedAsComplete")}</span>
                )}
                {o.status === "CANCELLED" && (
                  <span className="inline-flex items-center gap-1.5 text-rose-600 font-medium">
                    <XCircle className="size-3.5" /> {tr("reception:receptionServicePages.serviceOrderCancelled")}</span>
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
                {tr("reception:receptionServicePages.printRoomServiceTicket")}</Button>
              )}

              {booking.data && (
                <DeskLinkButton
                  to={`${base}/bookings/${o.bookingId}`}
                  variant="secondary"
                  className="w-full justify-center py-2 text-xs font-medium text-zinc-700 rounded-lg gap-2 shadow-2xs"
                >
                  <ExternalLink className="size-3.5 text-zinc-500" />
                  {tr("reception:receptionServicePages.viewReservationDetails")}{booking.data.reference}
                </DeskLinkButton>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
