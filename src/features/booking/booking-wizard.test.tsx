import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BookingWizard } from "@/features/booking/booking-wizard";
import { ServiceStep } from "@/features/booking/steps/service-step";
import { ApiError } from "@/lib/api/errors";
import { BOOKING_DRAFT_STORAGE_KEY } from "@/lib/booking/persistence";
import { renderWithProviders } from "@/test/render";

const replace = vi.fn();
const navigation = {
  search: new URLSearchParams(),
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: replace }),
  usePathname: () => "/booking",
  useSearchParams: () => navigation.search,
}));

vi.mock("@/lib/api/client", () => ({
  apiClient: vi.fn(),
}));

vi.mock("@/lib/api/booking", async (importOriginal) => {
  const { withFixtureQuote } = await import("@/test/quote-fixture");
  return withFixtureQuote(await importOriginal());
});

import { apiClient } from "@/lib/api/client";
import { QUOTE_FIXTURE_PATH } from "@/test/quote-fixture";

const mockedClient = vi.mocked(apiClient);

describe("BookingWizard", () => {
  beforeEach(() => {
    mockedClient.mockReset();
    replace.mockReset();
    navigation.search = new URLSearchParams();
    window.sessionStorage.clear();
    document.documentElement.dir = "rtl";
  });

  it("revalidates a URL service and rejects an unsafe id", async () => {
    navigation.search = new URLSearchParams("service=../evil");
    mockedClient.mockResolvedValue({ name: "مجموعه", bookingEnabled: true, items: [] });
    renderWithProviders(<BookingWizard />);
    expect(await screen.findByText("خدمت موجود در پیوند معتبر نیست. لطفاً یک خدمت انتخاب کنید.")).toBeInTheDocument();
  });

  it("loads public services and blocks continuing without a selection", async () => {
    const user = userEvent.setup();
    mockedClient.mockImplementation(async (path: string) => {
      if (path === "/public/business") {
        return { name: "مجموعه", bookingEnabled: true };
      }
      if (path === "/services") {
        return { items: [{ id: "svc_1", name: "ویزیت", durationMinutes: 30, priceLabel: "۲۵۰ هزار" }] };
      }
      throw new ApiError({ status: 404, message: "نیست" });
    });
    renderWithProviders(<BookingWizard />);
    expect(await screen.findByRole("radio", { name: /ویزیت/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "ادامه" }));
    expect(screen.getByText("لطفاً یک خدمت را انتخاب کنید.")).toBeInTheDocument();
    expect(screen.queryByText(/اتاق|صندلی|دستگاه/)).not.toBeInTheDocument();
  });

  it("keeps a compact RTL step indicator on mobile", async () => {
    mockedClient.mockResolvedValue({ name: "مجموعه", items: [] });
    const { container } = renderWithProviders(<BookingWizard />);
    expect(await screen.findByRole("heading", { name: "رزرو نوبت" })).toBeInTheDocument();
    expect(container.querySelector(".booking-stepper-mobile")).toBeTruthy();
    expect(document.documentElement.dir).toBe("rtl");
  });

  it("does not persist sensitive additional data in session storage", async () => {
    mockedClient.mockResolvedValue({ name: "مجموعه", items: [] });
    renderWithProviders(<BookingWizard />);
    await screen.findByRole("heading", { name: "رزرو نوبت" });
    const raw = window.sessionStorage.getItem(BOOKING_DRAFT_STORAGE_KEY);
    expect(raw ?? "").not.toMatch(/otp|token|medical|additionalData/);
  });

  it("does not restore a completed booking draft via browser back", async () => {
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
    window.sessionStorage.setItem(
      "appointment.booking.draft.completed.v1",
      JSON.stringify({ version: 1, completedAt: "2026-08-22T10:00:00.000Z", reference: "BK22A" }),
    );
    mockedClient.mockResolvedValue({ name: "مجموعه", bookingEnabled: true, items: [] });
    renderWithProviders(<BookingWizard />);
    await screen.findByRole("heading", { name: "رزرو نوبت" });
    expect(screen.queryByText("پیش‌نویس رزرو بازیابی شد و دوباره بررسی می‌شود.")).not.toBeInTheDocument();
  });
});

describe("service step selection", () => {
  it("uses radios and keyboard-focusable options", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderWithProviders(
      <ServiceStep
        services={[
          {
            id: "svc_1",
            name: "ویزیت",
            pricing: { kind: "fixed", label: "۲۵۰ هزار" },
            bookingEnabled: true,
            availability: "bookable",
          },
          {
            id: "svc_2",
            name: "مشاوره",
            pricing: { kind: "fixed", label: "۱۰۰ هزار" },
            bookingEnabled: true,
            availability: "bookable",
          },
        ]}
        selectedId={null}
        onSelect={onSelect}
      />,
    );
    await user.click(screen.getByRole("radio", { name: /مشاوره/ }));
    expect(onSelect).toHaveBeenCalledWith("svc_2");
  });
});

