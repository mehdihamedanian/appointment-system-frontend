import { describe, expect, it } from "vitest";
import {
  adminAppointmentsHref,
  countActiveAdminAppointmentFilters,
  parseAdminAppointmentFilters,
} from "@/lib/admin/appointment-filters";

describe("admin appointment filters", () => {
  it("parses URL filters and preserves sort allowlist", () => {
    const params = new URLSearchParams(
      "q=ali&status=confirmed&paymentStatus=paid&sort=customerName&direction=asc&page=2",
    );
    expect(parseAdminAppointmentFilters(params)).toEqual({
      q: "ali",
      status: "confirmed",
      paymentStatus: "paid",
      sort: "customerName",
      direction: "asc",
      page: 2,
    });
  });

  it("builds href and counts active filters", () => {
    const filters = parseAdminAppointmentFilters(new URLSearchParams("status=confirmed&branch=br_1"));
    expect(countActiveAdminAppointmentFilters(filters)).toBe(2);
    expect(adminAppointmentsHref(filters)).toBe("/admin/appointments?status=confirmed&branch=br_1");
  });
});
