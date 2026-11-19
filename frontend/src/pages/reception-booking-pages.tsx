import { formatDate as localizedDate } from "../i18n/format";
import { catalogName } from "../i18n/catalog";
import { displayLocale, safeError, t as tr, useLocale } from "../i18n";


import { DeskLink, DeskBackLink } from "../features/reception/navigation";
import { DeskBookingPayment } from "../features/reception/booking-payment";
import { StayHistory } from '../features/reception/stay-history';
import { awaitingOnlinePayment, deskBookingStatusLabel, type DeskBooking } from '../features/reception/contracts';
import { useState } from "react";
import { useParams } from "react-router";
import {
  Clock,
  LogOut,
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
  useLocale();
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
          message={safeError(query.error)}
          retry={() => void query.refetch()}
        />
      </div>
    );
  }

  const b = query.data!;
  const financeReady = !invoice.isPending && !invoice.error && !!preview.data && !preview.error;
  const paid = invoice.data?.paidAmount ?? preview.data?.paidAmount ?? '0.00';
  const balance = invoice.data?.balance ?? preview.data?.balance ?? preview.data?.totalAmount ?? b.totalRoomAmount;
  const hasBalance = Number(balance) > 0;
  const onlineReceipts = preview.data?.roomPayments ?? [];
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
          booking={b}
          onClose={() => setCreateOrderOpen(false)}
          onCreated={() => {
            setCreateOrderOpen(false);
            void orders.refetch();
            void preview.refetch();
            void invoice.refetch();
          }}
        />
      )}

      <StayHistory bookingId={b.id} />
      {/* Breadcrumb */}
      <div>
        <DeskBackLink
          to={`${base}/bookings`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-brand-700 transition-colors"
        >{tr("reception:receptionBookingPages.backToReservations")}</DeskBackLink>
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
                <span className="inline-flex items-center rounded-md bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand-800">{tr("reception:cashier.roomValue", { value0: (b.roomNumber) })}</span>
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
                  {deskBookingStatusLabel(b)}
                </Badge>
              </div>

              <div className="flex items-center gap-2 text-xs sm:text-sm text-zinc-500 mt-1 flex-wrap">
                <span className="font-medium text-zinc-700">
                  {catalogName(b.room?.roomType.name) ?? "Standard"}
                </span>
                <span>·</span>
                <span className="tabular-nums">{tr("reception:receptionBookingPages.valueValueValueNightsValueGuests", { value0: (localizedDate(b.checkIn)), value1: (localizedDate(b.checkOut)), value2: (b.nights), value3: (b.guestCount) })}</span>
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
                        ? tr("reception:receptionBookingPages.cleanRoom")
                        : tr("reception:receptionBookingPages.needsCleaning")}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {beforeArrival && (
              <>
                {!awaitingOnlinePayment(b) && <CheckInWizard
                  bookingId={b.id}
                  checkIn={b.checkIn}
                  checkOut={b.checkOut}
                  variant="primary"
                  className="!bg-brand-600 !text-white hover:!bg-brand-700 !border-transparent px-3.5 py-1.5 font-semibold text-xs shadow-2xs"
                />}
                <DeskAction
                  action="cancel" confirmationLabel={tr("common:supplement.confirmCancelReservation")}
                  path={`/bookings/${id}/cancel`}
                  label={tr("reception:receptionBookingPages.cancelReservation")}
                  description={tr("reception:receptionBookingPages.cancelReservationValueTheRoomMayBecomeAvailableForOtherGuests", { value0: (b.reference) })}
                  variant="ghost"
                  className="!text-rose-600 hover:!bg-rose-50 !border-transparent text-xs py-1.5 px-2"
                />
              </>
            )}
            {b.status === "CHECKED_OUT" && (
              <DeskLink
                to={`${base}/bookings/${id}/billing`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition-colors shadow-2xs"
              >
                <Receipt className="size-3.5 text-zinc-500" />
                {tr("reception:receptionBookingPages.viewChargesInvoice")}</DeskLink>
            )}
          </div>
        </div>
      </div>

      {beforeArrival ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="rounded-2xl border-zinc-200/90 shadow-2xs">
            <CardHeader><CardTitle>{tr("reception:receptionBookingPages.reservationInformation")}</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="rounded-xl bg-brand-50 p-4 text-brand-900">
                <p className="font-semibold">{deskBookingStatusLabel(b)}</p>{awaitingOnlinePayment(b) && <p className="mt-1 text-sm">{tr("reception:receptionBookingPages.theGuestHasNotPaidTheRoomChargeThroughPayosTheReservation")}</p>}

              </div>
              <dl className="grid grid-cols-2 gap-4">
                <div><dt className="text-xs text-zinc-500">{tr("reception:receptionBookingPages.guest")}</dt><dd className="mt-1 font-semibold">{guestName}</dd></div>
                <div><dt className="text-xs text-zinc-500">{tr("reception:receptionBookingPages.phoneNumber")}</dt><dd className="mt-1">{b.customer?.phone || tr("reception:receptionBookingPages.notProvided")}</dd></div>
                <div><dt className="text-xs text-zinc-500">{tr("reception:unifiedBookingModal.checkInDate")}</dt><dd className="mt-1">{localizedDate(b.checkIn)}</dd></div>
                <div><dt className="text-xs text-zinc-500">{tr("reception:unifiedBookingModal.checkOutDate")}</dt><dd className="mt-1">{localizedDate(b.checkOut)}</dd></div>
                <div><dt className="text-xs text-zinc-500">{tr("reception:reservationPanels.room")}</dt><dd className="mt-1">{b.roomNumber} · {catalogName(b.room?.roomType.name)}</dd></div>
                <div><dt className="text-xs text-zinc-500">{tr("reception:receptionBookingPages.stay")}</dt><dd className="mt-1">{tr("reception:components.valueNightsValueGuests", { value0: (b.nights), value1: (b.guestCount) })}</dd></div>
              </dl>
            </CardContent>
          </Card>
          {awaitingOnlinePayment(b) && <DeskBookingPayment bookingId={b.id} />}
          <Card className="rounded-2xl border-zinc-200/90 shadow-2xs">
            <CardHeader><CardTitle>{tr("reception:receptionBookingPages.estimatedRoomCharges")}</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex justify-between"><span className="text-zinc-500">{tr("reception:receptionBookingPages.pricePerNight")}</span><span>{money(b.nightlyPrice)}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">{tr("reception:receptionBookingPages.nights")}</span><span>{tr("reception:today.valueNights", { value0: (b.nights) })}</span></div>
              <div className="flex justify-between border-t border-zinc-200 pt-4 font-bold"><span>{tr("reception:receptionBookingPages.totalRoomCharge")}</span><span className="text-lg text-brand-800">{money(invoice.data?.roomAmount ?? preview.data?.roomAmount ?? b.totalRoomAmount)}</span></div>
              {financeReady && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-2" aria-label={tr("reception:bookingPayment.roomPayment")}>
                <div className="flex justify-between"><span>{tr("reception:cashier.paid")}{onlineReceipts.some(p => p.method !== 'CASH') ? tr("reception:receptionBookingPages.includingRoomPaymentsThroughPayos") : ''}</span><strong>{money(paid)}</strong></div>
                <div className="flex justify-between"><span>{tr("reception:cashier.balanceDue")}</span><strong>{money(balance)}</strong></div>
                {onlineReceipts.map(receipt => <p className="text-xs text-emerald-800" key={receipt.id}>{receipt.method === "CASH" ? tr("reception:cashier.cash") : "payOS"} · {money(receipt.amount)} · {receipt.paidAt ? new Date(receipt.paidAt).toLocaleString(displayLocale(), { timeZone: 'Asia/Ho_Chi_Minh' }) : tr("reception:receptionBookingPages.verified")}</p>)}
              </div>}
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
              <CardTitle className="text-sm font-bold text-zinc-900">{tr("reception:receptionBookingPages.roomServicesUsed")}</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              {orders.data && (
                <span className="text-xs font-semibold text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded-md">{tr("reception:receptionBillingPages.valueOrders", { value0: (orders.data.meta.total) })}</span>
              )}
              {b.status === "CHECKED_IN" && (
                <button
                  type="button"
                  onClick={() => setCreateOrderOpen(true)}
                  className="text-xs font-semibold text-brand-700 hover:text-brand-800 hover:underline cursor-pointer"
                >{tr("reception:receptionBookingPages.addItems")}</button>
              )}
            </div>
          </CardHeader>

          <CardContent className="pt-3 flex-1 flex flex-col justify-between">
            {!orders.data?.data.length ? (
              <div className="py-10 text-center">
                <p className="text-xs text-zinc-400">{tr("reception:receptionBookingPages.noRoomServicesUsedDuringThisStayYet")}</p>
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
                              tr("reception:reservationPanels.valueValue", { value0: (catalogName(cleanServiceName(i.serviceName))), value1: (i.quantity) }),
                          )
                          .join(", ")}
                      </div>
                      <div className="text-[11px] text-zinc-400 flex items-center gap-1 mt-0.5">
                        <Clock className="size-3" />
                        {new Date(o.orderedAt).toLocaleString(displayLocale(), { timeZone: 'Asia/Ho_Chi_Minh',
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
                            ? o.paymentMethod ? "green" : "amber"
                            : o.status === "PENDING"
                            ? "amber"
                            : "zinc"
                        }
                        className="text-[11px] px-2 py-0.5"
                      >
                        {o.status === "COMPLETED" && o.paymentMethod ? tr("reception:receptionBookingPages.paidSeparately")
                          : o.status === "COMPLETED" && !o.requestedPaymentMethod ? tr("reception:receptionBillingPages.chargeToRoom")
                          : statusLabels[o.status] ?? tr("common:status.unknown")}
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
              <CardTitle className="text-sm font-bold text-zinc-900">{tr("reception:receptionBookingPages.chargesSettlement")}</CardTitle>
            </div>
          </CardHeader>

          <CardContent className="pt-3.5 space-y-4 text-xs sm:text-sm flex-1 flex flex-col justify-between">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-500">{tr("reception:receptionBookingPages.roomChargesValueNights", { value0: (b.nights) })}</span>
                <span className="tabular-nums font-semibold text-zinc-900">
                  {money(b.totalRoomAmount)}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-500">{tr("reception:receptionBillingPages.servicesChargedToRoom")}</span>
                <span className="tabular-nums font-semibold text-zinc-900">
                  {financeReady ? money(invoice.data?.serviceAmount ?? preview.data!.serviceAmount) : "—"}
                </span>
              </div>

              <div className="border-t border-zinc-200/80 pt-2.5 flex items-baseline justify-between">
                <span className="font-bold text-zinc-900 text-sm">{tr("reception:receptionBookingPages.roomInvoiceTotal")}</span>
                <span className="tabular-nums font-bold text-brand-800 text-lg">
                  {financeReady ? money(invoice.data?.totalAmount ?? preview.data!.totalAmount) : "—"}
                </span>
              </div>

              {/* Trạng thái công nợ / Còn phải thu */}
              <div className="pt-1">
                {financeReady ? (
                  <div
                    className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                      hasBalance
                        ? "bg-amber-50/80 border-amber-200 text-amber-900"
                        : "bg-emerald-50/80 border-emerald-200 text-emerald-900"
                    }`}
                  >
                    <div>
                      <span className="font-bold block">
                        {hasBalance
                          ? tr("reception:receptionBookingPages.balanceDueValue", { value0: (invoice.data ? '' : tr("common:supplement.estimated")) })
                          : invoice.data ? tr("reception:receptionBookingPages.settled") : tr("reception:receptionBookingPages.currentChargesFullyCollected")}
                      </span>
                      <span className="text-[11px] opacity-75">{tr("reception:receptionBookingPages.collectedAgainstRoomInvoiceValue", { value0: (money(paid)) })}</span>
                    </div>
                    <span className="tabular-nums font-extrabold text-base">
                      {money(balance)}
                    </span>
                  </div>
                ) : (
                  preview.error || invoice.error
                    ? <ErrorState message={tr("reception:receptionBookingPages.unableToLoadPaymentInformation")} retry={() => { void preview.refetch(); void invoice.refetch(); }} />
                    : <p role="status">{tr("reception:receptionBookingPages.checkingPayment")}</p>
                )}
              </div>
              {onlineReceipts.length > 0 && <details className="space-y-1 text-xs text-zinc-600" aria-label={onlineReceipts.some(p => p.method !== "CASH") ? tr("reception:receptionBookingPages.payosReceipt") : tr("reception:receptionBookingPages.cashReceipt")}>
                <summary className="cursor-pointer">{tr("reception:receptionBookingPages.viewReceipt")}</summary>
                {onlineReceipts.map(receipt => <p key={receipt.id}>{receipt.method === "CASH" ? tr("reception:receptionBookingPages.cashReceived") : tr("reception:receptionBookingPages.receivedThroughPayos")}: <strong>{money(receipt.amount)}</strong>{receipt.paidAt ? ` · ${new Date(receipt.paidAt).toLocaleString(displayLocale(), { timeZone: 'Asia/Ho_Chi_Minh' })}` : ''}</p>)}

              </details>}
            </div>

            {/* Nút thanh toán & trả phòng */}
            {(b.status === 'CHECKED_IN' || b.status === 'CHECKED_OUT') && <div className="pt-2">
              <DeskLink
                to={`${base}/bookings/${id}/billing`}
                className="w-full h-9 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors cursor-pointer shadow-2xs flex items-center justify-center gap-1.5"
              >
                <LogOut className="size-3.5" />
                {b.status === 'CHECKED_IN' ? tr("reception:receptionBookingPages.openSettlement") : tr("reception:receptionBookingPages.viewInvoice")}
              </DeskLink>
            </div>}
          </CardContent>
        </Card>
      </div>
      )}


    </div>
  );
}
