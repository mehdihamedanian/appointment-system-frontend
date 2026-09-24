import { describe, expect, it } from "vitest";
import {
  adminDashboardHref,
  filtersToQueryParams,
  isManualBookingRouteEnabled,
  parseAdminDashboardFilters,
} from "@/lib/admin/dashboard-filters";

describe("admin dashboard filters", () => {
  it("parses branch and analytics range from URL search params", () => {
    const params = new URLSearchParams("date=2026-08-23&from=2026-08-01&to=2026-08-23&branch=br_1");
    expect(parseAdminDashboardFilters(params, "Asia/Tehran")).toEqual({
      date: "2026-08-23",
      analyticsFrom: "2026-08-01",
      analyticsTo: "2026-08-23",
      branchId: "br_1",
    });
  });

  it("builds stable dashboard href preserving filters", () => {
    expect(
      adminDashboardHref({
        date: "2026-08-23",
        analyticsFrom: "2026-08-01",
        branchId: "br_1",
      }),
    ).toBe("/admin?date=2026-08-23&from=2026-08-01&branch=br_1");
  });

  it("maps filters to backend query params", () => {
    expect(
      filtersToQueryParams({
        date: "2026-08-23",
        branchId: "br_1",
      }),
    ).toEqual({
      date: "2026-08-23",
      branchId: "br_1",
    });
  });

  it("enables manual booking route for Phase 26+", () => {
    expect(isManualBookingRouteEnabled()).toBe(true);
  });
});
