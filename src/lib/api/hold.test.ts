import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/errors";
import { createSlotHold, fetchSlotHold, startHoldPayment } from "@/lib/api/hold";
import { emptyBookingDraft } from "@/types/booking";

vi.mock("@/lib/api/client", () => ({
  apiClient: vi.fn(),
}));

import { apiClient } from "@/lib/api/client";

const mockedClient = vi.mocked(apiClient);

describe("slot hold API", () => {
  beforeEach(() => {
    mockedClient.mockReset();
  });

  it("creates a hold with the backend idempotency contract", async () => {
    mockedClient.mockResolvedValue({
      id: "hold_1",
      status: "active",
      expiresAt: "2026-08-22T10:05:00.000Z",
      slot: { id: "slot_1", startsAt: "2026-08-22T09:00:00+03:30" },
    });
    const draft = emptyBookingDraft();
    draft.serviceId = "svc_1";
    draft.slotId = "slot_1";
    draft.quoteId = "q1";
    const result = await createSlotHold(draft, "key-hold-1");
    expect(result.outcome).toBe("created");
    expect(mockedClient).toHaveBeenCalledWith(
      "/customer/bookings/holds",
      expect.objectContaining({
        method: "POST",
        headers: { "Idempotency-Key": "key-hold-1" },
      }),
    );
  });

  it("does not start a timer when expiresAt is missing", async () => {
    mockedClient.mockResolvedValue({ id: "hold_1", status: "active", slot: { id: "slot_1" } });
    const result = await createSlotHold(emptyBookingDraft(), "key-hold-1");
    expect(result.outcome).toBe("missing_expires_at");
  });

  it("does not invent a hold when the endpoint is missing", async () => {
    mockedClient.mockRejectedValue(new ApiError({ status: 404, message: "نیست" }));
    const result = await createSlotHold(emptyBookingDraft(), "key-hold-1");
    expect(result.outcome).toBe("missing_endpoint");
  });

  it("loads an existing hold by GET and never posts on fetch", async () => {
    mockedClient.mockResolvedValue({
      id: "hold_1",
      status: "active",
      expiresAt: "2026-08-22T10:05:00.000Z",
    });
    const hold = await fetchSlotHold("hold_1");
    expect(hold.holdId).toBe("hold_1");
    expect(mockedClient).toHaveBeenCalledWith(
      "/customer/bookings/holds/hold_1",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("does not invent a payment session when the gateway is missing", async () => {
    mockedClient.mockRejectedValue(new ApiError({ status: 404, message: "نیست" }));
    const result = await startHoldPayment("hold_1");
    expect(result.outcome).toBe("missing_endpoint");
  });
});
