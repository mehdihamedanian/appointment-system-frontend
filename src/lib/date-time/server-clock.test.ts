import { describe, expect, it } from "vitest";
import { formatCountdownMmSs, remainingMsFromTimestamps } from "@/lib/date-time/server-clock";

describe("server-clock hold remaining time", () => {
  it("returns null without expiresAt so no timer is invented", () => {
    expect(
      remainingMsFromTimestamps({
        receivedAt: Date.parse("2026-08-22T10:00:00.000Z"),
        now: Date.parse("2026-08-22T10:00:10.000Z"),
      }),
    ).toBeNull();
  });

  it("recalculates from timestamps instead of decrementing a counter", () => {
    const receivedAt = Date.parse("2026-08-22T10:00:00.000Z");
    const expiresAt = "2026-08-22T10:05:00.000Z";
    const first = remainingMsFromTimestamps({
      expiresAt,
      receivedAt,
      now: receivedAt,
    });
    const later = remainingMsFromTimestamps({
      expiresAt,
      receivedAt,
      now: receivedAt + 90_000,
    });
    expect(first).toBe(5 * 60_000);
    expect(later).toBe(5 * 60_000 - 90_000);
  });

  it("uses serverNow plus elapsed local time", () => {
    const receivedAt = 1_000_000;
    const remaining = remainingMsFromTimestamps({
      expiresAt: "2026-08-22T10:05:00.000Z",
      serverNow: "2026-08-22T10:00:00.000Z",
      receivedAt,
      now: receivedAt + 30_000,
    });
    expect(remaining).toBe(4 * 60_000 + 30_000);
  });

  it("recovers after a background gap from the same timestamps", () => {
    const receivedAt = Date.parse("2026-08-22T10:00:00.000Z");
    const remaining = remainingMsFromTimestamps({
      expiresAt: "2026-08-22T10:05:00.000Z",
      serverNow: "2026-08-22T10:00:00.000Z",
      receivedAt,
      now: receivedAt + 4 * 60_000,
    });
    expect(remaining).toBe(60_000);
    expect(formatCountdownMmSs(remaining ?? 0)).toBe("01:00");
  });

  it("formats mm:ss including zero", () => {
    expect(formatCountdownMmSs(125_000)).toBe("02:05");
    expect(formatCountdownMmSs(-8_000)).toBe("00:00");
  });
});
