import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DashboardView } from "@/features/customer/dashboard-view";
import { adaptCustomerDashboard } from "@/lib/customer/adapters";
import { renderWithProviders } from "@/test/render";
import type { CustomerDashboardView } from "@/types/customer";

const retry = vi.fn();

function renderDashboard(view: CustomerDashboardView, bookingEnabled = view.bookingEnabled) {
  return renderWithProviders(
    <DashboardView view={view} bookingEnabled={bookingEnabled} phone="02112345678" onRetry={retry} />,
  );
}

function appointment(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    serviceName: `خدمت ${id}`,
    startsAt: "2026-08-22T09:00:00.000Z",
    status: "confirmed",
    timezone: "Asia/Tehran",
    ...overrides,
  };
}

describe("customer dashboard view", () => {
  it("prioritizes the nearest appointment and limits upcoming preview", () => {
    const view = adaptCustomerDashboard({
      customer: { displayName: "سارا محمدی" },
      nextAppointment: appointment("apt_1", { serviceName: "ویزیت" }),
      upcomingAppointments: [
        appointment("apt_1", { serviceName: "ویزیت" }),
        appointment("apt_2", { serviceName: "سونوگرافی" }),
        appointment("apt_3", { serviceName: "مشاوره" }),
        appointment("apt_4", { serviceName: "نباید دیده شود" }),
      ],
    });
    renderDashboard(view);

    expect(screen.getByRole("heading", { level: 1, name: "سارا محمدی" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "نزدیک‌ترین نوبت" })).toBeInTheDocument();
    expect(screen.getByText("ویزیت")).toBeInTheDocument();
    expect(screen.getByText("سونوگرافی")).toBeInTheDocument();
    expect(screen.getByText("مشاوره")).toBeInTheDocument();
    expect(screen.queryByText("نباید دیده شود")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "مشاهده همه نوبت‌ها" })).toHaveAttribute(
      "href",
      "/appointments",
    );
    expect(screen.getByRole("link", { name: "مشاهده جزئیات" })).toHaveAttribute(
      "href",
      "/appointments/apt_1",
    );
  });

  it("shows a purposeful empty state for new customers", () => {
    renderDashboard(adaptCustomerDashboard({ customer: { displayName: "مشتری جدید" } }));
    expect(screen.getByRole("heading", { name: "نوبت پیش‌رویی ندارید" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "رزرو نوبت جدید" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "رزرو نوبت جدید" })[0]).toHaveAttribute("href", "/booking");
    expect(screen.queryByRole("heading", { name: "نزدیک‌ترین نوبت" })).not.toBeInTheDocument();
    expect(screen.queryByText("پرداخت")).not.toBeInTheDocument();
  });

  it("explains booking-disabled without a booking CTA", () => {
    renderDashboard(
      adaptCustomerDashboard({
        bookingEnabled: false,
        nextAppointment: appointment("apt_1"),
        upcomingAppointments: [appointment("apt_1")],
      }),
      false,
    );
    expect(screen.getByText("رزرو آنلاین فعال نیست")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "رزرو نوبت جدید" })).not.toBeInTheDocument();
  });

  it("hides the payment widget when no payment data is returned", () => {
    renderDashboard(
      adaptCustomerDashboard({
        nextAppointment: appointment("apt_1"),
        upcomingAppointments: [appointment("apt_1")],
      }),
    );
    expect(screen.queryByRole("heading", { name: "پرداخت" })).not.toBeInTheDocument();
  });

  it("shows payment summary and disables expired continue actions", () => {
    renderDashboard(
      adaptCustomerDashboard(
        {
          nextAppointment: appointment("apt_1"),
          paymentSummary: {
            status: "pending_payment",
            amountLabel: "۱۵۰٬۰۰۰ تومان",
            continueHref: "/payments",
            validUntil: "2026-08-21T11:00:00.000Z",
          },
        },
        new Date("2026-08-21T12:00:00.000Z"),
      ),
    );
    expect(screen.getByRole("heading", { name: "پرداخت" })).toBeInTheDocument();
    expect(screen.getByText("۱۵۰٬۰۰۰ تومان")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "ادامه پرداخت" })).not.toBeInTheDocument();
  });

  it("announces unread notifications in text, not only color", () => {
    renderDashboard(
      adaptCustomerDashboard({
        unreadNotificationCount: 2,
        recentNotifications: [
          {
            id: "n1",
            title: "نوبت تأیید شد",
            createdAt: "2026-08-21T10:00:00.000Z",
            read: false,
            href: "/appointments/apt_1",
          },
          {
            id: "n2",
            title: "پیام قبلی",
            createdAt: "2026-08-20T10:00:00.000Z",
            read: true,
          },
        ],
      }),
    );
    expect(screen.getByText("2 خوانده‌نشده")).toBeInTheDocument();
    expect(screen.getByText("، خوانده‌نشده", { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /نوبت تأیید شد/ })).toHaveAttribute(
      "href",
      "/appointments/apt_1",
    );
    expect(screen.queryByRole("link", { name: /پیام قبلی/ })).not.toBeInTheDocument();
  });

  it("does not render unsafe external notification links", () => {
    renderDashboard(
      adaptCustomerDashboard({
        recentNotifications: [
          {
            id: "n1",
            title: "هشدار خارجی",
            createdAt: "2026-08-21T10:00:00.000Z",
            href: "https://evil.example",
            read: false,
          },
        ],
        unreadNotificationCount: 1,
      }),
    );
    expect(screen.getByText("هشدار خارجی")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /هشدار خارجی/ })).not.toBeInTheDocument();
  });

  it("keeps healthy widgets visible when another widget fails", () => {
    renderDashboard(
      adaptCustomerDashboard({
        nextAppointment: appointment("apt_1", { serviceName: "ویزیت سالم" }),
        upcomingAppointments: [appointment("apt_1", { serviceName: "ویزیت سالم" })],
        notifications: { error: { status: 500, message: "down" } },
      }),
    );
    expect(screen.getByText("ویزیت سالم")).toBeInTheDocument();
    expect(screen.getByText("اعلان‌ها دریافت نشد")).toBeInTheDocument();
    expect(screen.queryByText("نوبت پیش‌رویی ندارید")).not.toBeInTheDocument();
  });

  it("does not expose internal operational resources", () => {
    renderDashboard(
      adaptCustomerDashboard({
        nextAppointment: appointment("apt_1", {
          roomName: "اتاق ۳",
          device: "دستگاه MRI",
          chair: "صندلی ۷",
          internalNotes: "یادداشت داخلی",
        }),
        upcomingAppointments: [appointment("apt_1")],
      }),
    );
    expect(screen.queryByText("اتاق ۳")).not.toBeInTheDocument();
    expect(screen.queryByText("دستگاه MRI")).not.toBeInTheDocument();
    expect(screen.queryByText("صندلی ۷")).not.toBeInTheDocument();
    expect(screen.queryByText("یادداشت داخلی")).not.toBeInTheDocument();
  });

  it("supports keyboard access in RTL", async () => {
    const user = userEvent.setup();
    document.documentElement.dir = "rtl";
    renderDashboard(
      adaptCustomerDashboard({
        customer: { displayName: "آزمایش" },
        nextAppointment: appointment("apt_1"),
        bookingEnabled: true,
      }),
    );
    await user.tab();
    expect(document.activeElement).toHaveAttribute("href", "/notifications");
    expect(document.activeElement).toHaveAttribute("aria-label", "اعلان‌ها");
    await user.tab();
    expect(document.activeElement).toHaveAttribute("href", "/profile");
    await user.tab();
    expect(document.activeElement).toHaveAttribute("href", "/booking");
    expect(document.activeElement).toHaveTextContent("رزرو نوبت جدید");
    document.documentElement.dir = "ltr";
  });
});
