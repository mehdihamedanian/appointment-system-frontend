import { describe, expect, it } from "vitest";
import {
  formatAppointmentParts,
  formatIsoDateLabel,
  isTimestampExpired,
  todayIsoInTimeZone,
} from "@/lib/date-time/format";

describe("date-time display formatting", () => {
  it("formats instants in the configured business timezone, not the device timezone", () => {
    // 21:00 UTC on 21 Aug = 00:30 on 22 Aug (31 Mordad 1405) in Tehran.
    const parts = formatAppointmentParts("2026-08-21T21:00:00Z");
    expect(parts?.date).toMatch(/مرداد/);
    expect(parts?.date).toMatch(/۳۱/);
    expect(parts?.time).toBe("۰۰:۳۰");
    expect(parts?.label).toContain("ساعت");
  });

  it("honours an explicit payload timezone", () => {
    const parts = formatAppointmentParts("2026-08-21T21:00:00Z", "UTC");
    expect(parts?.date).toMatch(/۳۰/);
    expect(parts?.time).toBe("۲۱:۰۰");
  });

  it("returns null for unparseable values instead of showing Invalid Date", () => {
    expect(formatAppointmentParts("garbage")).toBeNull();
    expect(formatIsoDateLabel("2026-02-30")).toBeNull();
  });

  it("formats calendar dates as the same Jalali day regardless of timezone", () => {
    const label = formatIsoDateLabel("2026-08-22");
    expect(label).toMatch(/۳۱/);
    expect(label).toMatch(/مرداد/);
    expect(label).toMatch(/۱۴۰۵/);
    expect(formatIsoDateLabel("2026-08-23", { weekday: true })).toBe("یکشنبه ۱ شهریور ۱۴۰۵");
    expect(formatIsoDateLabel("2026-08-23", { style: "full" })).toBe("یکشنبه ۱ شهریور ۱۴۰۵");
  });

  it("derives today and expiry from an explicit clock", () => {
    const now = new Date("2026-08-21T21:00:00Z");
    expect(todayIsoInTimeZone(undefined, now)).toBe("2026-08-22");
    expect(isTimestampExpired("2026-08-21T20:59:59Z", now)).toBe(true);
    expect(isTimestampExpired("2026-08-21T21:00:01Z", now)).toBe(false);
    expect(isTimestampExpired(undefined, now)).toBe(false);
  });
});
