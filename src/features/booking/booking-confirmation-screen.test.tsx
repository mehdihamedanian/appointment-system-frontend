import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BookingConfirmationScreen } from "@/features/booking/booking-confirmation-screen";
import { ApiError } from "@/lib/api/errors";
import {
  BOOKING_DRAFT_COMPLETED_KEY,
  BOOKING_DRAFT_STORAGE_KEY,
} from "@/lib/booking/persistence";
import { renderWithProviders } from "@/test/render";

vi.mock("@/lib/api/client", () => ({
  apiClient: vi.fn(),
}));

import { apiClient } from "@/lib/api/client";

const mockedClient = vi.mocked(apiClient);
const writeText = vi.fn().mockResolvedValue(undefined);

const booking = {
  id: "apt_1",
  reference: "BK22A",
  serviceName: "ویزیت",
  startsAt: "2026-08-22T09:00:00+03:30",
  durationMinutes: 30,
  status: "confirmed",
  paymentStatus: "paid",
  provider: { name: "دکتر آریا" },
  branch: { name: "شعبه مرکزی" },
  pricing: { totalAmount: { label: "۲۵۰٬۰۰۰ تومان" }, paidAmount: { label: "۲۵۰٬۰۰۰ تومان" } },
};

describe("BookingConfirmationScreen", () => {
  beforeEach(() => {
    mockedClient.mockReset();
    writeText.mockClear();
    window.sessionStorage.clear();
    document.documentElement.dir = "rtl";
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
  });

  it("shows a loading skeleton without a success heading", () => {
    mockedClient.mockImplementation(() => new Promise(() => undefined));
    renderWithProviders(<BookingConfirmationScreen reference="BK22A" />);
    expect(screen.getByLabelText("در حال بررسی وضعیت رزرو")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "نوبت شما با موفقیت ثبت شد." })).not.toBeInTheDocument();
  });

  it("renders a confirmed booking from GET and never posts confirm", async () => {
    mockedClient.mockResolvedValue(booking);
    renderWithProviders(<BookingConfirmationScreen reference="BK22A" />);
    expect(await screen.findByRole("heading", { name: "نوبت شما با موفقیت ثبت شد." })).toBeInTheDocument();
    expect(screen.getByText("BK22A")).toBeInTheDocument();
    expect(screen.getByText("ویزیت")).toBeInTheDocument();
    expect(screen.getByText("دکتر آریا")).toBeInTheDocument();
    expect(mockedClient).toHaveBeenCalledWith(
      "/customer/bookings/BK22A",
      expect.objectContaining({ method: "GET" }),
    );
    expect(mockedClient.mock.calls.some((call) => call[1]?.method === "POST")).toBe(false);
  });

  it("shows pending confirmation copy", async () => {
    mockedClient.mockResolvedValue({ ...booking, status: "pending_confirmation", paymentStatus: undefined });
    renderWithProviders(<BookingConfirmationScreen reference="BK22A" />);
    expect(
      await screen.findByRole("heading", { name: "درخواست نوبت شما ثبت شد و در انتظار تأیید مجموعه است." }),
    ).toBeInTheDocument();
  });

  it("explains pay at location with remaining amount from backend", async () => {
    mockedClient.mockResolvedValue({
      ...booking,
      paymentStatus: "pay_at_location",
      remainingAmountLabel: "۱۵۰٬۰۰۰ تومان",
    });
    renderWithProviders(<BookingConfirmationScreen reference="BK22A" />);
    expect(await screen.findByRole("heading", { name: "نوبت شما ثبت شد." })).toBeInTheDocument();
    expect(screen.getByText(/مانده اعلام‌شده توسط سرویس/)).toBeInTheDocument();
  });

  it("does not claim success when payment is pending", async () => {
    mockedClient.mockResolvedValue({ ...booking, paymentStatus: "pending_payment" });
    renderWithProviders(<BookingConfirmationScreen reference="BK22A" />);
    expect(await screen.findByRole("heading", { name: "نوبت در انتظار پرداخت است." })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "نوبت شما با موفقیت ثبت شد." })).not.toBeInTheDocument();
  });

  it("treats an invalid reference as not found without fetching", () => {
    renderWithProviders(<BookingConfirmationScreen reference="../evil" />);
    expect(screen.getByText("رزرو پیدا نشد")).toBeInTheDocument();
    expect(mockedClient).not.toHaveBeenCalled();
  });

  it("uses the same not-found copy for 403 and 404", async () => {
    mockedClient.mockRejectedValue(new ApiError({ status: 403, message: "forbidden" }));
    renderWithProviders(<BookingConfirmationScreen reference="BK22A" />);
    expect(await screen.findByText("رزرو پیدا نشد")).toBeInTheDocument();
    expect(screen.queryByText("forbidden")).not.toBeInTheDocument();
  });

  it("shows session expired without creating a booking", async () => {
    mockedClient.mockRejectedValue(
      new ApiError({ status: 401, code: "SESSION_EXPIRED", message: "نشست منقضی شد" }),
    );
    renderWithProviders(<BookingConfirmationScreen reference="BK22A" />);
    expect(await screen.findByText("نشست شما پایان یافته است")).toBeInTheDocument();
    expect(mockedClient.mock.calls.some((call) => call[1]?.method === "POST")).toBe(false);
  });

  it("retries with GET only", async () => {
    const user = userEvent.setup();
    mockedClient
      .mockRejectedValueOnce(new ApiError({ status: 500, message: "خطای سرور", requestId: "req_9" }))
      .mockResolvedValueOnce(booking);
    renderWithProviders(<BookingConfirmationScreen reference="BK22A" />);
    expect(await screen.findByText("req_9")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "تلاش دوباره" }));
    expect(await screen.findByText("نوبت شما با موفقیت ثبت شد.")).toBeInTheDocument();
    expect(mockedClient.mock.calls.every((call) => call[1]?.method === "GET")).toBe(true);
  });

  it("copies the backend-issued reference", async () => {
    mockedClient.mockResolvedValue(booking);
    renderWithProviders(<BookingConfirmationScreen reference="BK22A" />);
    await screen.findByText("BK22A");
    fireEvent.click(screen.getByRole("button", { name: "رونوشت کد پیگیری" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("BK22A"));
    expect(screen.getByText("کد پیگیری کپی شد.")).toBeInTheDocument();
  });

  it("marks the draft completed after a successful fetch", async () => {
    window.sessionStorage.setItem(
      BOOKING_DRAFT_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        expiresAt: "2099-01-01T00:00:00.000Z",
        currentStep: "summary",
        serviceId: "svc_1",
        branchId: null,
        providerPreference: { type: "not_applicable" },
        date: "2026-08-22",
        slotId: "slot_1",
      }),
    );
    mockedClient.mockResolvedValue(booking);
    renderWithProviders(<BookingConfirmationScreen reference="BK22A" />);
    await screen.findByText("نوبت شما با موفقیت ثبت شد.");
    await waitFor(() => {
      expect(window.sessionStorage.getItem(BOOKING_DRAFT_STORAGE_KEY)).toBeNull();
      expect(window.sessionStorage.getItem(BOOKING_DRAFT_COMPLETED_KEY)).toContain("BK22A");
    });
  });

  it("keeps RTL layout and a dashboard CTA", async () => {
    mockedClient.mockResolvedValue(booking);
    const { container } = renderWithProviders(<BookingConfirmationScreen reference="BK22A" />);
    await screen.findByText("نوبت شما با موفقیت ثبت شد.");
    expect(document.documentElement.dir).toBe("rtl");
    expect(container.querySelector(".booking-confirmation")).toBeTruthy();
    expect(screen.getByRole("link", { name: "بازگشت به داشبورد" })).toHaveAttribute("href", "/dashboard");
    expect(screen.queryByRole("link", { name: /مشاهده نوبت/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/اتاق|دستگاه|صندلی/)).not.toBeInTheDocument();
  });
});
