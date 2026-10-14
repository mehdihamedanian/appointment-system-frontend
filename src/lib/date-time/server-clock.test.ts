import { afterEach, describe, expect, it } from "vitest";
import {
  formatCountdownMmSs,
  recordServerDateHeader,
  remainingMsFromTimestamps,
  resetServerClock,
  serverClockOffsetMs,
  serverNowMs,
} from "@/lib/date-time/server-clock";

const SENT_AT = Date.parse("2026-08-22T10:00:00.000Z");

describe("server clock from HTTP Date headers", () => {
  afterEach(() => {
    resetServerClock();
  });

  it("applies a significant device clock skew", () => {
    // Device is 60 s behind the Backend; 200 ms round trip.
    recordServerDateHeader("Sat, 22 Aug 2026 10:01:00 GMT", SENT_AT, SENT_AT + 200);
    expect(serverClockOffsetMs()).toBe(60_400);
    expect(serverNowMs(SENT_AT)).toBe(SENT_AT + 60_400);
  });

  it("ignores skews within the header's one-second precision", () => {
    recordServerDateHeader("Sat, 22 Aug 2026 10:00:02 GMT", SENT_AT, SENT_AT + 200);
    expect(serverClockOffsetMs()).toBe(0);
  });

  it("ignores slow round trips and malformed headers", () => {
    recordServerDateHeader("Sat, 22 Aug 2026 10:05:00 GMT", SENT_AT, SENT_AT + 15_000);
    expect(serverClockOffsetMs()).toBe(0);
    recordServerDateHeader("not a date", SENT_AT, SENT_AT + 100);
    recordServerDateHeader(null, SENT_AT, SENT_AT + 100);
    expect(serverClockOffsetMs()).toBe(0);
  });

  it("uses the server offset for hold expiry when the payload has no serverNow", () => {
    // Device clock is 2 minutes fast relative to the Backend.
    recordServerDateHeader("Sat, 22 Aug 2026 09:58:00 GMT", SENT_AT, SENT_AT);
    const remaining = remainingMsFromTimestamps({
      expiresAt: "2026-08-22T10:05:00.000Z",
      receivedAt: SENT_AT,
      now: SENT_AT,
    });
    expect(remaining).toBe(7 * 60_000 - 500);
  });

  it("prefers a payload serverNow over the header estimate", () => {
    recordServerDateHeader("Sat, 22 Aug 2026 09:58:00 GMT", SENT_AT, SENT_AT);
    const remaining = remainingMsFromTimestamps({
      expiresAt: "2026-08-22T10:05:00.000Z",
      serverNow: "2026-08-22T10:00:00.000Z",
      receivedAt: SENT_AT,
      now: SENT_AT,
    });
    expect(remaining).toBe(5 * 60_000);
  });
});

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
