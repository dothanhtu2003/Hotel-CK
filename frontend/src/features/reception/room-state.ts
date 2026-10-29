import type { DeskRoom } from "./contracts";

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
export function roomState(room: DeskRoom) {
  if (room.operationalStatus !== "ACTIVE") return "out-of-service";
  if (room.bookings.some((b) => b.status === "CHECKED_IN")) return "occupied";
  if (
    room.bookings.some((b) =>
      ["PENDING", "CONFIRMED", "CHECKED_OUT"].includes(b.status),
    )
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
