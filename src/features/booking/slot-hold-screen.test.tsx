import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SlotHoldScreen } from "@/features/booking/slot-hold-screen";
import { ApiError } from "@/lib/api/errors";
import { BOOKING_DRAFT_STORAGE_KEY } from "@/lib/booking/persistence";
import { renderWithProviders } from "@/test/render";

const push = vi.fn();
const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
  usePathname: () => "/booking/hold/hold_1",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/api/client", () => ({
  apiClient: vi.fn(),
}));

import { apiClient } from "@/lib/api/client";

const mockedClient = vi.mocked(apiClient);

const activeHold = {
  id: "hold_1",
  status: "active",
  expiresAt: "2026-08-22T10:05:00.000Z",
  serverNow: "2026-08-22T10:00:00.000Z",
  slot: { id: "slot_1", startsAt: "2026-08-22T09:00:00+03:30" },
  service: { name: "ویزیت" },
  branch: { name: "شعبه مرکزی" },
  payableNowLabel: "۲۵۰٬۰۰۰ تومان",
};

describe("SlotHoldScreen", () => {
  beforeEach(() => {
    mockedClient.mockReset();
    push.mockReset();
    replace.mockReset();
    window.sessionStorage.clear();
    document.documentElement.dir = "rtl";
    vi.useRealTimers();
    window.sessionStorage.setItem(
      BOOKING_DRAFT_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        expiresAt: "2099-01-01T00:00:00.000Z",
        currentStep: "checkout",
        serviceId: "svc_1",
        branchId: "br_1",
        providerPreference: { type: "not_applicable" },
        date: "2026-08-22",
        slotId: "slot_1",
      }),
    );
  });

  it("does not show a countdown before a real hold response", () => {
    mockedClient.mockImplementation(() => new Promise(() => undefined));
    renderWithProviders(<SlotHoldScreen reference="hold_1" />);
    expect(screen.getByLabelText("در حال بررسی رزرو موقت")).toBeInTheDocument();
    expect(screen.queryByLabelText(/زمان باقی‌مانده رزرو موقت/)).not.toBeInTheDocument();
    expect(screen.queryByText(/با موفقیت ثبت شد/)).not.toBeInTheDocument();
    expect(mockedClient.mock.calls.some((call) => call[1]?.method === "POST")).toBe(false);
  });

  it("renders an active hold from GET and starts the countdown from timestamps", async () => {
    mockedClient.mockResolvedValue(activeHold);
    renderWithProviders(<SlotHoldScreen reference="hold_1" />);
    expect(await screen.findByRole("heading", { name: "رزرو موقت" })).toBeInTheDocument();
    expect(screen.getAllByText(/به‌صورت موقت برای شما نگه داشته شده/).length).toBeGreaterThan(0);
    expect(screen.getByText("ویزیت")).toBeInTheDocument();
    expect(screen.getByText("شعبه مرکزی")).toBeInTheDocument();
    expect(screen.getByText("۲۵۰٬۰۰۰ تومان")).toBeInTheDocument();
    expect(screen.getByLabelText(/زمان باقی‌مانده رزرو موقت/)).toBeInTheDocument();
    expect(screen.queryByText(/اتاق|صندلی|دستگاه|clientSecret|lock/)).not.toBeInTheDocument();
    expect(document.documentElement.dir).toBe("rtl");
    expect(mockedClient).toHaveBeenCalledWith(
      "/customer/bookings/holds/hold_1",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("revalidates with the backend at zero instead of trusting the client timer", async () => {
    const elapsed = {
      ...activeHold,
      expiresAt: "2026-08-22T09:59:00.000Z",
      serverNow: "2026-08-22T10:00:00.000Z",
    };
    mockedClient.mockResolvedValueOnce(elapsed).mockResolvedValue({ ...elapsed, status: "expired" });
    renderWithProviders(<SlotHoldScreen reference="hold_1" />);
    expect(await screen.findByText("مهلت نگه‌داشتن این زمان به پایان رسید")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "ادامه پرداخت" })).not.toBeInTheDocument();
    const stored = JSON.parse(window.sessionStorage.getItem(BOOKING_DRAFT_STORAGE_KEY) ?? "{}") as {
      slotId: string | null;
    };
    expect(stored.slotId).toBeNull();
  });

  it("offers a new time without auto-selecting a slot after expiry", async () => {
    mockedClient.mockResolvedValue({ ...activeHold, status: "expired" });
    const user = userEvent.setup();
    renderWithProviders(<SlotHoldScreen reference="hold_1" />);
    expect(await screen.findByRole("button", { name: "انتخاب زمان جدید" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "انتخاب زمان جدید" }));
    expect(push).toHaveBeenCalledWith(expect.stringContaining("step=time"));
    const stored = JSON.parse(window.sessionStorage.getItem(BOOKING_DRAFT_STORAGE_KEY) ?? "{}") as {
      slotId: string | null;
    };
    expect(stored.slotId).toBeNull();
  });

  it("shows consumed payment-pending without returning to slot selection", async () => {
    mockedClient.mockResolvedValue({
      ...activeHold,
      status: "consumed",
      paymentStatus: "pending_payment",
    });
    renderWithProviders(<SlotHoldScreen reference="hold_1" />);
    expect(await screen.findByText("وضعیت پرداخت در حال بررسی است")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "انتخاب زمان جدید" })).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("routes consumed holds with a booking reference to confirmation", async () => {
    mockedClient.mockResolvedValue({
      ...activeHold,
      status: "consumed",
      bookingReference: "BK22A",
      paymentStatus: "paid",
    });
    renderWithProviders(<SlotHoldScreen reference="hold_1" />);
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/booking/confirmation/BK22A");
    });
  });

  it("announces warning without flashing a confirmed booking", async () => {
    const hold = {
      ...activeHold,
      serverNow: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 90_000).toISOString(),
    };
    mockedClient.mockResolvedValue(hold);
    renderWithProviders(<SlotHoldScreen reference="hold_1" />);
    expect((await screen.findAllByText(/کمتر از دو دقیقه/)).length).toBeGreaterThan(0);
    expect(screen.getByText(/هشدار نزدیک شدن به پایان مهلت/)).toBeInTheDocument();
    expect(screen.queryByText(/با موفقیت ثبت شد/)).not.toBeInTheDocument();
  });

  it("shows released and invalid states distinctly", async () => {
    mockedClient.mockResolvedValue({ ...activeHold, status: "released" });
    const { unmount } = renderWithProviders(<SlotHoldScreen reference="hold_1" />);
    expect(await screen.findByText("رزرو موقت آزاد شد")).toBeInTheDocument();
    unmount();
    mockedClient.mockResolvedValue({ ...activeHold, status: "invalid" });
    renderWithProviders(<SlotHoldScreen reference="hold_1" />);
    expect(await screen.findByText("رزرو موقت معتبر نیست")).toBeInTheDocument();
  });

  it("keeps payment disabled while hold status is unknown", async () => {
    mockedClient.mockRejectedValue(new ApiError({ status: 500, message: "خطا", requestId: "req_9" }));
    renderWithProviders(<SlotHoldScreen reference="hold_1" />);
    expect(await screen.findByText("وضعیت رزرو موقت نامشخص است")).toBeInTheDocument();
    expect(screen.getByText("req_9")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "ادامه پرداخت" })).not.toBeInTheDocument();
  });

  it("prevents a second payment attempt while one is running", async () => {
    mockedClient.mockResolvedValue(activeHold);
    const user = userEvent.setup();
    renderWithProviders(<SlotHoldScreen reference="hold_1" />);
    const pay = await screen.findByRole("button", { name: "ادامه پرداخت" });
    await user.click(pay);
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/booking/payment");
    });
    expect(mockedClient.mock.calls.some((call) => call[0] === "/customer/payments/sessions")).toBe(false);
  });

  it("revalidates on focus and reconnect without creating a hold", async () => {
    mockedClient.mockResolvedValue(activeHold);
    renderWithProviders(<SlotHoldScreen reference="hold_1" />);
    await screen.findByText("ویزیت");
    mockedClient.mockClear();
    mockedClient.mockResolvedValue(activeHold);
    fireEvent(window, new Event("focus"));
    fireEvent(window, new Event("online"));
    await waitFor(() => {
      expect(mockedClient).toHaveBeenCalled();
    });
    expect(mockedClient.mock.calls.every((call) => call[1]?.method === "GET")).toBe(true);
  });

  it("does not render internal resources from the hold payload", async () => {
    mockedClient.mockResolvedValue({
      ...activeHold,
      clientSecret: "sk_live",
      resources: [{ kind: "room", name: "اتاق ۳" }],
    });
    renderWithProviders(<SlotHoldScreen reference="hold_1" />);
    await screen.findByText("ویزیت");
    expect(screen.queryByText(/اتاق ۳|sk_live/)).not.toBeInTheDocument();
  });
});
