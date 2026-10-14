import { describe, expect, it } from "vitest";
import {
  adaptAdminDashboard,
  adaptDashboardSummary,
  hasEmptyOperationalDay,
} from "@/lib/admin/dashboard-adapter";

const emptyDaySummary = {
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
      total_count: 0,
      status_counts: {
        pending: 0,
        confirmed: 0,
        checked_in: 0,
        in_progress: 0,
        completed: 0,
        cancelled: 0,
        no_show: 0,
        rescheduled: 0,
      },
    },
    revenue: { currency: "IRR", net_revenue: "0.00" },
    customer_types: { new_customers: 0, returning_customers: 0 },
    popular_services: [],
  },
};

describe("adaptDashboardSummary", () => {
  it("maps an empty Backend day to ready zero metrics, not to an error", () => {
    const view = adaptDashboardSummary(
      {
        day: emptyDaySummary,
        analytics: { ok: true, payload: emptyDaySummary },
        recent: {
          ok: true,
          payload: { success: true, data: { items: [], meta: { page: 1, page_size: 10, total_items: 0, total_pages: 0 } } },
        },
      },
      "2026-08-01",
    );

    expect(view.operationalDate).toBe("2026-08-23");
    expect(view.timezone).toBe("Asia/Tehran");
    expect(view.operational.todayAppointments).toEqual({ state: "ready", value: 0 });
    expect(view.operational.todayRevenue.state).toBe("ready");
    expect(view.analytics.newCustomers).toEqual({ state: "ready", value: 0 });
    expect(view.analytics.popularServices).toEqual({ status: "ready", data: [] });
    expect(hasEmptyOperationalDay(view)).toBe(true);
  });

  it("keeps failed sections as widget errors", () => {
    const error = { status: 403, code: "FORBIDDEN", message: "denied", requestId: "req_9" };
    const view = adaptDashboardSummary(
      {
        day: emptyDaySummary,
        analytics: { ok: false, error },
        recent: { ok: false, error },
      },
      "2026-08-23",
    );

    expect(view.analytics.newCustomers).toEqual({ state: "error", error });
    expect(view.analytics.popularServices).toEqual({ status: "error", error });
    expect(view.recentAppointments).toEqual({ status: "error", error });
    expect(hasEmptyOperationalDay(view)).toBe(false);
  });

  it("derives upcoming and needing-action counts from Backend status counts", () => {
    const view = adaptDashboardSummary(
      {
        day: {
          data: {
            ...emptyDaySummary.data,
            appointments: {
              total_count: 6,
              status_counts: { ...emptyDaySummary.data.appointments.status_counts, pending: 2, confirmed: 3, completed: 1 },
            },
          },
        },
        analytics: { ok: true, payload: emptyDaySummary },
        recent: { ok: true, payload: { data: { items: [] } } },
      },
      "2026-08-23",
    );

    expect(view.operational.needingAction).toEqual({ state: "ready", value: 2 });
    expect(view.operational.upcoming).toEqual({ state: "ready", value: 5 });
    expect(view.operational.completed).toEqual({ state: "ready", value: 1 });
  });
});

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
