import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminPaymentsScreen } from "@/features/admin/payments/admin-payment-screen";
import { AdminPaymentDetailScreen } from "@/features/admin/payments/admin-payment-detail-screen";
import { authenticatedAdmin, createSessionValue, renderWithProviders } from "@/test/render";

/** E2E: Admin payment list → detail → refund preview → confirmation → refresh */

const replaceMock = vi.fn();
const pushMock = vi.fn();
let params = { paymentReference: "PAY-1" };

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/payments",
  useRouter: () => ({ replace: replaceMock, push: pushMock }),
  useSearchParams: () => new URLSearchParams(),
  useParams: () => params,
}));

vi.mock("@/lib/api/client", () => ({
  apiClient: vi.fn(),
}));

import { apiClient } from "@/lib/api/client";

const mockedClient = vi.mocked(apiClient);

describe("Phase 35 admin payments E2E flow", () => {
  beforeEach(() => {
    mockedClient.mockReset();
    replaceMock.mockReset();
    pushMock.mockReset();
    params = { paymentReference: "PAY-1" };
  });

  it("walks list → detail → refund preview → confirmation → refresh", async () => {
    const user = userEvent.setup();
    const session = createSessionValue({ status: "authenticated", user: authenticatedAdmin });
    let detailFetchCount = 0;

    mockedClient.mockImplementation(async (path: string, init?: { method?: string }) => {
      const url = String(path);
      const method = init?.method ?? "GET";
      if (url.startsWith("/admin/payments?")) {
        return {
          items: [
            {
              publicReference: "PAY-1",
              status: "paid",
              amountLabel: "۱۰۰٬۰۰۰ تومان",
              customer: { reference: "C-1", displayName: "مشتری" },
              appointment: { reference: "APT-1", serviceName: "ویزیت" },
              allowedActions: { issueRefund: true },
            },
          ],
          totalCount: 1,
          pageCount: 1,
        };
      }
      if (url.includes("/refund-preview") && method === "POST") {
        return {
          title: "پیش‌نمایش بازپرداخت",
          maxRefundableLabel: "۱۰۰٬۰۰۰ تومان",
          allowsPartial: false,
          requiresReason: false,
          reasonOptions: [{ id: "customer_request", label: "درخواست مشتری" }],
        };
      }
      if (url.includes("/refund") && method === "POST") {
        return {
          reference: "PAY-1",
          refundStatus: "refunded",
          refundAmountLabel: "۱۰۰٬۰۰۰ تومان",
          message: "بازپرداخت ثبت شد",
        };
      }
      if (url.includes("/admin/payments/PAY-1")) {
        detailFetchCount += 1;
        return {
          publicReference: "PAY-1",
          status: "paid",
          amountLabel: "۱۰۰٬۰۰۰ تومان",
          customer: { reference: "C-1", displayName: "مشتری" },
          appointment: { reference: "APT-1", serviceName: "ویزیت" },
          allowedActions: { issueRefund: true, downloadReceipt: false },
          capabilities: { supportsRefundPreview: true },
          timeline: [{ id: "t1", label: "پرداخت موفق", status: "paid" }],
          internalNotes: [],
        };
      }
      return {};
    });

    const { unmount: unmountList } = renderWithProviders(<AdminPaymentsScreen />, { session });
    await waitFor(() => {
      expect(mockedClient).toHaveBeenCalledWith(
        expect.stringMatching(/^\/admin\/payments\?/),
        expect.objectContaining({ method: "GET" }),
      );
    });
    unmountList();

    renderWithProviders(<AdminPaymentDetailScreen />, { session });
    expect(await screen.findByRole("heading", { name: /جزئیات پرداخت/i })).toBeInTheDocument();
    expect(await screen.findByText("PAY-1")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /بازپرداخت/i }));
    expect(await screen.findByText(/حداکثر قابل بازپرداخت/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^ادامه$/i }));
    await user.click(screen.getByRole("button", { name: /ثبت بازپرداخت/i }));

    await waitFor(() => {
      expect(mockedClient).toHaveBeenCalledWith(
        expect.stringContaining("/admin/payments/PAY-1/refund"),
        expect.objectContaining({ method: "POST" }),
      );
    });

    await waitFor(() => {
      expect(detailFetchCount).toBeGreaterThanOrEqual(2);
    });
  });
});
