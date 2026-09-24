import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient } from "@tanstack/react-query";
import { AdminDashboardScreen } from "@/features/admin/admin-dashboard-screen";
import { ApiError } from "@/lib/api/errors";
import { queryKeys } from "@/lib/query/keys";
import {
  authenticatedAdmin,
  createSessionValue,
  renderWithProviders,
} from "@/test/render";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin",
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams("date=2026-08-23"),
}));

vi.mock("@/lib/api/client", () => ({
  apiClient: vi.fn(),
}));

import { apiClient } from "@/lib/api/client";

const mockedClient = vi.mocked(apiClient);

function dashboardPayload() {
  return {
    operationalDate: "2026-08-23",
    timezone: "Asia/Tehran",
    lastUpdatedAt: "2026-08-23T08:00:00.000Z",
    operational: {
      todayAppointments: { value: 5 },
      upcoming: { value: 2 },
      needingAction: { value: 1 },
      completed: { value: 3 },
      cancelled: { value: 0 },
      noShow: { value: 0 },
      todayRevenue: { amountLabel: "۵۰۰٬۰۰۰ ریال" },
    },
    recentAppointments: {
      items: [
        {
          id: "apt_1",
          customerName: "سارا محمدی",
          serviceName: "ویزیت",
          startsAt: "2026-08-23T09:00:00.000Z",
          status: "confirmed",
          paymentStatus: "paid",
        },
      ],
    },
    analytics: {
      newCustomers: { value: 2 },
      peakHours: {
        items: [{ hourLabel: "09:00", countLabel: "3", barPercent: 60 }],
      },
    },
  };
}

describe("AdminDashboardScreen", () => {
  beforeEach(() => {
    mockedClient.mockReset();
  });

  it("does not fetch while session is loading", () => {
    renderWithProviders(<AdminDashboardScreen />, {
      session: createSessionValue({ status: "loading", user: null }),
    });
    expect(mockedClient).not.toHaveBeenCalled();
  });

  it("renders operational metrics from backend", async () => {
    mockedClient.mockImplementation(async (path) => {
      if (String(path).includes("/admin/dashboard")) {
        return dashboardPayload();
      }
      return { name: "کلینیک", timezone: "Asia/Tehran", branchesEnabled: false };
    });

    renderWithProviders(<AdminDashboardScreen />, {
      session: createSessionValue({
        status: "authenticated",
        user: authenticatedAdmin,
      }),
    });

    expect(await screen.findByText("نوبت‌های امروز")).toBeInTheDocument();
    expect(screen.getByText("۵")).toBeInTheDocument();
    expect(screen.getByText("۵۰۰٬۰۰۰ ریال")).toBeInTheDocument();
    expect(screen.getAllByText("سارا محمدی").length).toBeGreaterThan(0);
  });

  it("shows permission denied for forbidden dashboard", async () => {
    mockedClient.mockRejectedValue(new ApiError({ status: 403, message: "forbidden" }));
    renderWithProviders(<AdminDashboardScreen />, {
      session: createSessionValue({
        status: "authenticated",
        user: { ...authenticatedAdmin, permissionCodes: ["admin.dashboard.view"] },
      }),
    });
    expect(await screen.findByText("دسترسی مجاز نیست")).toBeInTheDocument();
  });

  it("shows unavailable metrics as em dash", async () => {
    mockedClient.mockImplementation(async (path) => {
      if (String(path).includes("/admin/dashboard")) {
        return { operationalDate: "2026-08-23", operational: {} };
      }
      return { name: "کلینیک", timezone: "Asia/Tehran" };
    });
    renderWithProviders(<AdminDashboardScreen />);
    const dashes = await screen.findAllByText("—");
    expect(dashes.length).toBeGreaterThan(0);
  });

  it("shows backend missing state for 404 dashboard endpoint", async () => {
    mockedClient.mockRejectedValue(new ApiError({ status: 404, message: "missing" }));
    renderWithProviders(<AdminDashboardScreen />);
    expect(
      await screen.findByText("داشبورد مدیریت در دسترس نیست"),
    ).toBeInTheDocument();
  });

  it("uses distinct query keys when branch filter changes", async () => {
    mockedClient.mockImplementation(async (path) => {
      if (String(path).includes("/admin/dashboard")) {
        return dashboardPayload();
      }
      if (String(path).includes("/public/branches")) {
        return [{ id: "br_1", name: "شعبه مرکزی" }];
      }
      return { name: "کلینیک", timezone: "Asia/Tehran", branchesEnabled: true };
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    renderWithProviders(<AdminDashboardScreen />, {
      queryClient,
      session: createSessionValue({
        status: "authenticated",
        user: authenticatedAdmin,
      }),
    });

    await screen.findByText("نوبت‌های امروز");

    const baseKey = queryKeys.admin.dashboard(authenticatedAdmin.id, {
      date: "2026-08-23",
    });
    await waitFor(() => {
      expect(queryClient.getQueryState(baseKey)?.status).toBe("success");
    });
  });

  it("hides quick add when manual booking route is disabled", async () => {
    mockedClient.mockImplementation(async (path) => {
      if (String(path).includes("/admin/dashboard")) {
        return { ...dashboardPayload(), manualBookingEnabled: true };
      }
      return { name: "کلینیک", timezone: "Asia/Tehran" };
    });
    renderWithProviders(<AdminDashboardScreen />);
    await screen.findByText("نوبت‌های امروز");
    expect(screen.queryByRole("link", { name: "ثبت نوبت جدید" })).not.toBeInTheDocument();
  });

  it("refetches dashboard on manual refresh", async () => {
    mockedClient.mockImplementation(async (path) => {
      if (String(path).includes("/admin/dashboard")) {
        return dashboardPayload();
      }
      return { name: "کلینیک", timezone: "Asia/Tehran" };
    });

    const user = userEvent.setup();
    renderWithProviders(<AdminDashboardScreen />);
    await screen.findByText("نوبت‌های امروز");

    const before = mockedClient.mock.calls.filter((call) =>
      String(call[0]).includes("/admin/dashboard"),
    ).length;

    await user.click(screen.getByRole("button", { name: "به‌روزرسانی" }));

    await waitFor(() => {
      const after = mockedClient.mock.calls.filter((call) =>
        String(call[0]).includes("/admin/dashboard"),
      ).length;
      expect(after).toBeGreaterThan(before);
    });
  });

  it("denies dashboard when granular permission is missing", async () => {
    mockedClient.mockImplementation(async (path) => {
      if (String(path).includes("/admin/dashboard")) {
        return dashboardPayload();
      }
      return { name: "کلینیک", timezone: "Asia/Tehran" };
    });

    renderWithProviders(<AdminDashboardScreen />, {
      session: createSessionValue({
        status: "authenticated",
        user: {
          ...authenticatedAdmin,
          permissionCodes: ["admin.appointments.view"],
        },
      }),
    });

    expect(
      await screen.findByText("مجوز لازم برای مشاهده این بخش را ندارید."),
    ).toBeInTheDocument();
  });
});
