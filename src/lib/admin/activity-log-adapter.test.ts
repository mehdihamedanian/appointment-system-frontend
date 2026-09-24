import { describe, expect, it } from "vitest";
import {
  adaptAdminActivityLogDetail,
  adaptAdminActivityLogList,
  adaptActivityLogFieldChanges,
  deriveActivityLogFieldChanges,
  isSensitiveActivityLogFieldKey,
  mapActivityLogActionLabel,
  maskSensitiveActivityLogValue,
  resolveActivityLogEntityLink,
} from "@/lib/admin/activity-log-adapter";
import {
  activityLogPermission,
  adminActivityLogFiltersApplied,
  adminActivityLogsHref,
  countActiveAdminActivityLogFilters,
  defaultAdminActivityLogFilters,
  filtersToAdminActivityLogParams,
  parseAdminActivityLogFilters,
  PHASE42_EXPECTED_PERMISSION_KEYS,
  sanitizeActivityLogSearch,
} from "@/lib/admin/activity-log-filters";
import { routes } from "@/constants/routes";

describe("activity log filters", () => {
  it("parses and serializes URL filters", () => {
    const search = new URLSearchParams(
      "q=refund&action=payment.refund_requested&entityType=payment&result=success&from=2026-01-01&to=2026-01-31&page=2&actor=USR-1&branchId=BR-1&sort=actor&direction=asc",
    );
    const filters = parseAdminActivityLogFilters(search);
    expect(filters.q).toBe("refund");
    expect(filters.action).toBe("payment.refund_requested");
    expect(filters.entityType).toBe("payment");
    expect(filters.result).toBe("success");
    expect(filters.actorReference).toBe("USR-1");
    expect(filters.branchId).toBe("BR-1");
    expect(filters.page).toBe(2);
    expect(filters.sort).toBe("actor");
    expect(filters.direction).toBe("asc");
    expect(adminActivityLogFiltersApplied(filters)).toBe(true);
    expect(countActiveAdminActivityLogFilters(filters)).toBeGreaterThan(3);

    const href = adminActivityLogsHref(filters);
    expect(href).toContain("/admin/activity-logs?");
    expect(href).toContain("action=payment.refund_requested");
    expect(filtersToAdminActivityLogParams(filters).actor).toBe("USR-1");
  });

  it("sanitizes search and defaults", () => {
    expect(sanitizeActivityLogSearch("  hello  ")).toBe("hello");
    expect(sanitizeActivityLogSearch("")).toBeUndefined();
    expect(defaultAdminActivityLogFilters().sort).toBe("occurredAt");
    expect(PHASE42_EXPECTED_PERMISSION_KEYS).toContain("admin.activity_logs.view_changes");
    expect(activityLogPermission("export")).toBe("admin.activity_logs.export");
  });
});

describe("activity log adapter", () => {
  it("maps known and unknown actions safely", () => {
    expect(mapActivityLogActionLabel("appointment.cancelled").known).toBe(true);
    expect(mapActivityLogActionLabel("appointment.cancelled").label).toContain("لغو");
    const unknown = mapActivityLogActionLabel("custom.weird_event");
    expect(unknown.known).toBe(false);
    expect(unknown.label).toContain("custom.weird_event");
  });

  it("resolves entity links and deleted entities", () => {
    const link = resolveActivityLogEntityLink({
      entityType: "appointment",
      entityReference: "APT-1",
    });
    expect(link.available).toBe(true);
    expect(link.href).toBe(routes.admin.appointmentDetail("APT-1"));

    const deleted = resolveActivityLogEntityLink({
      entityType: "customer",
      entityReference: "CUS-1",
      entityAvailable: false,
      unavailableReason: "حذف شده",
    });
    expect(deleted.available).toBe(false);
    expect(deleted.href).toBeUndefined();
    expect(deleted.unavailableReason).toBe("حذف شده");

    const settings = resolveActivityLogEntityLink({
      entityType: "settings",
      entityReference: "booking",
      settingsSection: "booking",
    });
    expect(settings.href).toBe(routes.admin.settingsBooking);
  });

  it("masks sensitive fields and formats changes", () => {
    expect(isSensitiveActivityLogFieldKey("password")).toBe(true);
    expect(isSensitiveActivityLogFieldKey("accessToken")).toBe(true);
    expect(maskSensitiveActivityLogValue("otp", "123456").display).toBe("••••••••");

    const changes = adaptActivityLogFieldChanges([
      {
        fieldKey: "status",
        fieldLabel: "وضعیت",
        kind: "changed",
        previous: "active",
        next: "inactive",
      },
      {
        fieldKey: "password",
        kind: "changed",
        previous: "secret",
        next: "secret2",
      },
    ]);
    expect(changes[0]?.kindLabel).toBe("تغییر یافته");
    expect(changes[1]?.hidden).toBe(true);
    expect(changes[1]?.nextDisplay).toBe("••••••••");

    const derived = deriveActivityLogFieldChanges(
      { name: "A", token: "x" },
      { name: "B", token: "y" },
      { canViewPrivate: false },
    );
    expect(derived.some((item) => item.fieldKey === "name" && item.kind === "changed")).toBe(
      true,
    );
    expect(derived.find((item) => item.fieldKey === "token")?.hidden).toBe(true);
  });

  it("adapts list and detail DTOs", () => {
    const list = adaptAdminActivityLogList(
      {
        items: [
          {
            reference: "LOG-1",
            actorLabel: "مدیر",
            actionCode: "staff.updated",
            entityType: "staff",
            entityReference: "STF-1",
            summary: "به‌روزرسانی پرسنل",
            occurredAt: "2026-08-01T10:00:00.000Z",
            result: "success",
          },
        ],
        totalCount: 1,
        emptyHistory: false,
        capabilities: { supportsExport: false },
      },
      defaultAdminActivityLogFilters(),
    );
    expect(list.items).toHaveLength(1);
    expect(list.items[0]?.actionLabel).toContain("پرسنل");
    expect(list.items[0]?.detailHref).toBe(routes.admin.activityLogDetail("LOG-1"));

    const detail = adaptAdminActivityLogDetail({
      reference: "LOG-1",
      actorLabel: "مدیر",
      actionCode: "weird.unknown",
      entityType: "staff",
      entityReference: "STF-GONE",
      entityAvailable: false,
      entityUnavailableReason: "حذف شده",
      summary: "حذف",
      occurredAt: "2026-08-01T10:00:00.000Z",
      result: "success",
      changes: [
        { fieldKey: "title", kind: "removed", previous: "دکتر", next: null },
      ],
      allowedActions: { view: true, viewDetail: true, viewChanges: true },
    });
    expect(detail?.actionLabel).toContain("weird.unknown");
    expect(detail?.entityUnavailable).toBe(true);
    expect(detail?.entityLink?.available).toBe(false);
    expect(detail?.changes[0]?.kind).toBe("removed");
  });
});
