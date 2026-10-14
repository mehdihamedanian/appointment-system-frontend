import { describe, expect, it, vi } from "vitest";
import {
  bookableDatesQueryOptions,
  bookableSlotsQueryOptions,
  fetchBookableDates,
  fetchBookableSlots,
} from "@/lib/api/booking";
import { ApiError } from "@/lib/api/errors";

vi.mock("@/lib/api/client", () => ({
  apiClient: vi.fn(),
}));

import { apiClient } from "@/lib/api/client";

const mockedClient = vi.mocked(apiClient);

describe("availability API client", () => {
  it("requests the whole month from the service availability endpoint", async () => {
    mockedClient.mockReset();
    mockedClient.mockResolvedValue({
      success: true,
      data: {
        service_id: "svc_1",
        branch_id: "br_1",
        timezone: "Asia/Tehran",
        from_date: "2026-02-01",
        to_date: "2026-02-28",
        configuration_valid: true,
        days: [
          { date: "2026-02-01", slots: [] },
          { date: "2026-02-02", slots: [{ start: "2026-02-02T05:30:00Z", end: "2026-02-02T06:00:00Z" }] },
        ],
      },
    });
    const signal = new AbortController().signal;
    const view = await fetchBookableDates(
      {
        serviceId: "svc_1",
        branchId: "br_1",
        preference: { type: "specific", providerId: "p1" },
        month: "2026-02",
      },
      signal,
    );
    expect(mockedClient).toHaveBeenCalledWith(
      "/services/svc_1/availability",
      expect.objectContaining({
        signal,
        query: { branch_id: "br_1", from: "2026-02-01", to: "2026-02-28", staff_id: "p1" },
      }),
    );
    expect(view.dates).toEqual(["2026-02-02"]);
    expect(view.days).toEqual([
      { date: "2026-02-01", status: "unavailable" },
      { date: "2026-02-02", status: "available" },
    ]);
  });

  it("asks for a branch instead of calling the Backend without one", async () => {
    mockedClient.mockReset();
    const view = await fetchBookableDates({
      serviceId: "svc_1",
      preference: { type: "not_applicable" },
      month: "2026-08",
    });
    expect(mockedClient).not.toHaveBeenCalled();
    expect(view.dates).toEqual([]);
    expect(view.unavailableReason).toBe("branch_required");
  });

  it("surfaces Backend failures instead of reporting an empty calendar", async () => {
    mockedClient.mockReset();
    mockedClient.mockRejectedValue(
      new ApiError({ status: 404, code: "SERVICE_NOT_FOUND", message: "نیست" }),
    );
    await expect(
      fetchBookableDates({
        serviceId: "svc_1",
        branchId: "br_1",
        preference: { type: "not_applicable" },
        month: "2026-08",
      }),
    ).rejects.toMatchObject({ status: 404, code: "SERVICE_NOT_FOUND" });
  });

  it("maps Backend slots to safe ids and keeps invalid configuration distinct", async () => {
    mockedClient.mockReset();
    mockedClient.mockResolvedValueOnce({
      data: {
        timezone: "Asia/Tehran",
        configuration_valid: true,
        days: [{ date: "2026-08-22", slots: [{ start: "2026-08-22T05:30:00Z", end: "2026-08-22T06:00:00Z" }] }],
      },
    });
    const slots = await fetchBookableSlots({
      serviceId: "svc_1",
      branchId: "br_1",
      preference: { type: "not_applicable" },
      date: "2026-08-22",
    });
    expect(slots.available).toBe(true);
    expect(slots.slots[0]).toMatchObject({
      id: `slot_${Date.parse("2026-08-22T05:30:00Z")}`,
      startsAt: "2026-08-22T05:30:00Z",
      endsAt: "2026-08-22T06:00:00Z",
      status: "available",
    });

    mockedClient.mockResolvedValueOnce({ data: { configuration_valid: false, days: [] } });
    const invalid = await fetchBookableSlots({
      serviceId: "svc_1",
      branchId: "br_1",
      preference: { type: "not_applicable" },
      date: "2026-08-22",
    });
    expect(invalid.unavailableReason).toBe("not_configured");
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
