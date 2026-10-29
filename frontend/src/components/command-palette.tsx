import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
  AlertCircle,
  BedDouble,
  CalendarDays,
  LoaderCircle,
  Plus,
  Search,
  User,
  X,
} from "lucide-react";
import { api } from "../lib/api";
import { Badge } from "./kamra-ui";
import { money, statusLabels } from "../features/guest/contracts";
import type { DeskBooking, DeskRoom } from "../features/reception/contracts";
import type { Page } from "../features/guest/contracts";

interface ActionItem {
  id: string;
  type: "shortcut" | "booking" | "room";
  onSelect: () => void;
}

function CommandPaletteModal({
  onClose,
  home,
}: {
  onClose: () => void;
  home: string;
}) {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bookings, setBookings] = useState<DeskBooking[]>([]);
  const [rooms, setRooms] = useState<DeskRoom[]>([]);
  const [rawSelectedIndex, setRawSelectedIndex] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const go = useCallback(
    (path: string) => {
      onClose();
      navigate(path);
    },
    [onClose, navigate],
  );

  const trimmed = q.trim();
  const isQueryMode = trimmed.length >= 2;

  // Flattened actionable items for keyboard navigation
  const flatItems: ActionItem[] = useMemo(() => {
    if (isQueryMode) {
      const items: ActionItem[] = [];
      bookings.forEach((b) => {
        items.push({
          id: `booking-${b.id}`,
          type: "booking",
          onSelect: () => go(`${home}/bookings/${b.id}`),
        });
      });
      rooms.forEach((r) => {
        items.push({
          id: `room-${r.id}`,
          type: "room",
          onSelect: () => go(`${home}/rooms`),
        });
      });
      return items;
    }
    return [
      { id: "new-booking", type: "shortcut", onSelect: () => go(`${home}/rooms?mode=booking`) },
      { id: "bookings", type: "shortcut", onSelect: () => go(`${home}/bookings`) },
      { id: "tape-chart", type: "shortcut", onSelect: () => go(`${home}/tape-chart`) },
    ];
  }, [isQueryMode, bookings, rooms, home, go]);

  const selectedIndex =
    flatItems.length === 0
      ? 0
      : Math.min(Math.max(0, rawSelectedIndex), flatItems.length - 1);

  // Focus input on mount
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, []);

  // Keyboard navigation listener (ArrowUp, ArrowDown, Enter, Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setRawSelectedIndex((i) =>
          flatItems.length > 0 ? (i + 1) % flatItems.length : 0,
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setRawSelectedIndex((i) =>
          flatItems.length > 0
            ? (i - 1 + flatItems.length) % flatItems.length
            : 0,
        );
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (flatItems[selectedIndex]) {
          flatItems[selectedIndex].onSelect();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, flatItems, selectedIndex]);

  // Debounced server-side search with cancellation and race-condition immunity
  useEffect(() => {
    if (trimmed.length < 2) {
      abortRef.current?.abort();
      return;
    }

    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;

    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const [bookingsRes, roomsRes] = await Promise.all([
          api.request<Page<DeskBooking>>(
            `/front-desk/bookings?q=${encodeURIComponent(trimmed)}&pageSize=5`,
            { signal: controller.signal },
          ),
          api.request<Page<DeskRoom>>(
            `/front-desk/rooms?q=${encodeURIComponent(trimmed)}&pageSize=5`,
            { signal: controller.signal },
          ),
        ]);

        if (!controller.signal.aborted) {
          setBookings(bookingsRes.data || []);
          setRooms(roomsRes.data || []);
          setRawSelectedIndex(0);
        }
      } catch (err: unknown) {
        if (!controller.signal.aborted) {
          const isAbort =
            err instanceof Error &&
            (err.name === "AbortError" || err.message.includes("abort"));
          if (!isAbort) {
            setError(
              err instanceof Error
                ? err.message
                : "Không thể kết nối đến máy chủ tìm kiếm.",
            );
          }
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 200);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed]);

  // If user clears the query or typed < 2 characters, displayed bookings/rooms are empty
  const displayedBookings = isQueryMode ? bookings : [];
  const displayedRooms = isQueryMode ? rooms : [];

  let currentItemOffset = 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Tìm kiếm nhanh toàn hệ thống"
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4 bg-black/40 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-2 border-b border-zinc-200 px-3.5 py-2.5">
          <Search className="size-4 shrink-0 text-zinc-400" />
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded="true"
            aria-controls="cmd-palette-list"
            aria-activedescendant={flatItems[selectedIndex]?.id}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setRawSelectedIndex(0);
            }}
            placeholder="Tìm khách, mã booking, số phòng, số điện thoại…"
            className="w-full border-0 bg-transparent text-sm text-zinc-800 placeholder-zinc-400 focus:outline-none"
          />
          {loading && (
            <LoaderCircle className="size-4 animate-spin text-zinc-400" />
          )}
          {q && (
            <button
              type="button"
              aria-label="Xóa từ khóa tìm kiếm"
              onClick={() => {
                setQ("");
                setRawSelectedIndex(0);
                inputRef.current?.focus();
              }}
              className="rounded p-1 text-zinc-400 hover:text-zinc-600 cursor-pointer"
            >
              <X className="size-3.5" />
            </button>
          )}
          <kbd className="rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-400">
            ESC
          </kbd>
        </div>

        {/* Results / Navigation Body */}
        <div
          id="cmd-palette-list"
          role="listbox"
          className="max-h-[60vh] overflow-y-auto p-2"
        >
          {error && (
            <div
              role="alert"
              className="m-2 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700"
            >
              <AlertCircle className="size-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {isQueryMode ? (
            <>
              {displayedBookings.length > 0 && (
                <div className="mb-3">
                  <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                    Booking tìm thấy ({displayedBookings.length})
                  </div>
                  <div className="space-y-0.5">
                    {displayedBookings.map((b) => {
                      const itemIdx = currentItemOffset++;
                      const isHighlighted = selectedIndex === itemIdx;
                      return (
                        <button
                          key={b.id}
                          id={`booking-${b.id}`}
                          role="option"
                          aria-selected={isHighlighted}
                          onClick={() => go(`${home}/bookings/${b.id}`)}
                          onMouseEnter={() => setRawSelectedIndex(itemIdx)}
                          className={`flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-start text-sm cursor-pointer transition-colors ${
                            isHighlighted ? "bg-brand-50" : "hover:bg-zinc-50"
                          }`}
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
                      );
                    })}
                  </div>
                </div>
              )}

              {displayedRooms.length > 0 && (
                <div className="mb-3">
                  <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                    Phòng ({displayedRooms.length})
                  </div>
                  <div className="space-y-0.5">
                    {displayedRooms.map((r) => {
                      const itemIdx = currentItemOffset++;
                      const isHighlighted = selectedIndex === itemIdx;
                      return (
                        <button
                          key={r.id}
                          id={`room-${r.id}`}
                          role="option"
                          aria-selected={isHighlighted}
                          onClick={() => go(`${home}/rooms`)}
                          onMouseEnter={() => setRawSelectedIndex(itemIdx)}
                          className={`flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-start text-sm cursor-pointer transition-colors ${
                            isHighlighted ? "bg-brand-50" : "hover:bg-zinc-50"
                          }`}
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
                      );
                    })}
                  </div>
                </div>
              )}

              {displayedBookings.length === 0 &&
                displayedRooms.length === 0 &&
                !loading &&
                !error && (
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
                {[
                  {
                    id: "new-booking",
                    icon: <Plus className="size-4 text-brand-600" />,
                    title: "Đặt phòng mới",
                    to: `${home}/rooms?mode=booking`,
                  },
                  {
                    id: "bookings",
                    icon: <User className="size-4 text-zinc-500" />,
                    title: "Khách đến / Đang lưu trú / Khách đi",
                    to: `${home}/bookings`,
                  },
                  {
                    id: "tape-chart",
                    icon: <CalendarDays className="size-4 text-zinc-500" />,
                    title: "Sơ đồ timeline Tape Chart",
                    to: `${home}/tape-chart`,
                  },
                ].map((item, idx) => {
                  const isHighlighted = selectedIndex === idx;
                  return (
                    <button
                      key={item.id}
                      id={item.id}
                      role="option"
                      aria-selected={isHighlighted}
                      onClick={() => go(item.to)}
                      onMouseEnter={() => setRawSelectedIndex(idx)}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start text-sm cursor-pointer transition-colors ${
                        isHighlighted ? "bg-brand-50" : "hover:bg-zinc-50"
                      }`}
                    >
                      {item.icon}
                      <span className="font-medium text-zinc-700">
                        {item.title}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function CommandPalette({
  open,
  onClose,
  home,
}: {
  open: boolean;
  onClose: () => void;
  home: string;
}) {
  if (!open) return null;
  return <CommandPaletteModal onClose={onClose} home={home} />;
}
