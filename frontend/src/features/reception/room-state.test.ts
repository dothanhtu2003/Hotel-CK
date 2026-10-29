import { describe, expect, it } from "vitest";
import { hotelToday, roomState, shiftDate, staySpan } from "./room-state";
import type { DeskBooking, DeskRoom } from "./contracts";
const room = {
  operationalStatus: "ACTIVE",
  housekeepingStatus: "CLEAN",
  openTaskCount: 0,
  bookings: [],
} as unknown as DeskRoom;
describe("hotel calendar and occupancy dimensions", () => {
  it("switches days at hotel midnight and handles month/year boundaries", () => {
    expect(hotelToday(new Date("2026-10-28T16:59:59Z"))).toBe("2026-10-28");
    expect(hotelToday(new Date("2026-10-28T17:00:00Z"))).toBe("2026-10-29");
    expect(shiftDate("2028-02-28", 1)).toBe("2028-02-29");
    expect(shiftDate("2026-12-31", 1)).toBe("2027-01-01");
  });
  it("clips multiday bars and excludes checkout nights", () => {
    expect(staySpan("2026-10-28", "2026-10-31", "2026-10-29", 14)).toEqual({
      left: 0,
      width: 2,
    });
    expect(staySpan("2026-10-28", "2026-10-29", "2026-10-29", 14)).toBeNull();
    expect(staySpan("2026-11-10", "2026-11-15", "2026-10-29", 14)).toEqual({
      left: 12,
      width: 2,
    });
  });
  it("does not confuse clean, booked, occupied and ready", () => {
    expect(roomState(room)).toBe("ready");
    expect(roomState({ ...room, openTaskCount: 1 })).toBe("dirty");
    expect(
      roomState({
        ...room,
        bookings: [{ status: "CONFIRMED" } as DeskBooking],
      }),
    ).toBe("reserved");
    expect(
      roomState({
        ...room,
        housekeepingStatus: "DIRTY",
        bookings: [{ status: "CHECKED_IN" } as DeskBooking],
      }),
    ).toBe("occupied");
    expect(roomState({ ...room, operationalStatus: "OUT_OF_SERVICE" })).toBe(
      "out-of-service",
    );
  });
});
