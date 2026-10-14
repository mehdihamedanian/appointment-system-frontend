import { env } from "@/config/env";

/**
 * Timezone-explicit date/time primitives.
 *
 * - Calendar dates are Gregorian ISO strings (`YYYY-MM-DD`), the Backend wire
 *   format; arithmetic on them is done in UTC so the device offset never leaks in.
 * - Instants must carry `Z` or a numeric offset. Naive date-times are ambiguous
 *   and are only interpreted against an explicit IANA timezone.
 * - No helper falls back to the device timezone.
 */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const EXPLICIT_OFFSET = /(?:Z|[+-]\d{2}(?::?\d{2})?)$/i;
const ISO_DATE_TIME_PREFIX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const WALL_TIME = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;

const DAY_MS = 86_400_000;

export type IsoDateParts = { year: number; month: number; day: number };

export type ZonedParts = IsoDateParts & {
  hour: number;
  minute: number;
  second: number;
  /** 0 = Sunday … 6 = Saturday, in the given timezone. */
  weekday: number;
};

function pad(value: number, length = 2): string {
  return String(value).padStart(length, "0");
}

export function formatIsoDate(year: number, month: number, day: number): string {
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

export function parseIsoDateParts(value: string | null | undefined): IsoDateParts | null {
  const match = value ? ISO_DATE.exec(value) : null;
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

export function isIsoDate(value: string | null | undefined): value is string {
  return parseIsoDateParts(value) !== null;
}

function isoDateToUtcMs(iso: string): number | null {
  const parts = parseIsoDateParts(iso);
  return parts ? Date.UTC(parts.year, parts.month - 1, parts.day) : null;
}

function utcMsToIsoDate(ms: number): string {
  const date = new Date(ms);
  return formatIsoDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

export function addDaysToIsoDate(iso: string, days: number): string {
  const ms = isoDateToUtcMs(iso);
  return ms === null ? iso : utcMsToIsoDate(ms + days * DAY_MS);
}

/** Whole calendar days from `from` to `to` (negative when `to` is earlier). */
export function daysBetweenIsoDates(from: string, to: string): number | null {
  const start = isoDateToUtcMs(from);
  const end = isoDateToUtcMs(to);
  return start === null || end === null ? null : Math.round((end - start) / DAY_MS);
}

/** Day of week of a calendar date (0 = Sunday … 6 = Saturday); timezone independent. */
export function isoDateWeekday(iso: string): number | null {
  const ms = isoDateToUtcMs(iso);
  return ms === null ? null : new Date(ms).getUTCDay();
}

const timeZoneValidity = new Map<string, boolean>();

export function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;
  const cached = timeZoneValidity.get(value);
  if (cached !== undefined) return cached;
  let valid = false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    valid = true;
  } catch {
    valid = false;
  }
  timeZoneValidity.set(value, valid);
  return valid;
}

/** Deployment business timezone; used only when no payload names one. */
export function configuredBusinessTimeZone(): string {
  return env.businessTimeZone;
}

/**
 * First valid IANA timezone among the candidates (most specific first, e.g.
 * payload → effective branch → business), else the configured business zone.
 */
export function resolveTimeZone(...candidates: Array<string | null | undefined>): string {
  for (const candidate of candidates) {
    if (isValidTimeZone(candidate)) return candidate;
  }
  return configuredBusinessTimeZone();
}

export function hasExplicitOffset(value: string): boolean {
  return ISO_DATE_TIME_PREFIX.test(value) && EXPLICIT_OFFSET.test(value.trim());
}

/** Parses an absolute instant. Naive date-times (no offset) are rejected as ambiguous. */
export function parseInstant(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? new Date(value) : null;
  }
  const trimmed = value.trim();
  if (!hasExplicitOffset(trimmed)) return null;
  const ms = Date.parse(trimmed);
  return Number.isNaN(ms) ? null : new Date(ms);
}

const NAIVE_DATE_TIME = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}(?::\d{2})?)(?:\.\d+)?)?$/;

/**
 * Parses an instant; values without an offset are read as wall time in the
 * given timezone (date-only values as local midnight), never device time.
 */
