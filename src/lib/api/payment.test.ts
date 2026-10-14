import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/errors";
import { createPaymentSession, fetchPaymentStatus } from "@/lib/api/payment";

vi.mock("@/lib/api/client", () => ({
  apiClient: vi.fn(),
}));

import { apiClient } from "@/lib/api/client";

const mockedClient = vi.mocked(apiClient);

describe("payment API", () => {
  beforeEach(() => {
    mockedClient.mockReset();
  });

  it("creates a session with idempotency and without client amounts", async () => {
    mockedClient.mockResolvedValue({
      id: "pay_1",
      status: "redirect_required",
      redirectUrl: "https://pay.example/start",
    });
    const result = await createPaymentSession(
      { method: "full", holdReference: "hold_1", quoteId: "q1" },
      "key-pay-1",
    );
    expect(result.outcome).toBe("created");
    expect(mockedClient).toHaveBeenCalledWith(
      "/customer/payments/sessions",
      expect.objectContaining({
        method: "POST",
        headers: { "Idempotency-Key": "key-pay-1" },
        body: expect.not.objectContaining({ amount: expect.anything(), payableNow: expect.anything() }),
      }),
    );
  });

  it("does not invent a session when the endpoint is missing", async () => {
    mockedClient.mockRejectedValue(new ApiError({ status: 404, message: "نیست" }));
    const result = await createPaymentSession({ method: "full" }, "key-pay-1");
    expect(result.outcome).toBe("missing_endpoint");
  });

  it("reads payment status from the backend instead of trusting a query status", async () => {
    mockedClient.mockResolvedValue({ id: "pay_1", status: "paid", bookingReference: "BK22A" });
    const view = await fetchPaymentStatus("pay_1");
    expect(view.status).toBe("paid");
    expect(mockedClient).toHaveBeenCalledWith(
      "/customer/payments/pay_1",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("treats a processing intent with a gateway URL as awaiting redirect", async () => {
    mockedClient.mockResolvedValue({
      intent_id: "3c0a7f2e-1d4b-4c8e-9f6a-2b5d7e9c1a3f",
      intent_status: "processing",
      payment_status: "unpaid",
      amount: "150000.00",
      currency: "IRR",
      payment_url: "https://fake-gateway.test/pay/ref_1",
    });
    const result = await createPaymentSession(
      { method: "full", bookingReference: "3c0a7f2e-1d4b-4c8e-9f6a-2b5d7e9c1a30" },
      "key-pay-2",
    );
    expect(result.outcome).toBe("created");
    if (result.outcome !== "created") return;
    expect(result.session.status).toBe("redirect_required");
    expect(result.session.redirectUrl).toBe("https://fake-gateway.test/pay/ref_1");
    expect(result.session.payableNowLabel).toBeTruthy();
  });

  it("maps a succeeded backend intent to paid", async () => {
    mockedClient.mockResolvedValue({
      intent_id: "3c0a7f2e-1d4b-4c8e-9f6a-2b5d7e9c1a3f",
      intent_status: "succeeded",
      payment_status: "paid",
      amount: "150000.00",
      currency: "IRR",
    });
    const view = await fetchPaymentStatus("3c0a7f2e-1d4b-4c8e-9f6a-2b5d7e9c1a3f");
    expect(view.status).toBe("paid");
  });
});
