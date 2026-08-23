import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/errors";
import { createPaymentSession, verifyPayment } from "@/lib/api/payment";

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

  it("verifies payment by POST and does not trust a query status", async () => {
    mockedClient.mockResolvedValue({ id: "pay_1", status: "paid", bookingReference: "BK22A" });
    const view = await verifyPayment("pay_1");
    expect(view.status).toBe("paid");
    expect(mockedClient).toHaveBeenCalledWith(
      "/customer/payments/pay_1/verify",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
