import { describe, expect, it } from "vitest";
import {
  availabilityTodayIso,
  resolveCalendarDayState,
  hasDistinctUnavailableStates,
} from "@/lib/availability/days";

describe("availability calendar day states", () => {
  const statusByDate = new Map([
    ["2026-08-22", "available" as const],
    ["2026-08-23", "closed" as const],
    ["2026-08-24", "no_capacity" as const],
  ]);

  it("marks past days disabled even if the backend listed them", () => {
    const past = resolveCalendarDayState({
      iso: "2026-08-20",
      inCurrentMonth: true,
      today: "2026-08-22",
      statusByDate: new Map([["2026-08-20", "available"]]),
    });
    expect(past.state).toBe("past");
    expect(past.disabled).toBe(true);
    expect(past.selectable).toBe(false);
  });

  it("respects booking range limits", () => {
    const beforeMin = resolveCalendarDayState({
      iso: "2026-08-22",
      inCurrentMonth: true,
      today: "2026-08-01",
      minDate: "2026-08-25",
      statusByDate,
    });
    const afterMax = resolveCalendarDayState({
      iso: "2026-09-02",
      inCurrentMonth: true,
      today: "2026-08-22",
      maxDate: "2026-08-30",
      statusByDate,
    });
    expect(beforeMin.selectable).toBe(false);
    expect(afterMax.selectable).toBe(false);
  });

  it("uses backend available, closed and full states without inferring working hours", () => {
    expect(
      resolveCalendarDayState({
        iso: "2026-08-22",
        inCurrentMonth: true,
        today: "2026-08-22",
        statusByDate,
      }),
    ).toMatchObject({ state: "available", selectable: true });
    expect(
      resolveCalendarDayState({
        iso: "2026-08-23",
        inCurrentMonth: true,
        today: "2026-08-22",
        statusByDate,
      }).state,
    ).toBe("closed");
    expect(
      resolveCalendarDayState({
        iso: "2026-08-24",
        inCurrentMonth: true,
        today: "2026-08-22",
        statusByDate,
      }).state,
    ).toBe("no_capacity");
    expect(
      resolveCalendarDayState({
        iso: "2026-08-25",
        inCurrentMonth: true,
        today: "2026-08-22",
        statusByDate,
      }).state,
    ).toBe("unavailable");
    expect(hasDistinctUnavailableStates([...statusByDate.entries()].map(([date, status]) => ({ date, status })))).toBe(
      true,
    );
  });

  it("prefers backend serverNow for today", () => {
    expect(
      availabilityTodayIso(
        { timezone: "UTC", serverNow: "2026-01-02T23:30:00Z" },
        "Asia/Tehran",
      ),
    ).toBe("2026-01-02");
  });
});
