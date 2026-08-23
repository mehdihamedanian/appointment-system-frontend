import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PaymentScreen } from "@/features/booking/payment-screen";
import { PaymentResultScreen } from "@/features/booking/payment-result-screen";
import { ApiError } from "@/lib/api/errors";
import { BOOKING_DRAFT_STORAGE_KEY } from "@/lib/booking/persistence";
import { HOLD_SESSION_KEY } from "@/lib/booking/hold-session";
import { paymentNavigation } from "@/lib/api/payment";
import { renderWithProviders } from "@/test/render";

const push = vi.fn();
const replace = vi.fn();
const search = { current: new URLSearchParams() };

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
  usePathname: () => "/booking/payment",
  useSearchParams: () => search.current,
}));

vi.mock("@/lib/api/client", () => ({
  apiClient: vi.fn(),
}));

import { apiClient } from "@/lib/api/client";

const mockedClient = vi.mocked(apiClient);

function requestCoupon(options?: { body?: unknown }): string | undefined {
  if (!options?.body || typeof options.body !== "object") {
    return undefined;
  }
  const code = (options.body as { couponCode?: unknown }).couponCode;
  return typeof code === "string" ? code : undefined;
}

const quote = {
  id: "q1",
  paymentMode: "full",
  checkoutPath: "pay_full",
  payableNowLabel: "۲۵۰٬۰۰۰ تومان",
  finalAmountLabel: "۲۵۰٬۰۰۰ تومان",
  priceLabel: "۲۵۰٬۰۰۰ تومان",
};

const hold = {
  id: "hold_1",
  status: "active",
  expiresAt: "2099-01-01T00:00:00.000Z",
  serverNow: "2026-08-22T10:00:00.000Z",
  slot: { id: "slot_1", startsAt: "2026-08-22T09:00:00+03:30" },
};

function persistDraft() {
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
  window.sessionStorage.setItem(HOLD_SESSION_KEY, JSON.stringify({ version: 1, publicReference: "hold_1" }));
}

