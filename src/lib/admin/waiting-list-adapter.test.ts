import { describe, expect, it } from "vitest";
import { isAdminWaitingListEnabled } from "@/lib/admin/waiting-list-context";
import {
  adaptAdminWaitingListDetail,
  adaptAdminWaitingListDuplicateCheck,
  adaptAdminWaitingListImpactPreview,
  adaptAdminWaitingListList,
  adaptAdminWaitingListListItem,
  adaptAdminWaitingListOfferEligibility,
  adaptAdminWaitingListOfferPreview,
  adaptAdminWaitingListOfferSendResult,
  adminWaitingListConflictMessage,
  isAdminWaitingListConflict,
  isDuplicateWaitingListEntryError,
  isSlotTakenWaitingListError,
  sanitizeAdminWaitingListManualEntryBody,
  validateAdminWaitingListManualEntry,
} from "@/lib/admin/waiting-list-adapter";
import {
  adminWaitingListFiltersApplied,
  adminWaitingListHref,
  parseAdminWaitingListFilters,
  waitingListPermission,
} from "@/lib/admin/waiting-list-filters";
import type { AdminWaitingListListFilters, AdminWaitingListManualEntryInput } from "@/types/admin-waiting-list";

const baseFilters: AdminWaitingListListFilters = {
  entryStatus: "all",
  offerStatus: "all",
  sort: "createdAt",
  direction: "desc",
  page: 1,
};

const manualBase: AdminWaitingListManualEntryInput = {
  customerReference: "cust_1",
  serviceId: "svc_1",
  providerPreference: { type: "any" },
  datePreference: { mode: "any" },
  timePreference: "any",
};

