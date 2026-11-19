import { formatDate as localizedDate } from "../../i18n/format";
import { catalogName } from "../../i18n/catalog";
import { t as tr, useLocale } from "../../i18n";
import { DeskLink } from "./navigation";
import { useDeskNavigate } from "./navigation-state";
import { awaitingOnlinePayment, deskBookingStatusLabel, deskError, type DeskBooking } from './contracts';
import { CheckoutSummary } from "./reservation-panels";
import { CheckInWizard } from "./check-in";
import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { BedDouble, LogOut } from "lucide-react";
import { Button, Dialog, EmptyState, Table } from "../../components/ui";
import { Avatar, Badge, type BadgeTone } from "../../components/kamra-ui";
import { money, type Booking, type Order } from "../guest/contracts";
import { api } from "../../lib/api";
import { useToast } from "../../components/toast-context";

import { useDeskBase, useRefreshDesk } from "./queries";

const STATUS_TONES: Record<string, BadgeTone> = {
  CONFIRMED: "sky",
  CHECKED_IN: "green",
  CHECKED_OUT: "zinc",
  CANCELLED: "rose",
  PENDING: "amber",
};

function ConfirmDeskAction({
  path,
  label,
  description,
  action,
  onDone,
  variant = "secondary",
  className = "",
  confirmationLabel,
}: {
  path: string;
  label: string;
  description: string;
  action: string;
  onDone?: (result: unknown) => void;
  variant?: "primary" | "secondary" | "ghost" | "light";
  className?: string;
  confirmationLabel?: string;
}) {
  useLocale();
  const [open, setOpen] = useState(false),
    lock = useRef(false),
    refresh = useRefreshDesk(),
    toast = useToast();
  const mutation = useMutation({
    retry: false,
    mutationFn: () =>
      api.request(path, { method: action === "invoice" ? "POST" : "PATCH" }),
    onSuccess: async (data) => {
      toast(() => (tr("reception:components.valueSuccessful", { value0: (label) })));
      setOpen(false);
      await refresh();
      onDone?.(data);
    },
    onError: async (error) => {
      toast(() => (deskError(error, action)), "error");
      await refresh();
    },
    onSettled: () => {
      lock.current = false;
    },
  });
  return (
    <>
      <Button
        variant={variant}
        className={className}
        busy={mutation.isPending}
        onClick={() => {
          mutation.reset();
          setOpen(true);
        }}
      >
        {label}
      </Button>
      <Dialog
        open={open}
        onClose={() => {
          if (!lock.current) setOpen(false);
        }}
        title={label + "?"}
      >
        {action !== "check-out" && description && <p>{description}</p>}
        {action === "check-out" && open && (
          <CheckoutSummary bookingId={path.split("/")[2]} />
        )}
        {mutation.error && (
          <p className="form-error" role="alert">
            {deskError(mutation.error, action)}
          </p>
        )}
        <div className="dialog-actions">
          <Button
            variant="secondary"
            disabled={mutation.isPending}
            onClick={() => setOpen(false)}
          >{tr("reception:components.back")}</Button>
          <Button
            variant="primary"
            busy={mutation.isPending}
            disabled={!!mutation.error}
            onClick={() => {
              if (lock.current) return;
              lock.current = true;
              mutation.mutate();
            }}
          >
            {confirmationLabel ?? tr(action === "cancel" ? "common:supplement.confirmCancel" : action === "invoice" ? "common:supplement.confirmInvoice" : action === "check-out" ? "common:supplement.confirmCheckout" : "common:supplement.confirmAction")}
          </Button>
        </div>
      </Dialog>
    </>
  );
}

