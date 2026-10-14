import { describe, expect, it } from "vitest";
import {
  adaptAdminCalendarEvent,
  adaptAdminCalendarView,
} from "@/lib/admin/calendar-adapter";
import {
  adminCalendarFiltersApplied,
  adminCalendarHref,
  clearAdminCalendarFilters,
  countActiveAdminCalendarFilters,
  filtersToAdminCalendarParams,
  parseAdminCalendarState,
} from "@/lib/admin/calendar-filters";
import { layoutOverlappingEvents } from "@/lib/admin/calendar-layout";
import {
  addDaysIso,
  navigateCalendarDate,
  visibleRangeFor,
} from "@/lib/admin/calendar-range";
import { ADMIN_CALENDAR_DRAG_DROP_ENABLED } from "@/types/admin-calendar";

describe("admin calendar range", () => {
  it("computes day/week/month visible ranges with Saturday week start", () => {
    expect(visibleRangeFor("2026-08-25", "day", 6)).toEqual({
      from: "2026-08-25",
      to: "2026-08-25",
    });
    // 2026-08-25 is Tuesday; week starting Saturday → 22–28
    expect(visibleRangeFor("2026-08-25", "week", 6)).toEqual({
      from: "2026-08-22",
      to: "2026-08-28",
    });
    expect(visibleRangeFor("2026-08-25", "month", 6, "gregorian")).toEqual({
      from: "2026-08-01",
      to: "2026-08-31",
    });
  });

  it("uses the Jalali month as the month range by default", () => {
    // 2026-08-25 = 3 Shahrivar 1405; Shahrivar spans 2026-08-23 … 2026-09-22.
    expect(visibleRangeFor("2026-08-25", "month", 6)).toEqual({
      from: "2026-08-23",
      to: "2026-09-22",
    });
    // Esfand 1403 has 30 days (leap year), Esfand 1404 has 29.
    expect(visibleRangeFor("2025-03-10", "month", 6, "persian")).toEqual({
      from: "2025-02-19",
      to: "2025-03-20",
    });
    expect(visibleRangeFor("2026-03-10", "month", 6, "persian")).toEqual({
      from: "2026-02-20",
      to: "2026-03-20",
    });
  });

  it("navigates prev/next/today by range", () => {
    expect(navigateCalendarDate("2026-08-25", "day", "next")).toBe("2026-08-26");
    expect(navigateCalendarDate("2026-08-25", "day", "prev")).toBe("2026-08-24");
    expect(navigateCalendarDate("2026-08-25", "week", "next")).toBe("2026-09-01");
    expect(
      navigateCalendarDate("2026-08-25", "month", "prev", "Asia/Tehran", new Date(), "gregorian"),
    ).toBe("2026-07-25");
    expect(addDaysIso("2026-08-31", 1)).toBe("2026-09-01");
  });

  it("navigates Jalali months keeping the day of month and clamping", () => {
    // 31 Mordad 1405 → Shahrivar has 31 days → 31 Shahrivar = 2026-09-22.
    expect(navigateCalendarDate("2026-08-22", "month", "next", "Asia/Tehran", new Date(), "persian")).toBe(
      "2026-09-22",
    );
    // 31 Shahrivar 1405 → Mehr has 30 days → clamp to 30 Mehr = 2026-10-22.
    expect(navigateCalendarDate("2026-09-22", "month", "next", "Asia/Tehran", new Date(), "persian")).toBe(
      "2026-10-22",
    );
  });

  it("resolves today in the business timezone", () => {
    // 21:00 UTC on 21 Aug is already 22 Aug in Tehran.
    const now = new Date("2026-08-21T21:00:00Z");
    expect(navigateCalendarDate("2026-01-01", "day", "today", "Asia/Tehran", now)).toBe("2026-08-22");
    expect(navigateCalendarDate("2026-01-01", "day", "today", "UTC", now)).toBe("2026-08-21");
  });
});

