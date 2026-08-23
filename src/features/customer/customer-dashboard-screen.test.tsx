import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { QueryClient } from "@tanstack/react-query";
import { CustomerDashboardScreen } from "@/features/customer/customer-dashboard-screen";
import { CustomerGuard } from "@/features/auth/guards";
import { ApiError } from "@/lib/api/errors";
import { clearFrontendCaches } from "@/lib/auth/session";
import { queryKeys } from "@/lib/query/keys";
import {
  createSessionValue,
  renderWithProviders,
} from "@/test/render";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/api/client", () => ({
  apiClient: vi.fn(),
}));

import { apiClient } from "@/lib/api/client";

const mockedClient = vi.mocked(apiClient);

function appointmentPayload() {
  return {
    customer: { displayName: "سارا محمدی" },
    nextAppointment: {
      id: "apt_1",
      serviceName: "ویزیت",
      startsAt: "2026-08-22T09:00:00.000Z",
      status: "confirmed",
    },
    upcomingAppointments: [
      {
        id: "apt_1",
        serviceName: "ویزیت",
        startsAt: "2026-08-22T09:00:00.000Z",
        status: "confirmed",
      },
    ],
    bookingEnabled: true,
    unreadNotificationCount: 0,
  };
}

describe("customer dashboard screen", () => {
  beforeEach(() => {
    mockedClient.mockReset();
  });

  it("does not render dashboard data while the session is loading", () => {
    renderWithProviders(
      <CustomerGuard>
        <CustomerDashboardScreen />
      </CustomerGuard>,
      { session: createSessionValue({ status: "loading", user: null }) },
    );
    expect(screen.queryByRole("heading", { name: "سارا محمدی" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("در حال بررسی دسترسی")).toBeInTheDocument();
    expect(mockedClient).not.toHaveBeenCalled();
  });

  it("does not fetch dashboard data for expired sessions", () => {
    renderWithProviders(<CustomerDashboardScreen />, {
      session: createSessionValue({ status: "expired", user: null }),
    });
    expect(screen.getByLabelText("در حال بارگذاری داشبورد")).toBeInTheDocument();
    expect(mockedClient).not.toHaveBeenCalled();
    expect(screen.queryByText("ویزیت")).not.toBeInTheDocument();
  });

  it("renders a successful dashboard from the customer contract", async () => {
    mockedClient.mockImplementation(async (path) => {
      if (String(path).includes("/customer/dashboard")) {
        return appointmentPayload();
      }
      return { name: "کلینیک", bookingEnabled: true, phone: "02112345678" };
    });

    renderWithProviders(<CustomerDashboardScreen />);

    expect(await screen.findByRole("heading", { name: "نزدیک‌ترین نوبت" })).toBeInTheDocument();
    expect(screen.getByText("ویزیت")).toBeInTheDocument();
  });

  it("shows permission denied when the dashboard is forbidden", async () => {
    mockedClient.mockRejectedValue(
      new ApiError({ status: 403, message: "forbidden" }),
    );
    renderWithProviders(<CustomerDashboardScreen />);
    expect(await screen.findByText("دسترسی مجاز نیست")).toBeInTheDocument();
    expect(screen.queryByText("ویزیت")).not.toBeInTheDocument();
  });

  it("shows a full-page error instead of an empty dashboard when the request fails", async () => {
    mockedClient.mockRejectedValue(
      new ApiError({ status: 500, message: "server", requestId: "req_9" }),
    );
    renderWithProviders(<CustomerDashboardScreen />);
    expect(await screen.findByText("داشبورد بارگذاری نشد")).toBeInTheDocument();
    expect(screen.queryByText("نوبت پیش‌رویی ندارید")).not.toBeInTheDocument();
  });
});

describe("dashboard cache isolation", () => {
  it("clears customer dashboard cache on logout", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(queryKeys.customer.dashboard("user_1"), { secret: true });
    queryClient.setQueryData(queryKeys.customer.dashboard("user_2"), { other: true });
    clearFrontendCaches(queryClient);
    expect(queryClient.getQueryData(queryKeys.customer.dashboard("user_1"))).toBeUndefined();
    expect(queryClient.getQueryData(queryKeys.customer.dashboard("user_2"))).toBeUndefined();
  });

  it("scopes dashboard cache per customer", () => {
    expect(queryKeys.customer.dashboard("user_1")).not.toEqual(
      queryKeys.customer.dashboard("user_2"),
    );
  });
});
