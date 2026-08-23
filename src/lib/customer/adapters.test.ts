import { describe, expect, it } from "vitest";
import {
  adaptAppointmentPreview,
  adaptCustomerDashboard,
  hasNoUpcomingAppointments,
  UPCOMING_PREVIEW_LIMIT,
} from "@/lib/customer/adapters";

const now = new Date("2026-08-21T12:00:00.000Z");

function appointment(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    serviceName: "ویزیت عمومی",
    startsAt: "2026-08-22T09:00:00.000Z",
    status: "confirmed",
    ...overrides,
  };
}

describe("customer dashboard adapters", () => {
  it("uses the Backend-designated nearest appointment", () => {
    const view = adaptCustomerDashboard(
      {
        nextAppointment: appointment("apt_2", { serviceName: "رادیولوژی" }),
        upcomingAppointments: [appointment("apt_1"), appointment("apt_2", { serviceName: "رادیولوژی" })],
      },
      now,
    );
    expect(view.nextAppointment?.id).toBe("apt_2");
    expect(view.nextAppointment?.serviceName).toBe("رادیولوژی");
  });

  it("falls back to the first upcoming appointment in Backend order", () => {
    const view = adaptCustomerDashboard(
      {
        upcomingAppointments: [appointment("apt_a"), appointment("apt_b")],
      },
      now,
    );
    expect(view.nextAppointment?.id).toBe("apt_a");
  });

  it("limits upcoming appointments and keeps Backend order", () => {
    const view = adaptCustomerDashboard(
      {
        upcomingAppointments: [
          appointment("apt_1"),
          appointment("apt_2"),
          appointment("apt_3"),
          appointment("apt_4"),
        ],
      },
      now,
    );
    expect(view.upcomingAppointments.map((item) => item.id)).toEqual(["apt_1", "apt_2", "apt_3"]);
    expect(view.upcomingAppointments).toHaveLength(UPCOMING_PREVIEW_LIMIT);
  });

  it("does not copy internal resource fields onto the preview", () => {
    const preview = adaptAppointmentPreview(
      appointment("apt_1", {
        roomName: "اتاق ۳",
        device: "دستگاه MRI",
        chair: "صندلی ۷",
        desk: "میز ۲",
        bed: "تخت ۱",
        internalNotes: "یادداشت داخلی",
        providerName: "کارشناس نمونه",
      }),
    );
    expect(preview).toMatchObject({
      id: "apt_1",
      providerName: "کارشناس نمونه",
    });
    expect(JSON.stringify(preview)).not.toMatch(/اتاق|دستگاه|صندلی|میز|تخت|یادداشت داخلی/);
  });

  it("rejects expired payment holds and invalid deep links", () => {
    const view = adaptCustomerDashboard(
      {
        pendingAction: {
          type: "continue_payment",
          title: "ادامه پرداخت",
          href: "https://evil.example/pay",
          validUntil: "2026-08-21T11:00:00.000Z",
        },
        paymentSummary: {
          status: "pending_payment",
          amountLabel: "۱۵۰٬۰۰۰ تومان",
          continueHref: "/payments?hold=x",
          validUntil: "2026-08-21T11:00:00.000Z",
        },
        recentNotifications: [
          {
            id: "n1",
            title: "<b>پرداخت</b>",
            createdAt: "2026-08-21T10:00:00.000Z",
            href: "https://evil.example",
            read: false,
          },
        ],
      },
      now,
    );
    expect(view.pendingAction).toBeNull();
    expect(view.paymentSummary?.continueHref).toBeUndefined();
    expect(view.recentNotifications[0]?.title).toBe("پرداخت");
    expect(view.recentNotifications[0]?.href).toBeUndefined();
  });

  it("keeps a valid internal pending payment action", () => {
    const view = adaptCustomerDashboard(
      {
        pendingAction: {
          type: "continue_payment",
          title: "ادامه پرداخت",
          href: "/payments?appointment=apt_1",
          validUntil: "2026-08-21T13:00:00.000Z",
          valid: true,
        },
      },
      now,
    );
    expect(view.pendingAction?.href).toBe("/payments?appointment=apt_1");
  });

  it("omits recent activity when the public feed is absent and filters internal events", () => {
    expect(adaptCustomerDashboard({}, now).recentActivities).toBeNull();
    const view = adaptCustomerDashboard(
      {
        recentActivities: [
          { id: "a1", type: "appointment_created", title: "نوبت ثبت شد", createdAt: "2026-08-21T09:00:00.000Z" },
          { id: "a2", type: "audit_log", title: "ورود ادمین", createdAt: "2026-08-21T09:01:00.000Z" },
        ],
      },
      now,
    );
    expect(view.recentActivities?.map((item) => item.id)).toEqual(["a1"]);
  });

  it("maps nested widget errors without treating them as empty data", () => {
    const view = adaptCustomerDashboard(
      {
        upcomingAppointments: { error: { status: 500, message: "fail", requestId: "req_1" } },
        notifications: { error: { status: 503, message: "notify fail" } },
      },
      now,
    );
    expect(view.widgets.appointments?.status).toBe("error");
    expect(view.widgets.notifications?.status).toBe("error");
    expect(hasNoUpcomingAppointments(view)).toBe(false);
  });

  it("does not enable booking when the Backend sets bookingEnabled false", () => {
    const view = adaptCustomerDashboard({ bookingEnabled: false }, now);
    expect(view.bookingEnabled).toBe(false);
    expect(hasNoUpcomingAppointments(view)).toBe(true);
  });
});
