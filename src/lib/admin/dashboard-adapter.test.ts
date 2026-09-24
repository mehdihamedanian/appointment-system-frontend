import { describe, expect, it } from "vitest";
import { adaptAdminDashboard } from "@/lib/admin/dashboard-adapter";

describe("adaptAdminDashboard", () => {
  it("maps operational counts and revenue from backend payload", () => {
    const view = adaptAdminDashboard(
      {
        operationalDate: "2026-08-23",
        timezone: "Asia/Tehran",
        operational: {
          todayAppointments: { value: 12 },
          upcoming: { value: 4 },
          needingAction: { value: 2 },
          completed: { value: 6 },
          cancelled: { value: 1 },
          noShow: { value: 0 },
          todayRevenue: { amountLabel: "۱٬۲۰۰٬۰۰۰ ریال" },
        },
        recentAppointments: {
          items: [
            {
              id: "apt_1",
              customerName: "علی رضایی",
              serviceName: "ویزیت",
              startsAt: "2026-08-23T09:00:00.000Z",
              status: "confirmed",
              paymentStatus: "paid",
            },
          ],
        },
      },
      "2026-08-22",
    );

    expect(view.operational.todayAppointments).toEqual({ state: "ready", value: 12 });
    expect(view.operational.noShow).toEqual({ state: "ready", value: 0 });
    expect(view.operational.todayRevenue).toEqual({
      state: "ready",
      amountLabel: "۱٬۲۰۰٬۰۰۰ ریال",
    });
    expect(view.recentAppointments.status).toBe("ready");
    if (view.recentAppointments.status === "ready") {
      expect(view.recentAppointments.data[0]?.status).toBe("confirmed");
    }
  });

  it("treats missing metrics as unavailable instead of zero", () => {
    const view = adaptAdminDashboard({}, "2026-08-23");
    expect(view.operational.todayAppointments.state).toBe("unavailable");
    expect(view.operational.todayRevenue.state).toBe("unavailable");
  });

  it("maps unknown appointment status without collapsing to completed", () => {
    const view = adaptAdminDashboard(
      {
        recentAppointments: [
          {
            id: "apt_x",
            customerName: "نمونه",
            serviceName: "خدمت",
            startsAt: "2026-08-23T10:00:00.000Z",
            status: "mystery_status",
          },
        ],
      },
      "2026-08-23",
    );
    expect(view.recentAppointments.status).toBe("ready");
    if (view.recentAppointments.status === "ready") {
      expect(view.recentAppointments.data[0]?.status).toBe("unknown");
    }
  });

  it("surfaces widget-level recent appointment errors", () => {
    const view = adaptAdminDashboard(
      {
        recentAppointments: {
          error: { status: 500, message: "failed", requestId: "req_1" },
        },
      },
      "2026-08-23",
    );
    expect(view.recentAppointments.status).toBe("error");
    if (view.recentAppointments.status === "error") {
      expect(view.recentAppointments.error.requestId).toBe("req_1");
    }
  });
});
