import { todayIsoInTimeZone } from "@/lib/date-time/format";
import type {
  BookableDateDay,
  CalendarDayAvailability,
  CalendarDayVisualState,
} from "@/types/availability";
import type { BookableDatesView } from "@/types/booking";

export function availabilityTodayIso(
  dates?: Pick<BookableDatesView, "timezone" | "serverNow">,
  fallbackTimeZone?: string,
): string {
  const timeZone = dates?.timezone ?? fallbackTimeZone;
  if (dates?.serverNow) {
    const server = new Date(dates.serverNow);
    if (!Number.isNaN(server.getTime())) {
      return todayIsoInTimeZone(timeZone, server);
    }
  }
  return todayIsoInTimeZone(timeZone);
}

export function dayStatusMap(days: BookableDateDay[]): Map<string, CalendarDayAvailability> {
  return new Map(days.map((day) => [day.date, day.status]));
}

export function resolveCalendarDayState(input: {
  iso: string;
  inCurrentMonth: boolean;
  today: string;
  selected?: string;
  minDate?: string;
  maxDate?: string;
  statusByDate: Map<string, CalendarDayAvailability>;
  loading?: boolean;
  failed?: boolean;
}): {
  state: CalendarDayVisualState;
  disabled: boolean;
  selectable: boolean;
} {
  if (input.loading) {
    return { state: "loading", disabled: true, selectable: false };
  }
  if (input.failed) {
    return { state: "unknown", disabled: true, selectable: false };
  }
  if (!input.inCurrentMonth) {
    return { state: "outside", disabled: true, selectable: false };
  }
  if (input.iso < input.today) {
    return { state: "past", disabled: true, selectable: false };
  }
  if (input.minDate && input.iso < input.minDate) {
    return { state: "disabled", disabled: true, selectable: false };
  }
  if (input.maxDate && input.iso > input.maxDate) {
    return { state: "disabled", disabled: true, selectable: false };
  }

  const status = input.statusByDate.get(input.iso);
  if (status === "available") {
    return {
      state: input.selected === input.iso ? "selected" : "available",
      disabled: false,
      selectable: true,
    };
  }
  if (status === "closed") {
    return { state: "closed", disabled: true, selectable: false };
  }
  if (status === "no_capacity") {
    return { state: "no_capacity", disabled: true, selectable: false };
  }
  return { state: "unavailable", disabled: true, selectable: false };
}

export function calendarDayStateLabel(state: CalendarDayVisualState): string {
  switch (state) {
    case "available":
      return "قابل رزرو";
    case "selected":
      return "انتخاب‌شده";
    case "today":
      return "امروز";
    case "closed":
      return "تعطیل";
    case "no_capacity":
      return "ظرفیت تکمیل";
    case "unavailable":
      return "غیرفعال";
    case "past":
      return "گذشته";
    case "outside":
      return "خارج از این ماه";
    case "disabled":
      return "خارج از بازه رزرو";
    case "loading":
      return "در حال بارگذاری";
    case "unknown":
      return "نامشخص";
    default:
      return "";
  }
}

export function hasDistinctUnavailableStates(days: BookableDateDay[]): boolean {
  return days.some((day) => day.status === "closed" || day.status === "no_capacity");
}
