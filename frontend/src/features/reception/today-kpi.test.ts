import { describe, expect, it } from "vitest";
import { calculateOccupancyPct } from "./room-state";

describe("Front Desk Today KPI calculations", () => {
  it("calculates accurate occupancy percentage without synthetic values", () => {
    expect(calculateOccupancyPct(0, 50)).toBe(0);
    expect(calculateOccupancyPct(25, 50)).toBe(50);
    expect(calculateOccupancyPct(1, 3)).toBe(33);
    expect(calculateOccupancyPct(2, 3)).toBe(67);
    expect(calculateOccupancyPct(50, 50)).toBe(100);
  });

  it("handles edge cases safely without dividing by zero or producing NaN", () => {
    expect(calculateOccupancyPct(0, 0)).toBe(0);
    expect(calculateOccupancyPct(10, 0)).toBe(0);
    expect(calculateOccupancyPct(-5, 50)).toBe(0);
    expect(calculateOccupancyPct(10, -50)).toBe(0);
  });

  it("caps occupancy at 100% in case of abnormal data", () => {
    expect(calculateOccupancyPct(60, 50)).toBe(100);
  });
});
