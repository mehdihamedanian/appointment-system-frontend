import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient } from "@tanstack/react-query";
import { AppointmentCancellationScreen } from "@/features/customer/appointment-cancellation-screen";
import { ApiError } from "@/lib/api/errors";
import { queryKeys } from "@/lib/query/keys";
import {
  createSessionValue,
  renderWithProviders,
} from "@/test/render";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/appointments/apt_cancel_1/cancel",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/api/client", () => ({
  apiClient: vi.fn(),
}));

import { apiClient } from "@/lib/api/client";

const mockedClient = vi.mocked(apiClient);

const previewPayload = {
  canCancel: true,
  previewVersion: "pv_1",
  appointment: {
    publicReference: "apt_cancel_1",
    status: "confirmed",
    service: { name: "ویزیت" },
    startsAt: "2026-08-22T09:00:00+03:30",
    timezone: "Asia/Tehran",
    paymentStatus: "paid",
    provider: { mode: "specific", name: "دکتر نمونه" },
    branch: { name: "شعبه مرکزی" },
    internalNote: "محرمانه",
  },
  policy: {
    summary: "تا ۲۴ ساعت قبل",
    feeLabel: "۵۰٬۰۰۰ تومان",
  },
  refund: {
    status: "partial",
    paidAmount: { label: "۲۵۰٬۰۰۰ تومان" },
    cancellationFee: { label: "۵۰٬۰۰۰ تومان" },
    refundableAmount: { label: "۲۰۰٬۰۰۰ تومان" },
  },
  allowedReasons: [
    { code: "schedule_conflict", label: "تداخل زمانی" },
    { code: "other", label: "سایر", requiresText: true },
  ],
};

