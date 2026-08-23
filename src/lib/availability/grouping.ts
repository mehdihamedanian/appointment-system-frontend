import type { AvailableSlotView, SlotPeriod, SlotPeriodGroup } from "@/types/availability";

/** Presentation-only hour boundaries in the business timezone. Do not generate slots. */
export const SLOT_PERIOD_BOUNDARIES = {
  morning: { startHour: 5, endHour: 12, label: "صبح" },
  afternoon: { startHour: 12, endHour: 17, label: "بعدازظهر" },
  evening: { startHour: 17, endHour: 5, label: "عصر" },
} as const;

export function hourInTimeZone(value: string, timeZone?: string): number | null {
  if (/^\d{4}-\d{2}-\d{2}T/.test(value) || value.includes("Z")) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    try {
      const hour = new Intl.DateTimeFormat("en-GB", {
        timeZone: timeZone || undefined,
        hour: "2-digit",
        hourCycle: "h23",
      }).format(date);
      const parsed = Number.parseInt(hour, 10);
      return Number.isFinite(parsed) ? parsed : null;
    } catch {
      return date.getHours();
    }
  }

  const match = value.match(/(?:^|[^\d])(\d{1,2}):(\d{2})/);
  if (!match) {
    return null;
  }
  const hour = Number.parseInt(match[1], 10);
  return hour >= 0 && hour <= 23 ? hour : null;
}

export function periodForHour(hour: number): SlotPeriod {
  if (hour >= SLOT_PERIOD_BOUNDARIES.morning.startHour && hour < SLOT_PERIOD_BOUNDARIES.morning.endHour) {
    return "morning";
  }
  if (hour >= SLOT_PERIOD_BOUNDARIES.afternoon.startHour && hour < SLOT_PERIOD_BOUNDARIES.afternoon.endHour) {
    return "afternoon";
  }
  return "evening";
}

export function periodForSlot(slot: AvailableSlotView, timeZone?: string): SlotPeriod | null {
  const hour = hourInTimeZone(slot.startsAt, timeZone) ?? hourInTimeZone(slot.label, timeZone);
  return hour === null ? null : periodForHour(hour);
}

const PERIOD_ORDER: SlotPeriod[] = ["morning", "afternoon", "evening"];

export function groupSlotsByPeriod(
  slots: AvailableSlotView[],
  timeZone?: string,
): SlotPeriodGroup[] {
  const buckets: Record<SlotPeriod, AvailableSlotView[]> = {
    morning: [],
    afternoon: [],
    evening: [],
  };

  for (const slot of slots) {
    const period = periodForSlot(slot, timeZone) ?? "evening";
    buckets[period].push(slot);
  }

  return PERIOD_ORDER.filter((period) => buckets[period].length > 0).map((period) => ({
    period,
    label: SLOT_PERIOD_BOUNDARIES[period].label,
    slots: buckets[period],
  }));
}
