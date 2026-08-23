import { describe, expect, it } from "vitest";
import { emptyBookingQuote } from "@/lib/booking/adapters";
import { createIdempotencyKey, quoteIntentFingerprint } from "@/lib/booking/idempotency";
import { isQuoteChangedError, isQuoteExpired } from "@/lib/booking/quote";
import { isSlotTakenError } from "@/lib/availability/slot-taken";
import { emptyBookingDraft } from "@/types/booking";

describe("quote expiration", () => {
  it("does not invent a timer without expiresAt", () => {
    expect(isQuoteExpired({ ...emptyBookingQuote(), authoritative: true }, Date.now())).toBe(false);
  });

  it("uses serverNow plus elapsed local time", () => {
    const quote = {
      ...emptyBookingQuote(),
      authoritative: true,
      expiresAt: "2026-08-22T10:00:00.000Z",
      serverNow: "2026-08-22T09:50:00.000Z",
    };
    const receivedAt = Date.parse("2026-08-22T09:50:00.000Z");
    expect(isQuoteExpired(quote, receivedAt, Date.parse("2026-08-22T09:59:00.000Z"))).toBe(false);
    expect(isQuoteExpired(quote, receivedAt, Date.parse("2026-08-22T10:00:00.000Z"))).toBe(true);
  });
});

describe("quote conflict codes", () => {
  it("does not treat quote-changed 409 as slot taken", () => {
    const error = { status: 409, code: "QUOTE_CHANGED", message: "changed" };
    expect(isQuoteChangedError(error)).toBe(true);
    expect(isSlotTakenError(error)).toBe(false);
  });
});

describe("idempotency keys", () => {
  it("reuses the same intent fingerprint until a material change", () => {
    const draft = emptyBookingDraft();
    draft.serviceId = "svc_1";
    draft.slotId = "slot_1";
    draft.date = "2026-08-22";
    const first = quoteIntentFingerprint(draft, "q1");
    expect(quoteIntentFingerprint(draft, "q1")).toBe(first);
    draft.slotId = "slot_2";
    expect(quoteIntentFingerprint(draft, "q1")).not.toBe(first);
    expect(createIdempotencyKey().length).toBeGreaterThan(8);
  });
});
