import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminBookingSettingsScreen } from "@/features/admin/settings/admin-booking-settings-screen";
import { authenticatedAdmin, createSessionValue, renderWithProviders } from "@/test/render";

/** E2E: Open settings → edit booking → impact preview → confirm → save → queries refresh */

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/settings/booking",
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

vi.mock("@/lib/api/client", () => ({
  apiClient: vi.fn(),
}));

import { apiClient } from "@/lib/api/client";

const mockedClient = vi.mocked(apiClient);

describe("Phase 41 business settings booking flow", () => {
  beforeEach(() => {
    cleanup();
    mockedClient.mockReset();
  });

  it("opens booking settings, confirms impact preview, saves, and refetches", async () => {
    const user = userEvent.setup();
    const session = createSessionValue({
      status: "authenticated",
      user: {
        ...authenticatedAdmin,
        permissionCodes: [],
      },
    });

    let saved = false;
    let version = "v1";

    mockedClient.mockImplementation(async (path: string, init?: { method?: string; body?: unknown }) => {
      const url = String(path);
      const method = init?.method ?? "GET";

      if (method === "GET" && url === "/admin/settings/booking") {
        return {
          version,
          minAdvanceBookingMinutes: saved ? 120 : 60,
          maxAdvanceBookingDays: 30,
          slotIntervalMinutes: 15,
          slotHoldDurationMinutes: 10,
          confirmationMode: "instant",
          providerSelectionEnabled: true,
          anyProviderEnabled: true,
          payAtLocationEnabled: false,
          cancellationPolicyText: "",
          reschedulePolicyText: "",
          confirmationModeOptions: [{ value: "instant", label: "فوری" }],
          fieldUnits: {
            minAdvanceBookingMinutes: "دقیقه",
            maxAdvanceBookingDays: "روز",
            slotIntervalMinutes: "دقیقه",
            slotHoldDurationMinutes: "دقیقه",
          },
          allowedActions: { view: true, edit: true },
          capabilities: { supportsImpactPreview: true },
        };
      }

      if (method === "POST" && url.includes("/impact-preview")) {
        return {
          title: "تأثیر تنظیمات نوبت‌دهی",
          summary: "بازه حداقل رزرو تغییر می‌کند.",
          effects: ["ویزارد رزرو پس از ذخیره به‌روز می‌شود."],
          blocked: false,
          requiresConfirmation: true,
          highImpact: true,
          previewVersion: "prev-1",
          confirmLabel: "تأیید و ذخیره",
        };
      }

      if (method === "PATCH" && url === "/admin/settings/booking") {
        const body = init?.body as Record<string, unknown>;
        expect(body.minAdvanceBookingMinutes).toBe(120);
        expect(body.previewVersion).toBe("prev-1");
        saved = true;
        version = "v2";
        return {
          version,
          minAdvanceBookingMinutes: 120,
          maxAdvanceBookingDays: 30,
          slotIntervalMinutes: 15,
          slotHoldDurationMinutes: 10,
          allowedActions: { view: true, edit: true },
          capabilities: { supportsImpactPreview: true },
          fieldUnits: {},
          confirmationModeOptions: [],
        };
      }

      throw new Error(`Unexpected ${method} ${url}`);
    });

    renderWithProviders(<AdminBookingSettingsScreen />, { session });

    const minAdvance = await screen.findByLabelText(/حداقل زمان رزرو از قبل/i);
    await user.clear(minAdvance);
    await user.type(minAdvance, "120");

    await user.click(screen.getByRole("button", { name: "ذخیره" }));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/ویزارد رزرو پس از ذخیره به‌روز می‌شود/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "تأیید و ذخیره" }));

    await waitFor(() => {
      expect(saved).toBe(true);
    });

    await waitFor(() => {
      expect(screen.getByLabelText(/حداقل زمان رزرو از قبل/i)).toHaveValue("120");
    });

    expect(
      mockedClient.mock.calls.some(
        ([path, init]) =>
          String(path) === "/admin/settings/booking" && init?.method === "PATCH",
      ),
    ).toBe(true);
  });
});
