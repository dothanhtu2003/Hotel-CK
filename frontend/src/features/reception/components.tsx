import { CheckoutSummary } from "./reservation-panels";
import { CheckInWizard } from "./check-in";
import { useRef, useState } from "react";
import { Link } from "react-router";
import { useMutation } from "@tanstack/react-query";
import { BedDouble, LogOut } from "lucide-react";
import { Button, Dialog, EmptyState, Table } from "../../components/ui";
import { Avatar, Badge, type BadgeTone } from "../../components/kamra-ui";
import { money, statusLabels, type Booking, type Order } from "../guest/contracts";
import { api } from "../../lib/api";
import { useToast } from "../../components/toast-context";
import { type DeskBooking, deskError } from "./contracts";
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
}: {
  path: string;
  label: string;
  description: string;
  action: string;
  onDone?: (result: unknown) => void;
  variant?: "primary" | "secondary" | "ghost" | "light";
  className?: string;
}) {
  const [open, setOpen] = useState(false),
    lock = useRef(false),
    refresh = useRefreshDesk(),
    toast = useToast();
  const mutation = useMutation({
    retry: false,
    mutationFn: () =>
      api.request(path, { method: action === "invoice" ? "POST" : "PATCH" }),
    onSuccess: async (data) => {
      toast(`${label} thành công.`);
      setOpen(false);
      await refresh();
      onDone?.(data);
    },
    onError: async (error) => {
      toast(deskError(error, action), "error");
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
        <p>{description}</p>
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
          >
            Quay lại
          </Button>
          <Button
            busy={mutation.isPending}
            disabled={!!mutation.error}
            onClick={() => {
              if (lock.current) return;
              lock.current = true;
              mutation.mutate();
            }}
          >
            Xác nhận {label.toLocaleLowerCase("vi-VN")}
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
  const base = useDeskBase();
  return (
    <Table
      caption="Danh sách booking"
      rows={rows}
      rowKey={(b) => b.id}
      empty={
        <EmptyState
          title="Chưa có booking phù hợp"
          description="Hãy thử trạng thái khác hoặc quay lại sau."
        />
      }
      columns={[
        {
          title: "KHÁCH HÀNG / MÃ",
          render: (b) => {
            const rawName = b.customer?.fullName?.trim();
            const guestName = rawName
              ? rawName
                  .split(" ")
                  .filter(Boolean)
                  .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                  .join(" ")
              : "Khách tại quầy";
            const contact = b.customer?.phone || b.customer?.email || "Tại quầy";
            return (
              <div className="flex items-center gap-2.5">
                <Avatar name={guestName} />
                <div className="min-w-0">
                  <span className="font-semibold text-zinc-900 block truncate text-sm">
                    {guestName}
                  </span>
                  <div className="flex items-center gap-1.5 text-xs text-zinc-500 pt-0.5">
                    <Link
                      to={`${base}/bookings/${b.id}`}
                      className="font-mono font-medium text-brand-700 hover:underline tracking-tight truncate max-w-[140px] inline-block align-bottom"
                      title={b.reference}
                    >
                      {b.reference}
                    </Link>
                    <span>·</span>
                    <span className="text-zinc-400 truncate max-w-[130px]">{contact}</span>
                  </div>
                </div>
              </div>
            );
          },
        },
        {
          title: "PHÒNG",
          render: (b) => (
            <div>
              {b.roomNumber ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-100/90 text-zinc-800 text-xs font-semibold tabular-nums">
                  <BedDouble className="size-3.5 text-zinc-500 shrink-0" />
                  Phòng {b.roomNumber}
                </span>
              ) : (
                <span className="text-zinc-400 text-xs italic">Chưa xếp</span>
              )}
            </div>
          ),
        },
        {
          title: "LƯU TRÚ",
          render: (b) => (
            <div>
              <div className="tabular-nums text-zinc-800 text-xs font-medium">
                <time dateTime={b.checkIn}>{b.checkIn.split("-").reverse().join("/")}</time>
                {" → "}
                <time dateTime={b.checkOut}>{b.checkOut.split("-").reverse().join("/")}</time>
              </div>
              <small className="text-zinc-400 block text-[11px] mt-0.5">
                {b.nights} đêm · {b.guestCount} khách
              </small>
            </div>
          ),
        },
        {
          title: "TIỀN PHÒNG",
          render: (b) => (
            <span className="tabular-nums font-semibold text-zinc-900 text-sm">
              {money(b.totalRoomAmount)}
            </span>
          ),
        },
        {
          title: "TRẠNG THÁI",
          render: (b) => (
            <Badge tone={STATUS_TONES[b.status] || "zinc"} className="status-badge">
              {statusLabels[b.status] ?? b.status}
            </Badge>
          ),
        },
        {
          title: "THAO TÁC",
          render: (b) => (
            <div className="flex items-center justify-end gap-1.5 flex-wrap">
              {billing ? (
                <Link
                  to={`${base}/bookings/${b.id}/billing`}
                  className="inline-flex items-center rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-900 transition-colors shadow-2xs"
                >
                  Xem chi phí
                </Link>
              ) : b.status === "CHECKED_IN" ? (
                <Link
                  to={`${base}/bookings/${b.id}/billing`}
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors shadow-2xs"
                >
                  <LogOut className="size-3" />
                  Trả phòng / Hóa đơn
                </Link>
              ) : b.status === "CONFIRMED" ? (
                <DeskAction
                  path={`/bookings/${b.id}/check-in`}
                  action="check-in"
                  label="Nhận phòng"
                  description="Chỉ nhận phòng trong ngày lưu trú hợp lệ, khách đang hoạt động, phòng ACTIVE và CLEAN, không có công việc buồng phòng còn mở."
                  variant="primary"
                  className="!bg-brand-600 !text-white hover:!bg-brand-700 !border-transparent text-xs py-1.5 px-3 font-semibold shadow-2xs"
                />
              ) : b.status === "PENDING" ? (
                <DeskAction
                  path={`/bookings/${b.id}/confirm`}
                  action="confirm"
                  label="Xác nhận"
                  description={`Xác nhận booking ${b.reference}, phòng ${b.roomNumber}?`}
                  variant="primary"
                  className="!bg-brand-600 !text-white hover:!bg-brand-700 !border-transparent text-xs py-1.5 px-3 font-semibold shadow-2xs"
                />
              ) : null}

              <Link
                to={`${base}/bookings/${b.id}`}
                className="inline-flex items-center rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 transition-colors shadow-2xs"
              >
                Chi tiết
              </Link>

              {!billing && ["PENDING", "CONFIRMED"].includes(b.status) && (
                <DeskAction
                  path={`/bookings/${b.id}/cancel`}
                  action="cancel"
                  label="Hủy"
                  description={`Hủy booking ${b.reference}? Phòng có thể được khách khác đặt lại.`}
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
  return (
    <dl className="guest-facts">
      <div>
        <dt>Tiền phòng</dt>
        <dd>{money(room)}</dd>
      </div>
      <div>
        <dt>Dịch vụ hoàn thành</dt>
        <dd>{money(services)}</dd>
      </div>
      <div>
        <dt>Tổng tiền</dt>
        <dd>
          <strong>{money(total)}</strong>
        </dd>
      </div>
    </dl>
  );
}

export function OrderItems({ order }: { order: Order }) {
  return (
    <Table
      caption="Chi tiết dịch vụ và giá snapshot"
      rows={order.items}
      rowKey={(i) => i.id}
      columns={[
        { title: "DỊCH VỤ", render: (i) => i.serviceName },
        { title: "SỐ LƯỢNG", render: (i) => i.quantity },
        { title: "GIÁ ĐÃ CHỐT", render: (i) => money(i.unitPrice) },
        { title: "THÀNH TIỀN", render: (i) => money(i.subtotal) },
      ]}
    />
  );
}

export function DeskAction(props: Parameters<typeof ConfirmDeskAction>[0]) {
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
