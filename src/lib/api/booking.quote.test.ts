import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/errors";
import { confirmBooking, quoteRequestBody } from "@/lib/api/booking";
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
