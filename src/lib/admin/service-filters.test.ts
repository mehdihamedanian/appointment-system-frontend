import { describe, expect, it } from "vitest";
import {
  adminServiceFiltersApplied,
  adminServiceHref,
  parseAdminServiceFilters,
} from "@/lib/admin/service-filters";

describe("service-filters", () => {
  it("parses filters from search params", () => {
    const filters = parseAdminServiceFilters({
      get: (key) => {
        const map: Record<string, string> = {
          q: "mri",
          active: "active",
          page: "2",
          sort: "name",
        };
        return map[key] ?? null;
      },
    });
    expect(filters.q).toBe("mri");
    expect(filters.active).toBe("active");
    expect(filters.page).toBe(2);
    expect(filters.sort).toBe("name");
  });

  it("builds href with filters", () => {
    expect(adminServiceHref({ q: "test", active: "inactive" })).toContain("q=test");
    expect(adminServiceHref({ q: "test", active: "inactive" })).toContain("active=inactive");
  });

  it("detects applied filters", () => {
    expect(adminServiceFiltersApplied({ active: "all", sort: "name", direction: "asc", page: 1 })).toBe(
      false,
    );
    expect(
      adminServiceFiltersApplied({ q: "x", active: "all", sort: "name", direction: "asc", page: 1 }),
    ).toBe(true);
  });
});
