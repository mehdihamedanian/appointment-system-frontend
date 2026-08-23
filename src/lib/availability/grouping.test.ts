import { describe, expect, it } from "vitest";
import { groupSlotsByPeriod, hourInTimeZone, periodForHour } from "@/lib/availability/grouping";
import type { AvailableSlotView } from "@/types/availability";

function slot(id: string, label: string, startsAt = ""): AvailableSlotView {
  return { id, label, startsAt, status: "available" };
}

describe("slot grouping", () => {
  it("groups backend slots into morning, afternoon and evening without creating new slots", () => {
    const grouped = groupSlotsByPeriod(
      [
        slot("s1", "09:00"),
        slot("s2", "13:30"),
        slot("s3", "18:00"),
        slot("s4", "11:15"),
      ],
      "Asia/Tehran",
    );
    expect(grouped.map((group) => group.period)).toEqual(["morning", "afternoon", "evening"]);
    expect(grouped[0]?.slots.map((item) => item.id)).toEqual(["s1", "s4"]);
    expect(grouped[1]?.slots.map((item) => item.id)).toEqual(["s2"]);
    expect(grouped[2]?.slots.map((item) => item.id)).toEqual(["s3"]);
    expect(grouped.every((group) => group.slots.length > 0)).toBe(true);
  });

  it("hides empty groups and keeps backend order inside a period", () => {
    const grouped = groupSlotsByPeriod([slot("late", "19:00"), slot("later", "20:30")]);
    expect(grouped).toHaveLength(1);
    expect(grouped[0]?.period).toBe("evening");
    expect(grouped[0]?.slots.map((item) => item.id)).toEqual(["late", "later"]);
  });

  it("reads hour from backend timestamps in the business timezone", () => {
    expect(hourInTimeZone("2026-08-22T09:30:00+03:30", "Asia/Tehran")).toBe(9);
    expect(periodForHour(9)).toBe("morning");
    expect(periodForHour(12)).toBe("afternoon");
    expect(periodForHour(17)).toBe("evening");
  });
});
