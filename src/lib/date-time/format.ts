import { env } from "@/config/env";
import { serverNow } from "@/lib/date-time/server-clock";
import {
  isoDateInZone,
  parseInstantInZone,
  parseIsoDateParts,
  resolveTimeZone,
} from "@/lib/date-time/zoned";

/** Intl calendar id for the configured display calendar. */
export function intlCalendar(): "persian" | "gregory" {
  return env.calendarSystem === "gregorian" ? "gregory" : "persian";
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = JSON.stringify(options);
  let cached = formatters.get(key);
  if (!cached) {
    cached = new Intl.DateTimeFormat("fa-IR", options);
    formatters.set(key, cached);
  }
  return cached;
}

/**
 * Date and time of an instant in the business (or explicitly given) timezone.
 * Invalid or missing timezones resolve to the configured business timezone,
 * never the device timezone.
 */
export function formatAppointmentParts(
  iso: string,
  timeZone?: string,
): { date: string; time: string; label: string } | null {
  const zone = resolveTimeZone(timeZone);
  const instant = parseInstantInZone(iso, zone);
  if (!instant) {
    return null;
  }
  const date = formatter({ calendar: intlCalendar(), timeZone: zone, dateStyle: "medium" }).format(instant);
  const time = formatter({
    calendar: intlCalendar(),
    timeZone: zone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(instant);
  return { date, time, label: `${date}، ساعت ${time}` };
}

/**
 * Label for a calendar date (`YYYY-MM-DD`). Calendar dates have no timezone,
 * so they are rendered at UTC noon in UTC to keep the same day everywhere.
 */
export function formatIsoDateLabel(
  isoDate: string,
  options: { style?: "medium" | "long" | "full"; weekday?: boolean } = {},
): string | null {
  const parts = parseIsoDateParts(isoDate);
  if (!parts) {
    return null;
  }
  const instant = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12));
  const style = options.style ?? "medium";
  // ICU's fa "full" pattern for the Persian calendar is inconsistent across runtimes
  // (e.g. "۱۴۰۵ شهریور ۱, یکشنبه"), so weekday labels are composed explicitly.
  if (options.weekday || style === "full") {
    const weekday = formatter({ timeZone: "UTC", weekday: "long" }).format(instant);
    const date = formatter({ calendar: intlCalendar(), timeZone: "UTC", dateStyle: "long" }).format(instant);
    return `${weekday} ${date}`;
  }
  return formatter({ calendar: intlCalendar(), timeZone: "UTC", dateStyle: style }).format(instant);
}

export function formatWeekdayLabel(isoDate: string): string | null {
  const parts = parseIsoDateParts(isoDate);
  if (!parts) {
    return null;
  }
  const instant = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12));
  return formatter({ timeZone: "UTC", weekday: "long" }).format(instant);
}

export function formatDurationMinutes(minutes: number): string {
  return `${new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 0 }).format(minutes)} دقیقه`;
}

export function formatRelativeTime(iso: string, now: Date = serverNow()): string | null {
  const date = parseInstantInZone(iso, resolveTimeZone());
  if (!date) {
    return null;
  }
  const deltaSeconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(deltaSeconds);
  const rtf = new Intl.RelativeTimeFormat("fa", { numeric: "auto" });
  if (abs < 60) {
    return rtf.format(Math.trunc(deltaSeconds), "second");
  }
  if (abs < 3600) {
    return rtf.format(Math.trunc(deltaSeconds / 60), "minute");
  }
  if (abs < 86400) {
    return rtf.format(Math.trunc(deltaSeconds / 3600), "hour");
  }
  return rtf.format(Math.trunc(deltaSeconds / 86400), "day");
}

export function formatCurrencyAmount(amount: number, currency?: string): string | undefined {
  if (!Number.isInteger(amount)) {
    return undefined;
  }
  try {
    return new Intl.NumberFormat("fa-IR", {
      style: currency ? "currency" : "decimal",
      currency: currency || "IRR",
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return String(amount);
  }
}

/** Formats a Backend `Decimal` amount (`"150000.00"` or a number); fractional amounts are not rounded. */
export function formatDecimalAmount(value: unknown, currency?: string): string | undefined {
  const raw = typeof value === "number" ? String(value) : typeof value === "string" ? value.trim() : "";
  const match = /^(-?\d+)(?:\.(\d+))?$/.exec(raw);
  if (!match || (match[2] && !/^0+$/.test(match[2]))) {
    return undefined;
  }
  return formatCurrencyAmount(Number(match[1]), currency);
}

/** Today's calendar date in the business (or given) timezone, by the server-referenced clock. */
export function todayIsoInTimeZone(timeZone?: string, now: Date = serverNow()): string {
  return isoDateInZone(now, resolveTimeZone(timeZone));
}

export function isTimestampExpired(iso: string | undefined, now: Date = serverNow()): boolean {
  if (!iso) {
    return false;
  }
  const date = parseInstantInZone(iso, resolveTimeZone());
  if (!date) {
    return false;
  }
  return date.getTime() <= now.getTime();
}
