import { describe, expect, it } from "vitest";
import {
  adminCustomerFiltersApplied,
  adminCustomerHref,
  countActiveAdminCustomerFilters,
  parseAdminCustomerFilters,
  sanitizeCustomerSearch,
} from "@/lib/admin/customer-filters";

describe("admin customer filters", () => {
  it("parses URL filters", () => {
    const filters = parseAdminCustomerFilters(
      new URLSearchParams("q=sara&active=active&upcoming=has_upcoming&page=2&sort=lastVisit"),
    );
    expect(filters.q).toBe("sara");
    expect(filters.active).toBe("active");
    expect(filters.upcoming).toBe("has_upcoming");
    expect(filters.page).toBe(2);
    expect(filters.sort).toBe("lastVisit");
  });

  it("builds href and counts filters", () => {
    const filters = parseAdminCustomerFilters(new URLSearchParams("q=test&tagId=tag_1"));
    expect(adminCustomerHref(filters)).toContain("q=test");
    expect(countActiveAdminCustomerFilters(filters)).toBe(2);
    expect(adminCustomerFiltersApplied(filters)).toBe(true);
  });

  it("sanitizes search query length", () => {
    expect(sanitizeCustomerSearch("  abc  ")).toBe("abc");
    expect(sanitizeCustomerSearch("")).toBeUndefined();
  });
});