describe("AppointmentCancellationScreen", () => {
  beforeEach(() => {
    mockedClient.mockReset();
    document.documentElement.dir = "rtl";
  });

  it("does not fetch preview before session restoration", () => {
    renderWithProviders(<AppointmentCancellationScreen reference="apt_cancel_1" />, {
      session: createSessionValue({ status: "loading", user: null }),
    });
    expect(mockedClient).not.toHaveBeenCalled();
    expect(screen.getByLabelText("در حال بارگذاری پیش‌نمایش لغو")).toBeInTheDocument();
  });

  it("renders preview summary and backend refund labels", async () => {
    mockedClient.mockResolvedValue(previewPayload);
    renderWithProviders(<AppointmentCancellationScreen reference="apt_cancel_1" />);
    expect(await screen.findByText("نوبتی که لغو می‌شود")).toBeInTheDocument();
    expect(screen.getAllByText("ویزیت").length).toBeGreaterThan(0);
    expect(screen.getByText("بازپرداخت جزئی")).toBeInTheDocument();
    expect(screen.getByText("۲۰۰٬۰۰۰ تومان")).toBeInTheDocument();
    expect(screen.queryByText("محرمانه")).not.toBeInTheDocument();
  });

  it("shows blocked state from fresh preview eligibility", async () => {
    mockedClient.mockResolvedValue({
      ...previewPayload,
      canCancel: false,
      blockedReason: "نوبت آغاز شده است",
    });
    renderWithProviders(<AppointmentCancellationScreen reference="apt_cancel_1" />);
    expect(await screen.findByText("لغو این نوبت مجاز نیست")).toBeInTheDocument();
    expect(screen.getByText("نوبت آغاز شده است")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "لغو نوبت" })).not.toBeInTheDocument();
  });

  it("requires reason selection before submit", async () => {
    mockedClient.mockResolvedValue(previewPayload);
    const user = userEvent.setup();
    renderWithProviders(<AppointmentCancellationScreen reference="apt_cancel_1" />);
    await screen.findByText("دلیل لغو");
    const submit = screen.getByRole("button", { name: "لغو نوبت" });
    expect(submit).toBeDisabled();
    await user.click(screen.getByRole("radio", { name: "تداخل زمانی" }));
    expect(submit).toBeEnabled();
    await user.click(submit);
    await waitFor(() => {
      expect(mockedClient).toHaveBeenCalledWith(
        "/customer/appointments/apt_cancel_1/cancellation",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({ "Idempotency-Key": expect.any(String) }),
        }),
      );
    });
  });

  it("shows success with separate refund status after backend confirmation", async () => {
    mockedClient.mockImplementation(async (path: string) => {
      if (path.includes("cancellation-preview")) return previewPayload;
      return {
        appointmentReference: "apt_cancel_1",
        status: "cancelled",
        cancelledAt: "2026-08-21T12:00:00+03:30",
        refund: { status: "processing", refundableAmount: { label: "۲۰۰٬۰۰۰ تومان" } },
      };
    });
    const user = userEvent.setup();
    renderWithProviders(<AppointmentCancellationScreen reference="apt_cancel_1" />);
    await screen.findByText("دلیل لغو");
    await user.click(screen.getByRole("radio", { name: "تداخل زمانی" }));
    await user.click(screen.getByRole("button", { name: "لغو نوبت" }));
    expect(await screen.findByRole("heading", { name: "نوبت شما لغو شد." })).toBeInTheDocument();
    expect(screen.getByText("بازپرداخت در حال پردازش")).toBeInTheDocument();
    expect(screen.queryByText("۲۰۰٬۰۰۰ تومان")).not.toBeInTheDocument();
  });

  it("refetches preview on policy change and clears reason", async () => {
    mockedClient.mockImplementation(async (path: string, options?: { method?: string }) => {
      if (path.includes("cancellation-preview")) return previewPayload;
      if (options?.method === "POST") {
        throw new ApiError({
          status: 409,
          code: "POLICY_CHANGED",
          message: "policy changed",
        });
      }
      return previewPayload;
    });
    const user = userEvent.setup();
    renderWithProviders(<AppointmentCancellationScreen reference="apt_cancel_1" />);
    await screen.findByText("دلیل لغو");
    await user.click(screen.getByRole("radio", { name: "تداخل زمانی" }));
    await user.click(screen.getByRole("button", { name: "لغو نوبت" }));
    expect(await screen.findByText("تغییر در شرایط لغو")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "تداخل زمانی" })).not.toBeChecked();
  });

  it("treats already cancelled as terminal without retrying mutation", async () => {
    mockedClient.mockImplementation(async (path: string, options?: { method?: string }) => {
      if (path.includes("cancellation-preview")) return previewPayload;
      if (options?.method === "POST") {
        throw new ApiError({
          status: 409,
          code: "ALREADY_CANCELLED",
          message: "already cancelled",
        });
      }
      return previewPayload;
    });
    const user = userEvent.setup();
    renderWithProviders(<AppointmentCancellationScreen reference="apt_cancel_1" />);
    await screen.findByText("دلیل لغو");
    await user.click(screen.getByRole("radio", { name: "تداخل زمانی" }));
    await user.click(screen.getByRole("button", { name: "لغو نوبت" }));
    expect(await screen.findByRole("heading", { name: "این نوبت قبلاً لغو شده است" })).toBeInTheDocument();
  });

  it("invalidates related queries after successful cancellation", async () => {
    mockedClient.mockImplementation(async (path: string, options?: { method?: string }) => {
      if (path.includes("cancellation-preview")) return previewPayload;
      if (options?.method === "POST") {
        return {
          appointmentReference: "apt_cancel_1",
          status: "cancelled",
          refund: { status: "none" },
        };
      }
      return previewPayload;
    });
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const user = userEvent.setup();
    renderWithProviders(<AppointmentCancellationScreen reference="apt_cancel_1" />, {
      queryClient,
    });
    await screen.findByText("دلیل لغو");
    await user.click(screen.getByRole("radio", { name: "تداخل زمانی" }));
    await user.click(screen.getByRole("button", { name: "لغو نوبت" }));
    await screen.findByRole("heading", { name: "نوبت شما لغو شد." });
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.customer.appointmentDetail("user_1", "apt_cancel_1"),
      }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.customer.appointments("user_1"),
      }),
    );
  });

  it("rejects unsafe reference tokens", () => {
    renderWithProviders(<AppointmentCancellationScreen reference="../secret" />);
    expect(screen.getByRole("heading", { name: "نوبت پیدا نشد" })).toBeInTheDocument();
    expect(mockedClient).not.toHaveBeenCalled();
  });
});
