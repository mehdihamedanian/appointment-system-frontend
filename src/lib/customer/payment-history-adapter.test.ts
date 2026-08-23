import { describe, expect, it } from "vitest";
import {
  adaptPaymentHistoryDetail,
  adaptPaymentHistoryItem,
  adaptPaymentHistoryList,
  adaptPaymentReceiptUrl,
} from "@/lib/customer/payment-history-adapter";
import {
  parsePaymentHistoryFilters,
  paymentsHref,
} from "@/lib/customer/payment-history-filters";

describe("payment history adapter", () => {
  it("maps known payment statuses and never treats unknown as paid", () => {
    const paid = adaptPaymentHistoryItem({
      id: "pay_1",
      publicReference: "pay_1",
      status: "paid",
      amountLabel: "۲۵۰٬۰۰۰ تومان",
      paidAt: "2026-08-22T10:00:00.000Z",
    });
    expect(paid?.status).toBe("paid");

    const weird = adaptPaymentHistoryItem({
      id: "pay_2",
      publicReference: "pay_2",
      status: "settled_mystery",
      amount: 1000,
      currency: "IRR",
    });
    expect(weird?.status).toBe("unknown");
    expect(weird?.status).not.toBe("paid");
  });

  it("maps refund and receipt fields without inventing amounts", () => {
    const item = adaptPaymentHistoryItem({
      publicReference: "pay_3",
      status: "partially_refunded",
      amountLabel: "۱۰۰٬۰۰۰ تومان",
      refundStatus: "partially_refunded",
      refundAmountLabel: "۴۰٬۰۰۰ تومان",
      receiptUrl: "https://receipts.example/pay_3",
      appointmentId: "apt_1",
      appointmentAvailable: true,
      serviceName: "ویزیت",
    });
    expect(item?.refundStatus).toBe("partiallyRefunded");
    expect(item?.refundAmountLabel).toBe("۴۰٬۰۰۰ تومان");
    expect(item?.receiptUrl).toBe("https://receipts.example/pay_3");
    expect(item?.appointmentAvailable).toBe(true);
  });

  it("distinguishes empty history from filtered no-results", () => {
    const empty = adaptPaymentHistoryList({ items: [] }, { status: "all", page: 1 });
    expect(empty.emptyHistory).toBe(true);
    expect(empty.filtersApplied).toBe(false);

    const filtered = adaptPaymentHistoryList(
      { items: [], totalCount: 0 },
      { status: "paid", page: 1, q: "pay" },
    );
    expect(filtered.filtersApplied).toBe(true);
    expect(filtered.emptyHistory).toBe(false);
  });

  it("adapts detail and receipt url payloads", () => {
    const detail = adaptPaymentHistoryDetail({
      publicReference: "pay_9",
      status: "pending",
      payableNowLabel: "۱۰٬۰۰۰ تومان",
      gatewayName: "نمونه",
    });
    expect(detail?.status).toBe("pendingPayment");
    expect(detail?.gatewayName).toBe("نمونه");
    expect(adaptPaymentReceiptUrl({ url: "https://files.example/r.pdf" })).toBe(
      "https://files.example/r.pdf",
    );
  });
});

describe("payment history filters", () => {
  it("normalizes URL params and builds href", () => {
    const filters = parsePaymentHistoryFilters({
      get: (name) =>
        ({
          status: "PAID",
          page: "2",
          q: "  pay_1  ",
          appointment: "apt_1",
          from: "2026-01-01",
          to: "bad",
        })[name] ?? null,
    });
    expect(filters).toEqual({
      status: "paid",
      page: 2,
      q: "pay_1",
      appointmentId: "apt_1",
      from: "2026-01-01",
    });
    expect(paymentsHref(filters)).toContain("status=paid");
    expect(paymentsHref(filters)).toContain("page=2");
    expect(paymentsHref(filters)).toContain("appointment=apt_1");
  });
});
