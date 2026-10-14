import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/errors";
import {
  confirmBooking,
  fetchBookingQuote,
  previewBookingCheckout,
  quoteRequestBody,
} from "@/lib/api/booking";
import { emptyBookingDraft } from "@/types/booking";

vi.mock("@/lib/api/client", () => ({
  apiClient: vi.fn(),
}));

import { apiClient } from "@/lib/api/client";

const mockedClient = vi.mocked(apiClient);

describe("booking quote request", () => {
  beforeEach(() => {
    mockedClient.mockReset();
  });

  it("sends validated public fields and never client-calculated amounts", () => {
    const draft = emptyBookingDraft();
    draft.serviceId = "svc_1";
    draft.branchId = "br_1";
    draft.slotId = "slot_1";
    draft.date = "2026-08-22";
    draft.additionalData = { note: "سلام" };
    const body = quoteRequestBody(draft);
    expect(body).toEqual({
      serviceId: "svc_1",
      branchId: "br_1",
      providerPreference: { type: "not_applicable" },
      date: "2026-08-22",
      slotId: "slot_1",
      additionalData: { note: "سلام" },
    });
    expect(JSON.stringify(body)).not.toMatch(/amount|deposit|discount|resourceId/);
  });

  it("reuses the provided idempotency key on confirm", async () => {
    mockedClient.mockResolvedValue({ status: "confirmed", id: "apt_1", reference: "apt_1" });
    const draft = emptyBookingDraft();
    draft.serviceId = "svc_1";
    draft.slotId = "slot_1";
    draft.quoteId = "q1";
    const result = await confirmBooking(draft, "key-1");
    expect(result.outcome).toBe("confirmed");
    expect(mockedClient).toHaveBeenCalledWith(
      "/customer/bookings",
      expect.objectContaining({
        method: "POST",
        headers: { "Idempotency-Key": "key-1" },
      }),
    );
  });

  it("does not invent a booking when confirm is missing", async () => {
    mockedClient.mockRejectedValue(new ApiError({ status: 404, message: "نیست" }));
    const result = await confirmBooking(emptyBookingDraft(), "key-1");
    expect(result.outcome).toBe("missing_endpoint");
  });
});

describe("booking quote against the current Backend (no quote endpoint)", () => {
  beforeEach(() => {
    mockedClient.mockReset();
  });

  function draft() {
    const value = emptyBookingDraft();
    value.serviceId = "svc_1";
    value.slotId = "slot_1";
    value.holdId = "hold_1";
    return value;
  }

  it("without a coupon, defers pricing to booking creation and invents no amount", async () => {
    const quote = await fetchBookingQuote(draft());
    expect(mockedClient).not.toHaveBeenCalled();
    expect(quote.authoritative).toBe(false);
    expect(quote.pricedAtBooking).toBe(true);
    expect(quote.checkoutPath).toBe("confirm");
    expect(quote.paymentMode).toBe("unknown");
    expect(quote.paymentOptions).toEqual([]);
    expect(quote.lines).toEqual([]);
    expect(quote.payableNowLabel).toBeUndefined();
    expect(quote.finalAmountLabel).toBeUndefined();
    await expect(previewBookingCheckout(draft())).resolves.toMatchObject({ checkoutPath: "confirm" });
  });

  it("validates a coupon through the advisory coupon endpoint only", async () => {
    mockedClient.mockResolvedValue({ success: true, data: { valid: true } });
    await fetchBookingQuote(draft(), undefined, "  OFF10 ");
    expect(mockedClient).toHaveBeenCalledTimes(1);
    expect(mockedClient).toHaveBeenCalledWith(
      "/coupons/validate",
      expect.objectContaining({
        method: "POST",
        body: { couponCode: "OFF10", serviceId: "svc_1", holdToken: "hold_1" },
      }),
    );
  });

  it("shows the Backend's coupon amounts as given and keeps its rejection message", async () => {
    mockedClient.mockResolvedValue({
      success: true,
      data: {
        valid: true,
        code: "OFF10",
        original_amount: "150000.00",
        discount_amount: "15000.00",
        final_amount: "135000.00",
        currency_code: "IRR",
      },
    });
    const applied = await fetchBookingQuote(draft(), undefined, "OFF10");
    expect(applied.coupon).toMatchObject({ code: "OFF10", status: "applied" });
    expect(applied.priceLabel).toMatch(/۱۵۰٬۰۰۰/);
    expect(applied.discountLabel).toMatch(/۱۵٬۰۰۰/);
    expect(applied.finalAmountLabel).toMatch(/۱۳۵٬۰۰۰/);

    mockedClient.mockResolvedValue({
      success: true,
      data: { valid: false, code: null, failure_code: "COUPON_EXPIRED", message: "کد منقضی شده است." },
    });
    const rejected = await fetchBookingQuote(draft(), undefined, "OLD");
    expect(rejected.coupon).toEqual({ code: "OLD", status: "invalid", message: "کد منقضی شده است." });
    expect(rejected.discountLabel).toBeUndefined();
  });

  it("surfaces coupon validation failures other than a missing route", async () => {
    mockedClient.mockRejectedValue(new ApiError({ status: 422, code: "COUPON_EXPIRED", message: "x" }));
    await expect(fetchBookingQuote(draft(), undefined, "OLD")).rejects.toMatchObject({ status: 422 });
  });
});
