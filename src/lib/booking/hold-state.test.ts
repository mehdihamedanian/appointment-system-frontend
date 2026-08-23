import { describe, expect, it } from "vitest";
import {
  deriveHoldUiState,
  holdAnnouncement,
  holdUrgency,
  paymentAllowed,
  shouldDeferExpiryNavigation,
} from "@/lib/booking/hold-state";
import { HOLD_CRITICAL_MS, HOLD_WARNING_MS, type SlotHoldView } from "@/types/hold";

const activeHold = (overrides: Partial<SlotHoldView> = {}): SlotHoldView => ({
  holdId: "hold_1",
  status: "active",
  expiresAt: "2026-08-22T10:05:00.000Z",
  slot: { id: "slot_1", startsAt: "2026-08-22T09:00:00+03:30" },
  ...overrides,
});

describe("hold state model", () => {
  it("uses centralized warning and critical thresholds", () => {
    expect(holdUrgency(HOLD_WARNING_MS + 1)).toBe("active");
    expect(holdUrgency(HOLD_WARNING_MS)).toBe("warning");
    expect(holdUrgency(HOLD_CRITICAL_MS)).toBe("critical");
    expect(holdUrgency(0)).toBe("elapsed");
  });

  it("does not announce every second", () => {
    expect(holdAnnouncement("active")).toBeUndefined();
    expect(holdAnnouncement("warning")).toMatch(/دو دقیقه/);
    expect(holdAnnouncement("critical")).toMatch(/سی ثانیه/);
    expect(holdAnnouncement("expired")).toMatch(/پایان/);
  });

  it("keeps payment available only while the hold is visually active", () => {
    expect(paymentAllowed("active")).toBe(true);
    expect(paymentAllowed("warning")).toBe(true);
    expect(paymentAllowed("critical")).toBe(true);
    expect(paymentAllowed("expired")).toBe(false);
    expect(paymentAllowed("checking-status")).toBe(false);
    expect(paymentAllowed("consumed")).toBe(false);
  });

  it("does not treat client zero as expired while payment is in flight", () => {
    const state = deriveHoldUiState({
      hold: activeHold({ status: "expired" }),
      remainingMs: 0,
      paymentInFlight: true,
    });
    expect(state).toBe("checking-status");
    expect(shouldDeferExpiryNavigation(state)).toBe(true);
  });

  it("keeps hold status separate from payment processing", () => {
    expect(
      deriveHoldUiState({
        hold: activeHold({ paymentContextId: "pay_1" }),
        remainingMs: 60_000,
        paymentInFlight: true,
      }),
    ).toBe("payment-processing");
    expect(
      deriveHoldUiState({
        hold: activeHold({ status: "consumed", paymentStatus: "pending_payment" }),
        remainingMs: 0,
      }),
    ).toBe("consumed");
  });

  it("maps terminal backend statuses explicitly", () => {
    expect(deriveHoldUiState({ hold: activeHold({ status: "released" }), remainingMs: 10_000 })).toBe("released");
    expect(deriveHoldUiState({ hold: activeHold({ status: "invalid" }), remainingMs: 10_000 })).toBe("invalid");
    expect(deriveHoldUiState({ hold: activeHold({ status: "expired" }), remainingMs: 0 })).toBe("expired");
  });

  it("does not assume active when status is unknown", () => {
    expect(deriveHoldUiState({ remainingMs: 10_000, error: true })).toBe("error");
    expect(deriveHoldUiState({ remainingMs: null, offline: true })).toBe("offline");
    expect(deriveHoldUiState({ hold: activeHold({ expiresAt: undefined }), remainingMs: null })).toBe("error");
  });
});
