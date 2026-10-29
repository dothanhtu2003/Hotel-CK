import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, ShieldAlert } from "lucide-react";
import { Button, Dialog, ErrorState } from "../../components/ui";
import { Avatar, Badge } from "../../components/kamra-ui";
import { Skeleton } from "../guest/components";
import { money } from "../guest/contracts";
import { api } from "../../lib/api";
import { useToast } from "../../components/toast-context";
import { deskError, type DeskBooking } from "./contracts";
import { useDeskGet, useRefreshDesk } from "./queries";
import { cleaningLabels, hotelToday } from "./room-state";

export function CheckInWizard({ bookingId }: { bookingId: string }) {
  const [open, setOpen] = useState(false),
    [step, setStep] = useState(0);
  const lock = useRef(false),
    refresh = useRefreshDesk(),
    toast = useToast();
  const query = useDeskGet<DeskBooking>(
    "/front-desk/bookings/" + bookingId,
    open,
  );
  const mutation = useMutation({
    retry: false,
    mutationFn: () =>
      api.request(`/bookings/${bookingId}/check-in`, { method: "PATCH" }),
    onSuccess: async () => {
      toast("Nhận phòng thành công.");
      setOpen(false);
      await refresh();
    },
    onError: async () => {
      await refresh();
    },
    onSettled: () => {
      lock.current = false;
    },
  });
  const b = query.data,
    today = hotelToday();
  const eligible =
    b?.status === "CONFIRMED" &&
    b.checkIn <= today &&
    b.checkOut > today &&
    b.room?.operationalStatus === "ACTIVE" &&
    b.room.housekeepingStatus === "CLEAN" &&
    b.openTaskCount === 0;

  const steps = [
    "Khách & kỳ nghỉ",
    "Phòng & điều kiện",
    "Kiểm tra & nhận phòng",
  ];

  return (
    <>
      <Button
        variant="secondary"
        onClick={() => {
          setStep(0);
          mutation.reset();
          setOpen(true);
          void query.refetch();
        }}
      >
        Nhận phòng
      </Button>
      <Dialog
        open={open}
        onClose={() => {
          if (!lock.current) setOpen(false);
        }}
        title="Quy trình nhận phòng (Check-in)"
        className="desk-checkin-sheet"
      >
        {/* Step Flow Header matching Kamra */}
        <div className="mb-4 border-b border-zinc-100 pb-3">
          <ol className="flex items-center gap-2">
            {steps.map((title, i) => (
              <li
                key={title}
                aria-current={step === i ? "step" : undefined}
                className={`flex items-center gap-1.5 text-xs font-medium ${
                  step === i
                    ? "text-brand-700 font-semibold"
                    : i < step
                    ? "text-zinc-600"
                    : "text-zinc-400"
                }`}
              >
                <span
                  className={`flex size-5 items-center justify-center rounded-full text-[10px] ${
                    step === i
                      ? "bg-brand-600 text-white font-bold"
                      : i < step
                      ? "bg-brand-100 text-brand-800"
                      : "bg-zinc-100 text-zinc-500"
                  }`}
                >
                  {i < step ? "✓" : i + 1}
                </span>
                <span className="hidden sm:inline">{title}</span>
                {i < steps.length - 1 && (
                  <span className="text-zinc-300 ml-1">/</span>
                )}
              </li>
            ))}
          </ol>
        </div>

        {query.isPending ? (
          <Skeleton />
        ) : query.error ? (
          <ErrorState
            message={query.error.message}
            retry={() => void query.refetch()}
          />
        ) : (
          b && (
            <div className="checkin-content space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  Mã đặt phòng: <strong className="text-zinc-800">{b.reference}</strong>
                </span>
                <span className="text-xs font-bold tabular-nums text-zinc-800">
                  Phòng {b.roomNumber}
                </span>
              </div>

              {step === 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50/70 p-3">
                    <Avatar name={b.customer?.fullName ?? "Khách"} />
                    <div>
                      <h4 className="text-sm font-semibold text-zinc-900">
                        {b.customer?.fullName}
                      </h4>
                      <p className="text-xs text-zinc-500">
                        {b.customer?.phone ?? "Chưa có SĐT"} · {b.customer?.email}
                      </p>
                    </div>
                  </div>

                  <dl className="grid grid-cols-2 gap-2 text-xs border border-zinc-100 rounded-lg p-3 bg-white">
                    <div>
                      <dt className="text-zinc-400">Thời gian lưu trú</dt>
                      <dd className="font-medium text-zinc-800 mt-0.5">
                        {b.checkIn} → {b.checkOut}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-zinc-400">Số đêm & khách</dt>
                      <dd className="font-medium text-zinc-800 mt-0.5">
                        {b.nights} đêm · {b.guestCount} khách
                      </dd>
                    </div>
                  </dl>
                </div>
              )}

              {step === 1 && (
                <div className="space-y-3">
                  <div className="rounded-lg border border-zinc-200 bg-zinc-50/70 p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-zinc-900">
                        Phòng {b.roomNumber}
                      </span>
                      <Badge
                        tone={
                          b.room?.housekeepingStatus === "CLEAN"
                            ? "green"
                            : b.room?.housekeepingStatus === "DIRTY"
                            ? "amber"
                            : "zinc"
                        }
                      >
                        {cleaningLabels[b.room?.housekeepingStatus ?? ""] ?? b.room?.housekeepingStatus}
                      </Badge>
                    </div>
                    <p className="text-xs text-zinc-600">
                      Loại phòng: {b.room?.roomType.name}
                    </p>
                    <p className="text-xs text-zinc-500">
                      Trạng thái vận hành: {b.room?.operationalStatus} · {b.openTaskCount} công việc mở
                    </p>
                  </div>

                  <p className="text-xs text-zinc-500">
                    Phòng đã được chọn khi đặt. Hệ thống kiểm tra điều kiện sẵn sàng trước khi trao chìa khóa cho khách.
                  </p>

                  {!eligible && (
                    <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 flex items-start gap-2">
                      <ShieldAlert className="size-4 shrink-0 text-rose-600 mt-0.5" />
                      <div>
                        <strong>Chưa đủ điều kiện nhận phòng:</strong> Cần ngày lưu trú hợp lệ, booking CONFIRMED, phòng ACTIVE và CLEAN, không còn công việc buồng phòng còn mở.
                      </div>
                    </div>
                  )}

                  {eligible && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-xs text-emerald-800 flex items-center gap-2">
                      <CheckCircle2 className="size-4 text-emerald-600" />
                      <span>Phòng đã sẵn sàng đón khách (ACTIVE & CLEAN).</span>
                    </div>
                  )}
                </div>
              )}

              {step === 2 && (
                <div className="space-y-3">
                  <div className="rounded-lg border border-zinc-200 bg-white p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-500">Khách nhận phòng:</span>
                      <strong className="text-zinc-800">{b.customer?.fullName}</strong>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-500">Phòng nhận:</span>
                      <strong className="text-zinc-800">Phòng {b.roomNumber} ({b.room?.roomType.name})</strong>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-500">Kỳ nghỉ:</span>
                      <span className="text-zinc-800">{b.checkIn} → {b.checkOut} ({b.nights} đêm)</span>
                    </div>
                    <div className="border-t border-zinc-100 pt-2 flex items-center justify-between text-xs">
                      <span className="text-zinc-500">Giá mỗi đêm:</span>
                      <span className="tabular-nums font-medium text-zinc-800">{money(b.nightlyPrice)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-zinc-700">Tổng tiền phòng:</span>
                      <span className="tabular-nums text-sm text-brand-700">{money(b.totalRoomAmount)}</span>
                    </div>
                  </div>

                  <p className="text-xs text-zinc-500">
                    Bàn giao phòng cho khách. Tiền phòng chưa bao gồm các đơn dịch vụ phát sinh trong quá trình lưu trú.
                  </p>
                </div>
              )}

              {mutation.error && (
                <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700">
                  {deskError(mutation.error, "check-in")}
                </p>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100">
                <Button
                  variant="secondary"
                  disabled={mutation.isPending}
                  onClick={() => (step ? setStep(step - 1) : setOpen(false))}
                >
                  Quay lại
                </Button>
                {step < 2 ? (
                  <Button
                    disabled={step === 1 && !eligible}
                    onClick={() => setStep(step + 1)}
                  >
                    Tiếp tục
                  </Button>
                ) : (
                  <Button
                    busy={mutation.isPending}
                    disabled={!eligible || !!mutation.error || query.isFetching}
                    onClick={() => {
                      if (lock.current) return;
                      lock.current = true;
                      mutation.mutate();
                    }}
                  >
                    Xác nhận nhận phòng
                  </Button>
                )}
              </div>
            </div>
          )
        )}
      </Dialog>
    </>
  );
}
