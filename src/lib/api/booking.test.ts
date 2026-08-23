import { describe, expect, it, vi } from "vitest";
import { bookableDatesQueryOptions, bookableSlotsQueryOptions, fetchBookableDates } from "@/lib/api/booking";
import { ApiError } from "@/lib/api/errors";

vi.mock("@/lib/api/client", () => ({
  apiClient: vi.fn(),
}));

import { apiClient } from "@/lib/api/client";

const mockedClient = vi.mocked(apiClient);

describe("availability API client", () => {
  it("sends month-scoped date requests with the abort signal", async () => {
    mockedClient.mockResolvedValue({ dates: ["2026-08-22"] });
    const signal = new AbortController().signal;
    await fetchBookableDates(
      {
        serviceId: "svc_1",
        branchId: "br_1",
        preference: { type: "specific", providerId: "p1" },
        month: "2026-08",
      },
      signal,
    );
    expect(mockedClient).toHaveBeenCalledWith(
      "/public/booking/availability/dates",
      expect.objectContaining({
        signal,
        query: expect.objectContaining({
          serviceId: "svc_1",
          branchId: "br_1",
          providerId: "p1",
          month: "2026-08",
        }),
      }),
    );
  });

  it("treats 404 as a disconnected calendar rather than generating dates", async () => {
    mockedClient.mockRejectedValue(new ApiError({ status: 404, message: "نیست" }));
    const view = await fetchBookableDates({
      serviceId: "svc_1",
      preference: { type: "not_applicable" },
      month: "2026-08",
    });
    expect(view.dates).toEqual([]);
    expect(view.days).toEqual([]);
    expect(view.unavailableReason).toBe("missing_endpoint");
  });

  it("disables queries when dependencies or the selected date are invalid", () => {
    expect(
      bookableDatesQueryOptions("svc_1", undefined, { type: "not_applicable" }, "2026-08", {
        requiresBranch: false,
        providerMode: "not_applicable",
      }).enabled,
    ).toBe(true);
    expect(
      bookableDatesQueryOptions("", undefined, { type: "not_applicable" }, "2026-08", {
        requiresBranch: false,
        providerMode: "not_applicable",
      }).enabled,
    ).toBe(false);
    expect(
      bookableSlotsQueryOptions("svc_1", undefined, { type: "not_applicable" }, "", {
        requiresBranch: false,
        providerMode: "not_applicable",
      }).enabled,
    ).toBe(false);
    expect(
      bookableSlotsQueryOptions("svc_1", undefined, { type: "not_applicable" }, "2026-08-22", {
        requiresBranch: false,
        providerMode: "not_applicable",
      }).enabled,
    ).toBe(true);
  });
});
