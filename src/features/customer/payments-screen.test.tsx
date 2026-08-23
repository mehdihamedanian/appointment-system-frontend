import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PaymentsScreen } from "@/features/customer/payments-screen";
import { PaymentDetailScreen } from "@/features/customer/payment-detail-screen";
import { ApiError } from "@/lib/api/errors";
import { createSessionValue, renderWithProviders } from "@/test/render";

const push = vi.fn();
const replace = vi.fn();
const search = { current: new URLSearchParams() };
const params = { current: { paymentReference: "pay_1" } as Record<string, string> };

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
  usePathname: () => "/payments",
  useSearchParams: () => search.current,
  useParams: () => params.current,
}));

vi.mock("@/lib/api/client", () => ({
  apiClient: vi.fn(),
}));

import { apiClient } from "@/lib/api/client";

const mockedClient = vi.mocked(apiClient);

function paymentItem(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    publicReference: id,
    status: "paid",
    amountLabel: "۲۵۰٬۰۰۰ تومان",
    paidAt: "2026-08-22T10:00:00.000Z",
    transactionReference: `trx_${id}`,
    bookingReference: "BK22A",
    appointmentId: "apt_1",
    appointmentAvailable: true,
    serviceName: "ویزیت",
    classification: "full",
    refundStatus: "refunded",
    refundAmountLabel: "۵۰٬۰۰۰ تومان",
    receiptUrl: "https://receipts.example/pay",
    ...overrides,
  };
}

describe("PaymentsScreen", () => {
  beforeEach(() => {
    mockedClient.mockReset();
    push.mockReset();
    replace.mockReset();
    search.current = new URLSearchParams();
    document.documentElement.dir = "rtl";
  });

  it("does not fetch before the session is ready", () => {
    renderWithProviders(<PaymentsScreen />, {
      session: createSessionValue({ status: "unauthenticated", user: null }),
    });
    expect(mockedClient).not.toHaveBeenCalled();
    expect(screen.getByLabelText("در حال بارگذاری پرداخت‌ها")).toBeInTheDocument();
  });

  it("renders payment cards and desktop table content", async () => {
    mockedClient.mockResolvedValue({
      items: [paymentItem("pay_1"), paymentItem("pay_2", { status: "failed", refundStatus: undefined })],
      totalCount: 2,
      pageCount: 1,
    });
    renderWithProviders(<PaymentsScreen />);
    expect(await screen.findAllByText("۲۵۰٬۰۰۰ تومان")).not.toHaveLength(0);
    expect(screen.getAllByText("پرداخت‌شده").length).toBeGreaterThan(0);
    expect(screen.getAllByText("ناموفق").length).toBeGreaterThan(0);
    expect(screen.getAllByText("بازپرداخت‌شده").length).toBeGreaterThan(0);
    expect(screen.getAllByText("pay_1")[0]).toHaveClass("ltr-value");
    expect(screen.getAllByRole("link", { name: "جزئیات پرداخت" })[0]).toHaveAttribute(
      "href",
      "/payments/pay_1",
    );
    expect(screen.getAllByRole("link", { name: "مشاهده نوبت" })[0]).toHaveAttribute(
      "href",
      "/appointments/apt_1",
    );
    expect(screen.getByRole("table", { name: "فهرست پرداخت‌های مشتری" })).toBeInTheDocument();
    expect(document.documentElement.dir).toBe("rtl");
  });

  it("shows empty history state", async () => {
    mockedClient.mockResolvedValue({ items: [], emptyHistory: true });
    renderWithProviders(<PaymentsScreen />);
    expect(await screen.findByText("هنوز پرداختی ندارید")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "رزرو نوبت" })).toHaveAttribute("href", "/booking");
  });

  it("shows filtered no-results state", async () => {
    search.current = new URLSearchParams("status=paid&q=missing");
    mockedClient.mockResolvedValue({ items: [], totalCount: 0 });
    renderWithProviders(<PaymentsScreen />);
    expect(await screen.findByText("نتیجه‌ای پیدا نشد")).toBeInTheDocument();
    expect(mockedClient).toHaveBeenCalledWith(
      expect.stringContaining("status=paid"),
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("shows API error and retries", async () => {
    mockedClient.mockRejectedValueOnce(
      new ApiError({ status: 500, code: "SERVER", message: "خطای سرویس" }),
    );
    mockedClient.mockResolvedValueOnce({ items: [paymentItem("pay_9")] });
    const user = userEvent.setup();
    renderWithProviders(<PaymentsScreen />);
    expect(await screen.findByText("پرداخت‌ها بارگذاری نشد")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /تلاش دوباره|Retry|سعی مجدد|دوباره/i }));
    expect(await screen.findAllByText("۲۵۰٬۰۰۰ تومان")).not.toHaveLength(0);
  });

  it("renders unknown status safely", async () => {
    mockedClient.mockResolvedValue({
      items: [paymentItem("pay_x", { status: "weird_gateway_state", refundStatus: undefined })],
    });
    renderWithProviders(<PaymentsScreen />);
    expect(await screen.findAllByText("نامشخص")).not.toHaveLength(0);
    expect(screen.queryByText("پرداخت‌شده")).not.toBeInTheDocument();
  });

  it("shows unavailable appointment message", async () => {
    mockedClient.mockResolvedValue({
      items: [
        paymentItem("pay_a", {
          appointmentAvailable: false,
          receiptUrl: undefined,
          refundStatus: undefined,
        }),
      ],
    });
    renderWithProviders(<PaymentsScreen />);
    expect(await screen.findAllByText("نوبت مرتبط در دسترس نیست.")).not.toHaveLength(0);
    expect(screen.queryByRole("link", { name: "مشاهده نوبت" })).not.toBeInTheDocument();
  });

  it("keeps appointment deep-link filter in the URL request", async () => {
    search.current = new URLSearchParams("appointment=apt_9");
    mockedClient.mockResolvedValue({ items: [paymentItem("pay_1")] });
    renderWithProviders(<PaymentsScreen />);
    await screen.findAllByText("۲۵۰٬۰۰۰ تومان");
    expect(mockedClient).toHaveBeenCalledWith(
      expect.stringContaining("appointmentId=apt_9"),
      expect.any(Object),
    );
    expect(screen.getByText("apt_9")).toHaveClass("ltr-value");
  });

  it("paginates with Backend page metadata", async () => {
    search.current = new URLSearchParams("page=1");
    mockedClient.mockResolvedValue({
      items: [paymentItem("pay_1")],
      page: 1,
      pageCount: 3,
      totalCount: 25,
    });
    const user = userEvent.setup();
    renderWithProviders(<PaymentsScreen />);
    expect(await screen.findByLabelText("صفحه‌بندی")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "2" }));
    expect(replace).toHaveBeenCalledWith(expect.stringContaining("page=2"), { scroll: false });
  });
});

