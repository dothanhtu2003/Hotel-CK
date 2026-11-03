import { describe, expect, it, jest } from "@jest/globals";
import type { PrismaService } from "../../src/database/prisma.service.js";
import {
  hotelDay,
  deskWhere,
  readyWhere,
  FrontDeskService,
} from "../../src/front-desk/front-desk.service.js";
import {
  DeskQuery,
  RoomQuery,
  WalkInDto,
  CustomerQuery,
} from "../../src/front-desk/desk.dto.js";
import { createValidationPipe } from "../../src/configure-app.js";

describe("Front desk date boundaries and validation", () => {
  it("keeps unchecked-out guests in dated room boards after their scheduled departure", async () => {
    const findMany = jest.fn<(...args: unknown[]) => Promise<unknown[]>>().mockResolvedValue([]);
    const tx = { room: { findMany, count: async () => 0 } };
    const service = new FrontDeskService({
      client: { $transaction: async (read: (client: typeof tx) => Promise<unknown>) => read(tx) },
    } as unknown as PrismaService);

    await service.rooms(Object.assign(new RoomQuery(), {
      start: "2026-11-03", end: "2026-11-10",
    }));
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.objectContaining({
        bookings: expect.objectContaining({
          where: { OR: [
            { status: "CHECKED_IN" },
            {
              status: { not: "CANCELLED" },
              checkInDate: { lt: new Date("2026-11-10T00:00:00Z") },
              checkOutDate: { gt: new Date("2026-11-03T00:00:00Z") },
            },
          ] },
        }),
      }),
    }));
  });
  it("uses Vietnam midnight independently from the server timezone", () => {
    expect(hotelDay(new Date("2026-10-28T16:59:59Z"))).toBe("2026-10-28");
    expect(hotelDay(new Date("2026-10-28T17:00:00Z"))).toBe("2026-10-29");
  });
  it("arrivals exclude cancelled/checked-in; departures only include checked-in stays", () => {
    expect(
      JSON.stringify(
        deskWhere({ view: "arrivals" } as DeskQuery, "2026-10-28"),
      ),
    ).toContain("CONFIRMED");
    expect(
      JSON.stringify(
        deskWhere({ view: "departures" } as DeskQuery, "2026-10-28"),
      ),
    ).toContain("checkOutDate");
    expect(
      JSON.stringify(deskWhere({ view: "staying" } as DeskQuery)),
    ).toContain("CHECKED_IN");
  });
  it("readyWhere requires ACTIVE, CLEAN, no open tasks, blocks CHECKED_IN/CONFIRMED/PENDING, and NEVER blocks CHECKED_OUT", () => {
    const where = readyWhere(new Date("2026-10-29T00:00:00Z"));
    expect(where.operationalStatus).toBe("ACTIVE");
    expect(where.housekeepingStatus).toBe("CLEAN");
    expect(where.tasks).toEqual({ none: { status: { not: "DONE" } } });

    const str = JSON.stringify(where);
    expect(str).toContain("CHECKED_IN");
    expect(str).toContain("CONFIRMED");
    expect(str).toContain("PENDING");
    // Completed historical bookings must never block room readiness
    expect(str).not.toContain("CHECKED_OUT");
  });
  const pipe = createValidationPipe();
  it("rejects forged price, owner and creator; enforces query limits and actual calendar dates", async () => {
    for (const input of [
      { q: "x".repeat(121) },
      { pageSize: 101 },
      { checkIn: "2026-02-30" },
      { view: "all" },
      { userId: "x" },
    ])
      await expect(
        pipe.transform(input, { type: "query", metatype: DeskQuery }),
      ).rejects.toThrow();
    await expect(
      pipe.transform({ q: "x".repeat(51) }, { type: "query", metatype: RoomQuery }),
    ).rejects.toThrow();
    const validRoomQuery = await pipe.transform({ q: "101", pageSize: 5 }, { type: "query", metatype: RoomQuery });
    expect(validRoomQuery.q).toBe("101");
    expect(validRoomQuery.pageSize).toBe(5);
    await expect(
      pipe.transform({ q: "  " }, { type: "query", metatype: CustomerQuery }),
    ).rejects.toThrow();
    await expect(
      pipe.transform(
        {
          roomId: "bad",
          guests: 1,
          checkIn: "2026-10-28",
          checkOut: "2026-10-29",
          createdById: "forged",
          nightlyPrice: 1,
        },
        { type: "body", metatype: WalkInDto },
      ),
    ).rejects.toThrow();
  });
});
