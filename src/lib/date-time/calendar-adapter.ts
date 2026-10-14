import { env, type CalendarSystem } from "@/config/env";
import {
  JALALI_MONTH_NAMES,
  isSupportedJalaliYear,
  jalaliMonthLength,
  toGregorian,
  toJalali,
} from "@/lib/date-time/jalali";
import { addDaysToIsoDate, formatIsoDate, isoDateWeekday, parseIsoDateParts } from "@/lib/date-time/zoned";
import { toPersianDigits } from "@/lib/utilities/digits";

/**
 * Calendar grid adapters. Display follows the configured calendar system;
 * every value crossing the adapter (selection, min/max, API ranges) stays a
 * Gregorian ISO date. Month keys are self-describing so fetchers can turn any
 * visible month into a `from`/`to` range: `2026-08` (Gregorian) or `j1405-05`
 * (Jalali).
 */
export type { CalendarSystem };

export type CalendarMonth = { year: number; monthIndex: number };

export type CalendarDay = {
  isoDate: string;
  inCurrentMonth: boolean;
  dayOfMonth: number;
};

export type CalendarAdapter = {
  id: CalendarSystem;
  /** Saturday-first week. */
  weekDayLabels: readonly string[];
  monthLabel: (month: CalendarMonth) => string;
  monthName: (month: CalendarMonth) => string;
  monthOf: (isoDate: string) => CalendarMonth | null;
  monthKey: (month: CalendarMonth) => string;
  parseMonthKey: (key: string) => CalendarMonth | null;
  monthRange: (month: CalendarMonth) => { from: string; to: string };
  addMonths: (month: CalendarMonth, delta: number) => CalendarMonth;
  dayOfMonth: (isoDate: string) => number | null;
  getMatrix: (month: CalendarMonth) => CalendarDay[][];
};

const WEEK_DAYS_FA = ["ش", "ی", "د", "س", "چ", "پ", "ج"] as const;
const GREGORIAN_MONTHS_FA = [
  "ژانویه",
  "فوریه",
  "مارس",
  "آوریل",
  "مه",
  "ژوئن",
  "ژوئیه",
  "اوت",
  "سپتامبر",
  "اکتبر",
  "نوامبر",
  "دسامبر",
] as const;

const GREGORIAN_KEY = /^(\d{4})-(\d{2})$/;
const JALALI_KEY = /^j(\d{4})-(\d{2})$/;

function pad(value: number, length = 2): string {
  return String(value).padStart(length, "0");
}

function shiftMonth(month: CalendarMonth, delta: number): CalendarMonth {
  const total = month.year * 12 + month.monthIndex + delta;
  return { year: Math.floor(total / 12), monthIndex: ((total % 12) + 12) % 12 };
}

export function toIsoMonth(year: number, monthIndex: number): string {
  return `${pad(year, 4)}-${pad(monthIndex + 1)}`;
}

export function parseIsoMonth(value: string): CalendarMonth | null {
  const match = GREGORIAN_KEY.exec(value);
  if (!match) return null;
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return { year: Number(match[1]), monthIndex: month - 1 };
}

function buildMatrix(adapter: CalendarAdapter, month: CalendarMonth): CalendarDay[][] {
  const { from, to } = adapter.monthRange(month);
  const startOffset = ((isoDateWeekday(from) ?? 6) + 1) % 7;
  let cursor = addDaysToIsoDate(from, -startOffset);
  const weeks: CalendarDay[][] = [];
  for (let week = 0; week < 6; week += 1) {
    const days: CalendarDay[] = [];
    for (let day = 0; day < 7; day += 1) {
      days.push({
        isoDate: cursor,
        inCurrentMonth: cursor >= from && cursor <= to,
        dayOfMonth: adapter.dayOfMonth(cursor) ?? 0,
      });
      cursor = addDaysToIsoDate(cursor, 1);
    }
    weeks.push(days);
  }
  return weeks;
}