describe("PaymentDetailScreen", () => {
  beforeEach(() => {
    mockedClient.mockReset();
    params.current = { paymentReference: "pay_1" };
  });

  it("renders detail fields and pending refresh", async () => {
    mockedClient.mockResolvedValue({
      publicReference: "pay_1",
      status: "processing",
      amountLabel: "۱۲۰٬۰۰۰ تومان",
      transactionReference: "trx_1",
      bookingReference: "BK22A",
      serviceName: "ویزیت",
      appointmentId: "apt_1",
      appointmentAvailable: true,
      receiptAvailable: true,
      receiptUrl: "https://receipts.example/pay_1",
    });
    renderWithProviders(<PaymentDetailScreen />);
    expect(await screen.findByText("۱۲۰٬۰۰۰ تومان")).toBeInTheDocument();
    expect(screen.getByText("در حال پردازش")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "به‌روزرسانی وضعیت" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "مشاهده نوبت مرتبط" })).toHaveAttribute(
      "href",
      "/appointments/apt_1",
    );
    expect(screen.getByRole("link", { name: "مشاهده رسید" })).toHaveAttribute(
      "href",
      "https://receipts.example/pay_1",
    );
  });

  it("hides existence on forbidden detail access", async () => {
    mockedClient.mockRejectedValue(
      new ApiError({ status: 403, code: "FORBIDDEN", message: "forbidden" }),
    );
    renderWithProviders(<PaymentDetailScreen />);
    expect(await screen.findByText("پرداخت در دسترس نیست")).toBeInTheDocument();
  });
});

describe("payment receipt action", () => {
  beforeEach(() => {
    mockedClient.mockReset();
    search.current = new URLSearchParams();
  });

  it("loads receipt from Backend when URL is not embedded", async () => {
    mockedClient.mockImplementation(async (path) => {
      if (path === "/customer/payments?page=1&limit=10") {
        return {
          items: [
            paymentItem("pay_r", {
              receiptUrl: undefined,
              receiptAvailable: true,
              refundStatus: undefined,
            }),
          ],
        };
      }
      if (path === "/customer/payments/pay_r/receipt") {
        return { url: "https://receipts.example/signed" };
      }
      return {};
    });
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    const user = userEvent.setup();
    renderWithProviders(<PaymentsScreen />);
    const buttons = await screen.findAllByRole("button", { name: "مشاهده رسید" });
    await user.click(buttons[0]!);
    await waitFor(() => {
      expect(open).toHaveBeenCalledWith(
        "https://receipts.example/signed",
        "_blank",
        "noopener,noreferrer",
      );
    });
    open.mockRestore();
  });
});
