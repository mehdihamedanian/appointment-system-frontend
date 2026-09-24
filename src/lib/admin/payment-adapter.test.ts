import { describe, expect, it } from "vitest";
import {
  adaptAdminPaymentDetail,
  adaptAdminPaymentList,
  adaptAdminPaymentListItem,
  adaptAdminPaymentRefundPreview,
  adaptAdminPaymentRevenueSummary,
} from "@/lib/admin/payment-adapter";
import {
  adminPaymentFiltersApplied,
  adminPaymentsHref,
  parseAdminPaymentFilters,
} from "@/lib/admin/payment-filters";

describe("admin payment adapter", () => {
  it("maps list items with customer and admin links", () => {
    const item = adaptAdminPaymentListItem({
      publicReference: "PAY-1",
      status: "paid",
      amountLabel: "۱۰۰٬۰۰۰ تومان",
      transactionReference: "TX-1",
      customer: { reference: "C-1", displayName: "سارا" },
      appointment: { reference: "APT-1", serviceName: "ویزیت" },
      allowedActions: { issueRefund: true },
    });
    expect(item?.publicReference).toBe("PAY-1");
    expect(item?.customer?.href).toContain("/admin/customers/C-1");
    expect(item?.appointment?.href).toContain("/admin/appointments/APT-1");
    expect(item?.canIssueRefund).toBe(true);
    expect(item?.detailHref).toContain("/admin/payments/PAY-1");
  });

  it("never treats unknown payment status as paid", () => {
    const item = adaptAdminPaymentListItem({
      publicReference: "PAY-2",
      status: "mystery",
      amountLabel: "۵۰٬۰۰۰ تومان",
    });
    expect(item?.status).toBe("unknown");
    expect(item?.status).not.toBe("paid");
  });

  it("adapts revenue summary only from backend labels", () => {
    const available = adaptAdminPaymentRevenueSummary({
      collectedLabel: "۱٬۰۰۰٬۰۰۰ تومان",
      netRevenueLabel: "۹۰۰٬۰۰۰ تومان",
    });
    expect(available.state).toBe("available");
    expect(available.collectedLabel).toBe("۱٬۰۰۰٬۰۰۰ تومان");

    const unavailable = adaptAdminPaymentRevenueSummary({});
    expect(unavailable.state).toBe("unavailable");
  });

  it("requires max refundable label for refund preview", () => {
    expect(adaptAdminPaymentRefundPreview({ title: "x" })).toBeNull();
    expect(
      adaptAdminPaymentRefundPreview({
        maxRefundableLabel: "۵۰٬۰۰۰ تومان",
        allowsPartial: true,
        requiresReason: true,
      })?.allowsPartial,
    ).toBe(true);
  });

  it("adapts detail with timeline and internal notes", () => {
    const detail = adaptAdminPaymentDetail({
      publicReference: "PAY-3",
      status: "paid",
      amountLabel: "۲۰۰٬۰۰۰ تومان",
      timeline: [{ id: "t1", label: "ثبت شد", status: "paid" }],
      internalNotes: [{ id: "n1", body: "یادداشت داخلی" }],
      allowedActions: { downloadReceipt: true },
    });
    expect(detail?.timeline).toHaveLength(1);
    expect(detail?.internalNotes[0]?.body).toBe("یادداشت داخلی");
    expect(detail?.canDownloadReceipt).toBe(true);
  });

  it("distinguishes empty history from filtered no-results", () => {
    const empty = adaptAdminPaymentList(
      { items: [] },
      {
        status: "all",
        refundStatus: "all",
        method: "all",
        sort: "createdAt",
        direction: "desc",
        page: 1,
      },
    );
    expect(empty.emptyHistory).toBe(true);

    const filtered = adaptAdminPaymentList(
      { items: [], totalCount: 0 },
      {
        status: "paid",
        refundStatus: "all",
        method: "all",
        sort: "createdAt",
        direction: "desc",
        page: 1,
        q: "PAY",
      },
    );
    expect(filtered.filtersApplied).toBe(true);
    expect(filtered.emptyHistory).toBe(false);
  });
});

describe("admin payment filters", () => {
  it("parses URL params and builds href", () => {
    const filters = parseAdminPaymentFilters({
      get: (name) =>
        ({
          q: " PAY-1 ",
          status: "paid",
          refundStatus: "pending",
          method: "cash",
          customer: "C-1",
          page: "2",
          sort: "paidAt",
          direction: "asc",
        })[name] ?? null,
    });
    expect(filters.q).toBe("PAY-1");
    expect(filters.refundStatus).toBe("pending");
    expect(filters.customerId).toBe("C-1");
    expect(adminPaymentFiltersApplied(filters)).toBe(true);
    expect(adminPaymentsHref(filters)).toContain("refundStatus=pending");
    expect(adminPaymentsHref(filters)).toContain("customer=C-1");
  });
});
