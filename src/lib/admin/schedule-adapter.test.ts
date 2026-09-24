import { describe, expect, it } from "vitest";
import {
  adaptAdminScheduleImpactPreview,
  adaptAdminScheduleView,
  createDefaultWeeklyDraft,
  createEmptyWeekdayDraft,
  parseClock,
  sanitizeWeeklyBody,
  summarizeWeekday,
  validateWeeklyDraft,
  weeklyDraftEquals,
} from "@/lib/admin/schedule-adapter";

describe("schedule-adapter", () => {
  it("adapts schedule detail with weekly intervals and breaks", () => {
    const view = adaptAdminScheduleView(
      {
        scopeName: "کارمند الف",
        inheritanceMode: "custom",
        timezone: "Asia/Tehran",
        weekly: {
          items: [
            {
              weekday: 1,
              closed: false,
              intervals: [{ start: "09:00", end: "12:00" }, { start: "14:00", end: "18:00" }],
              breaks: [{ start: "12:00", end: "13:00", label: "ناهار" }],
            },
            { weekday: 5, closed: true, intervals: [], breaks: [] },
          ],
        },
        effective: {
          sourceLabel: "سفارشی",
          weeklySummary: ["دوشنبه ۹–۱۸"],
        },
        capabilities: { supportsBreaks: true, supportsImpactPreview: true },
        allowedActions: { edit: true, manageWeekly: true },
        version: "v1",
      },
      "staff",
      "st_1",
    );
    expect(view?.scopeName).toBe("کارمند الف");
    expect(view?.weekly.find((d) => d.weekday === 1)?.intervals).toHaveLength(2);
    expect(view?.weekly.find((d) => d.weekday === 5)?.closed).toBe(true);
    expect(view?.effective.weeklySummary?.[0]).toContain("دوشنبه");
  });

  it("validates overlapping intervals and breaks outside working hours", () => {
    const weekly = createDefaultWeeklyDraft();
    const monday = weekly.find((d) => d.weekday === 1)!;
    monday.intervals = [
      { id: "a", start: "09:00", end: "12:00" },
      { id: "b", start: "11:00", end: "13:00" },
    ];
    monday.breaks = [{ id: "brk", start: "08:00", end: "08:30" }];
    const issues = validateWeeklyDraft(weekly, { supportsBreaks: true });
    expect(issues.some((i) => i.message.includes("هم‌پوشانی"))).toBe(true);
    expect(issues.some((i) => i.message.includes("داخل"))).toBe(true);
  });

  it("supports copy equality and overnight rejection by default", () => {
    const left = createDefaultWeeklyDraft();
    const right = createDefaultWeeklyDraft();
    expect(weeklyDraftEquals(left, right)).toBe(true);

    const day = createEmptyWeekdayDraft(2);
    day.intervals = [{ id: "x", start: "22:00", end: "06:00" }];
    const issues = validateWeeklyDraft([day], { supportsOvernightIntervals: false });
    expect(issues.some((i) => i.message.includes("بعد از شروع"))).toBe(true);
  });

  it("summarizes weekday and adapts impact preview", () => {
    const day = createEmptyWeekdayDraft(3);
    day.intervals = [{ id: "i", start: "10:00", end: "16:00" }];
    expect(summarizeWeekday(day)).toContain("10:00");

    const preview = adaptAdminScheduleImpactPreview({
      title: "تأثیر",
      summary: "۲ نوبت",
      effects: ["کاهش اسلات"],
      futureAppointmentCount: 2,
      requiresConfirmation: true,
    });
    expect(preview?.futureAppointmentCount).toBe(2);
  });

  it("parses clock and sanitizes weekly body", () => {
    expect(parseClock("09:30")).toBe(570);
    expect(parseClock("25:00")).toBeNull();
    const body = sanitizeWeeklyBody({
      inheritanceMode: "custom",
      weekly: [createEmptyWeekdayDraft(0)],
    });
    expect(body.inheritanceMode).toBe("custom");
    expect(body.weekly[0]?.weekday).toBe(0);
  });
});
