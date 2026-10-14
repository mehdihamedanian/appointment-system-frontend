import { describe, expect, it } from "vitest";
import { adaptSlotHold, requiresSlotHold } from "@/lib/booking/hold-adapter";
import { emptyBookingQuote } from "@/lib/booking/adapters";

describe("slot hold adapter", () => {
  it("requires a hold only for online payment paths", () => {
    expect(requiresSlotHold({ ...emptyBookingQuote(), paymentMode: "full", checkoutPath: "pay_full" })).toBe(true);
    expect(requiresSlotHold({ ...emptyBookingQuote(), paymentMode: "deposit", checkoutPath: "pay_deposit" })).toBe(true);
    expect(requiresSlotHold({ ...emptyBookingQuote(), paymentMode: "pay_at_location", checkoutPath: "pay_at_location" })).toBe(
      false,
    );
    expect(requiresSlotHold({ ...emptyBookingQuote(), paymentMode: "none", checkoutPath: "confirm" })).toBe(false);
  });

  it("maps a backend hold and drops secrets and internal resources", () => {
    const hold = adaptSlotHold({
      id: "hold_1",
      status: "active",
      expiresAt: "2026-08-22T10:05:00.000Z",
      serverNow: "2026-08-22T10:00:00.000Z",
      clientSecret: "secret_value",
      holdToken: "tok_secret",
      lockId: "lock_1",
      slot: { id: "slot_1", startsAt: "2026-08-22T09:00:00+03:30", roomId: "room_9" },
      service: { name: "ویزیت" },
      payableNowLabel: "۲۵۰٬۰۰۰ تومان",
      paymentContextId: "pay_1",
    });
    expect(hold?.holdId).toBe("hold_1");
    expect(hold?.status).toBe("active");
    expect(hold?.expiresAt).toBe("2026-08-22T10:05:00.000Z");
    expect(hold?.serviceName).toBe("ویزیت");
    expect(JSON.stringify(hold)).not.toMatch(/secret_value|tok_secret|lock_1|room_9|clientSecret/);
  });

  it("maps Backend HoldRead token/state/expires_at", () => {
    const hold = adaptSlotHold({
      success: true,
      data: {
        token: "hold_token_abc",
        state: "held",
        starts_at: "2026-08-22T05:30:00Z",
        expires_at: "2026-08-22T10:05:00.000Z",
      },
    });
    expect(hold?.holdId).toBe("hold_token_abc");
    expect(hold?.status).toBe("active");
    expect(hold?.expiresAt).toBe("2026-08-22T10:05:00.000Z");
    expect(hold?.slot.startsAt).toBe("2026-08-22T05:30:00Z");
  });

  it("rejects numeric-only ids as public hold references", () => {
    expect(adaptSlotHold({ id: "12", status: "active", expiresAt: "2026-08-22T10:05:00.000Z" })).toBeNull();
  });

  it("maps consumed, expired, released and invalid statuses", () => {
    expect(adaptSlotHold({ id: "hold_1", status: "expired" })?.status).toBe("expired");
    expect(adaptSlotHold({ id: "hold_1", status: "consumed", bookingReference: "BK22A" })?.bookingReference).toBe("BK22A");
    expect(adaptSlotHold({ id: "hold_1", status: "released" })?.status).toBe("released");
    expect(adaptSlotHold({ id: "hold_1", status: "unknown" })?.status).toBe("invalid");
  });
});
