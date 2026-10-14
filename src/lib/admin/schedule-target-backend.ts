import { asList, asSafeText, readBoolean, unwrapPayload } from "@/lib/public/read";
import { formatAppointmentParts } from "@/lib/date-time/format";
import {
  addDaysToIsoDate,
  formatInstantWithOffset,
  isIsoDate,
  zonedDayBounds,
} from "@/lib/date-time/zoned";
import { isRecord, readString } from "@/lib/utilities/records";
import type {
  AdminScheduleBlockItem,
  AdminScheduleScope,
  AdminScheduleTimeOffItem,
} from "@/types/admin-schedule";

/**
 * Resource and staff schedules are separate Backend routes (working hours, time off, blocked
 * times, effective schedule); there is no combined schedule document or impact preview.
 */
export type ScheduleTargetScope = "resource" | "staff";

export function isScheduleTargetScope(scope: AdminScheduleScope): scope is ScheduleTargetScope {
  return scope === "resource" || scope === "staff";
}

export function scheduleTargetBasePath(scope: ScheduleTargetScope, reference: string): string {
  return `${scope === "resource" ? "/resources" : "/staff"}/${encodeURIComponent(reference)}`;
}

/** An inclusive date range → `[start of first day, start of the day after the last day)` in `timeZone`. */
export function dayRangeToInstants(
  startDate: string,
  endDate: string,
  timeZone: string,
): { startsAt: string; endsAt: string } | null {
  if (!isIsoDate(startDate) || !isIsoDate(endDate) || endDate < startDate) return null;
  const start = zonedDayBounds(startDate, timeZone);
  const end = zonedDayBounds(endDate, timeZone);
  if (!start || !end) return null;
  return {
    startsAt: formatInstantWithOffset(start.start, timeZone),
    endsAt: formatInstantWithOffset(end.end, timeZone),
  };
}

/** Instants in the schedule's timezone; raw values when the zone is unknown or a value is unparseable. */
export function formatScheduleRange(startsAt: string, endsAt: string, timeZone?: string): string {
  const start = timeZone ? formatAppointmentParts(startsAt, timeZone) : null;
  const end = timeZone ? formatAppointmentParts(endsAt, timeZone) : null;
  if (!start || !end) return `${startsAt} — ${endsAt}`;
  return `${start.label} تا ${end.label}`;
}

export function adaptTargetBlock(
  value: unknown,
  scope: ScheduleTargetScope,
  reference: string,
): AdminScheduleBlockItem | null {
  if (!isRecord(value)) return null;
  const id = readString(value.id);
  const startsAt = readString(value.starts_at) ?? readString(value.startsAt);
  const endsAt = readString(value.ends_at) ?? readString(value.endsAt);
  if (!id || !startsAt || !endsAt) return null;
  return {
    id,
    targetScope: scope,
    targetId: reference,
    startsAt,
    endsAt,
    allDay: false,
    reason: asSafeText(value.reason),
  };
}

export function adaptTargetTimeOff(
  value: unknown,
  scope: ScheduleTargetScope,
  reference: string,
): AdminScheduleTimeOffItem | null {
  if (!isRecord(value)) return null;
  const id = readString(value.id);
  const startsAt = readString(value.starts_at) ?? readString(value.startsAt);
  const endsAt = readString(value.ends_at) ?? readString(value.endsAt);
  if (!id || !startsAt || !endsAt) return null;
  return {
    id,
    targetScope: scope,
    targetId: reference,
    startsAt,
    endsAt,
    allDay: readBoolean(value.is_full_day) === true,
    reason: asSafeText(value.reason),
  };
}

function hasBranchSpecificHours(workingHours: unknown): boolean {
  return asList(unwrapPayload(workingHours), ["items"]).some(
    (row) => isRecord(row) && readString(row.branch_id) !== undefined,
  );
}

export type ScheduleTargetBranch = { id: string; name?: string };

/** The Backend's effective schedule is per branch; only the target's own active branches are queried. */
export function scheduleTargetBranches(target: unknown): ScheduleTargetBranch[] {
  const root = unwrapPayload(target);
  if (!isRecord(root)) return [];
  return asList(root.branches, ["items"]).flatMap((branch) => {
    if (!isRecord(branch) || readBoolean(branch.is_active) === false) return [];
    const id = readString(branch.id);
    return id ? [{ id, name: asSafeText(branch.name) }] : [];
  });
}

