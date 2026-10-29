import { describe, expect, it } from "@jest/globals";
import {
  hotelDay,
  deskWhere,
} from "../../src/front-desk/front-desk.service.js";
import {
  DeskQuery,
  WalkInDto,
  CustomerQuery,
} from "../../src/front-desk/desk.dto.js";
import { createValidationPipe } from "../../src/configure-app.js";

describe("Front desk date boundaries and validation", () => {
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
