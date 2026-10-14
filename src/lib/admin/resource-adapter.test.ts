import { describe, expect, it } from "vitest";
import {
  adaptAdminResourceDetail,
  adaptAdminResourceImpactPreview,
  adaptAdminResourceList,
  adaptAdminResourceType,
  adaptAdminResourceTypeOptions,
  isDuplicateResourceError,
  isInternalOperationalResourceType,
} from "@/lib/admin/resource-adapter";

describe("admin resource adapter", () => {
  it("reads Backend ResourceListItem and ResourceRead fields", () => {
    const list = adaptAdminResourceList(
      {
        success: true,
        data: {
          items: [
            {
              id: "9f1d3c2a-0000-4000-8000-0000000000aa",
              resource_type_code: "device",
              resource_type_display_name: "Device",
              name: "لیزر",
              is_active: false,
              capacity: 2,
              branch_count: 0,
            },
          ],
          meta: { page: 1, page_size: 20, total: 1 },
        },
      },
      1,
    );
    expect(list.items[0]?.type).toBe("device");
    expect(list.items[0]?.lifecycle).toBe("inactive");
    expect(list.items[0]?.capacity?.value).toBe(2);

    const detail = adaptAdminResourceDetail({
      success: true,
      data: {
        id: "9f1d3c2a-0000-4000-8000-0000000000aa",
        resource_type: { id: "rt", code: "kiosk", display_name: "Kiosk", is_system: false },
        name: "کیوسک",
        is_active: true,
        capacity: 1,
        branches: [{ id: "9f1d3c2a-0000-4000-8000-0000000000dd", name: "مرکزی", is_active: true }],
      },
    });
    expect(detail?.type).toBe("unknown");
    expect(detail?.typeLabel).toBe("Kiosk");
    expect(detail?.lifecycle).toBe("active");
    expect(detail?.branch?.name).toBe("مرکزی");
  });

  it("adapts GET /resources/types and flags human types", () => {
    const options = adaptAdminResourceTypeOptions({
      success: true,
      data: [
        { id: "9f1d3c2a-0000-4000-8000-000000000001", code: "staff", display_name: "Staff" },
        { id: "9f1d3c2a-0000-4000-8000-000000000002", code: "specialist", display_name: "Specialist" },
        { id: "9f1d3c2a-0000-4000-8000-000000000003", code: "room", display_name: "Room" },
        { id: "9f1d3c2a-0000-4000-8000-000000000004", code: "kiosk", display_name: "Kiosk" },
        { code: "desk", display_name: "Desk" },
      ],
    });
    expect(options.map((option) => [option.code, option.label, option.human])).toEqual([
      ["staff", "کارمند", true],
      ["specialist", "متخصص", true],
      ["room", "اتاق", false],
      ["kiosk", "Kiosk", false],
    ]);
  });

  it("maps known and unknown resource types with neutral fallback", () => {
    expect(adaptAdminResourceType("room")).toBe("room");
    expect(adaptAdminResourceType("provider")).toBe("staff");
    expect(adaptAdminResourceType("spaceship")).toBe("unknown");
  });

  it("treats non-staff types as internal operational resources", () => {
    expect(isInternalOperationalResourceType("room")).toBe(true);
    expect(isInternalOperationalResourceType("device")).toBe(true);
    expect(isInternalOperationalResourceType("staff")).toBe(false);
  });

  it("adapts list items including schedule and capacity", () => {
    const view = adaptAdminResourceList(
      {
        items: [
          {
            id: "res_1",
            reference: "ROOM-1",
            name: "اتاق ۱",
            type: "room",
            active: true,
            capacity: { value: 2, min: 1, max: 4, semanticsLabel: "هم‌زمان" },
            schedule: { mode: "inherit_business", summary: "۹–۱۸" },
            relatedServiceCount: 3,
          },
        ],
        pageCount: 1,
        totalCount: 1,
      },
      1,
    );
    expect(view.items).toHaveLength(1);
    expect(view.items[0]?.type).toBe("room");
    expect(view.items[0]?.capacity?.value).toBe(2);
    expect(view.items[0]?.schedule?.mode).toBe("inherit_business");
    expect(view.items[0]?.relatedServiceCount).toBe(3);
  });

  it("falls back unknown type label without crashing detail", () => {
    const detail = adaptAdminResourceDetail({
      id: "res_x",
      reference: "X-1",
      name: "منبع ناشناس",
      type: "holodeck",
      status: "active",
    });
    expect(detail?.type).toBe("unknown");
    expect(detail?.typeLabel).toBe("نامشخص");
    expect(detail?.customerVisibilityAllowed).toBe(false);
  });

  it("links staff resources to staff module and never marks rooms customer-visible by default", () => {
    const staff = adaptAdminResourceDetail({
      id: "res_s",
      reference: "ST-1",
      name: "دکتر الف",
      type: "staff",
      staffReference: "st_1",
      customerVisible: true,
      canSetCustomerVisible: true,
    });
    expect(staff?.staffHref).toBe("/admin/staff/st_1");
    expect(staff?.customerVisible).toBe(true);

    const room = adaptAdminResourceDetail({
      id: "res_r",
      reference: "R-1",
      name: "اتاق",
      type: "room",
      customerVisible: true,
    });
    expect(room?.customerVisibilityAllowed).toBe(false);
  });

  it("adapts impact preview for deactivation", () => {
    const preview = adaptAdminResourceImpactPreview(
      {
        title: "غیرفعال‌سازی",
        summary: "اثر دارد",
        futureAppointmentCount: 2,
        effects: ["نوبت‌های آینده تحت تأثیر قرار می‌گیرند"],
      },
      "deactivate",
    );
    expect(preview?.futureAppointmentCount).toBe(2);
    expect(preview?.requiresConfirmation).toBe(true);
  });

  it("detects duplicate resource errors", () => {
    expect(isDuplicateResourceError({ status: 409, code: "RESOURCE_DUPLICATE" })).toBe(true);
    expect(isDuplicateResourceError({ status: 400, code: "BAD" })).toBe(false);
  });
});
