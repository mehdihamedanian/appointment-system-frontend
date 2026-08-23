import { describe, expect, it } from "vitest";
import { emptyBookingQuote } from "@/lib/booking/adapters";
import {
  adaptPaymentOptions,
  adaptPaymentSession,
  paymentReferenceFromSearch,
  requiresHoldForMethod,
} from "@/lib/payment/adapter";

describe("payment adapter", () => {
  it("maps backend methods and does not infer them from amounts", () => {
    const quote = {
      ...emptyBookingQuote(),
      paymentMode: "unknown" as const,
      payableNowLabel: "۲۵۰٬۰۰۰ تومان",
      payableAtLocationLabel: "۱۵۰٬۰۰۰ تومان",
    };
    expect(adaptPaymentOptions(quote)).toEqual([]);
    const withMethods = adaptPaymentOptions(quote, {
      paymentMethods: [
        { type: "full", payableNow: { label: "۲۵۰٬۰۰۰ تومان" } },
        { type: "deposit", payableNow: { label: "۱۰۰٬۰۰۰ تومان" }, remainingAtLocation: { label: "۱۵۰٬۰۰۰ تومان" } },
        { type: "pay_at_location", payableNow: { label: "۰ تومان" }, remainingAtLocation: { label: "۲۵۰٬۰۰۰ تومان" } },
      ],
    });
    expect(withMethods.map((item) => item.type)).toEqual(["full", "deposit", "pay_at_location"]);
    expect(withMethods[1]?.refundability).toBeUndefined();
  });

  it("uses the declared payment mode when only one method exists", () => {
    const quote = {
      ...emptyBookingQuote(),
      paymentMode: "deposit" as const,
      payableNowLabel: "۱۰۰٬۰۰۰ تومان",
      payableAtLocationLabel: "۱۵۰٬۰۰۰ تومان",
      finalAmountLabel: "۲۵۰٬۰۰۰ تومان",
    };
    const options = adaptPaymentOptions(quote);
    expect(options).toHaveLength(1);
    expect(options[0]?.type).toBe("deposit");
    expect(requiresHoldForMethod("deposit")).toBe(true);
    expect(requiresHoldForMethod("pay_at_location")).toBe(false);
  });

  it("drops payment secrets and internal resources", () => {
    const session = adaptPaymentSession({
      id: "pay_1",
      status: "redirect_required",
      redirectUrl: "https://pay.example/start",
      clientSecret: "sk_live",
      resources: [{ kind: "room", name: "اتاق ۳" }],
    });
    expect(session?.paymentId).toBe("pay_1");
    expect(JSON.stringify(session)).not.toMatch(/sk_live|اتاق/);
  });

  it("reads only a public payment reference from the result URL", () => {
    const params = new URLSearchParams("ref=pay_1&status=success&Authority=secret");
    expect(paymentReferenceFromSearch(params)).toBe("pay_1");
    expect(paymentReferenceFromSearch(new URLSearchParams("status=success"))).toBeUndefined();
    expect(paymentReferenceFromSearch(new URLSearchParams("ref=12"))).toBeUndefined();
  });
});