describe("PaymentScreen", () => {
  beforeEach(() => {
    mockedClient.mockReset();
    push.mockReset();
    replace.mockReset();
    search.current = new URLSearchParams();
    window.sessionStorage.clear();
    document.documentElement.dir = "rtl";
    persistDraft();
    vi.spyOn(paymentNavigation, "assign").mockImplementation(() => undefined);
  });

  it("renders a single full-payment method from the quote", async () => {
    mockedClient.mockImplementation(async (path: string) => {
      if (path === "/public/booking/quote") return quote;
      if (path.startsWith("/customer/bookings/holds/")) return hold;
      throw new ApiError({ status: 404, message: "نیست" });
    });
    renderWithProviders(<PaymentScreen />);
    expect(await screen.findByRole("heading", { name: "پرداخت کامل" })).toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.getAllByText("۲۵۰٬۰۰۰ تومان").length).toBeGreaterThan(0);
    expect(screen.queryByText(/اتاق|صندلی|دستگاه/)).not.toBeInTheDocument();
    expect(document.documentElement.dir).toBe("rtl");
  });

  it("renders deposit remaining amount from backend labels only", async () => {
    mockedClient.mockImplementation(async (path: string) => {
      if (path === "/public/booking/quote") {
        return {
          ...quote,
          paymentMode: "deposit",
          checkoutPath: "pay_deposit",
          payableNowLabel: "۱۰۰٬۰۰۰ تومان",
          payableAtLocationLabel: "۱۵۰٬۰۰۰ تومان",
          finalAmountLabel: "۲۵۰٬۰۰۰ تومان",
        };
      }
      if (path.startsWith("/customer/bookings/holds/")) return hold;
      throw new ApiError({ status: 404, message: "نیست" });
    });
    renderWithProviders(<PaymentScreen />);
    expect(await screen.findByText("پرداخت بیعانه")).toBeInTheDocument();
    expect(screen.getAllByText("۱۰۰٬۰۰۰ تومان").length).toBeGreaterThan(0);
    expect(screen.getAllByText("۱۵۰٬۰۰۰ تومان").length).toBeGreaterThan(0);
  });

  it("renders multiple methods as a radio group", async () => {
    mockedClient.mockImplementation(async (path: string) => {
      if (path === "/public/booking/quote") {
        return {
          ...quote,
          paymentMethods: [
            { type: "full", payableNow: { label: "۲۵۰٬۰۰۰ تومان" } },
            { type: "pay_at_location", payableNow: { label: "۰ تومان" }, remainingAtLocation: { label: "۲۵۰٬۰۰۰ تومان" } },
          ],
        };
      }
      if (path.startsWith("/customer/bookings/holds/")) return hold;
      throw new ApiError({ status: 404, message: "نیست" });
    });
    const user = userEvent.setup();
    renderWithProviders(<PaymentScreen />);
    expect(await screen.findByRole("radio", { name: /پرداخت کامل/ })).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: /پرداخت در محل/ }));
    expect(screen.getByRole("radio", { name: /پرداخت در محل/ })).toBeChecked();
  });

  it("applies a coupon only after backend quote update", async () => {
    mockedClient.mockImplementation(async (path, options) => {
      if (path === "/public/booking/quote") {
        if (requestCoupon(options) === "SAVE10") {
          return {
            ...quote,
            payableNowLabel: "۲۰۰٬۰۰۰ تومان",
            coupon: { code: "SAVE10", status: "applied" },
          };
        }
        return quote;
      }
      if (path.startsWith("/customer/bookings/holds/")) return hold;
      throw new ApiError({ status: 404, message: "نیست" });
    });
    const user = userEvent.setup();
    renderWithProviders(<PaymentScreen />);
    await screen.findByRole("heading", { name: "پرداخت کامل" });
    await user.type(screen.getByLabelText(/کد تخفیف/), "SAVE10");
    await user.click(screen.getByRole("button", { name: "اعمال کد" }));
    expect(await screen.findByText("مبلغ‌ها با کد تخفیف به‌روزرسانی شد.")).toBeInTheDocument();
    expect(screen.getAllByText("۲۰۰٬۰۰۰ تومان").length).toBeGreaterThan(0);
  });

  it("shows coupon field errors for invalid and expired codes", async () => {
    mockedClient.mockImplementation(async (path, options) => {
      if (path === "/public/booking/quote" && requestCoupon(options)) {
        throw new ApiError({ status: 422, code: "COUPON_EXPIRED", message: "expired" });
      }
      if (path === "/public/booking/quote") return quote;
      if (path.startsWith("/customer/bookings/holds/")) return hold;
      throw new ApiError({ status: 404, message: "نیست" });
    });
    const user = userEvent.setup();
    renderWithProviders(<PaymentScreen />);
    await screen.findByLabelText(/کد تخفیف/);
    await user.type(screen.getByLabelText(/کد تخفیف/), "OLD");
    await user.click(screen.getByRole("button", { name: "اعمال کد" }));
    expect(await screen.findByText("این کد تخفیف منقضی شده است.")).toBeInTheDocument();
  });

  it("creates a payment session once and uses a safe redirect", async () => {
    let releasePayment: () => void = () => undefined;
    mockedClient.mockImplementation(async (path: string) => {
      if (path === "/public/booking/quote") return quote;
      if (path.startsWith("/customer/bookings/holds/")) return hold;
      if (path === "/customer/payments/sessions") {
        await new Promise<void>((resolve) => {
          releasePayment = resolve;
        });
        return { id: "pay_1", status: "redirect_required", redirectUrl: "https://pay.example/start" };
      }
      throw new ApiError({ status: 404, message: "نیست" });
    });
    const user = userEvent.setup();
    renderWithProviders(<PaymentScreen />);
    const pay = await screen.findByRole("button", { name: "پرداخت" });
    await user.click(pay);
    expect(pay).toBeDisabled();
    await user.click(pay);
    expect(mockedClient.mock.calls.filter((call) => call[0] === "/customer/payments/sessions")).toHaveLength(1);
    releasePayment();
    await waitFor(() => {
      expect(screen.getByText(/نشانی درگاه پرداخت معتبر یا مجاز نبود|در حال انتقال به درگاه پرداخت/)).toBeInTheDocument();
    });
    expect(paymentNavigation.assign).not.toHaveBeenCalled();
  });

  it("does not create a payment after confirmed hold expiry", async () => {
    mockedClient.mockImplementation(async (path: string) => {
      if (path === "/public/booking/quote") return quote;
      if (path.startsWith("/customer/bookings/holds/")) return { ...hold, status: "expired" };
      throw new ApiError({ status: 404, message: "نیست" });
    });
    renderWithProviders(<PaymentScreen />);
    expect(await screen.findByText("مهلت نگه‌داشتن این زمان به پایان رسید")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "پرداخت" })).toBeDisabled();
  });

  it("submits pay at location without a gateway redirect", async () => {
    window.sessionStorage.removeItem(HOLD_SESSION_KEY);
    mockedClient.mockImplementation(async (path: string) => {
      if (path === "/public/booking/quote") {
        return {
          id: "q1",
          paymentMode: "pay_at_location",
          checkoutPath: "pay_at_location",
          payableNowLabel: "۰ تومان",
          payableAtLocationLabel: "۲۵۰٬۰۰۰ تومان",
          finalAmountLabel: "۲۵۰٬۰۰۰ تومان",
        };
      }
      if (path === "/customer/payments/sessions") {
        return { id: "pay_loc", status: "pay_at_location", bookingReference: "BK22A" };
      }
      throw new ApiError({ status: 404, message: "نیست" });
    });
    const user = userEvent.setup();
    renderWithProviders(<PaymentScreen />);
    const submit = await screen.findByRole("button", { name: "ثبت با پرداخت در محل" });
    await user.click(submit);
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/booking/confirmation/BK22A");
    });
    expect(paymentNavigation.assign).not.toHaveBeenCalled();
  });

  it("rejects an unsafe gateway URL and does not redirect", async () => {
    mockedClient.mockImplementation(async (path: string) => {
      if (path === "/public/booking/quote") return quote;
      if (path.startsWith("/customer/bookings/holds/")) return hold;
      if (path === "/customer/payments/sessions") {
        return { id: "pay_1", status: "redirect_required", redirectUrl: "https://evil.example/phish" };
      }
      throw new ApiError({ status: 404, message: "نیست" });
    });
    const user = userEvent.setup();
    renderWithProviders(<PaymentScreen />);
    await user.click(await screen.findByRole("button", { name: "پرداخت" }));
    expect(await screen.findByText(/نشانی درگاه پرداخت معتبر یا مجاز نبود/)).toBeInTheDocument();
    expect(paymentNavigation.assign).not.toHaveBeenCalled();
  });

  it("removes an applied coupon and asks for a new quote", async () => {
    mockedClient.mockImplementation(async (path, options) => {
      if (path === "/public/booking/quote") {
        if (requestCoupon(options) === "SAVE10") {
          return {
            ...quote,
            payableNowLabel: "۲۰۰٬۰۰۰ تومان",
            coupon: { code: "SAVE10", status: "applied" },
          };
        }
        return quote;
      }
      if (path.startsWith("/customer/bookings/holds/")) return hold;
      throw new ApiError({ status: 404, message: "نیست" });
    });
    const user = userEvent.setup();
    renderWithProviders(<PaymentScreen />);
    await screen.findByRole("heading", { name: "پرداخت کامل" });
    await user.type(screen.getByLabelText(/کد تخفیف/), "SAVE10");
    await user.click(screen.getByRole("button", { name: "اعمال کد" }));
    expect(await screen.findByRole("button", { name: "حذف کد" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "حذف کد" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "اعمال کد" })).toBeInTheDocument();
    });
  });

  it("revalidates quote and hold on window focus", async () => {
    mockedClient.mockImplementation(async (path: string) => {
      if (path === "/public/booking/quote") return quote;
      if (path.startsWith("/customer/bookings/holds/")) return hold;
      throw new ApiError({ status: 404, message: "نیست" });
    });
    renderWithProviders(<PaymentScreen />);
    await screen.findByRole("heading", { name: "پرداخت کامل" });
    mockedClient.mockClear();
    fireEvent(window, new Event("focus"));
    await waitFor(() => {
      expect(mockedClient).toHaveBeenCalled();
    });
    expect(mockedClient.mock.calls.some((call) => call[0] === "/customer/payments/sessions")).toBe(false);
  });
});

