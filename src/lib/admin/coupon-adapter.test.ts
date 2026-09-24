import { describe, expect, it } from "vitest";
import { isAdminCouponsEnabled } from "@/lib/admin/coupon-context";
import {
  adaptAdminCouponDetail,
  adaptAdminCouponImpactPreview,
  adaptAdminCouponList,
  adaptAdminCouponListItem,
  adaptAdminCouponLifecycle,
  isAdminCouponConflict,
  isDuplicateCouponError,
  sanitizeAdminCouponBody,
  validateAdminCouponForm,
} from "@/lib/admin/coupon-adapter";
import {
  adminCouponFiltersApplied,
  adminCouponsHref,
  parseAdminCouponFilters,
} from "@/lib/admin/coupon-filters";
import type { AdminCouponFormInput, AdminCouponListFilters } from "@/types/admin-coupon";

const baseFilters: AdminCouponListFilters = {
  status: "all",
  discountType: "all",
  validity: "all",
  sort: "updatedAt",
  direction: "desc",
  page: 1,
};

describe("admin coupon adapter", () => {
  it("maps list items with admin links and lifecycle", () => {
    const item = adaptAdminCouponListItem({
      reference: "CPN-1",
      code: "SUMMER20",
      title: "تابستان",
      discountType: "percentage",
      discountValueLabel: "۲۰٪",
      status: "active",
      allowedActions: { edit: true, pause: true },
    });
    expect(item?.reference).toBe("CPN-1");
    expect(item?.code).toBe("SUMMER20");
    expect(item?.lifecycle).toBe("active");
    expect(item?.detailHref).toContain("/admin/coupons/CPN-1");
    expect(item?.canEdit).toBe(true);
    expect(item?.canPause).toBe(true);
  });

  it("never infers lifecycle solely from client-side dates", () => {
    expect(adaptAdminCouponLifecycle("active")).toBe("active");
    expect(adaptAdminCouponLifecycle("exhausted")).toBe("exhausted");
    expect(adaptAdminCouponLifecycle("mystery")).toBe("unknown");
  });

  it("distinguishes empty history from filtered no-results", () => {
    const empty = adaptAdminCouponList({ items: [], totalCount: 0 }, baseFilters);
    expect(empty.emptyHistory).toBe(true);

    const filtered = adaptAdminCouponList(
      { items: [], totalCount: 0 },
      { ...baseFilters, q: "missing" },
    );
    expect(filtered.emptyHistory).toBe(false);
    expect(filtered.filtersApplied).toBe(true);
  });

  it("adapts detail with stats and restrictions from backend", () => {
    const detail = adaptAdminCouponDetail({
      reference: "CPN-2",
      code: "FIXED50",
      title: "۵۰ هزار",
      discountType: "fixed",
      discountValueLabel: "۵۰٬۰۰۰ تومان",
      status: "paused",
      stats: { confirmedUsage: 3, totalUsageLimit: 10, totalDiscountedLabel: "۱۵۰٬۰۰۰ تومان" },
      restrictions: { serviceScope: "include", serviceLabels: ["ویزیت"] },
      serverStatusLabel: "متوقف توسط سرویس",
    });
    expect(detail?.lifecycle).toBe("paused");
    expect(detail?.stats.confirmedUsage).toBe(3);
    expect(detail?.stats.totalDiscountedLabel).toBe("۱۵۰٬۰۰۰ تومان");
    expect(detail?.serverStatusLabel).toBe("متوقف توسط سرویس");
    expect(detail?.restrictions.serviceLabels).toContain("ویزیت");
  });

  it("validates form end-after-start and service selection", () => {
    const input: AdminCouponFormInput = {
      code: "X",
      title: "Test",
      discountType: "percentage",
      discountValue: "10",
      startsAt: "2026-08-01",
      startsTime: "10:00",
      endsAt: "2026-07-01",
      endsTime: "10:00",
      serviceScope: "include",
      serviceIds: [],
      branchIds: [],
      draft: false,
    };
    const errors = validateAdminCouponForm(input);
    expect(errors.endsAt).toBeTruthy();
    expect(errors.serviceIds).toBeTruthy();
  });

  it("serializes money fields as trimmed strings without client-side math", () => {
    const body = sanitizeAdminCouponBody({
      code: " SAVE10 ",
      title: "Save",
      discountType: "fixed",
      discountValue: "50000",
      maximumDiscount: "100000",
      minimumAmount: "200000",
      startsAt: "2026-08-01",
      startsTime: "09:00",
      endsAt: "2026-12-31",
      endsTime: "23:59",
      totalUsageLimit: "100",
      perCustomerLimit: "1",
      serviceScope: "all",
      serviceIds: [],
      branchIds: [],
      draft: true,
    });
    expect(body.code).toBe("SAVE10");
    expect(body.discountValue).toBe("50000");
    expect(body.draft).toBe(true);
  });

  it("detects duplicate and conflict errors", () => {
    expect(isDuplicateCouponError({ status: 409, code: "COUPON_CODE_EXISTS" })).toBe(true);
    expect(isAdminCouponConflict({ status: 409, code: "VERSION_CONFLICT" })).toBe(true);
  });

  it("requires impact preview confirmation fields", () => {
    expect(adaptAdminCouponImpactPreview({ title: "Pause" })?.requiresConfirmation).toBe(true);
    expect(
      adaptAdminCouponImpactPreview({
        title: "Pause",
        effects: ["کوپن برای رزروهای جدید غیرفعال می‌شود"],
        existingBookingsUnchanged: true,
      })?.existingBookingsUnchanged,
    ).toBe(true);
  });
});

describe("admin coupon feature gate", () => {
  it("requires module flag, capability, and business flag", () => {
    expect(isAdminCouponsEnabled({ couponsEnabled: true })).toBe(true);
    expect(isAdminCouponsEnabled({ couponsEnabled: false })).toBe(false);
    expect(isAdminCouponsEnabled(undefined)).toBe(true);
  });
});

describe("admin coupon filters", () => {
  it("parses URL filters and builds href", () => {
    const filters = parseAdminCouponFilters(
      new URLSearchParams("q=summer&status=active&page=2&sort=code&direction=asc"),
    );
    expect(filters.q).toBe("summer");
    expect(filters.status).toBe("active");
    expect(filters.page).toBe(2);
    expect(filters.sort).toBe("code");
    expect(adminCouponsHref(filters)).toContain("q=summer");
    expect(adminCouponFiltersApplied(filters)).toBe(true);
  });
});
