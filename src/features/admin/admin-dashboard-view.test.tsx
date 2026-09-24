import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AdminDashboardView } from "@/features/admin/admin-dashboard-view";
import { authenticatedAdmin } from "@/test/render";
import type { AdminDashboardView as AdminDashboardViewModel } from "@/types/admin-dashboard";

function baseView(overrides: Partial<AdminDashboardViewModel> = {}): AdminDashboardViewModel {
  return {
    operationalDate: "2026-08-23",
    timezone: "Asia/Tehran",
    operational: {
      todayAppointments: { state: "ready", value: 0 },
      upcoming: { state: "ready", value: 0 },
      needingAction: { state: "ready", value: 0 },
      completed: { state: "ready", value: 0 },
      cancelled: { state: "ready", value: 0 },
      noShow: { state: "ready", value: 0 },
      todayRevenue: { state: "unavailable" },
    },
    recentAppointments: { status: "ready", data: [] },
    alerts: [],
    analytics: {},
    manualBookingEnabled: false,
    ...overrides,
  };
}

describe("AdminDashboardView", () => {
  it("shows empty operational day message for valid zero day", () => {
    render(
      <AdminDashboardView
        view={baseView()}
        user={authenticatedAdmin}
        branches={[]}
        showBranchFilter={false}
        showResourceUtilization={false}
        onRefresh={vi.fn()}
        onRetryWidget={vi.fn()}
      />,
    );
    expect(screen.getByText("امروز نوبتی ثبت نشده است.")).toBeInTheDocument();
  });

  it("renders accessible peak hours summary", () => {
    render(
      <AdminDashboardView
        view={baseView({
          analytics: {
            peakHours: {
              status: "ready",
              data: [{ hourLabel: "10:00", countLabel: "4", barPercent: 80 }],
            },
          },
        })}
        user={authenticatedAdmin}
        branches={[]}
        showBranchFilter={false}
        showResourceUtilization={false}
        onRefresh={vi.fn()}
        onRetryWidget={vi.fn()}
      />,
    );
    expect(screen.getByText("ساعات شلوغ")).toBeInTheDocument();
    expect(document.getElementById("peak-hours-summary")).toHaveTextContent("10:00: 4");
  });

  it("hides resource utilization without permission", () => {
    render(
      <AdminDashboardView
        view={baseView({
          analytics: {
            resourceUtilization: {
              status: "ready",
              data: [
                {
                  id: "res_1",
                  name: "اتاق ۱",
                  utilizationLabel: "۷۵٪",
                  barPercent: 75,
                },
              ],
            },
          },
        })}
        user={authenticatedAdmin}
        branches={[]}
        showBranchFilter={false}
        showResourceUtilization={false}
        onRefresh={vi.fn()}
        onRetryWidget={vi.fn()}
      />,
    );
    expect(screen.queryByText("بهره‌وری منابع")).not.toBeInTheDocument();
  });
});
