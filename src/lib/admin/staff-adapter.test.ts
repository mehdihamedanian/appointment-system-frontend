import { describe, expect, it } from "vitest";
import {
  adaptAdminStaffDetail,
  adaptAdminStaffList,
  adaptAdminStaffPerformance,
  isDuplicateStaffError,
  isInternalStaffForCustomerUI,
} from "@/lib/admin/staff-adapter";

describe("admin staff adapter", () => {
  it("adapts list with visibility and bookability as separate flags", () => {
    const view = adaptAdminStaffList(
      {
        items: [
          {
            id: "st_1",
            reference: "ST-1",
            name: "دکتر الف",
            jobTitle: "پزشک",
            specialty: "عمومی",
            active: true,
            customerVisible: false,
            bookable: true,
            branches: [{ id: "br_1", name: "مرکزی", primary: true }],
            services: [{ id: "svc_1", name: "ویزیت" }],
            schedule: { mode: "inherit_branch", summary: "۹–۱۸" },
          },
        ],
        pageCount: 1,
      },
      1,
    );
    expect(view.items[0]?.customerVisible).toBe(false);
    expect(view.items[0]?.bookable).toBe(true);
    expect(view.items[0]?.jobTitle).toBe("پزشک");
    expect(view.items[0]?.specialty).toBe("عمومی");
  });

  it("masks private contact when permission denied", () => {
    const detail = adaptAdminStaffDetail({
      id: "st_1",
      reference: "ST-1",
      name: "سارا",
      status: "active",
      contact: { phone: "09121234567", email: "sara@clinic.example" },
      allowedActions: { viewPrivateContact: false },
    });
    expect(detail?.privateContact?.masked).toBe(true);
    expect(detail?.privateContact?.phone).toContain("•");
  });

  it("shows private contact when permitted", () => {
    const detail = adaptAdminStaffDetail({
      id: "st_1",
      reference: "ST-1",
      name: "سارا",
      status: "active",
      contact: { phone: "09121234567" },
      allowedActions: { viewPrivateContact: true },
    });
    expect(detail?.privateContact?.phone).toBe("09121234567");
    expect(detail?.privateContact?.masked).toBe(false);
  });

  it("links resource reference without duplicating staff record", () => {
    const detail = adaptAdminStaffDetail({
      id: "st_1",
      reference: "ST-1",
      name: "علی",
      resourceReference: "res_st_1",
      status: "active",
    });
    expect(detail?.resourceHref).toBe("/admin/resources/res_st_1");
  });

  it("treats non-customer-visible staff as internal for customer UI", () => {
    expect(isInternalStaffForCustomerUI({ customerVisible: false, bookable: true })).toBe(true);
    expect(isInternalStaffForCustomerUI({ customerVisible: true })).toBe(false);
  });

  it("adapts backend performance metrics without calculating", () => {
    const perf = adaptAdminStaffPerformance({
      reference: "ST-1",
      appointmentCount: 12,
      completedCount: 10,
      utilizationLabel: "۷۵٪",
      metrics: [{ label: "میانگین", value: "۴۵ دقیقه" }],
    });
    expect(perf?.appointmentCount).toBe(12);
    expect(perf?.metrics).toHaveLength(1);
  });

  it("detects duplicate staff errors", () => {
    expect(isDuplicateStaffError({ status: 409, code: "STAFF_DUPLICATE" })).toBe(true);
  });
});
