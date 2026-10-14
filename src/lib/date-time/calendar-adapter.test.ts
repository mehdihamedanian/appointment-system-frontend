import { describe, expect, it } from "vitest";
import {
  calendarMonthBounds,
  calendarMonthKeyFor,
  getCalendarAdapter,
  isCalendarMonthKey,
  isIsoDateInMonthKey,
  parseIsoMonth,
  persianAdapter,
  toIsoMonth,
} from "@/lib/date-time/calendar-adapter";
import { todayIsoInTimeZone } from "@/lib/date-time/format";

describe("date adapter timezone and month keys", () => {
  it("formats and parses Gregorian ISO months", () => {
    expect(toIsoMonth(2026, 7)).toBe("2026-08");
    expect(parseIsoMonth("2026-08")).toEqual({ year: 2026, monthIndex: 7 });
    expect(parseIsoMonth("2026-13")).toBeNull();
  });

  it("computes today in the business timezone rather than only the device offset", () => {
    const now = new Date("2026-08-21T21:30:00Z");
    expect(todayIsoInTimeZone("UTC", now)).toBe("2026-08-21");
    expect(todayIsoInTimeZone("Pacific/Auckland", now)).toBe("2026-08-22");
    expect(todayIsoInTimeZone("Asia/Tehran", now)).toBe("2026-08-22");
  });
});

describe("Jalali calendar adapter", () => {
  it("uses self-describing month keys for both calendars", () => {
    expect(calendarMonthKeyFor("2026-08-22", "persian")).toBe("j1405-05");
    expect(calendarMonthKeyFor("2026-08-23", "persian")).toBe("j1405-06");
    expect(calendarMonthKeyFor("2026-08-23", "gregorian")).toBe("2026-08");
    expect(isCalendarMonthKey("j1405-05")).toBe(true);
    expect(isCalendarMonthKey("j1405-13")).toBe(false);
    expect(isCalendarMonthKey("")).toBe(false);
  });

  it("converts Jalali months to Gregorian API ranges within the 31-day backend limit", () => {
    expect(calendarMonthBounds("j1405-05")).toEqual({ from: "2026-07-23", to: "2026-08-22" });
    expect(calendarMonthBounds("j1405-12")).toEqual({ from: "2027-02-20", to: "2027-03-20" });
    expect(calendarMonthBounds("2026-08")).toEqual({ from: "2026-08-01", to: "2026-08-31" });
    expect(calendarMonthBounds("bogus")).toBeUndefined();
    expect(isIsoDateInMonthKey("2026-08-22", "j1405-05")).toBe(true);
    expect(isIsoDateInMonthKey("2026-08-23", "j1405-05")).toBe(false);
  });

  it("builds a Saturday-first matrix covering the whole Jalali month", () => {
    const month = { year: 1405, monthIndex: 4 };
    const weeks = persianAdapter.getMatrix(month);
    expect(weeks).toHaveLength(6);
    const days = weeks.flat();
    expect(days[0]!.isoDate).toBe("2026-07-18");
    expect(days[0]!.inCurrentMonth).toBe(false);
    const inMonth = days.filter((day) => day.inCurrentMonth);
    expect(inMonth).toHaveLength(31);
    expect(inMonth[0]).toMatchObject({ isoDate: "2026-07-23", dayOfMonth: 1 });
    expect(inMonth.at(-1)).toMatchObject({ isoDate: "2026-08-22", dayOfMonth: 31 });
  });

  it("labels months in Persian with Persian digits and wraps across years", () => {
    const adapter = getCalendarAdapter("persian");
    expect(adapter.monthLabel({ year: 1405, monthIndex: 4 })).toBe("مرداد ۱۴۰۵");
    expect(adapter.addMonths({ year: 1405, monthIndex: 11 }, 1)).toEqual({ year: 1406, monthIndex: 0 });
    expect(getCalendarAdapter("gregorian").monthLabel({ year: 2026, monthIndex: 7 })).toBe("اوت 2026");
  });
});
