import { describe, expect, it } from "vitest";
import {
  adaptAdminBranchDetail,
  adaptAdminBranchImpactPreview,
  adaptAdminBranchList,
  branchFormImpactFields,
  formFromAdminBranchDetail,
  validateAdminBranchForm,
} from "@/lib/admin/branch-adapter";

describe("admin branch adapter", () => {
  it("adapts list with schedule summary and counts", () => {
    const view = adaptAdminBranchList(
      {
        items: [
          {
            id: "br_1",
            reference: "BR-1",
            name: "شعبه مرکزی",
            address: "تهران",
            phone: "02112345678",
            active: true,
            staffCount: 3,
            resourceCount: 2,
            serviceCount: 5,
            schedule: { mode: "inherit_business", workingHoursLabel: "۹–۱۸" },
          },
        ],
        totalCount: 1,
      },
      1,
    );
    expect(view.items[0]?.name).toBe("شعبه مرکزی");
    expect(view.items[0]?.staffCount).toBe(3);
    expect(view.items[0]?.detailHref).toBe("/admin/branches/BR-1");
    expect(view.items[0]?.schedule?.workingHoursLabel).toBe("۹–۱۸");
  });

  it("adapts detail with assignments and capabilities", () => {
    const detail = adaptAdminBranchDetail({
      id: "br_1",
      reference: "BR-1",
      name: "شعبه شمال",
      status: "active",
      schedule: { mode: "custom", summary: "دوشنبه ۹–۱۷" },
      staff: [{ id: "st_1", reference: "ST-1", name: "علی" }],
      resources: [{ id: "res_1", reference: "RES-1", name: "اتاق ۱" }],
      services: [{ id: "svc_1", reference: "SVC-1", name: "ویزیت", feasible: false, warning: "منبع کم" }],
      capabilities: { supportsTimezoneEdit: true, supportsLocationCoordinates: true },
      allowedActions: { edit: true, assignStaff: true, viewCalendar: true },
      version: "v1",
    });
    expect(detail?.staff).toHaveLength(1);
    expect(detail?.services[0]?.feasible).toBe(false);
    expect(detail?.capabilities.supportsTimezoneEdit).toBe(true);
    expect(detail?.scheduleHref).toContain("/admin/schedules/branches/BR-1");
  });

  it("validates form and tracks impact fields separately for contact vs schedule", () => {
    const baseline = formFromAdminBranchDetail(null);
    const next = { ...baseline, name: "جدید", scheduleMode: "custom" as const };
    expect(validateAdminBranchForm(next)).toEqual({});
    const fields = branchFormImpactFields(next, baseline);
    expect(fields).toContain("name");
    expect(fields).toContain("scheduleMode");
    expect(fields).not.toContain("phone");
  });

  it("adapts lifecycle impact preview", () => {
    const preview = adaptAdminBranchImpactPreview(
      {
        title: "غیرفعال‌سازی",
        summary: "۲ نوبت آینده",
        futureAppointmentCount: 2,
        requiresConfirmation: true,
      },
      "deactivate",
    );
    expect(preview?.futureAppointmentCount).toBe(2);
    expect(preview?.requiresConfirmation).toBe(true);
  });
});
