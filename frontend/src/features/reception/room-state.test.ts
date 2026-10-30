import { describe, expect, it } from "vitest";
import { bookingLanes, hotelToday, roomState, shiftDate, staySpan } from "./room-state";
import type { DeskBooking, DeskRoom } from "./contracts";
const room = {
  operationalStatus: "ACTIVE",
  housekeepingStatus: "CLEAN",
  openTaskCount: 0,
  bookings: [],
} as unknown as DeskRoom;
it('keeps overlapping historical bookings visible and reuses lanes after checkout', () => {
  const bookings = [
    { id: 'a', checkIn: '2026-10-29', checkOut: '2026-10-31' },
    { id: 'b', checkIn: '2026-10-30', checkOut: '2026-10-31' },
    { id: 'c', checkIn: '2026-10-31', checkOut: '2026-11-02' },
    { id: 'd', checkIn: '2026-10-27', checkOut: '2026-10-30' },
  ] as DeskBooking[];
  expect(bookingLanes(bookings, '2026-10-30', 14).map(({ booking, lane }) => [booking.id, lane])).toEqual([
    ['a', 0], ['b', 1], ['c', 0],
  ]);
});
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

  describe("roomState regression coverage", () => {
    const today = "2026-10-29";

    it("evaluates available clean room as ready", () => {
      expect(
        roomState(
          {
            ...room,
            operationalStatus: "ACTIVE",
            housekeepingStatus: "CLEAN",
            openTaskCount: 0,
            bookings: [],
          },
          today,
        ),
      ).toBe("ready");
    });

    it("evaluates dirty empty room as dirty", () => {
      expect(
        roomState(
          {
            ...room,
            operationalStatus: "ACTIVE",
            housekeepingStatus: "DIRTY",
            openTaskCount: 1,
            bookings: [],
          },
          today,
        ),
      ).toBe("dirty");
    });

    it("evaluates cleaning in progress as cleaning", () => {
      expect(
        roomState(
          {
            ...room,
            operationalStatus: "ACTIVE",
            housekeepingStatus: "CLEANING",
            openTaskCount: 1,
            bookings: [],
          },
          today,
        ),
      ).toBe("cleaning");
    });

    it("evaluates occupied room as occupied regardless of housekeeping status", () => {
      expect(
        roomState(
          {
            ...room,
            operationalStatus: "ACTIVE",
            housekeepingStatus: "CLEAN",
            bookings: [{ status: "CHECKED_IN" } as DeskBooking],
          },
          today,
        ),
      ).toBe("occupied");
      expect(
        roomState(
          {
            ...room,
            operationalStatus: "ACTIVE",
            housekeepingStatus: "DIRTY",
            bookings: [{ status: "CHECKED_IN" } as DeskBooking],
          },
          today,
        ),
      ).toBe("occupied");
    });

    it("does not let a future confirmed or pending booking block today's room availability", () => {
      expect(
        roomState(
          {
            ...room,
            operationalStatus: "ACTIVE",
            housekeepingStatus: "CLEAN",
            openTaskCount: 0,
            bookings: [
              {
                status: "CONFIRMED",
                checkIn: "2026-11-05",
                checkOut: "2026-11-08",
              } as DeskBooking,
            ],
          },
          today,
        ),
      ).toBe("ready");

      expect(
        roomState(
          {
            ...room,
            operationalStatus: "ACTIVE",
            housekeepingStatus: "CLEAN",
            openTaskCount: 0,
            bookings: [
              {
                status: "PENDING",
                checkIn: "2026-11-10",
                checkOut: "2026-11-12",
              } as DeskBooking,
            ],
          },
          today,
        ),
      ).toBe("ready");
    });

    it("never treats historical checked-out booking as reserved, and allows clean room to become ready", () => {
      // Historical checkout where guest departed and housekeeping cleaned room
      expect(
        roomState(
          {
            ...room,
            operationalStatus: "ACTIVE",
            housekeepingStatus: "CLEAN",
            openTaskCount: 0,
            bookings: [
              {
                status: "CHECKED_OUT",
                checkIn: "2026-10-25",
                checkOut: "2026-10-29",
              } as DeskBooking,
            ],
          },
          today,
        ),
      ).toBe("ready");

      // Historical checkout where room is still dirty
      expect(
        roomState(
          {
            ...room,
            operationalStatus: "ACTIVE",
            housekeepingStatus: "DIRTY",
            openTaskCount: 1,
            bookings: [
              {
                status: "CHECKED_OUT",
                checkIn: "2026-10-25",
                checkOut: "2026-10-29",
              } as DeskBooking,
            ],
          },
          today,
        ),
      ).toBe("dirty");
    });

    it("handles early check-out correctly: clean room is ready, dirty room remains dirty", () => {
      // Guest scheduled until 2026-10-31 checked out early on 2026-10-29
      // Housekeeping cleaned room
      expect(
        roomState(
          {
            ...room,
            operationalStatus: "ACTIVE",
            housekeepingStatus: "CLEAN",
            openTaskCount: 0,
            bookings: [
              {
                status: "CHECKED_OUT",
                checkIn: "2026-10-25",
                checkOut: "2026-10-31",
              } as DeskBooking,
            ],
          },
          today,
        ),
      ).toBe("ready");

      // Early checkout, housekeeping NOT yet completed
      expect(
        roomState(
          {
            ...room,
            operationalStatus: "ACTIVE",
            housekeepingStatus: "DIRTY",
            openTaskCount: 1,
            bookings: [
              {
                status: "CHECKED_OUT",
                checkIn: "2026-10-25",
                checkOut: "2026-10-31",
              } as DeskBooking,
            ],
          },
          today,
        ),
      ).toBe("dirty");

      // Early checkout, housekeeping cleaning in progress
      expect(
        roomState(
          {
            ...room,
            operationalStatus: "ACTIVE",
            housekeepingStatus: "CLEANING",
            openTaskCount: 1,
            bookings: [
              {
                status: "CHECKED_OUT",
                checkIn: "2026-10-25",
                checkOut: "2026-10-31",
              } as DeskBooking,
            ],
          },
          today,
        ),
      ).toBe("cleaning");
    });

    it("evaluates out-of-service room as out-of-service even if clean", () => {
      expect(
        roomState(
          {
            ...room,
            operationalStatus: "OUT_OF_SERVICE",
            housekeepingStatus: "CLEAN",
            openTaskCount: 0,
            bookings: [],
          },
          today,
        ),
      ).toBe("out-of-service");
    });

    it("correctly handles same-day turnover: checked out guest + confirmed arrival today", () => {
      expect(
        roomState(
          {
            ...room,
            operationalStatus: "ACTIVE",
            housekeepingStatus: "CLEAN",
            openTaskCount: 0,
            bookings: [
              {
                status: "CHECKED_OUT",
                checkIn: "2026-10-25",
                checkOut: "2026-10-29",
              } as DeskBooking,
              {
                status: "CONFIRMED",
                checkIn: "2026-10-29",
                checkOut: "2026-10-31",
              } as DeskBooking,
            ],
          },
          today,
        ),
      ).toBe("reserved");
    });
  });
});
