import { describe, expect, it } from "vitest";
import {
  adminPageTitle,
  buildAdminBreadcrumbs,
  canSeeAdminNavItem,
  filterAdminNavSections,
  findAdminNavItem,
} from "@/lib/admin/navigation";
import { adminNavSections } from "@/constants/navigation";
import type { SessionUser } from "@/types/session";

const admin: SessionUser = {
  id: "staff_1",
  displayName: "مدیر",
  permissionCodes: [],
  adminPanelAccess: "granted",
};

const limited: SessionUser = {
  id: "staff_2",
  displayName: "اپراتور",
  permissionCodes: ["admin.appointments.view", "admin.calendar.view"],
  adminPanelAccess: "granted",
};

describe("admin navigation helpers", () => {
  it("shows all capability-visible items when permission codes are empty", () => {
    const sections = filterAdminNavSections(admin);
    const hrefs = sections.flatMap((section) => section.items.map((item) => item.href));
    expect(hrefs).toContain("/admin");
    expect(hrefs).toContain("/admin/appointments");
    expect(hrefs).toContain("/admin/settings");
  });

  it("hides items that require missing permissions", () => {
    const sections = filterAdminNavSections(limited);
    const hrefs = sections.flatMap((section) => section.items.map((item) => item.href));
    expect(hrefs).toContain("/admin/appointments");
    expect(hrefs).toContain("/admin/calendar");
    expect(hrefs).not.toContain("/admin/settings");
    expect(hrefs).not.toContain("/admin/users");
  });

  it("hides capability-gated items when capability is disabled", () => {
    const waiting = adminNavSections
      .flatMap((section) => section.items)
      .find((item) => item.href === "/admin/waiting-list");
    expect(waiting?.capability).toBe("waitingList");
    expect(canSeeAdminNavItem(admin, waiting!)).toBe(true);
  });

  it("matches active routes and builds breadcrumbs from metadata", () => {
    expect(findAdminNavItem("/admin/appointments")?.label).toBe("نوبت‌ها");
    expect(adminPageTitle("/admin/calendar")).toBe("تقویم");
    expect(buildAdminBreadcrumbs("/admin/customers")).toEqual([
      { href: "/admin", label: "پنل مدیریت" },
      { label: "مشتریان" },
    ]);
    expect(buildAdminBreadcrumbs("/admin/customers/c_1", "سارا")).toEqual([
      { href: "/admin", label: "پنل مدیریت" },
      { href: "/admin/customers", label: "مشتریان" },
      { label: "سارا" },
    ]);
  });

  it("includes manual booking, resources, and staff routes", () => {
    const hrefs = adminNavSections.flatMap((section) => section.items.map((item) => item.href));
    expect(hrefs).toContain("/admin/bookings/new");
    expect(hrefs).toContain("/admin/resources");
    expect(hrefs).toContain("/admin/staff");
    expect(hrefs).toContain("/admin/schedules");
    expect(hrefs).toContain("/admin/coupons");
  });

  it("gates coupons nav item on coupons capability", () => {
    const coupons = adminNavSections
      .flatMap((section) => section.items)
      .find((item) => item.href === "/admin/coupons");
    expect(coupons?.capability).toBe("coupons");
    expect(coupons?.permission).toBe("admin.coupons.view");
    expect(canSeeAdminNavItem(admin, coupons!)).toBe(true);
  });
});
