import { parseInstant } from "@/lib/date-time/zoned";
import type { AvailableSlotView } from "@/types/availability";

/**
 * Availability is fetched once and may be shown for minutes; slots whose start
 * has passed since then must not stay selectable. The Backend still validates
 * every hold, so this only prevents knowingly stale selections.
 */
export function isSlotElapsed(slot: Pick<AvailableSlotView, "startsAt">, nowMs: number): boolean {
  const start = parseInstant(slot.startsAt);
  return Boolean(start && start.getTime() <= nowMs);
}

export function markElapsedSlots(slots: AvailableSlotView[], nowMs: number): AvailableSlotView[] {
  let changed = false;
  const next = slots.map((slot) => {
    if (slot.status !== "past" && isSlotElapsed(slot, nowMs)) {
      changed = true;
      return { ...slot, status: "past" as const };
    }
    return slot;
  });
  return changed ? next : slots;
}