describe("admin calendar URL state", () => {
  it("parses independent range and grouping and normalizes invalid values", () => {
    const state = parseAdminCalendarState(
      new URLSearchParams("view=week&group=staff&date=2026-08-25&status=confirmed&resource=res_1"),
      "Asia/Tehran",
    );
    expect(state.range).toBe("week");
    expect(state.grouping).toBe("staff");
    expect(state.date).toBe("2026-08-25");
    expect(state.status).toBe("confirmed");
    expect(state.resourceId).toBe("res_1");
    expect(parseAdminCalendarState(new URLSearchParams("view=bogus&group=nope")).range).toBe("day");
    expect(parseAdminCalendarState(new URLSearchParams("view=bogus&group=nope")).grouping).toBe(
      "general",
    );
  });

  it("builds stable href and counts filters", () => {
    const href = adminCalendarHref({
      range: "week",
      grouping: "resource",
      presentation: "agenda",
      date: "2026-08-25",
      status: "confirmed",
      paymentStatus: "all",
      staffId: "st_1",
    });
    expect(href).toContain("view=week");
    expect(href).toContain("group=resource");
    expect(href).toContain("mode=agenda");
    expect(href).toContain("staff=st_1");
    const state = parseAdminCalendarState(new URLSearchParams(href.split("?")[1]!));
    expect(countActiveAdminCalendarFilters(state)).toBe(2);
    expect(adminCalendarFiltersApplied(state)).toBe(true);
    expect(clearAdminCalendarFilters(state).staffId).toBeUndefined();
  });

  it("maps filters to API query params for visible range only", () => {
    const params = filtersToAdminCalendarParams({
      range: "day",
      grouping: "general",
      presentation: "grid",
      date: "2026-08-25",
      status: "all",
      paymentStatus: "all",
      branchId: "br_1",
    });
    expect(params).toEqual({
      from: "2026-08-25",
      to: "2026-08-25",
      view: "day",
      groupBy: "general",
      branchId: "br_1",
    });
  });
});

describe("admin calendar adapter", () => {
  it("adapts appointment, blocked time, and time off distinctly", () => {
    const view = adaptAdminCalendarView(
      {
        timezone: "Asia/Tehran",
        weekStartsOn: 6,
        slotIntervalMinutes: 15,
        workingHours: [{ dayOfWeek: 2, start: "09:00", end: "18:00" }],
        events: [
          {
            id: "ev_1",
            type: "appointment",
            startsAt: "2026-08-25T05:30:00.000Z",
            endsAt: "2026-08-25T06:00:00.000Z",
            customerName: "سارا",
            serviceName: "ویزیت",
            status: "confirmed",
            paymentStatus: "paid",
            appointmentReference: "REF-1",
            columnId: "st_1",
          },
          {
            id: "ev_2",
            type: "blocked_time",
            startsAt: "2026-08-25T07:00:00.000Z",
            endsAt: "2026-08-25T08:00:00.000Z",
            title: "تعمیر",
            blockReason: "تعمیر دستگاه",
            columnId: "st_1",
          },
          {
            id: "ev_3",
            type: "time_off",
            startsAt: "2026-08-25T09:00:00.000Z",
            endsAt: "2026-08-25T12:00:00.000Z",
            timeOffLabel: "مرخصی استحقاقی",
            columnId: "st_1",
          },
        ],
      },
      { from: "2026-08-25", to: "2026-08-25" },
    );
    expect(view.events).toHaveLength(3);
    expect(view.events[0]!.type).toBe("appointment");
    expect(view.events[0]!.status).toBe("confirmed");
    expect(view.events[0]!.paymentStatus).toBe("paid");
    expect(view.events[1]!.type).toBe("blocked");
    expect(view.events[1]!.blockReason).toBe("تعمیر دستگاه");
    expect(view.events[2]!.type).toBe("time_off");
    expect(view.slotIntervalMinutes).toBe(15);
  });

  it("masks block reason when not authorized", () => {
    const event = adaptAdminCalendarEvent(
      {
        id: "ev_b",
        type: "blocked",
        startsAt: "2026-08-25T07:00:00.000Z",
        endsAt: "2026-08-25T08:00:00.000Z",
        blockReason: "secret",
      },
      "Asia/Tehran",
      false,
    );
    expect(event?.blockReason).toBeUndefined();
  });

  it("falls back unknown status neutrally", () => {
    const event = adaptAdminCalendarEvent({
      id: "ev_u",
      type: "appointment",
      startsAt: "2026-08-25T05:30:00.000Z",
      endsAt: "2026-08-25T06:00:00.000Z",
      status: "weird_future_status",
      appointmentReference: "REF-U",
    });
    expect(event?.status).toBeUndefined();
  });
});

describe("admin calendar layout", () => {
  it("lays out overlapping events into lanes without hiding", () => {
    const laid = layoutOverlappingEvents(
      [
        {
          id: "a",
          type: "appointment",
          startsAt: "2026-08-25T05:30:00.000Z",
          endsAt: "2026-08-25T06:30:00.000Z",
          columnId: "g",
          title: "A",
          accessibleName: "A",
        },
        {
          id: "b",
          type: "appointment",
          startsAt: "2026-08-25T06:00:00.000Z",
          endsAt: "2026-08-25T07:00:00.000Z",
          columnId: "g",
          title: "B",
          accessibleName: "B",
        },
      ],
      "UTC",
    );
    expect(laid).toHaveLength(2);
    expect(new Set(laid.map((l) => l.lane)).size).toBe(2);
    expect(laid[0]!.laneCount).toBeGreaterThanOrEqual(2);
  });
});

describe("admin calendar drag and drop", () => {
  it("keeps drag and drop disabled in Phase 27", () => {
    expect(ADMIN_CALENDAR_DRAG_DROP_ENABLED).toBe(false);
  });
});
