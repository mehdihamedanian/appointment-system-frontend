import { describe, expect, it } from "vitest";
import { parseIsoMonth, toIsoMonth } from "@/lib/date-time/calendar-adapter";
import { todayIsoInTimeZone } from "@/lib/date-time/format";

describe("date adapter timezone and month keys", () => {
  it("formats and parses ISO months without inventing Jalali conversion", () => {
    expect(toIsoMonth(2026, 7)).toBe("2026-08");
    expect(parseIsoMonth("2026-08")).toEqual({ year: 2026, monthIndex: 7 });
    expect(parseIsoMonth("2026-13")).toBeNull();
  });

  it("computes today in the business timezone rather than only the device offset", () => {
    const now = new Date("2026-08-21T21:30:00Z");
    expect(todayIsoInTimeZone("UTC", now)).toBe("2026-08-21");
    expect(todayIsoInTimeZone("Pacific/Auckland", now)).toBe("2026-08-22");
  });
});
