import type { AdminCalendarEventView } from "@/types/admin-calendar";
import { minutesFromMidnight } from "@/lib/admin/calendar-range";

export type LaidOutEvent = {
  event: AdminCalendarEventView;
  startMinutes: number;
  endMinutes: number;
  lane: number;
  laneCount: number;
};

/**
 * Pack overlapping events into lanes so they do not hide each other.
 * Drag & Drop is not enabled — layout only.
 */
export function layoutOverlappingEvents(
  events: AdminCalendarEventView[],
  timezone?: string,
  dayStartMinutes = 0,
  dayEndMinutes = 24 * 60,
): LaidOutEvent[] {
  const timed = events
    .map((event) => {
      const start = minutesFromMidnight(event.startsAt, timezone);
      const end = minutesFromMidnight(event.endsAt, timezone);
      if (start === null || end === null) return null;
      const startMinutes = Math.max(dayStartMinutes, Math.min(start, dayEndMinutes - 1));
      const endMinutes = Math.max(startMinutes + 5, Math.min(end, dayEndMinutes));
      return { event, startMinutes, endMinutes };
    })
    .filter((item): item is { event: AdminCalendarEventView; startMinutes: number; endMinutes: number } =>
      Boolean(item),
    )
    .sort((a, b) => a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes);

  const placed: Array<{
    event: AdminCalendarEventView;
    startMinutes: number;
    endMinutes: number;
    lane: number;
  }> = [];
  const active: Array<{ endMinutes: number; lane: number }> = [];

  for (const item of timed) {
    for (let i = active.length - 1; i >= 0; i -= 1) {
      if (active[i]!.endMinutes <= item.startMinutes) {
        active.splice(i, 1);
      }
    }
    const used = new Set(active.map((a) => a.lane));
    let lane = 0;
    while (used.has(lane)) lane += 1;
    active.push({ endMinutes: item.endMinutes, lane });
    placed.push({ ...item, lane });
  }

  // Assign laneCount per overlap cluster
  const result: LaidOutEvent[] = placed.map((item) => ({
    ...item,
    laneCount: 1,
  }));

  for (let i = 0; i < result.length; i += 1) {
    let maxLane = result[i]!.lane;
    for (let j = 0; j < result.length; j += 1) {
      if (i === j) continue;
      const a = result[i]!;
      const b = result[j]!;
      if (a.startMinutes < b.endMinutes && b.startMinutes < a.endMinutes) {
        maxLane = Math.max(maxLane, b.lane);
      }
    }
    // Second pass: find cluster max
  }

  for (let i = 0; i < result.length; i += 1) {
    let clusterMax = result[i]!.lane;
    for (let j = 0; j < result.length; j += 1) {
      const a = result[i]!;
      const b = result[j]!;
      if (a.startMinutes < b.endMinutes && b.startMinutes < a.endMinutes) {
        clusterMax = Math.max(clusterMax, b.lane);
      }
    }
    result[i]!.laneCount = clusterMax + 1;
  }

  return result;
}

export function densityClass(count: number): "none" | "low" | "medium" | "high" {
  if (count <= 0) return "none";
  if (count < 3) return "low";
  if (count < 8) return "medium";
  return "high";
}