export type TargetEffectiveSchedule = { branchName?: string; payload: unknown };

function effectiveLines(
  effective: TargetEffectiveSchedule,
  timeZone: string,
  withBranch: boolean,
): string[] {
  const root = unwrapPayload(effective.payload);
  const intervals = isRecord(root) ? asList(root.intervals, ["items"]) : [];
  const prefix = withBranch && effective.branchName ? `${effective.branchName} — ` : "";
  return intervals
    .map((interval) => {
      if (!isRecord(interval)) return null;
      const start = formatAppointmentParts(readString(interval.starts_at) ?? "", timeZone);
      const end = formatAppointmentParts(readString(interval.ends_at) ?? "", timeZone);
      if (!start || !end) return null;
      return `${prefix}${start.date}: ${start.time} – ${end.time}`;
    })
    .filter((line): line is string => Boolean(line));
}

function effectiveTimeZone(effective: TargetEffectiveSchedule[]): string | undefined {
  for (const item of effective) {
    const root = unwrapPayload(item.payload);
    const timeZone = isRecord(root) ? readString(root.timezone) : undefined;
    if (timeZone) return timeZone;
  }
  return undefined;
}

export const TARGET_SCHEDULE_DAYS = 7;

export function targetScheduleWindow(today: string): { from: string; to: string } {
  return { from: today, to: addDaysToIsoDate(today, TARGET_SCHEDULE_DAYS - 1) };
}

/** Builds the editor's view document from the Backend's per-concern responses. */
export function composeTargetSchedulePayload(input: {
  scope: ScheduleTargetScope;
  reference: string;
  target: unknown;
  workingHours: unknown;
  timeOff: unknown;
  blocks: unknown;
  effective: TargetEffectiveSchedule[];
}): Record<string, unknown> {
  const target = unwrapPayload(input.target);
  const timezone = effectiveTimeZone(input.effective);
  const withBranch = input.effective.length > 1;
  const name = isRecord(target)
    ? asSafeText(target.name) ??
      ([asSafeText(target.first_name), asSafeText(target.last_name)].filter(Boolean).join(" ") ||
        undefined)
    : undefined;
  const branchSpecific = hasBranchSpecificHours(input.workingHours);
  const hasOwnHours = asList(unwrapPayload(input.workingHours), ["items"]).length > 0;
  return {
    scopeName: name,
    timezone,
    inheritanceMode: hasOwnHours ? "custom" : "inherit_branch",
    weekly: [],
    effective: {
      inheritanceMode: hasOwnHours ? "custom" : "inherit_branch",
      sourceLabel: hasOwnHours
        ? "ساعات اختصاصی این مورد، محدود به ساعات شعبه"
        : "ساعات شعبه و کسب‌وکار",
      weeklySummary: timezone
        ? input.effective.flatMap((item) => effectiveLines(item, timezone, withBranch))
        : [],
    },
    weeklyReadOnlyReason:
      input.effective.length === 0
        ? "این مورد به هیچ شعبهٔ فعالی متصل نیست؛ برنامهٔ مؤثری برای نمایش وجود ندارد."
        : branchSpecific
          ? "این مورد ساعات کاری مخصوص شعبه دارد و ویرایش آن از این صفحه پشتیبانی نمی‌شود. برنامهٔ مؤثر هفت روز آینده از Backend نمایش داده می‌شود."
          : "ساعات هفتگی این مورد در این صفحه فقط نمایش داده می‌شود. برنامهٔ مؤثر هفت روز آینده از Backend نمایش داده می‌شود.",
    timeOff: asList(unwrapPayload(input.timeOff), ["items"])
      .map((item) => adaptTargetTimeOff(item, input.scope, input.reference))
      .filter(Boolean),
    blocks: asList(unwrapPayload(input.blocks), ["items"])
      .map((item) => adaptTargetBlock(item, input.scope, input.reference))
      .filter(Boolean),
    capabilities: {
      supportsImpactPreview: false,
      supportsBreaks: false,
      supportsCopyDay: false,
    },
    allowedActions: {
      manageWeekly: false,
      manageTimeOff: true,
      manageBlocks: true,
      viewCalendar: true,
    },
  };
}
