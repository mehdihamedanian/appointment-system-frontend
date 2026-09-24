import { describe, expect, it } from "vitest";
import {
  adminResourceCalendarHref,
  adminResourceFiltersApplied,
  adminResourcesHref,
  filtersToAdminResourceParams,
  parseAdminResourceFilters,
} from "@/lib/admin/resource-filters";

describe("admin resource filters", () => {
  it("parses URL search into filters with allowlisted sort", () => {
    const filters = parseAdminResourceFilters(
      new URLSearchParams(
        "q=اتاق&type=room&active=inactive&branch=br_1&service=svc_1&sort=capacity&direction=desc&page=2",
      ),
    );
    expect(filters.q).toBe("اتاق");
    expect(filters.type).toBe("room");
    expect(filters.active).toBe("inactive");
    expect(filters.branchId).toBe("br_1");
    expect(filters.serviceId).toBe("svc_1");
    expect(filters.sort).toBe("capacity");
    expect(filters.direction).toBe("desc");
    expect(filters.page).toBe(2);
  });

  it("rejects unsafe ids and unknown sort", () => {
    const filters = parseAdminResourceFilters(
      new URLSearchParams("branch=../evil&sort=hack&page=0"),
    );
    expect(filters.branchId).toBeUndefined();
    expect(filters.sort).toBe("name");
    expect(filters.page).toBe(1);
  });

  it("builds href and API params preserving state", () => {
    const href = adminResourcesHref({
      q: "میز",
      type: "desk",
      active: "active",
      page: 3,
      sort: "name",
      direction: "asc",
    });
    expect(href).toContain("/admin/resources?");
    expect(href).toContain("q=%D9%85%DB%8C%D8%B2");
    expect(href).toContain("type=desk");
    expect(href).toContain("page=3");
    expect(adminResourceFiltersApplied({ type: "desk", active: "all", sort: "name", direction: "asc", page: 1 })).toBe(
      true,
    );
    expect(
      filtersToAdminResourceParams({
        type: "room",
        active: "all",
        sort: "name",
        direction: "asc",
        page: 1,
        q: "a",
      }),
    ).toEqual({ page: "1", sort: "name", direction: "asc", type: "room", q: "a" });
  });

  it("builds Phase 27 calendar href with resource preselected", () => {
    expect(adminResourceCalendarHref("res_1", "2026-08-25")).toBe(
      "/admin/calendar?group=resource&resource=res_1&date=2026-08-25",
    );
  });
});