describe("BookingWizard hold creation", () => {
  beforeEach(() => {
    mockedClient.mockReset();
    replace.mockReset();
    navigation.search = new URLSearchParams("step=checkout");
    window.sessionStorage.clear();
    document.documentElement.dir = "rtl";
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

  function mockCatalog() {
    mockedClient.mockImplementation(async (path: string) => {
      if (path === "/public/business") {
        return { name: "مجموعه", bookingEnabled: true };
      }
      if (path === "/services") {
        return { items: [{ id: "svc_1", name: "ویزیت", durationMinutes: 30, bookingEnabled: true }] };
      }
      if (path === "/services/svc_1") {
        return { id: "svc_1", name: "ویزیت", bookingEnabled: true, additionalFields: [] };
      }
      if (path === "/public/services/svc_1/providers") {
        return { mode: "not_applicable", items: [] };
      }
      if (path === QUOTE_FIXTURE_PATH) {
        return {
          id: "q1",
          paymentMode: "full",
          checkoutPath: "pay_full",
          payableNowLabel: "۲۵۰٬۰۰۰ تومان",
          finalAmountLabel: "۲۵۰٬۰۰۰ تومان",
        };
      }
      if (path === "/customer/bookings/holds") {
        return {
          id: "hold_1",
          status: "active",
          expiresAt: "2099-01-01T00:00:00.000Z",
          slot: { id: "slot_1", startsAt: "2026-08-22T09:00:00+03:30" },
        };
      }
      if (path === "/customer/bookings") {
        throw new ApiError({ status: 500, message: "confirm should not run" });
      }
      throw new ApiError({ status: 404, message: "نیست" });
    });
  }

  it("creates a backend hold instead of confirming when online payment is required", async () => {
    const user = userEvent.setup();
    mockCatalog();
    renderWithProviders(<BookingWizard />);
    expect(await screen.findByRole("heading", { name: "تأیید" })).toBeInTheDocument();
    const action = await screen.findByRole("button", { name: "ادامه به پرداخت" });
    await user.click(action);
    await waitFor(() => {
      expect(mockedClient.mock.calls.some((call) => call[0] === "/customer/bookings/holds")).toBe(true);
    });
    expect(mockedClient.mock.calls.some((call) => call[0] === "/customer/bookings" && call[1]?.method === "POST")).toBe(
      false,
    );
    expect(replace).toHaveBeenCalledWith("/booking/hold/hold_1");
  });

  it("returns to time when hold creation reports slot taken", async () => {
    const user = userEvent.setup();
    mockCatalog();
    mockedClient.mockImplementation(async (path: string) => {
      if (path === "/customer/bookings/holds") {
        throw new ApiError({ status: 409, code: "SLOT_TAKEN", message: "taken" });
      }
      if (path === "/public/business") return { name: "مجموعه", bookingEnabled: true };
      if (path === "/services") {
        return { items: [{ id: "svc_1", name: "ویزیت", durationMinutes: 30, bookingEnabled: true }] };
      }
      if (path === "/services/svc_1") {
        return { id: "svc_1", name: "ویزیت", bookingEnabled: true, additionalFields: [] };
      }
      if (path === "/public/services/svc_1/providers") return { mode: "not_applicable", items: [] };
      if (path === QUOTE_FIXTURE_PATH) {
        return { id: "q1", paymentMode: "full", checkoutPath: "pay_full", payableNowLabel: "۲۵۰٬۰۰۰ تومان" };
      }
      throw new ApiError({ status: 404, message: "نیست" });
    });
    renderWithProviders(<BookingWizard />);
    expect(await screen.findByRole("heading", { name: "تأیید" })).toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "ادامه به پرداخت" }));
    expect(await screen.findByText("این زمان دیگر در دسترس نیست.")).toBeInTheDocument();
  });

  it("returns to summary review when hold creation reports a quote change", async () => {
    const user = userEvent.setup();
    mockedClient.mockImplementation(async (path: string) => {
      if (path === "/customer/bookings/holds") {
        throw new ApiError({ status: 409, code: "QUOTE_CHANGED", message: "changed" });
      }
      if (path === "/public/business") return { name: "مجموعه", bookingEnabled: true };
      if (path === "/services") {
        return { items: [{ id: "svc_1", name: "ویزیت", durationMinutes: 30, bookingEnabled: true }] };
      }
      if (path === "/services/svc_1") {
        return { id: "svc_1", name: "ویزیت", bookingEnabled: true, additionalFields: [] };
      }
      if (path === "/public/services/svc_1/providers") return { mode: "not_applicable", items: [] };
      if (path === QUOTE_FIXTURE_PATH) {
        return { id: "q1", paymentMode: "full", checkoutPath: "pay_full", payableNowLabel: "۲۵۰٬۰۰۰ تومان" };
      }
      throw new ApiError({ status: 404, message: "نیست" });
    });
    renderWithProviders(<BookingWizard />);
    expect(await screen.findByRole("heading", { name: "تأیید" })).toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "ادامه به پرداخت" }));
    expect(await screen.findByText("مبلغ یا شرایط رزرو به‌روزرسانی شد.")).toBeInTheDocument();
  });
});

