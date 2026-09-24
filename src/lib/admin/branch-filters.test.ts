import { describe, expect, it } from "vitest";
import {
  adminBranchCalendarHref,
  adminBranchFiltersApplied,
  adminBranchHref,
  countActiveAdminBranchFilters,
  parseAdminBranchFilters,
  sanitizeBranchReference,
} from "@/lib/admin/branch-filters";
import { isAdminMultiBranchEnabled } from "@/lib/admin/branch-context";

describe("admin branch filters", () => {
  it("parses URL filters with defaults", () => {
    const filters = parseAdminBranchFilters(
      new URLSearchParams("q=مرکزی&active=active&page=2&sort=status&direction=desc"),
    );
    expect(filters.q).toBe("مرکزی");
    expect(filters.active).toBe("active");
    expect(filters.page).toBe(2);
    expect(filters.sort).toBe("status");
    expect(filters.direction).toBe("desc");
  });

  it("builds href and counts active filters", () => {
    const filters = parseAdminBranchFilters(new URLSearchParams("q=test"));
    expect(adminBranchHref(filters)).toContain("q=test");
    expect(countActiveAdminBranchFilters(filters)).toBe(1);
    expect(adminBranchFiltersApplied(filters)).toBe(true);
  });

  it("builds calendar deep link with branch group", () => {
    expect(adminBranchCalendarHref("BR-1", "2026-08-26")).toBe(
      "/admin/calendar?branch=BR-1&group=branch&date=2026-08-26",
    );
  });

  it("sanitizes branch reference", () => {
    expect(sanitizeBranchReference("BR-1")).toBe("BR-1");
    expect(sanitizeBranchReference("../evil")).toBeUndefined();
  });
});

describe("admin branch context", () => {
  it("gates multi-branch on capability and business flag", () => {
    expect(isAdminMultiBranchEnabled({ branchesEnabled: true })).toBe(true);
    expect(isAdminMultiBranchEnabled({ branchesEnabled: false })).toBe(false);
    expect(isAdminMultiBranchEnabled(null)).toBe(false);
  });
});
