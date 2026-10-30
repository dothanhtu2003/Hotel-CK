import { hotelToday } from "./room-state";
import { useState, useRef } from "react";
import { useNavigate } from "react-router";
import { useMutation } from "@tanstack/react-query";
import { Search, AlertTriangle } from "lucide-react";
import { Button, Dialog } from "../../components/ui";
import { Skeleton } from "../guest/components";
import { money, type Page } from "../guest/contracts";
import {
  deskError,
  type Customer,
  type DeskBooking,
  type DeskRoom,
} from "./contracts";
import {
  useDeskBase,
  useDeskGet,
  useRefreshDesk,
} from "./queries";
import { api } from "../../lib/api";
import { ApiError } from "../../lib/api-client";
import { useToast } from "../../components/toast-context";

export interface UnifiedBookingModalProps {
  open: boolean;
  onClose: () => void;
  room: DeskRoom | { id: string; roomNumber: string; floor: number; roomType: { id: string; name: string; nightlyPrice: string; maxGuests: number } } | null;
  initialCheckIn: string;
  initialCheckOut: string;
  initialGuests: number;
  onSuccess?: (booking: DeskBooking) => void;
}

export function UnifiedBookingModal({
  open,
  onClose,
  room,
  initialCheckIn,
  initialCheckOut,
  initialGuests,
  onSuccess,
}: UnifiedBookingModalProps) {
  const base = useDeskBase(),
    navigate = useNavigate(),
    toast = useToast(),
    refresh = useRefreshDesk(),
    lock = useRef(false);

  const [checkIn, setCheckIn] = useState(initialCheckIn);
  const [checkOut, setCheckOut] = useState(initialCheckOut);
  const [guests, setGuests] = useState(initialGuests);

  const [newGuest, setNewGuest] = useState(false);
  const [search, setSearch] = useState("");
  const [customerPage, setCustomerPage] = useState(1);
  const [customer, setCustomer] = useState<Customer | null>(null);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const [review, setReview] = useState<Record<string, unknown> | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const customers = useDeskGet<Page<Customer>>(
    "/front-desk/customers?q=" +
      encodeURIComponent(search) +
      "&page=" +
      customerPage,
    open && !newGuest && search.length >= 2,
  );

  const nights = Math.max(
    1,
    Math.round(
      (Date.parse(checkOut + "T00:00:00Z") -
        Date.parse(checkIn + "T00:00:00Z")) /
        86400000,
    ),
  );

  const estimatedTotal = room
    ? (Number(room.roomType.nightlyPrice) * nights).toFixed(2)
    : "0.00";

  const isStayValid = checkIn && checkOut && checkOut > checkIn;
  const isCapacityValid = room ? guests <= room.roomType.maxGuests : true;

  const mutation = useMutation({
    retry: false,
    mutationFn: (data: Record<string, unknown>) =>
      api.request<DeskBooking>("/front-desk/walk-in", {
        method: "POST",
        body: { ...data, receiveNow: data.checkIn === hotelToday() },
      }),
    onSuccess: async (b) => {
      toast(b.status === "CHECKED_IN" ? "Đã nhận phòng thành công." : "Đã tạo đặt phòng trước.");
      await refresh();
      onClose();
      if (onSuccess) {
        onSuccess(b);
      } else {
        navigate(`${base}/bookings/${b.id}`);
      }
    },
    onError: (error) => {
      setUncertain(
        !(error instanceof ApiError) ||
          error.status === 0 ||
          error.status >= 500,
      );
      const msg = deskError(error, "booking");
      setFormError(msg);
      toast(msg, "error");
    },
    onSettled: () => {
      lock.current = false;
    },
  });

  const handleReviewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!room) {
      setFormError("Vui lòng chọn phòng trước khi đặt.");
      return;
    }

    if (!isStayValid) {
      setFormError("Ngày trả phòng phải sau ngày nhận phòng.");
      return;
    }

    if (!isCapacityValid) {
      setFormError(
        `Số khách (${guests}) vượt quá sức chứa tối đa của phòng (${room.roomType.maxGuests} khách).`,
      );
      return;
    }

    if (newGuest) {
      const trimmedName = fullName.trim();
      const trimmedPhone = phone.trim();
      const trimmedEmail = email.trim().toLowerCase();

      if (!trimmedName) {
        setFormError("Vui lòng nhập họ và tên của khách hàng.");
        return;
      }
      if (!trimmedPhone || trimmedPhone.length < 6 || trimmedPhone.length > 24) {
        setFormError("Vui lòng nhập số điện thoại hợp lệ (6-24 ký tự).");
        return;
      }
      // Validate email only when the guest provides one.
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (trimmedEmail && !emailRegex.test(trimmedEmail)) {
        setFormError("Vui lòng nhập địa chỉ email hợp lệ của khách.");
        return;
      }

      setReview({
        roomId: room.id,
        checkIn,
        checkOut,
        guests: Number(guests),
        fullName: trimmedName,
        phone: trimmedPhone,
        ...(trimmedEmail ? { email: trimmedEmail } : {}),
      });
    } else {
      if (!customer) {
        setFormError("Vui lòng tìm và chọn hồ sơ khách hàng đã có hoặc chuyển sang tạo hồ sơ mới.");
        return;
      }

      setReview({
        roomId: room.id,
        checkIn,
        checkOut,
        guests: Number(guests),
        customerId: customer.id,
      });
    }
  };

  if (!open || !room) return null;

  return (
    <>
      <Dialog
        open={open && !review}
        onClose={onClose}
        title={`Đặt phòng ${room.roomNumber} (${room.roomType.name})`}
        className="desk-room-action-modal unified-booking-dialog"
      >
        <div className="drawer-body p-4 sm:p-6 space-y-5">
          {/* Room Banner */}
          <div className="drawer-room-hero flex items-center justify-between p-3.5 bg-brand-50/60 border border-brand-200/60 rounded-lg">
            <div>
              <span className="drawer-room-number text-lg font-bold text-zinc-900">
                Phòng {room.roomNumber}
              </span>
              <p className="drawer-room-type text-xs text-zinc-600 mt-0.5">
                {room.roomType.name} · Tầng {room.floor} · Tối đa {room.roomType.maxGuests} khách
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs text-zinc-500 block">Giá niêm yết</span>
              <strong className="text-brand-700 font-semibold text-sm">
                {money(room.roomType.nightlyPrice)}/đêm
              </strong>
            </div>
          </div>

          {/* Form Error Banner */}
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs flex items-center gap-2" role="alert">
              <AlertTriangle className="size-4 shrink-0 text-rose-600" />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleReviewSubmit} noValidate className="space-y-4">
            {/* Dates & Guests Row */}
            <div className="bg-zinc-50 border border-zinc-200 p-3.5 rounded-lg space-y-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 block">
                1. Thông tin lưu trú
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="block">
                  <span className="text-xs text-zinc-600 block mb-1">Ngày nhận phòng</span>
                  <input
                    type="date"
                    className="input w-full text-xs"
                    value={checkIn}
                    onChange={(e) => setCheckIn(e.target.value)}
                    required
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-zinc-600 block mb-1">Ngày trả phòng</span>
                  <input
                    type="date"
                    className="input w-full text-xs"
                    value={checkOut}
                    onChange={(e) => setCheckOut(e.target.value)}
                    required
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-zinc-600 block mb-1">Số khách</span>
                  <input
                    type="number"
                    min={1}
                    max={room.roomType.maxGuests}
                    className="input w-full text-xs"
                    value={guests}
                    onChange={(e) => setGuests(Number(e.target.value))}
                    required
                  />
                </label>
              </div>

              {!isStayValid && (
                <p className="text-xs text-rose-600 font-medium">
                  ⚠️ Ngày trả phòng phải sau ngày nhận phòng.
                </p>
              )}
              {!isCapacityValid && (
                <p className="text-xs text-rose-600 font-medium">
                  ⚠️ Vượt quá sức chứa tối đa ({room.roomType.maxGuests} khách).
                </p>
              )}
            </div>

            {/* Guest Information Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  2. Thông tin khách hàng
                </span>
                <div className="inline-flex rounded-md border border-zinc-200 bg-zinc-100 p-0.5 text-xs">
                  <button
                    type="button"
                    className={`px-2.5 py-1 rounded font-medium transition-colors cursor-pointer ${
                      !newGuest
                        ? "bg-white text-zinc-900 shadow-2xs font-semibold"
                        : "text-zinc-600 hover:text-zinc-900"
                    }`}
                    onClick={() => {
                      setNewGuest(false);
                      setFormError(null);
                    }}
                  >
                    Tìm khách đã có
                  </button>
                  <button
                    type="button"
                    className={`px-2.5 py-1 rounded font-medium transition-colors cursor-pointer ${
                      newGuest
                        ? "bg-white text-zinc-900 shadow-2xs font-semibold"
                        : "text-zinc-600 hover:text-zinc-900"
                    }`}
                    onClick={() => {
                      setNewGuest(true);
                      setCustomer(null);
                      setFormError(null);
                    }}
                  >
                    Tạo hồ sơ mới
                  </button>
                </div>
              </div>

              {!newGuest ? (
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 size-4 text-zinc-400" />
                    <input
                      type="search"
                      className="input pl-9 w-full text-xs"
                      placeholder="Tìm theo tên, SĐT hoặc email (ít nhất 2 ký tự)…"
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        setCustomerPage(1);
                      }}
                      aria-label="Tìm kiếm khách hàng"
                    />
                  </div>

                  {customer && (
                    <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                      <div className="flex items-center gap-2.5">
                        <span className="flex size-7 items-center justify-center rounded-full bg-emerald-600 text-white font-semibold text-xs">
                          {customer.fullName.slice(0, 1).toUpperCase()}
                        </span>
                        <div>
                          <strong className="text-xs text-emerald-950 font-semibold block">
                            {customer.fullName}
                          </strong>
                          <span className="text-[11px] text-emerald-700 block">
                            {customer.phone ? `${customer.phone} · ` : ""}{customer.email}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCustomer(null)}
                        className="text-xs text-emerald-800 hover:underline cursor-pointer"
                      >
                        Đổi khách
                      </button>
                    </div>
                  )}

                  {!customer && search.length >= 2 && (
                    <div className="border border-zinc-200 rounded-lg max-h-48 overflow-y-auto divide-y divide-zinc-100 bg-white">
                      {customers.isPending ? (
                        <div className="p-3">
                          <Skeleton />
                        </div>
                      ) : customers.error ? (
                        <div className="p-3 text-xs text-rose-600">
                          {customers.error.message}
                        </div>
                      ) : customers.data?.data.length ? (
                        customers.data.data.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            className="w-full text-left p-2.5 hover:bg-zinc-50 flex items-center justify-between cursor-pointer transition-colors"
                            onClick={() => {
                              setCustomer(c);
                              setFormError(null);
                            }}
                          >
                            <div>
                              <strong className="text-xs text-zinc-900 block font-medium">
                                {c.fullName}
                              </strong>
                              <span className="text-[11px] text-zinc-500 block">
                                {c.phone ? `${c.phone} · ` : ""}{c.email}
                              </span>
                            </div>
                            <span className="text-xs font-semibold text-brand-600 hover:underline">
                              Chọn →
                            </span>
                          </button>
                        ))
                      ) : (
                        <div className="p-3 text-center text-xs text-zinc-500">
                          Không tìm thấy khách hàng. Bạn có thể chọn tab <strong>Tạo hồ sơ mới</strong>.
                        </div>
                      )}
                    </div>
                  )}

                  {!customer && search.length < 2 && (
                    <p className="text-xs text-zinc-500 bg-zinc-50 p-2.5 rounded border border-zinc-200">
                      💡 Nhập tên, SĐT hoặc email để chọn khách đã từng lưu trú.
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-3 bg-zinc-50 border border-zinc-200 p-3.5 rounded-lg">
                  <label className="block">
                    <span className="text-xs text-zinc-700 block mb-1">
                      Họ và tên khách <span className="text-rose-500">*</span>
                    </span>
                    <input
                      type="text"
                      className="input w-full text-xs"
                      placeholder="Ví dụ: Nguyễn Văn An"
                      value={fullName}
                      maxLength={120}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs text-zinc-700 block mb-1">
                      Số điện thoại <span className="text-rose-500">*</span>
                    </span>
                    <input
                      type="tel"
                      className="input w-full text-xs"
                      placeholder="Ví dụ: 0901234567"
                      value={phone}
                      minLength={6}
                      maxLength={24}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs text-zinc-700 block mb-1">
                      Địa chỉ Email (không bắt buộc)
                    </span>
                    <input
                      type="email"
                      className="input w-full text-xs"
                      placeholder="Email thực tế của khách"
                      value={email}
                      maxLength={254}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </label>
                </div>
              )}
            </div>

            {/* Price Breakdown */}
            <div className="pt-3 border-t border-zinc-200 flex items-center justify-between">
              <div>
                <span className="text-xs text-zinc-500 block">
                  Tổng tiền phòng dự kiến ({nights} đêm)
                </span>
                <strong className="text-base text-zinc-900 font-bold">
                  {money(estimatedTotal)}
                </strong>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="secondary" type="button" onClick={onClose}>
                  Hủy
                </Button>
                <Button
                  type="submit"
                  disabled={!isStayValid || !isCapacityValid || (!customer && !newGuest)}
                  className="font-semibold"
                >
                  Xem lại & Xác nhận
                </Button>
              </div>
            </div>
          </form>
        </div>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog
        open={Boolean(review)}
        onClose={() => {
          if (!lock.current) setReview(null);
        }}
        title="Xác nhận tạo booking"
        className="desk-room-action-modal"
      >
        {review && (
          <div className="drawer-body p-4 sm:p-6 space-y-4">
            <div className="p-3.5 bg-brand-50 border border-brand-200 rounded-lg space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-600">Phòng:</span>
                <strong className="text-zinc-900 font-semibold">
                  Phòng {room.roomNumber} ({room.roomType.name} · Tầng {room.floor})
                </strong>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-600">Khách hàng:</span>
                <strong className="text-zinc-900 font-semibold">
                  {customer?.fullName ?? String(review.fullName)}
                </strong>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-600">Liên hệ:</span>
                <span className="text-zinc-800">
                  {customer ? [customer.phone, customer.email].filter(Boolean).join(" · ") : [review.phone, review.email].filter(Boolean).join(" · ")}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-600">Lưu trú:</span>
                <span className="text-zinc-800 font-medium">
                  {String(review.checkIn)} → {String(review.checkOut)} ({nights} đêm · {String(review.guests)} khách)
                </span>
              </div>
              <div className="flex justify-between items-center text-xs border-t border-brand-200/60 pt-2 mt-2">
                <span className="text-zinc-700 font-medium">Tổng tiền dự kiến:</span>
                <strong className="text-brand-800 font-bold text-sm">
                  {money(estimatedTotal)}
                </strong>
              </div>
            </div>

            <p className="text-xs text-zinc-500 bg-amber-50 p-2.5 rounded border border-amber-200 text-amber-800">
              {checkIn === hotelToday() ? "Xác nhận sẽ tạo booking và nhận phòng ngay. Phòng chuyển sang Đang ở." : "Đặt trước cho ngày tương lai. Khách sẽ nhận phòng vào ngày đến."}
            </p>

            {mutation.error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded text-rose-800 text-xs" role="alert">
                {deskError(mutation.error, "booking")}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="secondary"
                disabled={mutation.isPending}
                onClick={() => setReview(null)}
              >
                Chỉnh sửa
              </Button>
              <Button
                busy={mutation.isPending}
                disabled={uncertain || !!mutation.error}
                onClick={() => {
                  if (lock.current) return;
                  lock.current = true;
                  mutation.mutate(review);
                }}
              >
                Xác nhận tạo booking
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}
