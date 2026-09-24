import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminCouponsScreen } from "@/features/admin/coupons/admin-coupon-screen";
import { AdminCouponDetailScreen } from "@/features/admin/coupons/admin-coupon-detail-screen";
import { PaymentScreen } from "@/features/booking/payment-screen";
import { authenticatedAdmin, createSessionValue, renderWithProviders } from "@/test/render";
import { BOOKING_DRAFT_STORAGE_KEY } from "@/lib/booking/persistence";
import { HOLD_SESSION_KEY } from "@/lib/booking/hold-session";

/** E2E: Admin creates coupon → customer applies coupon → quote display → revalidation */

const replaceMock = vi.fn();
const pushMock = vi.fn();
let params = { couponReference: "CPN-1" };

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/coupons",
  useRouter: () => ({ replace: replaceMock, push: pushMock }),
  useSearchParams: () => new URLSearchParams(),
  useParams: () => params,
}));

vi.mock("@/lib/api/client", () => ({
  apiClient: vi.fn(),
}));

import { apiClient } from "@/lib/api/client";

const mockedClient = vi.mocked(apiClient);

function persistBookingDraft() {
  window.sessionStorage.setItem(
    BOOKING_DRAFT_STORAGE_KEY,
    JSON.stringify({
      version: 1,
      expiresAt: "2099-01-01T00:00:00.000Z",
      currentStep: "checkout",
      serviceId: "svc_1",
      branchId: null,
      providerPreference: { type: "not_applicable" },
      date: "2026-08-22",
      slotId: "slot_1",
    }),
  );
  window.sessionStorage.setItem(
    HOLD_SESSION_KEY,
    JSON.stringify({ version: 1, publicReference: "hold_1" }),
  );
}

function mockBusiness(enabled: boolean) {
  return { name: "Test Business", couponsEnabled: enabled, currency: "IRR", bookingEnabled: true };
}

function mockPaymentApis(options?: {
  couponsEnabled?: boolean;
  onQuote?: (couponCode?: string) => unknown;
}) {
  mockedClient.mockImplementation(async (path: string, init?: { method?: string; body?: unknown }) => {
    const url = String(path);
    if (url === "/public/business") {
      return mockBusiness(options?.couponsEnabled ?? true);
    }
    if (url === "/public/booking/quote") {
      const couponCode =
        init?.body && typeof init.body === "object"
          ? (init.body as { couponCode?: string }).couponCode
          : undefined;
      if (options?.onQuote) return options.onQuote(couponCode);
      return {
        id: "q1",
        paymentMode: "full",
        checkoutPath: "pay_full",
        priceLabel: "۲۵۰٬۰۰۰ تومان",
        finalAmountLabel: couponCode ? "۲۲۵٬۰۰۰ تومان" : "۲۵۰٬۰۰۰ تومان",
        payableNowLabel: couponCode ? "۲۲۵٬۰۰۰ تومان" : "۲۵۰٬۰۰۰ تومان",
        discountLabel: couponCode ? "۲۵٬۰۰۰ تومان" : undefined,
        coupon: couponCode
          ? { code: couponCode, status: "applied", message: "کد اعمال شد" }
          : undefined,
        paymentOptions: [{ type: "online", label: "آنلاین", payableNowLabel: "۲۵۰٬۰۰۰ تومان" }],
      };
    }
    if (url.startsWith("/customer/bookings/holds/")) {
      return {
        id: "hold_1",
        status: "active",
        expiresAt: "2099-01-01T00:00:00.000Z",
        serverNow: "2026-08-22T10:00:00.000Z",
        slot: { id: "slot_1", startsAt: "2026-08-22T09:00:00+03:30" },
      };
    }
    return {};
  });
}

