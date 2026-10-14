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
    success: true,
    data: {
      period: {
        start: "2026-08-22T20:30:00Z",
        end: "2026-08-23T20:30:00Z",
        timezone: "Asia/Tehran",
        start_date: "2026-08-23",
        end_date: "2026-08-24",
      },
      filters: { branch_id: null },
      generated_at: "2026-08-23T08:00:00Z",
      appointments: {
        total_count: 5,
        status_counts: {
          pending: 1,
          confirmed: 1,
          checked_in: 0,
          in_progress: 0,
          completed: 3,
          cancelled: 0,
          no_show: 0,
          rescheduled: 0,
        },
      },
      revenue: {
        currency: "IRR",
        gross_collected: "500000.00",
        refunded_amount: "0.00",
        net_revenue: "500000.00",
      },
      customer_types: { new_customers: 2, returning_customers: 1 },
      popular_services: [
        {
          service_id: "svc_1",
          title: "ویزیت",
          completed_appointment_count: 3,
          share_percentage: "100.00",
        },
      ],
    },
  };
}

function appointmentsPayload() {
  return {
    success: true,
    data: {
      items: [
        {
          id: "7d0c6f1e-0000-4000-8000-000000000001",
          booking_reference: "APT1",
          starts_at: "2026-08-23T09:00:00Z",
          ends_at: "2026-08-23T09:30:00Z",
          status: "confirmed",
          booking_source: "online",
          created_at: "2026-08-20T09:00:00Z",
          customer: { id: "cus_1", display_name: "سارا محمدی" },
          service: { id: "svc_1", title: "ویزیت" },
          branch: { id: "br_1", name: "شعبه مرکزی" },
          staff: [],
          payment_status: "paid",
        },
      ],
      meta: { page: 1, page_size: 10, total_items: 1, total_pages: 1 },
    },
  };
}

function settingsPayload() {
  return { success: true, data: { business: { timezone: "Asia/Tehran" } } };
}

function backendResponse(path: unknown) {
  const value = String(path);
  if (value.startsWith("/admin/dashboard/summary")) {
    return dashboardPayload();
  }
  if (value.startsWith("/admin/appointments")) {
    return appointmentsPayload();
  }
  return settingsPayload();
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
    mockedClient.mockImplementation(async (path) => backendResponse(path));

    renderWithProviders(<AdminDashboardScreen />, {
      session: createSessionValue({
        status: "authenticated",
        user: authenticatedAdmin,
      }),
    });

    expect(await screen.findByText("نوبت‌های امروز")).toBeInTheDocument();
    expect(screen.getByText("۵")).toBeInTheDocument();
    expect(screen.getByText(/۵۰۰٬۰۰۰/)).toBeInTheDocument();
    expect(screen.getAllByText("سارا محمدی").length).toBeGreaterThan(0);
  });

  it("requests the operational day as a half-open summary range", async () => {
    mockedClient.mockImplementation(async (path) => backendResponse(path));
    renderWithProviders(<AdminDashboardScreen />);
    await screen.findByText("نوبت‌های امروز");

    expect(mockedClient).toHaveBeenCalledWith(
      "/admin/dashboard/summary",
      expect.objectContaining({
        query: { start_date: "2026-08-23", end_date: "2026-08-24" },
      }),
    );
    expect(mockedClient).toHaveBeenCalledWith(
      "/admin/appointments",
      expect.objectContaining({
        query: expect.objectContaining({
          starts_from: "2026-08-22T20:30:00Z",
          starts_to: "2026-08-23T20:30:00Z",
        }),
      }),
    );
  });

  it("shows a distinct state when business settings are not initialized", async () => {
    mockedClient.mockImplementation(async (path) => {
      if (String(path).startsWith("/admin/dashboard/summary")) {
        throw new ApiError({
          status: 404,
          code: "BUSINESS_SETTINGS_NOT_INITIALIZED",
          message: "not initialized",
        });
      }
      return backendResponse(path);
    });
    renderWithProviders(<AdminDashboardScreen />);
    expect(
      await screen.findByText("تنظیمات کسب‌وکار مقداردهی نشده است"),
    ).toBeInTheDocument();
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
      if (String(path).startsWith("/admin/dashboard/summary")) {
        return { success: true, data: { period: { start_date: "2026-08-23" } } };
      }
      return backendResponse(path);
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
    mockedClient.mockImplementation(async (path) => backendResponse(path));

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
    mockedClient.mockImplementation(async (path) => backendResponse(path));
    renderWithProviders(<AdminDashboardScreen />);
    await screen.findByText("نوبت‌های امروز");
    expect(screen.queryByRole("link", { name: "ثبت نوبت جدید" })).not.toBeInTheDocument();
  });

  it("refetches dashboard on manual refresh", async () => {
    mockedClient.mockImplementation(async (path) => backendResponse(path));

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
    mockedClient.mockImplementation(async (path) => backendResponse(path));

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