export function BookingTable({
  rows,
  billing = false,
}: {
  rows: (Booking & Partial<DeskBooking>)[];
  billing?: boolean;
}) {
  useLocale();
  const base = useDeskBase();
  const navigate = useDeskNavigate();
  return (
    <Table
      caption={tr("reception:components.reservationList")}
      rows={rows}
      rowKey={(b) => b.id}
      rowClassName={() => "cursor-pointer hover:bg-zinc-50/80 transition-colors"}
      onRowClick={(b) => navigate(`${base}/bookings/${b.id}`)}
      empty={
        <EmptyState
          title={tr("reception:components.noMatchingReservations")}
          description={tr("reception:components.tryAnotherStatusOrComeBackLater")}
        />
      }
      columns={[
        {
          title: tr("reception:components.guestCode"),
          render: (b) => {
            const rawName = b.customer?.fullName?.trim();
            const guestName = rawName
              ? rawName
                  .split(" ")
                  .filter(Boolean)
                  .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                  .join(" ")
              : tr("reception:cashier.walkInGuest");
            const contact = b.customer?.phone || b.customer?.email || tr("reception:components.atReception");
            return (
              <div className="flex items-center gap-2.5">
                <DeskLink
                  to={`${base}/bookings/${b.id}`}
                  onClick={(event) => event.stopPropagation()}
                  className="shrink-0 transition-opacity hover:opacity-80"
                  tabIndex={-1}
                  aria-hidden="true"
                >
                  <Avatar name={guestName} />
                </DeskLink>
                <div className="min-w-0">
                  <DeskLink
                    to={`${base}/bookings/${b.id}`}
                    onClick={(event) => event.stopPropagation()}
                    className="font-semibold text-zinc-900 hover:text-brand-700 hover:underline block truncate text-sm transition-colors"
                  >
                    {guestName}
                  </DeskLink>
                  <div className="flex items-center gap-1.5 text-xs text-zinc-500 pt-0.5">
                    <DeskLink
                      to={`${base}/bookings/${b.id}`}
                      onClick={(event) => event.stopPropagation()}
                      className="font-mono font-medium text-brand-700 hover:underline tracking-tight truncate max-w-[140px] inline-block align-bottom"
                      title={b.reference}
                    >
                      {b.reference}
                    </DeskLink>
                    <span>·</span>
                    <span className="text-zinc-400 truncate max-w-[130px]">{contact}</span>
                  </div>
                </div>
              </div>
            );
          },
        },
        {
          title: tr("reception:components.room"),
          render: (b) => (
            <div>
              {b.roomNumber ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-100/90 text-zinc-800 text-xs font-semibold tabular-nums">
                  <BedDouble className="size-3.5 text-zinc-500 shrink-0" />
                  {tr("reception:components.room2")}{b.roomNumber}
                </span>
              ) : (
                <span className="text-zinc-400 text-xs italic">{tr("reception:components.unassigned")}</span>
              )}
            </div>
          ),
        },
        {
          title: tr("reception:components.stay"),
          render: (b) => (
            <div>
              <div className="tabular-nums text-zinc-800 text-xs font-medium">
                <time dateTime={b.checkIn}>{localizedDate(b.checkIn)}</time>
                {" → "}
                <time dateTime={b.checkOut}>{localizedDate(b.checkOut)}</time>
              </div>
              <small className="text-zinc-400 block text-[11px] mt-0.5">{tr("reception:components.valueNightsValueGuests", { value0: (b.nights), value1: (b.guestCount) })}</small>
            </div>
          ),
        },
        {
          title: tr("reception:components.roomCharges"),
          render: (b) => (
            <span className="tabular-nums font-semibold text-zinc-900 text-sm">
              {money(b.totalRoomAmount)}
            </span>
          ),
        },
        {
          title: tr("reception:cashier.status"),
          render: (b) => (
            <Badge tone={STATUS_TONES[b.status] || "zinc"} className="status-badge">
              {deskBookingStatusLabel(b)}
            </Badge>
          ),
        },
        {
          title: tr("reception:cashier.actions"),
          render: (b) => (
            <div
              className="flex items-center justify-end gap-1.5 flex-wrap w-full cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              {billing ? (
                <DeskLink
                  to={`${base}/bookings/${b.id}/billing`}
                  className="inline-flex items-center rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-900 transition-colors shadow-2xs"
                >{tr("reception:components.viewCharges")}</DeskLink>
              ) : b.status === "CHECKED_IN" ? (
                <DeskLink
                  to={`${base}/bookings/${b.id}/billing`}
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors shadow-2xs"
                >
                  <LogOut className="size-3" />
                  {tr("reception:components.checkOutInvoice")}</DeskLink>
              ) : ["PENDING", "CONFIRMED"].includes(b.status) && !awaitingOnlinePayment(b) ? (
                <CheckInWizard
                  bookingId={b.id}
                  checkIn={b.checkIn}
                  checkOut={b.checkOut}
                  variant="primary"
                  className="!bg-brand-600 !text-white hover:!bg-brand-700 !border-transparent text-xs py-1.5 px-3 font-semibold shadow-2xs"
                />
              ) : null}


              {!billing && ["PENDING", "CONFIRMED"].includes(b.status) && (
                <DeskAction
                  path={`/bookings/${b.id}/cancel`}
                  action="cancel"
                  label={tr("reception:components.cancel")}
                  description={tr("reception:components.cancelReservationValueOtherGuestsMayBookTheRoomAfterwards", { value0: (b.reference) })}
                  variant="ghost"
                  className="!text-rose-600 hover:!bg-rose-50 !border-transparent text-xs py-1.5 px-2 font-medium"
                />
              )}
            </div>
          ),
        },
      ]}
    />
  );
}

export function Amounts({
  room,
  services,
  total,
}: {
  room: string;
  services: string;
  total: string;
}) {
  useLocale();
  return (
    <dl className="guest-facts">
      <div>
        <dt>{tr("reception:cashier.roomCharges")}</dt>
        <dd>{money(room)}</dd>
      </div>
      <div>
        <dt>{tr("reception:components.completedServices")}</dt>
        <dd>{money(services)}</dd>
      </div>
      <div>
        <dt>{tr("reception:components.total")}</dt>
        <dd>
          <strong>{money(total)}</strong>
        </dd>
      </div>
    </dl>
  );
}

function cleanServiceName(name: string) {
  return name.replace(/^TEST\s*-\s*\d{8}\s*/i, "").trim() || name;
}

export function OrderItems({ order }: { order: Order }) {
  useLocale();
  return (
    <Table
      caption={tr("reception:components.serviceDetails")}
      rows={order.items}
      rowKey={(i) => i.id}
      columns={[
        { title: tr("reception:components.service"), render: (i) => catalogName(cleanServiceName(i.serviceName)) },
        { title: tr("reception:components.quantity"), render: (i) => i.quantity },
        { title: tr("reception:components.confirmedPrice"), render: (i) => money(i.unitPrice) },
        { title: tr("reception:components.subtotal"), render: (i) => money(i.subtotal) },
      ]}
    />
  );
}

export function DeskAction(props: Parameters<typeof ConfirmDeskAction>[0]) {
  useLocale();
  return props.action === "check-in" ? (
    <CheckInWizard
      bookingId={props.path.split("/")[2]}
      variant={props.variant}
      className={props.className}
    />
  ) : (
    <ConfirmDeskAction {...props} />
  );
}