export const gregorianAdapter: CalendarAdapter = {
  id: "gregorian",
  weekDayLabels: WEEK_DAYS_FA,
  monthName: (month) => GREGORIAN_MONTHS_FA[month.monthIndex] ?? "",
  monthLabel: (month) => `${GREGORIAN_MONTHS_FA[month.monthIndex]} ${month.year}`,
  monthOf: (isoDate) => {
    const parts = parseIsoDateParts(isoDate);
    return parts ? { year: parts.year, monthIndex: parts.month - 1 } : null;
  },
  monthKey: (month) => toIsoMonth(month.year, month.monthIndex),
  parseMonthKey: parseIsoMonth,
  monthRange: (month) => {
    const last = new Date(Date.UTC(month.year, month.monthIndex + 1, 0)).getUTCDate();
    return {
      from: formatIsoDate(month.year, month.monthIndex + 1, 1),
      to: formatIsoDate(month.year, month.monthIndex + 1, last),
    };
  },
  addMonths: shiftMonth,
  dayOfMonth: (isoDate) => parseIsoDateParts(isoDate)?.day ?? null,
  getMatrix: (month) => buildMatrix(gregorianAdapter, month),
};

function jalaliOf(isoDate: string) {
  const parts = parseIsoDateParts(isoDate);
  if (!parts) return null;
  try {
    return toJalali(parts.year, parts.month, parts.day);
  } catch {
    return null;
  }
}

export const persianAdapter: CalendarAdapter = {
  id: "persian",
  weekDayLabels: WEEK_DAYS_FA,
  monthName: (month) => JALALI_MONTH_NAMES[month.monthIndex] ?? "",
  monthLabel: (month) =>
    `${JALALI_MONTH_NAMES[month.monthIndex]} ${toPersianDigits(month.year)}`,
  monthOf: (isoDate) => {
    const jalali = jalaliOf(isoDate);
    return jalali ? { year: jalali.jy, monthIndex: jalali.jm - 1 } : null;
  },
  monthKey: (month) => `j${pad(month.year, 4)}-${pad(month.monthIndex + 1)}`,
  parseMonthKey: (key) => {
    const match = JALALI_KEY.exec(key);
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (month < 1 || month > 12 || !isSupportedJalaliYear(year)) return null;
    return { year, monthIndex: month - 1 };
  },
  monthRange: (month) => {
    const jm = month.monthIndex + 1;
    const first = toGregorian(month.year, jm, 1);
    const last = toGregorian(month.year, jm, jalaliMonthLength(month.year, jm));
    return {
      from: formatIsoDate(first.gy, first.gm, first.gd),
      to: formatIsoDate(last.gy, last.gm, last.gd),
    };
  },
  addMonths: shiftMonth,
  dayOfMonth: (isoDate) => jalaliOf(isoDate)?.jd ?? null,
  getMatrix: (month) => buildMatrix(persianAdapter, month),
};

export function getCalendarAdapter(system: CalendarSystem = env.calendarSystem): CalendarAdapter {
  return system === "gregorian" ? gregorianAdapter : persianAdapter;
}

export function isCalendarMonthKey(key: string): boolean {
  return parseIsoMonth(key) !== null || persianAdapter.parseMonthKey(key) !== null;
}

/** Inclusive Gregorian ISO bounds of a month key from either calendar system. */
export function calendarMonthBounds(key: string): { from: string; to: string } | undefined {
  const gregorian = parseIsoMonth(key);
  if (gregorian) return gregorianAdapter.monthRange(gregorian);
  const jalali = persianAdapter.parseMonthKey(key);
  return jalali ? persianAdapter.monthRange(jalali) : undefined;
}

/** Month key (in the configured calendar) containing the ISO date. */
export function calendarMonthKeyFor(
  isoDate: string,
  system: CalendarSystem = env.calendarSystem,
): string | null {
  const adapter = getCalendarAdapter(system);
  const month = adapter.monthOf(isoDate);
  return month ? adapter.monthKey(month) : null;
}

export function isIsoDateInMonthKey(isoDate: string, key: string): boolean {
  const bounds = calendarMonthBounds(key);
  return Boolean(bounds && isoDate >= bounds.from && isoDate <= bounds.to);
}