describe("PaymentResultScreen", () => {
  beforeEach(() => {
    mockedClient.mockReset();
    push.mockReset();
    replace.mockReset();
    search.current = new URLSearchParams("ref=pay_1&status=success");
    window.sessionStorage.clear();
    document.documentElement.dir = "rtl";
  });

  it("verifies with backend and ignores gateway query status", async () => {
    mockedClient.mockResolvedValue({
      id: "pay_1",
      status: "pending",
      transactionReference: "trx_1",
    });
    renderWithProviders(<PaymentResultScreen />);
    expect(await screen.findByRole("heading", { name: "در حال بررسی پرداخت" })).toBeInTheDocument();
    expect(screen.queryByText("پرداخت با موفقیت تأیید شد")).not.toBeInTheDocument();
    expect(mockedClient).toHaveBeenCalledWith(
      "/customer/payments/pay_1/verify",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("shows verified success with references", async () => {
    mockedClient.mockResolvedValue({
      id: "pay_1",
      status: "paid",
      payableNowLabel: "۲۵۰٬۰۰۰ تومان",
      transactionReference: "trx_9",
      bookingReference: "BK22A",
      paidAt: "2026-08-22T10:05:00.000Z",
    });
    renderWithProviders(<PaymentResultScreen />);
    expect(await screen.findByRole("heading", { name: "پرداخت با موفقیت تأیید شد" })).toBeInTheDocument();
    expect(screen.getByText("trx_9")).toBeInTheDocument();
    expect(screen.getByText("BK22A")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "مشاهده تأیید رزرو" })).toHaveAttribute(
      "href",
      "/booking/confirmation/BK22A",
    );
  });

  it("keeps failed, pending and unknown states distinct", async () => {
    mockedClient.mockResolvedValue({ id: "pay_1", status: "failed", retryAllowed: true });
    renderWithProviders(<PaymentResultScreen />);
    expect(await screen.findByRole("heading", { name: "پرداخت ناموفق بود" })).toBeInTheDocument();
  });

  it("does not treat a network error as failed", async () => {
    mockedClient.mockRejectedValue(new ApiError({ status: 0, code: "NETWORK_ERROR", message: "قطع" }));
    renderWithProviders(<PaymentResultScreen />);
    expect(await screen.findByText("وضعیت پرداخت نامشخص است")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "پرداخت ناموفق بود" })).not.toBeInTheDocument();
  });

  it("does not render internal resources", async () => {
    mockedClient.mockResolvedValue({
      id: "pay_1",
      status: "paid",
      clientSecret: "sk_live",
      resources: [{ kind: "room", name: "اتاق ۳" }],
    });
    renderWithProviders(<PaymentResultScreen />);
    await screen.findByRole("heading", { name: "پرداخت با موفقیت تأیید شد" });
    expect(screen.queryByText(/اتاق ۳|sk_live/)).not.toBeInTheDocument();
  });

  it("refreshes status from backend on recovery", async () => {
    mockedClient.mockResolvedValue({ id: "pay_1", status: "pending" });
    const user = userEvent.setup();
    renderWithProviders(<PaymentResultScreen />);
    await screen.findByRole("heading", { name: "در حال بررسی پرداخت" });
    mockedClient.mockResolvedValue({
      id: "pay_1",
      status: "paid",
      bookingReference: "BK22A",
      transactionReference: "trx_1",
    });
    await user.click(screen.getByRole("button", { name: "بررسی دوباره وضعیت" }));
    expect(await screen.findByRole("heading", { name: "پرداخت با موفقیت تأیید شد" })).toBeInTheDocument();
  });
});
