import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { AdminCalendarMonthView } from "@/features/admin/calendar/admin-calendar-month-view";
import { adaptAdminCalendarView } from "@/lib/admin/calendar-adapter";

function viewWith(timezone: string) {
  return adaptAdminCalendarView(
    {
      timezone,
      weekStartsOn: 6,
      events: [
        {
          id: "ev_late",
          type: "appointment",
          startsAt: "2026-08-21T21:00:00Z",
          endsAt: "2026-08-21T21:30:00Z",
          status: "confirmed",
          appointmentReference: "REF-L",
        },
        {
          id: "ev_morning",
          type: "appointment",
          startsAt: "2026-08-22T05:30:00Z",
          endsAt: "2026-08-22T06:00:00Z",
          status: "confirmed",
          appointmentReference: "REF-M",
        },
      ],
    },
    { from: "2026-07-23", to: "2026-08-22" },
  );
}

function countFor(date: string): string | null {
  return document.querySelector(`[data-date="${date}"]`)?.getAttribute("aria-label") ?? null;
}

describe("admin calendar month view", () => {
  it("buckets appointments by business-local day, not UTC date", () => {
    render(
      <AdminCalendarMonthView
        view={viewWith("Asia/Tehran")}
        anchorDate="2026-08-22"
        weekStartsOn={6}
        onSelectDay={() => undefined}
      />,
    );
    // 21:00 UTC on 21 Aug is 00:30 on 22 Aug in Tehran.
    expect(countFor("2026-08-22")).toMatch(/2 نوبت$/);
    expect(countFor("2026-08-21")).toMatch(/0 نوبت$/);
  });

  it("renders the Jalali month with Gregorian data-date values", () => {
    render(
      <AdminCalendarMonthView
        view={viewWith("UTC")}
        anchorDate="2026-08-22"
        weekStartsOn={6}
        onSelectDay={() => undefined}
      />,
    );
    const cells = document.querySelectorAll("[data-date]");
    expect(cells).toHaveLength(31);
    expect(cells[0]).toHaveAttribute("data-date", "2026-07-23");
    expect(countFor("2026-08-21")).toMatch(/1 نوبت$/);
    expect(countFor("2026-08-22")).toMatch(/مرداد/);
  });
});
