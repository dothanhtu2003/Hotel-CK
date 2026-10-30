import type { DeskRoom } from "./contracts";

export function calculateOccupancyPct(occupied: number, total: number): number {
  if (!total || total <= 0 || !occupied || occupied <= 0) return 0;
  return Math.min(100, Math.round((occupied / total) * 100));
}

export function hotelToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function shiftDate(date: string, days: number) {
  return new Date(Date.parse(date + "T00:00:00Z") + days * 86400000)
    .toISOString()
    .slice(0, 10);
}
export function roomState(room: DeskRoom, today = hotelToday()) {
  if (room.operationalStatus !== "ACTIVE") return "out-of-service";
  if (room.bookings.some((b) => b.status === "CHECKED_IN")) return "occupied";
  if (
    room.bookings.some((b) => {
      if (!["PENDING", "CONFIRMED"].includes(b.status)) return false;
      if (!b.checkIn || !b.checkOut) return true;
      return b.checkIn <= today && b.checkOut > today;
    })
  )
    return "reserved";
  if (room.housekeepingStatus === "CLEANING") return "cleaning";
  if (room.housekeepingStatus !== "CLEAN" || room.openTaskCount > 0)
    return "dirty";
  return "ready";
}
export const roomStateLabels = {
  "out-of-service": "Ngưng phục vụ",
  occupied: "Đang ở",
  reserved: "Đã đặt",
  cleaning: "Đang dọn",
  dirty: "Chưa sẵn sàng",
  ready: "Trống sạch",
};
export const cleaningLabels: Record<string, string> = {
  CLEAN: "Sạch",
  DIRTY: "Cần dọn",
  CLEANING: "Đang dọn",
};
export function staySpan(
  checkIn: string,
  checkOut: string,
  start: string,
  days: number,
) {
  const end = shiftDate(start, days);
  if (checkOut <= start || checkIn >= end) return null;
  const left = Math.max(
    0,
    (Date.parse(checkIn) - Date.parse(start)) / 86400000,
  );
  const right = Math.min(
    days,
    (Date.parse(checkOut) - Date.parse(start)) / 86400000,
  );
  return { left, width: right - left };
}

export function bookingLanes(bookings: DeskRoom['bookings'], start: string, days: number) {
  const ends: number[] = [];
  const bars = bookings.flatMap(booking => {
    const span = staySpan(booking.checkIn, booking.checkOut, start, days);
    return span ? [{ booking, span }] : [];
  }).sort((a, b) => a.span.left - b.span.left || a.booking.checkIn.localeCompare(b.booking.checkIn) || a.booking.id.localeCompare(b.booking.id));
  return bars.map(bar => {
    let lane = ends.findIndex(end => end <= bar.span.left);
    if (lane === -1) lane = ends.length;
    ends[lane] = bar.span.left + bar.span.width;
    return { ...bar, lane };
  });
}

export function formatStayDateDisplay(
  dateStr?: string | null,
  referenceDateStr?: string | null,
): string {
  if (!dateStr || typeof dateStr !== "string") return "";
  const parts = dateStr.trim().split("-");
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts;
  const refYear = referenceDateStr
    ? referenceDateStr.split("-")[0]
    : String(new Date().getFullYear());
  if (y === refYear) {
    return `${d}/${m}`;
  }
  return `${d}/${m}/${y.slice(-2)}`;
}

