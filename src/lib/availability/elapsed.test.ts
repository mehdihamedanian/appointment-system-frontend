import { describe, expect, it } from "vitest";
import { isSlotElapsed, markElapsedSlots } from "@/lib/availability/elapsed";
import type { AvailableSlotView } from "@/types/availability";

const NOW = Date.parse("2026-08-22T06:00:00Z");

function slot(id: string, startsAt: string, status: AvailableSlotView["status"] = "available"): AvailableSlotView {
  return { id, label: id, startsAt, status };
}

describe("elapsed slot detection", () => {
  it("treats a slot starting now or earlier as elapsed", () => {
    expect(isSlotElapsed({ startsAt: "2026-08-22T09:30:00+03:30" }, NOW)).toBe(true);
    expect(isSlotElapsed({ startsAt: "2026-08-22T05:59:59Z" }, NOW)).toBe(true);
    expect(isSlotElapsed({ startsAt: "2026-08-22T06:00:01Z" }, NOW)).toBe(false);
  });

  it("never guesses for naive or empty start times", () => {
    expect(isSlotElapsed({ startsAt: "2026-08-22T05:00:00" }, NOW)).toBe(false);
    expect(isSlotElapsed({ startsAt: "" }, NOW)).toBe(false);
  });

  it("marks only elapsed slots and keeps array identity when nothing changes", () => {
    const slots = [
      slot("a", "2026-08-22T05:30:00Z"),
      slot("b", "2026-08-22T06:30:00Z"),
      slot("c", "2026-08-22T05:00:00Z", "held"),
    ];
    const marked = markElapsedSlots(slots, NOW);
    expect(marked.map((item) => item.status)).toEqual(["past", "available", "past"]);
    expect(markElapsedSlots(marked, NOW)).toBe(marked);
    const future = [slot("d", "2026-08-22T07:00:00Z")];
    expect(markElapsedSlots(future, NOW)).toBe(future);
  });
});
