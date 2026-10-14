import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BookingWizard } from "@/features/booking/booking-wizard";
import { PaymentScreen } from "@/features/booking/payment-screen";
import { routes } from "@/constants/routes";
import { rewriteBackendRequest } from "@/lib/api/backend-contract";
import { ApiError } from "@/lib/api/errors";
import { paymentNavigation } from "@/lib/api/payment";
import { HOLD_SESSION_KEY } from "@/lib/booking/hold-session";
import { BOOKING_DRAFT_STORAGE_KEY } from "@/lib/booking/persistence";
import { renderWithProviders } from "@/test/render";

/**
 * Real `@/lib/api/booking` (no quote fixture): the Backend has no quote/preview endpoint.
 * The wizard creates the appointment with `POST /appointments/me` and lets the Backend
 * price it; it never invents prices, holds or payments, and cannot book without a branch.
 */

const replace = vi.fn();
const push = vi.fn();
const navigation = { search: new URLSearchParams() };

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push }),
  usePathname: () => "/booking",
  useSearchParams: () => navigation.search,
}));

vi.mock("@/lib/api/client", () => ({
  apiClient: vi.fn(),
}));

import { apiClient } from "@/lib/api/client";

const mockedClient = vi.mocked(apiClient);

const WRITE_PATHS = ["/customer/bookings", "/customer/bookings/holds", "/customer/payments/sessions"];
const START = Date.UTC(2026, 7, 22, 6, 30);

function persistCheckoutDraft(branchId: string | null) {
  window.sessionStorage.setItem(
    BOOKING_DRAFT_STORAGE_KEY,
    JSON.stringify({
      version: 1,
      expiresAt: "2099-01-01T00:00:00.000Z",
      currentStep: "checkout",
      serviceId: "svc_1",
      branchId,
      providerPreference: { type: "not_applicable" },
      date: "2026-08-22",
      slotId: `slot_${START}`,
    }),
  );
}

function writes() {
  return mockedClient.mock.calls.filter(([path, init]) => WRITE_PATHS.includes(path) && init?.method === "POST");
}

beforeEach(() => {
  mockedClient.mockReset();
  replace.mockReset();
  push.mockReset();
  window.sessionStorage.clear();
  navigation.search = new URLSearchParams("step=checkout");
  mockedClient.mockImplementation(async (path: string, init) => {
    if (path === "/services") {
      return { items: [{ id: "svc_1", name: "ویزیت", durationMinutes: 30, bookingEnabled: true }] };
    }
    if (path === "/services/svc_1") {
      return { id: "svc_1", name: "ویزیت", bookingEnabled: true, additionalFields: [] };
    }
    if (path === "/customer/bookings/holds/hold_1") {
      return { id: "hold_1", status: "active", expiresAt: "2099-01-01T00:00:00.000Z" };
    }
    if (path === "/customer/bookings" && init?.method === "POST") {
      return {
        appointment: {
          id: "6f1c1d2e-0000-4000-8000-000000000001",
          booking_reference: "BK7Q2M",
          status: "pending",
          payment_status: "unpaid",
          price_snapshot: "150000.00",
          actions: { can_cancel: true, can_reschedule: true, can_repeat: false, can_pay: true },
        },
        idempotent_replay: false,
      };
    }
    throw new ApiError({ status: 404, message: "نیست" });
  });
});

describe("checkout against the current Backend contract", () => {
  it("keeps final submission disabled without a branch and creates nothing", async () => {
    persistCheckoutDraft(null);
    renderWithProviders(<BookingWizard />);
    expect(await screen.findByRole("heading", { name: "تأیید" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "ثبت نهایی" })).toBeDisabled();
    expect(screen.queryByText(/تومان/)).not.toBeInTheDocument();
    expect(writes()).toEqual([]);
  });

  it("with a branch, creates the appointment through POST /appointments/me without a quote or hold", async () => {
    const user = userEvent.setup();
    persistCheckoutDraft("br_1");
    renderWithProviders(<BookingWizard />);
    const submit = await screen.findByRole("button", { name: "ثبت نهایی" });
    await waitFor(() => expect(submit).toBeEnabled());
    expect(screen.queryByText(/تومان/)).not.toBeInTheDocument();
    await user.click(submit);

    await waitFor(() => expect(writes()).toHaveLength(1));
    const [path, init] = writes()[0]!;
    expect(path).toBe("/customer/bookings");
    expect(init?.headers).toEqual(expect.objectContaining({ "Idempotency-Key": expect.any(String) }));
    const rewritten = rewriteBackendRequest({ path, method: "POST", body: init?.body });
    expect(rewritten.path).toBe("/appointments/me");
    expect(rewritten.body).toEqual({
      service_id: "svc_1",
      branch_id: "br_1",
      start_time: new Date(START).toISOString(),
    });
    expect(mockedClient.mock.calls.some(([callPath]) => callPath === "/coupons/validate")).toBe(false);
    await waitFor(() => expect(push).toHaveBeenCalledWith(routes.customer.bookingConfirmation("BK7Q2M")));
    expect(await screen.findByText("در حال انتقال به صفحه تأیید")).toBeInTheDocument();
    const pushedAt = push.mock.invocationCallOrder.at(-1)!;
    expect(replace.mock.invocationCallOrder.filter((order) => order > pushedAt)).toEqual([]);
  });

  it("payment screen explains that no payment method is available and never redirects", async () => {
    persistCheckoutDraft(null);
    const assign = vi.spyOn(paymentNavigation, "assign").mockImplementation(() => undefined);
    window.sessionStorage.setItem(HOLD_SESSION_KEY, JSON.stringify({ version: 1, publicReference: "hold_1" }));
    renderWithProviders(<PaymentScreen />);
    expect(await screen.findByText("روش پرداخت از سرویس دریافت نشد")).toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(writes()).toEqual([]);
    expect(assign).not.toHaveBeenCalled();
  });
});
