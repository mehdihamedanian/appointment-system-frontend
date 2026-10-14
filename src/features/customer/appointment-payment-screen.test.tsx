import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppointmentPaymentScreen } from "@/features/customer/appointment-payment-screen";
import { ApiError } from "@/lib/api/errors";
import { paymentNavigation } from "@/lib/api/payment";
import { PAYMENT_SESSION_KEY } from "@/lib/payment/session-store";
import { renderWithProviders } from "@/test/render";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace }),
  usePathname: () => "/appointments/APT-698A0409/payment",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/api/client", () => ({
  apiClient: vi.fn(),
}));

vi.mock("@/config/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/config/env")>();
  return { ...actual, env: { ...actual.env, paymentGatewayOrigins: ["https://fake-gateway.test"] } };
});

import { apiClient } from "@/lib/api/client";

const mockedClient = vi.mocked(apiClient);

const APPOINTMENT_UUID = "f6e9a5a2-85aa-48d2-86bf-6f134a9e31d7";

/** `GET /appointments/me/{reference}` — `CustomerAppointmentDetail`. */
const detail = {
  id: APPOINTMENT_UUID,
  booking_reference: "APT-698A0409",
  starts_at: "2026-10-15T06:15:00Z",
  ends_at: "2026-10-15T06:45:00Z",
  status: "pending",
  payment_status: "unpaid",
  service: { id: "3fd22740-b8e6-4813-add2-d9979ffe8ab4", title: "مشاوره آزمون" },
  branch: { id: "11111111-2222-4333-8444-555555555555", name: "E2E Branch" },
  staff: [],
  payment: {
    payment_status: "unpaid",
    currency: "IRR",
    total_amount: "150000.00",
    successful_paid_amount: "0.00",
    outstanding_balance: "150000.00",
  },
  actions: { can_cancel: true, can_reschedule: true, can_repeat: false, can_pay: true },
};

const intent = {
  appointment_id: APPOINTMENT_UUID,
  payment_id: "0d5f7a4c-2b1e-4f3a-8c6d-9e7b5a3c1d2f",
  intent_id: "3c0a7f2e-1d4b-4c8e-9f6a-2b5d7e9c1a3f",
  payment_type: "full",
  amount: "150000.00",
  currency: "IRR",
  intent_status: "processing",
  payment_status: "unpaid",
  payment_url: "https://fake-gateway.test/pay/ref_1",
};

describe("AppointmentPaymentScreen", () => {
  beforeEach(() => {
    mockedClient.mockReset();
    replace.mockReset();
    window.sessionStorage.clear();
    document.documentElement.dir = "rtl";
    vi.spyOn(paymentNavigation, "assign").mockImplementation(() => undefined).mockClear();
  });

  it("creates an intent for the appointment UUID and redirects to the allowed gateway", async () => {
    mockedClient.mockImplementation(async (path: string) => {
      if (path === "/customer/appointments/APT-698A0409") return detail;
      if (path === "/customer/payments/sessions") return intent;
      throw new ApiError({ status: 404, message: "نیست" });
    });
    const user = userEvent.setup();
    renderWithProviders(<AppointmentPaymentScreen reference="APT-698A0409" />);
    expect(await screen.findByRole("heading", { name: "مشاوره آزمون" })).toBeInTheDocument();
    expect(screen.getByText("مانده قابل پرداخت")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "پرداخت آنلاین" }));
    await waitFor(() => {
      expect(paymentNavigation.assign).toHaveBeenCalledWith("https://fake-gateway.test/pay/ref_1");
    });
    const call = mockedClient.mock.calls.find(([path]) => path === "/customer/payments/sessions");
    expect(call?.[1]).toEqual(
      expect.objectContaining({
        method: "POST",
        headers: { "Idempotency-Key": expect.any(String) },
        body: expect.objectContaining({ method: "full", bookingReference: APPOINTMENT_UUID }),
      }),
    );
    expect(call?.[1]?.body).not.toHaveProperty("amount");
    expect(JSON.parse(window.sessionStorage.getItem(PAYMENT_SESSION_KEY) ?? "{}").paymentReference).toBe(
      intent.intent_id,
    );
  });

  it("refuses a gateway URL outside the allowlist", async () => {
    mockedClient.mockImplementation(async (path: string) => {
      if (path === "/customer/appointments/APT-698A0409") return detail;
      if (path === "/customer/payments/sessions") {
        return { ...intent, payment_url: "https://evil.example/phish" };
      }
      throw new ApiError({ status: 404, message: "نیست" });
    });
    const user = userEvent.setup();
    renderWithProviders(<AppointmentPaymentScreen reference="APT-698A0409" />);
    await user.click(await screen.findByRole("button", { name: "پرداخت آنلاین" }));
    expect(await screen.findByText(/نشانی درگاه پرداخت معتبر یا مجاز نبود/)).toBeInTheDocument();
    expect(paymentNavigation.assign).not.toHaveBeenCalled();
  });

  it("does not offer payment when the backend disallows it", async () => {
    mockedClient.mockImplementation(async (path: string) => {
      if (path === "/customer/appointments/APT-698A0409") {
        return { ...detail, actions: { ...detail.actions, can_pay: false } };
      }
      throw new ApiError({ status: 404, message: "نیست" });
    });
    renderWithProviders(<AppointmentPaymentScreen reference="APT-698A0409" />);
    expect(await screen.findByText("پرداخت آنلاین برای این نوبت در دسترس نیست")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "پرداخت آنلاین" })).not.toBeInTheDocument();
    expect(mockedClient).not.toHaveBeenCalledWith("/customer/payments/sessions", expect.anything());
  });
});
