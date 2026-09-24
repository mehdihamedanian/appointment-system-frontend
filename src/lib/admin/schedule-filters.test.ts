import { describe, expect, it } from "vitest";
import {
  adminScheduleApiPath,
  adminScheduleBranchHref,
  adminScheduleStaffHref,
  parseScheduleScopeFromPath,
  schedulePermissionForScope,
} from "@/lib/admin/schedule-filters";

describe("schedule-filters", () => {
  it("builds scope hrefs and api paths", () => {
    expect(adminScheduleBranchHref("br_1")).toBe("/admin/schedules/branches/br_1");
    expect(adminScheduleStaffHref("st_1")).toBe("/admin/schedules/staff/st_1");
    expect(adminScheduleApiPath("resource", "res_1")).toBe("/admin/schedules/resources/res_1");
  });

  it("parses pathname scope", () => {
    expect(parseScheduleScopeFromPath("/admin/schedules/staff/st_9")).toEqual({
      scope: "staff",
      reference: "st_9",
    });
    expect(parseScheduleScopeFromPath("/admin/schedules/business")).toEqual({
      scope: "business",
    });
  });

  it("maps permission codes per scope", () => {
    expect(schedulePermissionForScope("staff", "edit")).toBe("admin.schedules.staff.edit");
    expect(schedulePermissionForScope("business", "holidays")).toBe(
      "admin.schedules.holidays.manage",
    );
  });
});
