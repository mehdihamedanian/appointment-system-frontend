import { describe, expect, it } from "vitest";
import { paymentIdempotencyKey, paymentIntentFingerprint } from "@/lib/payment/idempotency";
import { derivePaymentUiState, retryAllowedForState } from "@/lib/payment/state";

describe("payment state and idempotency", () => {
  it("keeps an explicit state machine without overlapping result labels", () => {
    expect(derivePaymentUiState({ creating: true, resultStatus: "failed" })).toBe("creating-payment");
    expect(derivePaymentUiState({ resultStatus: "paid" })).toBe("success");
    expect(derivePaymentUiState({ resultStatus: "failed" })).toBe("failed");
    expect(derivePaymentUiState({ resultStatus: "pending" })).toBe("pending");
    expect(derivePaymentUiState({ offline: true })).toBe("unknown");
    expect(retryAllowedForState("failed", true)).toBe(true);
    expect(retryAllowedForState("pending")).toBe(false);
    expect(retryAllowedForState("unknown")).toBe(false);
  });

  it("reuses the same idempotency key until the payment intent changes", () => {
    const store: { current?: { fingerprint: string; key: string } } = {};
    const first = paymentIntentFingerprint({ holdReference: "hold_1", quoteId: "q1", method: "full" });
    const keyA = paymentIdempotencyKey(store, first);
    const keyB = paymentIdempotencyKey(store, first);
    expect(keyA).toBe(keyB);
    const next = paymentIntentFingerprint({
      holdReference: "hold_1",
      quoteId: "q2",
      method: "full",
      couponCode: "SAVE10",
    });
    expect(paymentIdempotencyKey(store, next)).not.toBe(keyA);
  });
});