describe("admin waiting-list adapter", () => {
  it("maps list items with separate entry and offer statuses", () => {
    const item = adaptAdminWaitingListListItem({
      publicReference: "WLE-1",
      status: "offered",
      service: { id: "svc_1", name: "ویزیت" },
      customer: { reference: "cust_1", displayName: "علی رضایی" },
      activeOffer: { publicReference: "WLO-1", status: "pending" },
      allowedActions: { view: true, sendOffer: true },
      createdAt: "2026-08-22T10:00:00.000Z",
    });
    expect(item?.reference).toBe("WLE-1");
    expect(item?.entryStatus).toBe("offered");
    expect(item?.offerStatus).toBe("pending");
    expect(item?.detailHref).toContain("/admin/waiting-list/WLE-1");
    expect(item?.offerHref).toContain("/offer");
    expect(item?.canSendOffer).toBe(true);
  });

  it("distinguishes empty history from filtered no-results", () => {
    const empty = adaptAdminWaitingListList({ items: [], totalCount: 0 }, baseFilters);
    expect(empty.emptyHistory).toBe(true);

    const filtered = adaptAdminWaitingListList(
      { items: [], totalCount: 0 },
      { ...baseFilters, q: "missing" },
    );
    expect(filtered.emptyHistory).toBe(false);
    expect(filtered.filtersApplied).toBe(true);
  });

  it("masks contact unless allowedActions.viewContact", () => {
    const masked = adaptAdminWaitingListDetail({
      publicReference: "WLE-2",
      status: "active",
      service: { id: "svc_1", name: "ویزیت" },
      customer: { reference: "cust_1", displayName: "سارا", phoneMasked: "09**" },
      contactPhone: "09120000000",
      allowedActions: { viewContact: false },
      createdAt: "2026-08-22T10:00:00.000Z",
    });
    expect(masked?.contactPhone).toBeUndefined();
    expect(masked?.customer.phoneMasked).toBe("09**");

    const visible = adaptAdminWaitingListDetail({
      publicReference: "WLE-2",
      status: "active",
      service: { id: "svc_1", name: "ویزیت" },
      customer: { reference: "cust_1", displayName: "سارا" },
      contactPhone: "09120000000",
      allowedActions: { viewContact: true },
      createdAt: "2026-08-22T10:00:00.000Z",
    });
    expect(visible?.contactPhone).toBe("09120000000");
  });

  it("adapts offer preview with backend expiration options only", () => {
    const preview = adaptAdminWaitingListOfferPreview({
      serviceName: "ویزیت",
      slotLabel: "۹:۰۰",
      expirationOptions: [
        { id: "exp_30", label: "۳۰ دقیقه", minutes: 30 },
        { id: "exp_60", label: "۱ ساعت", minutes: 60 },
      ],
      priceLabel: "۲۵۰٬۰۰۰ تومان",
      defaultExpirationId: "exp_30",
    });
    expect(preview?.expirationOptions).toHaveLength(2);
    expect(preview?.defaultExpirationId).toBe("exp_30");
    expect(preview?.priceLabel).toBe("۲۵۰٬۰۰۰ تومان");
  });

  it("adapts offer send result without inferring notification delivery", () => {
    const result = adaptAdminWaitingListOfferSendResult({
      entryReference: "WLE-1",
      offerReference: "WLO-1",
      offerStatus: "pending",
      expiresAt: "2026-08-22T12:00:00.000Z",
      serverNow: "2026-08-22T11:55:00.000Z",
    });
    expect(result?.offerStatus).toBe("pending");
    expect(result?.notification).toBeUndefined();
  });

  it("validates manual entry without creating appointments", () => {
    expect(validateAdminWaitingListManualEntry(manualBase)).toEqual({});
    expect(
      validateAdminWaitingListManualEntry({ ...manualBase, customerReference: "" }).customerReference,
    ).toBeTruthy();
    const body = sanitizeAdminWaitingListManualEntryBody(manualBase);
    expect(body.customerReference).toBe("cust_1");
    expect(body).not.toHaveProperty("appointment");
  });

  it("detects duplicate and conflict errors", () => {
    expect(isDuplicateWaitingListEntryError({ status: 409, code: "DUPLICATE_ENTRY" })).toBe(true);
    expect(isSlotTakenWaitingListError({ status: 409, code: "SLOT_TAKEN" })).toBe(true);
    expect(isAdminWaitingListConflict({ status: 409, code: "VERSION_MISMATCH" })).toBe(true);
    expect(adminWaitingListConflictMessage()).toMatch(/تغییر/);
  });

  it("adapts duplicate check with existing reference link", () => {
    const dup = adaptAdminWaitingListDuplicateCheck({
      duplicate: true,
      existingReference: "WLE-9",
      message: "قبلاً ثبت شده",
    });
    expect(dup.duplicate).toBe(true);
    expect(dup.existingHref).toContain("WLE-9");
  });

  it("adapts impact preview with reason requirement", () => {
    const preview = adaptAdminWaitingListImpactPreview({
      title: "لغو",
      summary: "پیشنهاد فعال لغو می‌شود.",
      requiresReason: true,
      reasonOptions: [{ id: "customer_request", label: "درخواست مشتری" }],
      activeOfferAffected: true,
    });
    expect(preview?.requiresReason).toBe(true);
    expect(preview?.reasonOptions).toHaveLength(1);
    expect(preview?.activeOfferAffected).toBe(true);
  });

  it("does not invent offer eligibility", () => {
    expect(adaptAdminWaitingListOfferEligibility({ eligible: true }).eligible).toBe(true);
    expect(adaptAdminWaitingListOfferEligibility({}).eligible).toBe(false);
  });
});

describe("admin waiting-list filters", () => {
  it("parses and serializes URL filters", () => {
    const filters = parseAdminWaitingListFilters(
      new URLSearchParams("q=ali&entryStatus=active&offerStatus=pending&page=2&sort=service"),
    );
    expect(filters.q).toBe("ali");
    expect(filters.entryStatus).toBe("active");
    expect(filters.offerStatus).toBe("pending");
    expect(filters.page).toBe(2);
    expect(filters.sort).toBe("service");
    expect(adminWaitingListHref(filters)).toContain("entryStatus=active");
    expect(adminWaitingListFiltersApplied(filters)).toBe(true);
  });

  it("sanitizes invalid filter values", () => {
    const filters = parseAdminWaitingListFilters(
      new URLSearchParams("entryStatus=weird&page=-1&serviceId=123"),
    );
    expect(filters.entryStatus).toBe("all");
    expect(filters.page).toBe(1);
    expect(filters.serviceId).toBeUndefined();
  });
});

describe("admin waiting-list gating", () => {
  it("maps permission codes", () => {
    expect(waitingListPermission("view")).toBe("admin.waiting_list.view");
    expect(waitingListPermission("offer")).toBe("admin.waiting_list.offer");
    expect(waitingListPermission("lifecycle")).toBe("admin.waiting_list.lifecycle");
  });

  it("respects capability flag for module enablement", () => {
    expect(isAdminWaitingListEnabled({ waitingListEnabled: true })).toBe(true);
    expect(isAdminWaitingListEnabled({ waitingListEnabled: false })).toBe(false);
  });
});
