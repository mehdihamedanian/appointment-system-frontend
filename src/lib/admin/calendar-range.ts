import { getCalendarAdapter, type CalendarSystem } from "@/lib/date-time/calendar-adapter";
import { todayIsoInTimeZone } from "@/lib/date-time/format";
import { serverNow } from "@/lib/date-time/server-clock";
import {
  addDaysToIsoDate,
  formatIsoDate,
  isoDateInZone,
  isoDateWeekday,
  minutesSinceMidnightInZone,
  parseInstantInZone,
  resolveTimeZone,
} from "@/lib/date-time/zoned";
import type { AdminCalendarRange } from "@/types/admin-calendar";

export function toIsoDate(y: number, m: number, d: number): string {
  return formatIsoDate(y, m, d);
}

export function addDaysIso(iso: string, days: number): string {
  return addDaysToIsoDate(iso, days);
}

/** Same day-of-month `months` later in the given calendar, clamped to the month length. */
export function addMonthsIso(iso: string, months: number, calendar?: CalendarSystem): string {
  const adapter = getCalendarAdapter(calendar);
  const month = adapter.monthOf(iso);
  const day = adapter.dayOfMonth(iso);
  if (!month || !day) return iso;
  const range = adapter.monthRange(adapter.addMonths(month, months));
  const target = addDaysToIsoDate(range.from, day - 1);
  return target > range.to ? range.to : target;
}

/** Day of week for an ISO date. 0=Sun … 6=Sat. */
export function isoDayOfWeek(iso: string): number {
  return isoDateWeekday(iso) ?? 0;
}

/**
 * Inclusive visible range for the given anchor date and range mode.
 * weekStartsOn: 0=Sunday … 6=Saturday (Backend). Months follow the display calendar.
 */
export function visibleRangeFor(
  date: string,
  range: AdminCalendarRange,
  weekStartsOn = 6,
  calendar?: CalendarSystem,
): { from: string; to: string } {
  if (range === "day") {
    return { from: date, to: date };
  }
  if (range === "week") {
    const dow = isoDayOfWeek(date);
    const offset = (dow - weekStartsOn + 7) % 7;
    const from = addDaysIso(date, -offset);
    return { from, to: addDaysIso(from, 6) };
  }
  const adapter = getCalendarAdapter(calendar);
  const month = adapter.monthOf(date);
  return month ? adapter.monthRange(month) : { from: date, to: date };
}

export function navigateCalendarDate(
  date: string,
  range: AdminCalendarRange,
  direction: "prev" | "next" | "today",
  timezone?: string,
  now: Date = serverNow(),
  calendar?: CalendarSystem,
): string {
  if (direction === "today") {
    return todayIsoInTimeZone(timezone, now);
  }
  const delta = direction === "next" ? 1 : -1;
  if (range === "day") return addDaysIso(date, delta);
  if (range === "week") return addDaysIso(date, delta * 7);
  return addMonthsIso(date, delta, calendar);
}

export function eachIsoDateInclusive(from: string, to: string): string[] {
  const dates: string[] = [];
  let cursor = from;
  let guard = 0;
  while (cursor <= to && guard < 62) {
    dates.push(cursor);
    cursor = addDaysIso(cursor, 1);
    guard += 1;
  }
  return dates;
}

export function minutesFromMidnight(isoDateTime: string, timeZone?: string): number | null {
  const zone = resolveTimeZone(timeZone);
  const instant = parseInstantInZone(isoDateTime, zone);
  return instant ? minutesSinceMidnightInZone(instant, zone) : null;
}

/** Business-local calendar date of an instant. */
export function isoDateInTimeZone(isoDateTime: string, timeZone?: string): string | null {
  const zone = resolveTimeZone(timeZone);
  const instant = parseInstantInZone(isoDateTime, zone);
  return instant ? isoDateInZone(instant, zone) : null;
}

export function parseHmToMinutes(hm: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hm.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

export function formatHm(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
