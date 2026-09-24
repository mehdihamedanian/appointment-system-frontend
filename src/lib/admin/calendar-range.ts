import { todayIsoInTimeZone } from "@/lib/date-time/format";
import type { AdminCalendarRange } from "@/types/admin-calendar";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parseIsoDateParts(iso: string): { y: number; m: number; d: number } | null {
  if (!ISO_DATE.test(iso)) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  return { y, m, d };
}

export function toIsoDate(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function addDaysIso(iso: string, days: number): string {
  const parts = parseIsoDateParts(iso);
  if (!parts) return iso;
  const date = new Date(Date.UTC(parts.y, parts.m - 1, parts.d + days));
  return toIsoDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

export function addMonthsIso(iso: string, months: number): string {
  const parts = parseIsoDateParts(iso);
  if (!parts) return iso;
  const date = new Date(Date.UTC(parts.y, parts.m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  const day = Math.min(parts.d, lastDay);
  return toIsoDate(date.getUTCFullYear(), date.getUTCMonth() + 1, day);
}

/** Day of week for ISO date in UTC noon (stable for date-only). 0=Sun … 6=Sat. */
export function isoDayOfWeek(iso: string): number {
  const parts = parseIsoDateParts(iso);
  if (!parts) return 0;
  return new Date(Date.UTC(parts.y, parts.m - 1, parts.d)).getUTCDay();
}

/**
 * Inclusive visible range for the given anchor date and range mode.
 * weekStartsOn: 0=Sunday … 6=Saturday (Backend).
 */
export function visibleRangeFor(
  date: string,
  range: AdminCalendarRange,
  weekStartsOn = 6,
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
  const parts = parseIsoDateParts(date);
  if (!parts) return { from: date, to: date };
  const from = toIsoDate(parts.y, parts.m, 1);
  const last = new Date(Date.UTC(parts.y, parts.m, 0)).getUTCDate();
  return { from, to: toIsoDate(parts.y, parts.m, last) };
}

export function navigateCalendarDate(
  date: string,
  range: AdminCalendarRange,
  direction: "prev" | "next" | "today",
  timezone?: string,
  now: Date = new Date(),
): string {
  if (direction === "today") {
    return todayIsoInTimeZone(timezone, now);
  }
  const delta = direction === "next" ? 1 : -1;
  if (range === "day") return addDaysIso(date, delta);
  if (range === "week") return addDaysIso(date, delta * 7);
  return addMonthsIso(date, delta);
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
  const date = new Date(isoDateTime);
  if (Number.isNaN(date.getTime())) return null;
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: timeZone || undefined,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);
    const hour = Number(parts.find((p) => p.type === "hour")?.value ?? NaN);
    const minute = Number(parts.find((p) => p.type === "minute")?.value ?? NaN);
    if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
    return hour * 60 + minute;
  } catch {
    return date.getHours() * 60 + date.getMinutes();
  }
}

export function isoDateInTimeZone(isoDateTime: string, timeZone?: string): string | null {
  const date = new Date(isoDateTime);
  if (Number.isNaN(date.getTime())) return null;
  return todayIsoInTimeZone(timeZone, date);
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
