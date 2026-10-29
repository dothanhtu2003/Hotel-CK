import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { BedDouble, CalendarDays, LoaderCircle, Plus, Search, User, X } from "lucide-react";
import { api } from "../lib/api";
import { Badge } from "./kamra-ui";
import { money, statusLabels } from "../features/guest/contracts";
import type { DeskBooking, DeskRoom } from "../features/reception/contracts";
import type { Page } from "../features/guest/contracts";

export function CommandPalette({
  open,
  onClose,
  home,
}: {
  open: boolean;
  onClose: () => void;
  home: string;
}) {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [bookings, setBookings] = useState<DeskBooking[]>([]);
  const [rooms, setRooms] = useState<DeskRoom[]>([]);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQ("");
      setBookings([]);
      setRooms([]);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setBookings([]);
      setRooms([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const [bookingsRes, roomsRes] = await Promise.all([
          api.request<Page<DeskBooking>>(
            `/front-desk/bookings?q=${encodeURIComponent(trimmed)}&pageSize=5`,
          ),
          api.request<Page<DeskRoom>>(
            `/front-desk/rooms?pageSize=30`,
          ),
        ]);

        setBookings(bookingsRes.data || []);
        const filteredRooms = (roomsRes.data || []).filter((r) =>
          r.roomNumber.toLowerCase().includes(trimmed.toLowerCase()),
        );
        setRooms(filteredRooms.slice(0, 5));
      } catch {
        // silent error for search
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [q]);

  if (!open) return null;

  const go = (path: string) => {
    onClose();
    navigate(path);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4 bg-black/40 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-zinc-200 px-3.5 py-2.5">
          <Search className="size-4 shrink-0 text-zinc-400" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm khách, mã booking, số phòng, số điện thoại…"
            className="w-full border-0 bg-transparent text-sm text-zinc-800 placeholder-zinc-400 focus:outline-none"
          />
          {loading && <LoaderCircle className="size-4 animate-spin text-zinc-400" />}
          {q && (
            <button
              onClick={() => setQ("")}
              className="rounded p-1 text-zinc-400 hover:text-zinc-600"
            >
              <X className="size-3.5" />
            </button>
          )}
          <kbd className="rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-400">
            ESC
          </kbd>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2">
          {q.trim().length >= 2 ? (
            <>
              {bookings.length > 0 && (
                <div className="mb-3">
                  <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                    Booking tìm thấy ({bookings.length})
                  </div>
                  <div className="space-y-0.5">
                    {bookings.map((b) => (
                      <button
                        key={b.id}
                        onClick={() => go(`${home}/bookings/${b.id}`)}
                        className="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-start text-sm hover:bg-zinc-50 cursor-pointer"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-zinc-800 truncate">
                              {b.customer?.fullName ?? b.reference}
                            </span>
                            <Badge
                              tone={
                                b.status === "CHECKED_IN"
                                  ? "green"
                                  : b.status === "CONFIRMED"
                                  ? "sky"
                                  : b.status === "PENDING"
                                  ? "amber"
                                  : "zinc"
                              }
                            >
                              {statusLabels[b.status] ?? b.status}
                            </Badge>
                          </div>
                          <div className="text-xs text-zinc-400">
                            {b.reference} · Phòng {b.roomNumber} · {b.checkIn} → {b.checkOut}
                          </div>
                        </div>
                        <span className="text-xs font-semibold tabular-nums text-zinc-700 shrink-0">
                          {money(b.totalRoomAmount)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {rooms.length > 0 && (
                <div className="mb-3">
                  <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                    Phòng ({rooms.length})
                  </div>
                  <div className="space-y-0.5">
                    {rooms.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => go(`${home}/rooms`)}
                        className="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-start text-sm hover:bg-zinc-50 cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <BedDouble className="size-4 text-zinc-400" />
                          <span className="font-medium text-zinc-800">
                            Phòng {r.roomNumber} ({r.roomType.name})
                          </span>
                        </div>
                        <Badge
                          tone={
                            r.housekeepingStatus === "CLEAN"
                              ? "green"
                              : r.housekeepingStatus === "DIRTY"
                              ? "amber"
                              : "zinc"
                          }
                        >
                          {r.housekeepingStatus}
                        </Badge>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {bookings.length === 0 && rooms.length === 0 && !loading && (
                <div className="py-8 text-center text-sm text-zinc-400">
                  Không tìm thấy kết quả nào cho "{q}".
                </div>
              )}
            </>
          ) : (
            <div>
              <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Lối tắt thao tác
              </div>
              <div className="space-y-0.5">
                <button
                  onClick={() => go(`${home}/walk-in`)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start text-sm hover:bg-zinc-50 cursor-pointer"
                >
                  <Plus className="size-4 text-brand-600" />
                  <span className="font-medium text-zinc-700">Đặt phòng tại quầy (Walk-in)</span>
                </button>
                <button
                  onClick={() => go(`${home}/bookings`)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start text-sm hover:bg-zinc-50 cursor-pointer"
                >
                  <User className="size-4 text-zinc-500" />
                  <span className="font-medium text-zinc-700">Khách đến / Đang lưu trú / Khách đi</span>
                </button>
                <button
                  onClick={() => go(`${home}/tape-chart`)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start text-sm hover:bg-zinc-50 cursor-pointer"
                >
                  <CalendarDays className="size-4 text-zinc-500" />
                  <span className="font-medium text-zinc-700">Sơ đồ timeline Tape Chart</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
