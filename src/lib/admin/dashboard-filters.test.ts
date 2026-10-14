import { describe, expect, it } from "vitest";
import {
  adminDashboardHref,
  analyticsRangeQueryParams,
  isManualBookingRouteEnabled,
  operationalDayQueryParams,
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

  it("maps the operational day to a half-open Backend date range", () => {
    expect(
      operationalDayQueryParams({
        date: "2026-08-31",
        branchId: "br_1",
      }),
    ).toEqual({
      start_date: "2026-08-31",
      end_date: "2026-09-01",
      branch_id: "br_1",
    });
  });

  it("sends an analytics range only when both bounds are valid", () => {
    expect(
      analyticsRangeQueryParams({
        date: "2026-08-23",
        analyticsFrom: "2026-08-01",
        analyticsTo: "2026-08-23",
      }),
    ).toEqual({ start_date: "2026-08-01", end_date: "2026-08-24" });
    expect(analyticsRangeQueryParams({ date: "2026-08-23", analyticsFrom: "2026-08-01" })).toEqual({});
    expect(
      analyticsRangeQueryParams({
        date: "2026-08-23",
        analyticsFrom: "2026-08-24",
        analyticsTo: "2026-08-01",
      }),
    ).toEqual({});
  });

  it("enables manual booking route for Phase 26+", () => {
    expect(isManualBookingRouteEnabled()).toBe(true);
  });
});
