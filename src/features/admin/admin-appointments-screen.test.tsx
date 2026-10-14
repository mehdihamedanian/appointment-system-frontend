import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import { axeViolations } from "@/test/axe";
import { AdminAppointmentsScreen } from "@/features/admin/admin-appointments-screen";
import { ApiError } from "@/lib/api/errors";
import { authenticatedAdmin, createSessionValue, renderWithProviders } from "@/test/render";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/appointments",
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/api/client", () => ({
  apiClient: vi.fn(),
}));

import { apiClient } from "@/lib/api/client";

const mockedClient = vi.mocked(apiClient);

function listPayload() {
  return {
    items: [
      {
        id: "apt_1",
        reference: "REF-1",
        customerName: "سارا محمدی",
        serviceName: "ویزیت",
        startsAt: "2026-08-23T09:00:00.000Z",
        status: "confirmed",
        paymentStatus: "paid",
        allowedActions: { confirm: false },
      },
    ],
    page: 1,
    pageCount: 1,
  };
}

describe("AdminAppointmentsScreen", () => {
  beforeEach(() => {
    mockedClient.mockReset();
  });

  it("renders list from backend", async () => {
    mockedClient.mockResolvedValue(listPayload());
    renderWithProviders(<AdminAppointmentsScreen />, {
      session: createSessionValue({ status: "authenticated", user: authenticatedAdmin }),
    });
    expect((await screen.findAllByText("سارا محمدی")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("REF-1").length).toBeGreaterThan(0);
  });

  it("renders an accessible appointments table", async () => {
    mockedClient.mockResolvedValue(listPayload());
    renderWithProviders(<AdminAppointmentsScreen />, {
      session: createSessionValue({ status: "authenticated", user: authenticatedAdmin }),
    });
    const table = await screen.findByRole("table");
    expect(within(table).getAllByRole("columnheader").length).toBeGreaterThan(0);
    expect(await axeViolations()).toEqual([]);
  });

  it("shows 404 missing endpoint state", async () => {
    mockedClient.mockRejectedValue(new ApiError({ status: 404, message: "missing" }));
    renderWithProviders(<AdminAppointmentsScreen />);
    expect(await screen.findByText("فهرست نوبت‌ها در دسترس نیست")).toBeInTheDocument();
  });

  it("denies without admin.appointments.view when codes are granular", async () => {
    mockedClient.mockResolvedValue(listPayload());
    renderWithProviders(<AdminAppointmentsScreen />, {
      session: createSessionValue({
        status: "authenticated",
        user: { ...authenticatedAdmin, permissionCodes: ["admin.dashboard.view"] },
      }),
    });
    expect(
      await screen.findByText("مجوز لازم برای مشاهده این بخش را ندارید."),
    ).toBeInTheDocument();
  });
});

describe("AdminAppointmentsScreen search", () => {
  beforeEach(() => {
    mockedClient.mockReset();
    mockedClient.mockResolvedValue(listPayload());
  });

  it("renders search input for server-side query", async () => {
    mockedClient.mockResolvedValue(listPayload());
    renderWithProviders(<AdminAppointmentsScreen />);
    await screen.findAllByText("سارا محمدی");
    expect(screen.getByLabelText("جستجوی نوبت")).toBeInTheDocument();
  });
});
