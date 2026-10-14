import { describe, expect, it } from "vitest";
import {
  adaptTargetBlock,
  adaptTargetTimeOff,
  composeTargetSchedulePayload,
  dayRangeToInstants,
  scheduleTargetBasePath,
  scheduleTargetBranches,
  targetScheduleWindow,
} from "@/lib/admin/schedule-target-backend";

describe("schedule target Backend mapping", () => {
  it("maps scopes to the Backend's own routes", () => {
    expect(scheduleTargetBasePath("resource", "r 1")).toBe("/resources/r%201");
    expect(scheduleTargetBasePath("staff", "s1")).toBe("/staff/s1");
  });

  it("turns an inclusive day range into half-open instants in the schedule timezone", () => {
    expect(dayRangeToInstants("2026-08-21", "2026-08-22", "Asia/Tehran")).toEqual({
      startsAt: "2026-08-21T00:00:00+03:30",
      endsAt: "2026-08-23T00:00:00+03:30",
    });
    expect(dayRangeToInstants("2026-03-08", "2026-03-08", "America/New_York")).toEqual({
      startsAt: "2026-03-08T00:00:00-05:00",
      endsAt: "2026-03-09T00:00:00-04:00",
    });
    expect(dayRangeToInstants("2026-08-22", "2026-08-21", "Asia/Tehran")).toBeNull();
    expect(dayRangeToInstants("bad", "2026-08-21", "Asia/Tehran")).toBeNull();
  });

  it("queries only the target's active branches", () => {
    expect(
      scheduleTargetBranches({
        branches: [
          { id: "b1", name: "مرکزی", is_active: true },
          { id: "b2", name: "بسته", is_active: false },
          { name: "بی‌شناسه" },
        ],
      }),
    ).toEqual([{ id: "b1", name: "مرکزی" }]);
    expect(scheduleTargetBranches({})).toEqual([]);
  });

  it("uses a seven-day window", () => {
    expect(targetScheduleWindow("2026-08-20")).toEqual({ from: "2026-08-20", to: "2026-08-26" });
  });

  it("adapts Backend block and time-off rows and drops incomplete ones", () => {
    expect(
      adaptTargetBlock(
        { id: "b", starts_at: "2026-08-21T00:00:00+03:30", ends_at: "2026-08-22T00:00:00+03:30", reason: "x" },
        "resource",
        "r1",
      ),
    ).toMatchObject({ id: "b", targetScope: "resource", targetId: "r1", reason: "x" });
    expect(adaptTargetBlock({ id: "b" }, "resource", "r1")).toBeNull();
    expect(
      adaptTargetTimeOff(
        { id: "t", starts_at: "2026-08-21T00:00:00+03:30", ends_at: "2026-08-22T00:00:00+03:30", is_full_day: true },
        "staff",
        "s1",
      ),
    ).toMatchObject({ id: "t", allDay: true, targetScope: "staff" });
  });

  it("never fabricates weekly hours and states why weekly editing is read-only", () => {
    const payload = composeTargetSchedulePayload({
      scope: "resource",
      reference: "r1",
      target: { name: "اتاق" },
      workingHours: [],
      timeOff: [],
      blocks: [],
      effective: [],
    });
    expect(payload.weekly).toEqual([]);
    expect(payload.inheritanceMode).toBe("inherit_branch");
    expect(payload.timezone).toBeUndefined();
    expect(String(payload.weeklyReadOnlyReason)).toMatch(/هیچ شعبهٔ فعالی/);

    const branchSpecific = composeTargetSchedulePayload({
      scope: "staff",
      reference: "s1",
      target: { first_name: "سارا", last_name: "احمدی" },
      workingHours: [{ id: "w", weekday: 0, branch_id: "b1" }],
      timeOff: [],
      blocks: [],
      effective: [{ branchName: "مرکزی", payload: { timezone: "Asia/Tehran", intervals: [] } }],
    });
    expect(branchSpecific.scopeName).toBe("سارا احمدی");
    expect(branchSpecific.inheritanceMode).toBe("custom");
    expect(branchSpecific.timezone).toBe("Asia/Tehran");
    expect(String(branchSpecific.weeklyReadOnlyReason)).toMatch(/مخصوص شعبه/);
  });
});
