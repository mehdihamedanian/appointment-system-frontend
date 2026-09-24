import { describe, expect, it } from "vitest";
import {
  adminStaffCalendarHref,
  adminStaffFiltersApplied,
  adminStaffHref,
  filtersToAdminStaffParams,
  parseAdminStaffFilters,
} from "@/lib/admin/staff-filters";

describe("admin staff filters", () => {
  it("parses URL search into filters", () => {
    const filters = parseAdminStaffFilters(
      new URLSearchParams(
        "q=دکتر&active=active&visible=visible&bookable=bookable&branch=br_1&service=svc_1&sort=name&direction=desc&page=2",
      ),
    );
    expect(filters.q).toBe("دکتر");
    expect(filters.active).toBe("active");
    expect(filters.customerVisible).toBe("visible");
    expect(filters.bookable).toBe("bookable");
    expect(filters.branchId).toBe("br_1");
    expect(filters.page).toBe(2);
  });

  it("builds href and API params", () => {
    expect(adminStaffHref({ q: "علی", active: "active" })).toContain("/admin/staff?");
    expect(
      filtersToAdminStaffParams({
        active: "all",
        customerVisible: "hidden",
        bookable: "all",
        sort: "name",
        direction: "asc",
        page: 1,
      }),
    ).toEqual({
      page: "1",
      sort: "name",
      direction: "asc",
      customerVisible: "hidden",
    });
    expect(
      adminStaffFiltersApplied({
        active: "all",
        customerVisible: "visible",
        bookable: "all",
        sort: "name",
        direction: "asc",
        page: 1,
      }),
    ).toBe(true);
  });

  it("builds Phase 27 calendar href with staff preselected", () => {
    expect(adminStaffCalendarHref("st_1", "2026-08-25")).toBe(
      "/admin/calendar?group=staff&staff=st_1&date=2026-08-25",
    );
  });
});
