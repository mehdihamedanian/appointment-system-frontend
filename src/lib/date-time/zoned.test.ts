import { describe, expect, it } from "vitest";
import {
  addDaysToIsoDate,
  daysBetweenIsoDates,
  formatInstantWithOffset,
  isIsoDate,
  isoDateInZone,
  isoDateWeekday,
  parseInstant,
  parseInstantInZone,
  resolveTimeZone,
  zonedDayBounds,
  zonedWallTimeToInstant,
} from "@/lib/date-time/zoned";

const HOUR = 3_600_000;

describe("calendar date arithmetic", () => {
  it("validates and shifts ISO dates without device timezone influence", () => {
    expect(isIsoDate("2026-02-29")).toBe(false);
    expect(isIsoDate("2028-02-29")).toBe(true);
    expect(isIsoDate("2026-8-1")).toBe(false);
    expect(addDaysToIsoDate("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysToIsoDate("2026-03-01", -1)).toBe("2026-02-28");
    expect(daysBetweenIsoDates("2026-08-01", "2026-08-31")).toBe(30);
    expect(isoDateWeekday("2026-08-22")).toBe(6);
  });
});

describe("timezone resolution", () => {
  it("falls back to the configured business timezone for missing or invalid zones", () => {
    expect(resolveTimeZone(undefined, "Not/AZone", "Europe/Berlin")).toBe("Europe/Berlin");
    expect(resolveTimeZone(null, "")).toBe("Asia/Tehran");
  });
});

describe("instant parsing", () => {
  it("rejects naive date-times as absolute instants", () => {
    expect(parseInstant("2026-08-22T09:00:00")).toBeNull();
    expect(parseInstant("2026-08-22T09:00:00+03:30")?.toISOString()).toBe("2026-08-22T05:30:00.000Z");
    expect(parseInstant("2026-08-22T05:30:00Z")?.toISOString()).toBe("2026-08-22T05:30:00.000Z");
  });

  it("reads naive values as business wall time, never device time", () => {
    expect(parseInstantInZone("2026-08-22T09:00", "Asia/Tehran")?.toISOString()).toBe(
      "2026-08-22T05:30:00.000Z",
    );
    expect(parseInstantInZone("2026-08-22", "Asia/Tehran")?.toISOString()).toBe(
      "2026-08-21T20:30:00.000Z",
    );
    expect(parseInstantInZone("2026-08-22T09:00:00Z", "Asia/Tehran")?.toISOString()).toBe(
      "2026-08-22T09:00:00.000Z",
    );
  });
});

describe("business-local day boundaries", () => {
  it("maps instants near UTC midnight to the business calendar day", () => {
    const instant = new Date("2026-08-21T21:00:00Z");
    expect(isoDateInZone(instant, "Asia/Tehran")).toBe("2026-08-22");
    expect(isoDateInZone(instant, "UTC")).toBe("2026-08-21");
    expect(isoDateInZone(instant, "America/Los_Angeles")).toBe("2026-08-21");
  });

  it("computes half-open day bounds in Tehran", () => {
    const bounds = zonedDayBounds("2026-08-22", "Asia/Tehran");
    expect(bounds?.start.toISOString()).toBe("2026-08-21T20:30:00.000Z");
    expect(bounds?.end.toISOString()).toBe("2026-08-22T20:30:00.000Z");
  });

  it("handles 23- and 25-hour DST days", () => {
    const spring = zonedDayBounds("2026-03-08", "America/New_York")!;
    expect(spring.start.toISOString()).toBe("2026-03-08T05:00:00.000Z");
    expect(spring.end.getTime() - spring.start.getTime()).toBe(23 * HOUR);
    const autumn = zonedDayBounds("2026-11-01", "America/New_York")!;
    expect(autumn.end.getTime() - autumn.start.getTime()).toBe(25 * HOUR);
  });

  it("resolves skipped wall times forward and repeated ones to the earlier instant", () => {
    expect(zonedWallTimeToInstant("2026-03-08", "02:30", "America/New_York")?.toISOString()).toBe(
      "2026-03-08T07:30:00.000Z",
    );
    expect(zonedWallTimeToInstant("2026-11-01", "01:30", "America/New_York")?.toISOString()).toBe(
      "2026-11-01T05:30:00.000Z",
    );
    expect(zonedWallTimeToInstant("2026-08-22", "24:00", "Asia/Tehran")).toBeNull();
  });
});

describe("API instant serialization", () => {
  it("formats instants with the business offset", () => {
    expect(formatInstantWithOffset(new Date("2026-08-22T05:30:00Z"), "Asia/Tehran")).toBe(
      "2026-08-22T09:00:00+03:30",
    );
    expect(formatInstantWithOffset(new Date("2026-01-15T17:00:00Z"), "America/New_York")).toBe(
      "2026-01-15T12:00:00-05:00",
    );
  });
});