export function parseInstantInZone(value: string | null | undefined, timeZone: string): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  const explicit = parseInstant(trimmed);
  if (explicit) return explicit;
  const naive = NAIVE_DATE_TIME.exec(trimmed);
  if (!naive) return null;
  return zonedWallTimeToInstant(naive[1], naive[2] ?? "00:00", timeZone);
}

const partsFormatters = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = partsFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      calendar: "gregory",
      numberingSystem: "latn",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
      hourCycle: "h23",
    });
    partsFormatters.set(timeZone, formatter);
  }
  return formatter;
}

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Wall-clock parts of an instant in a timezone (Gregorian). */
export function zonedParts(instant: Date | number, timeZone: string): ZonedParts {
  const date = typeof instant === "number" ? new Date(instant) : instant;
  const values: Record<string, string> = {};
  for (const part of partsFormatter(resolveTimeZone(timeZone)).formatToParts(date)) {
    values[part.type] = part.value;
  }
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour) % 24,
    minute: Number(values.minute),
    second: Number(values.second),
    weekday: WEEKDAYS[values.weekday] ?? 0,
  };
}

export function isoDateInZone(instant: Date | number, timeZone: string): string {
  const parts = zonedParts(instant, timeZone);
  return formatIsoDate(parts.year, parts.month, parts.day);
}

export function minutesSinceMidnightInZone(instant: Date | number, timeZone: string): number {
  const parts = zonedParts(instant, timeZone);
  return parts.hour * 60 + parts.minute;
}

/** UTC offset of the timezone at the instant, in milliseconds (east positive). */
export function timeZoneOffsetMs(instant: Date | number, timeZone: string): number {
  const ms = typeof instant === "number" ? instant : instant.getTime();
  const wholeSecond = Math.floor(ms / 1000) * 1000;
  const parts = zonedParts(wholeSecond, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - wholeSecond;
}

/**
 * Converts a business-local wall time to an instant. Times skipped by a DST
 * jump resolve forward; repeated times resolve to the earlier occurrence.
 */
export function zonedWallTimeToInstant(isoDate: string, wallTime: string, timeZone: string): Date | null {
  const date = parseIsoDateParts(isoDate);
  const time = WALL_TIME.exec(wallTime.trim());
  if (!date || !time) return null;
  const hour = Number(time[1]);
  const minute = Number(time[2]);
  const second = Number(time[3] ?? 0);
  if (hour > 23 || minute > 59 || second > 59) return null;
  const zone = resolveTimeZone(timeZone);
  const guess = Date.UTC(date.year, date.month - 1, date.day, hour, minute, second);
  const firstOffset = timeZoneOffsetMs(guess, zone);
  let instant = guess - firstOffset;
  const secondOffset = timeZoneOffsetMs(instant, zone);
  if (secondOffset !== firstOffset) {
    const alternative = guess - secondOffset;
    instant = timeZoneOffsetMs(alternative, zone) === secondOffset ? Math.min(instant, alternative) : instant;
  }
  return new Date(instant);
}

/** `[start, end)` instants of a business-local calendar day (23/25h on DST days). */
export function zonedDayBounds(isoDate: string, timeZone: string): { start: Date; end: Date } | null {
  const start = zonedWallTimeToInstant(isoDate, "00:00", timeZone);
  const end = zonedWallTimeToInstant(addDaysToIsoDate(isoDate, 1), "00:00", timeZone);
  return start && end ? { start, end } : null;
}

/** ISO-8601 with the zone's numeric offset, e.g. `2026-08-22T09:00:00+03:30`. */
export function formatInstantWithOffset(instant: Date | number, timeZone: string): string {
  const zone = resolveTimeZone(timeZone);
  const parts = zonedParts(instant, zone);
  const offsetMinutes = Math.round(timeZoneOffsetMs(instant, zone) / 60_000);
  const sign = offsetMinutes < 0 ? "-" : "+";
  const absolute = Math.abs(offsetMinutes);
  return `${formatIsoDate(parts.year, parts.month, parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}${sign}${pad(Math.floor(absolute / 60))}:${pad(absolute % 60)}`;
}
