import type { WorkingHoursDay } from "@/types/public";

const WEEKDAY_LABELS = [
  "یکشنبه",
  "دوشنبه",
  "سه‌شنبه",
  "چهارشنبه",
  "پنجشنبه",
  "جمعه",
  "شنبه",
] as const;

const DAY_ALIASES: Record<string, number> = {
  sun: 0,
  sunday: 0,
  یکشنبه: 0,
  mon: 1,
  monday: 1,
  دوشنبه: 1,
  tue: 2,
  tuesday: 2,
  سه‌شنبه: 2,
  wed: 3,
  wednesday: 3,
  چهارشنبه: 3,
  thu: 4,
  thursday: 4,
  پنجشنبه: 4,
  fri: 5,
  friday: 5,
  جمعه: 5,
  sat: 6,
  saturday: 6,
  شنبه: 6,
};

export function weekdayLabel(weekday: number): string {
  return WEEKDAY_LABELS[weekday] ?? "روز نامشخص";
}

export function parseWeekday(value: unknown): number | undefined {
  if (typeof value === "number" && value >= 0 && value <= 6) {
    return value;
  }
  if (typeof value === "string") {
    const alias = DAY_ALIASES[value.trim().toLowerCase()];
    if (alias !== undefined) {
      return alias;
    }
    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed >= 0 && parsed <= 6) {
      return parsed;
    }
  }
  return undefined;
}

export function displayOrder(days: WorkingHoursDay[]): WorkingHoursDay[] {
  return [...days].sort((left, right) => {
    const toSaturdayFirst = (day: number) => (day + 1) % 7;
    return toSaturdayFirst(left.weekday) - toSaturdayFirst(right.weekday);
  });
}

export function weekdayInTimeZone(timeZone: string, now: Date = new Date()): number | null {
  try {
    const weekday = new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      timeZone,
    }).format(now);
    return parseWeekday(weekday) ?? null;
  } catch {
    return null;
  }
}

export function isOpenNow(
  days: WorkingHoursDay[],
  timeZone: string | undefined,
  now: Date = new Date(),
): boolean | null {
  if (!timeZone || days.length === 0) {
    return null;
  }
  const weekday = weekdayInTimeZone(timeZone, now);
  if (weekday == null) {
    return null;
  }
  const today = days.find((day) => day.weekday === weekday);
  if (!today || today.closed || today.ranges.length === 0) {
    return today ? false : null;
  }

  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
    const hour = Number(parts.find((part) => part.type === "hour")?.value);
    const minute = Number(parts.find((part) => part.type === "minute")?.value);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
      return null;
    }
    const current = hour * 60 + minute;
    return today.ranges.some((range) => {
      const start = parseClock(range.start);
      const end = parseClock(range.end);
      if (start == null || end == null) {
        return false;
      }
      return current >= start && current < end;
    });
  } catch {
    return null;
  }
}

function parseClock(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

export function formatRange(range: { start: string; end: string }): string {
  return `${range.start} تا ${range.end}`;
}