describe("Phase 36 admin coupons E2E flow", () => {
  beforeEach(() => {
    mockedClient.mockReset();
    replaceMock.mockReset();
    pushMock.mockReset();
    params = { couponReference: "CPN-1" };
    window.sessionStorage.clear();
  });

  it("walks list → detail → lifecycle preview → confirmation", async () => {
    const user = userEvent.setup();
    const session = createSessionValue({ status: "authenticated", user: authenticatedAdmin });
    let detailFetchCount = 0;

    mockedClient.mockImplementation(async (path: string, init?: { method?: string }) => {
      const url = String(path);
      const method = init?.method ?? "GET";
      if (url === "/public/business") {
        return mockBusiness(true);
      }
      if (method === "GET" && url.includes("/admin/coupons") && !url.includes("/admin/coupons/")) {
        return {
          items: [
            {
              reference: "CPN-1",
              code: "SAVE10",
              title: "ده درصد",
              discountType: "percentage",
              discountValueLabel: "۱۰٪",
              status: "active",
              allowedActions: { edit: true, pause: true },
            },
          ],
          totalCount: 1,
          pageCount: 1,
        };
      }
      if (url.includes("/impact-preview") && method === "POST") {
        return {
          title: "توقف کوپن",
          summary: "کوپن برای رزروهای جدید غیرفعال می‌شود.",
          effects: ["رزروهای موجود بدون تغییر می‌مانند."],
          existingBookingsUnchanged: true,
          requiresConfirmation: true,
        };
      }
      if (url.includes("/pause") && method === "POST") {
        return { reference: "CPN-1", version: "v2" };
      }
      if (url.includes("/admin/coupons/CPN-1")) {
        detailFetchCount += 1;
        return {
          reference: "CPN-1",
          code: "SAVE10",
          title: "ده درصد",
          discountType: "percentage",
          discountValueLabel: "۱۰٪",
          status: detailFetchCount > 1 ? "paused" : "active",
          allowedActions: { pause: detailFetchCount === 1, activate: detailFetchCount > 1 },
          stats: { confirmedUsage: 2, totalUsageLimit: 50 },
        };
      }
      return {};
    });

    const listView = renderWithProviders(<AdminCouponsScreen />, { session });
    expect((await screen.findAllByText("ده درصد")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("SAVE10").length).toBeGreaterThan(0);
    listView.unmount();

    params = { couponReference: "CPN-1" };
    renderWithProviders(<AdminCouponDetailScreen />, { session });
    expect((await screen.findAllByText("SAVE10")).length).toBeGreaterThan(0);

    await user.click(await screen.findByRole("button", { name: "توقف" }));
    expect(await screen.findByText(/توقف کوپن/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /تأیید/i }));
    await waitFor(() => expect(detailFetchCount).toBeGreaterThan(1));
  });

  it("customer applies coupon and quote displays backend breakdown", async () => {
    const user = userEvent.setup();
    persistBookingDraft();
    let quoteCalls = 0;

    mockPaymentApis({
      onQuote: (couponCode) => {
        quoteCalls += 1;
        return {
          id: "q1",
          paymentMode: "full",
          checkoutPath: "pay_full",
          priceLabel: "۲۵۰٬۰۰۰ تومان",
          finalAmountLabel: couponCode ? "۲۲۵٬۰۰۰ تومان" : "۲۵۰٬۰۰۰ تومان",
          payableNowLabel: couponCode ? "۲۲۵٬۰۰۰ تومان" : "۲۵۰٬۰۰۰ تومان",
          discountLabel: couponCode ? "۲۵٬۰۰۰ تومان" : undefined,
          coupon: couponCode
            ? { code: couponCode, status: "applied", message: "کد اعمال شد" }
            : undefined,
          paymentOptions: [{ type: "full", label: "پرداخت کامل", payableNowLabel: "۲۵۰٬۰۰۰ تومان" }],
        };
      },
    });

    renderWithProviders(<PaymentScreen />);
    expect(await screen.findByRole("heading", { name: "پرداخت کامل" })).toBeInTheDocument();

    await user.type(screen.getByLabelText(/کد تخفیف/i), "SAVE10");
    await user.click(screen.getByRole("button", { name: "اعمال کد" }));

    await waitFor(() => expect(quoteCalls).toBeGreaterThan(1));
    expect(screen.getAllByText("۲۲۵٬۰۰۰ تومان").length).toBeGreaterThan(0);
  });

  it("hides coupon field when feature disabled", async () => {
    persistBookingDraft();
    mockPaymentApis({ couponsEnabled: false });

    renderWithProviders(<PaymentScreen />);
    await screen.findByRole("heading", { name: "پرداخت کامل" });
    expect(screen.queryByLabelText(/کد تخفیف/i)).not.toBeInTheDocument();
  });
});
