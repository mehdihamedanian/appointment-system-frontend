/**
 * Calendar adapter boundary.
 *
 * The Design System calendar is Gregorian internally (Date + ISO `YYYY-MM-DD`).
 * Jalali display/conversion is intentionally not faked by translating labels.
 * A Jalali adapter belongs to a later localization phase (Phase 48).
 */
export type CalendarDay = {
  isoDate: string;
  inCurrentMonth: boolean;
  date: Date;
};

export type CalendarAdapter = {
  id: "gregorian";
  weekDayLabels: readonly string[];
  monthLabel: (year: number, monthIndex: number) => string;
  getMatrix: (year: number, monthIndex: number) => CalendarDay[][];
  addMonths: (year: number, monthIndex: number, delta: number) => {
    year: number;
    monthIndex: number;
  };
};

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function toIsoMonth(year: number, monthIndex: number): string {
  return `${year}-${pad(monthIndex + 1)}`;
}

export function parseIsoMonth(value: string): { year: number; monthIndex: number } | null {
  if (!/^\d{4}-\d{2}$/.test(value)) {
    return null;
  }
  const [year, month] = value.split("-").map(Number);
  if (month < 1 || month > 12) {
    return null;
  }
  return { year, monthIndex: month - 1 };
}

export function parseIsoDate(iso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return null;
  }
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

const WEEK_DAYS_FA = ["ش", "ی", "د", "س", "چ", "پ", "ج"] as const;
const MONTHS_FA = [
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

export const gregorianAdapter: CalendarAdapter = {
  id: "gregorian",
  weekDayLabels: WEEK_DAYS_FA,
  monthLabel: (year, monthIndex) => `${MONTHS_FA[monthIndex]} ${year}`,
  addMonths: (year, monthIndex, delta) => {
    const date = new Date(year, monthIndex + delta, 1);
    return { year: date.getFullYear(), monthIndex: date.getMonth() };
  },
  getMatrix: (year, monthIndex) => {
    const first = new Date(year, monthIndex, 1);
    const startOffset = (first.getDay() + 1) % 7;
    const start = new Date(year, monthIndex, 1 - startOffset);
    const weeks: CalendarDay[][] = [];

    for (let week = 0; week < 6; week += 1) {
      const days: CalendarDay[] = [];
      for (let day = 0; day < 7; day += 1) {
        const current = new Date(start);
        current.setDate(start.getDate() + week * 7 + day);
        days.push({
          date: current,
          isoDate: toIsoDate(current),
          inCurrentMonth: current.getMonth() === monthIndex,
        });
      }
      weeks.push(days);
    }

    return weeks;
  },
};

export function getCalendarAdapter(): CalendarAdapter {
  return gregorianAdapter;
}
