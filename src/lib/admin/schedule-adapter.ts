import { asList, asSafeText, readBoolean, unwrapPayload } from "@/lib/public/read";
import { isRecord, readString } from "@/lib/utilities/records";
import { formatRange, parseWeekday, weekdayLabel } from "@/lib/public/working-hours";
import { adminStaffCalendarHref } from "@/lib/admin/staff-filters";
import { adminResourceCalendarHref } from "@/lib/admin/resource-filters";
import { routes } from "@/constants/routes";
import type {
  AdminScheduleAllowedActions,
  AdminScheduleBlockItem,
  AdminScheduleBreakInterval,
  AdminScheduleCapabilities,
  AdminScheduleEffectiveSummary,
  AdminScheduleHolidayItem,
  AdminScheduleImpactPreview,
  AdminScheduleInheritanceMode,
  AdminScheduleMutationResult,
  AdminScheduleOverrideSemantics,
  AdminScheduleScope,
  AdminScheduleSpecialDayItem,
  AdminScheduleTimeInterval,
  AdminScheduleTimeOffItem,
  AdminScheduleView,
  AdminScheduleWeekdayDraft,
  AdminScheduleWeeklyInput,
} from "@/types/admin-schedule";
import {
  ADMIN_SCHEDULE_INHERITANCE_LABELS,
  ADMIN_SCHEDULE_SCOPE_LABELS,
  DEFAULT_WEEKDAY_LABELS,
  WEEKDAY_INDICES,
} from "@/types/admin-schedule";

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function parseClock(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function isValidTimeFormat(value: string): boolean {
  return parseClock(value) != null;
}

function adaptInheritanceMode(value: unknown): AdminScheduleInheritanceMode {
  const raw = readString(value)?.toLowerCase().replace(/[\s-]+/g, "_");
  if (raw === "inherit_business" || raw === "business") return "inherit_business";
  if (raw === "inherit_branch" || raw === "branch") return "inherit_branch";
  if (raw === "custom") return "custom";
  return "unknown";
}

function adaptOverrideSemantics(value: unknown): AdminScheduleOverrideSemantics {
  const raw = readString(value)?.toLowerCase();
  if (raw === "replace" || raw === "full_replace") return "replace";
  if (raw === "merge" || raw === "partial") return "merge";
  return "unknown";
}

function adaptInterval(value: unknown, prefix: string): AdminScheduleTimeInterval | null {
  if (!isRecord(value)) return null;
  const start = readString(value.start) ?? readString(value.startTime);
  const end = readString(value.end) ?? readString(value.endTime);
  if (!start || !end) return null;
  const id = readString(value.id) ?? newId(prefix);
  return { id, start, end };
}

function adaptBreak(value: unknown): AdminScheduleBreakInterval | null {
  if (!isRecord(value)) return null;
  const interval = adaptInterval(value, "brk");
  if (!interval) return null;
  const label = asSafeText(value.label) ?? asSafeText(value.name);
  return label ? { ...interval, label } : interval;
}

function adaptWeekdayDraft(value: unknown, fallbackWeekday: number): AdminScheduleWeekdayDraft {
  if (!isRecord(value)) {
    return createEmptyWeekdayDraft(fallbackWeekday);
  }
  const weekday = parseWeekday(value.weekday ?? value.day) ?? fallbackWeekday;
  const closed = readBoolean(value.closed) === true || readBoolean(value.isClosed) === true;
  const intervals = asList(value.intervals ?? value.ranges ?? value.workingHours, ["items"])
    .map((item) => adaptInterval(item, "int"))
    .filter((item): item is AdminScheduleTimeInterval => item != null);
  const breaks = asList(value.breaks, ["items"])
    .map(adaptBreak)
    .filter((item): item is AdminScheduleBreakInterval => item != null);
  return {
    weekday,
    label: weekdayLabel(weekday),
    closed,
    intervals: closed ? [] : intervals.length ? intervals : [emptyInterval()],
    breaks: closed ? [] : breaks,
  };
}

function emptyInterval(): AdminScheduleTimeInterval {
  return { id: newId("int"), start: "09:00", end: "17:00" };
}

export function createEmptyWeekdayDraft(weekday: number): AdminScheduleWeekdayDraft {
  const isFriday = weekday === 5;
  return {
    weekday,
    label: weekdayLabel(weekday),
    closed: isFriday,
    intervals: isFriday ? [] : [emptyInterval()],
    breaks: [],
  };
}

export function createDefaultWeeklyDraft(): AdminScheduleWeekdayDraft[] {
  return WEEKDAY_INDICES.map((weekday) => createEmptyWeekdayDraft(weekday));
}

function adaptWeekly(value: unknown): AdminScheduleWeekdayDraft[] {
  const list = asList(value, ["items", "days", "weekly"]);
  if (list.length === 0) {
    return createDefaultWeeklyDraft();
  }
  const byWeekday = new Map<number, AdminScheduleWeekdayDraft>();
  for (const item of list) {
    const weekday = parseWeekday(isRecord(item) ? item.weekday ?? item.day : undefined);
    if (weekday == null) continue;
    byWeekday.set(weekday, adaptWeekdayDraft(item, weekday));
  }
  return WEEKDAY_INDICES.map((weekday) => byWeekday.get(weekday) ?? createEmptyWeekdayDraft(weekday));
}

function adaptEffective(value: unknown, mode: AdminScheduleInheritanceMode): AdminScheduleEffectiveSummary {
  const root = isRecord(value) ? value : {};
  const inheritanceMode = adaptInheritanceMode(root.inheritanceMode ?? root.mode) ?? mode;
  const effective: AdminScheduleEffectiveSummary = {
    inheritanceMode: inheritanceMode === "unknown" ? mode : inheritanceMode,
  };
  const sourceLabel = asSafeText(root.sourceLabel) ?? asSafeText(root.source);
  if (sourceLabel) effective.sourceLabel = sourceLabel;
  else if (effective.inheritanceMode !== "unknown") {
    effective.inheritanceLabel = ADMIN_SCHEDULE_INHERITANCE_LABELS[effective.inheritanceMode];
  }
  const weeklySummary = asList(root.weeklySummary ?? root.workingHoursSummary, ["items"])
    .map(asSafeText)
    .filter(Boolean) as string[];
  if (weeklySummary.length) effective.weeklySummary = weeklySummary;
  const activeOverrides = asList(root.activeOverrides ?? root.overrides, ["items"])
    .map(asSafeText)
    .filter(Boolean) as string[];
  if (activeOverrides.length) effective.activeOverrides = activeOverrides;
  const activeSpecialDays = asList(root.activeSpecialDays ?? root.specialDays, ["items"])
    .map(asSafeText)
    .filter(Boolean) as string[];
  if (activeSpecialDays.length) effective.activeSpecialDays = activeSpecialDays;
  const timeOffSummary = asList(root.timeOffSummary ?? root.leaveSummary, ["items"])
    .map(asSafeText)
    .filter(Boolean) as string[];
  if (timeOffSummary.length) effective.timeOffSummary = timeOffSummary;
  const blockSummary = asList(root.blockSummary ?? root.blocksSummary, ["items"])
    .map(asSafeText)
    .filter(Boolean) as string[];
  if (blockSummary.length) effective.blockSummary = blockSummary;
  const lastUpdatedAt = readString(root.lastUpdatedAt) ?? readString(root.updatedAt);
  if (lastUpdatedAt) effective.lastUpdatedAt = lastUpdatedAt;
  return effective;
}

function adaptHoliday(value: unknown): AdminScheduleHolidayItem | null {
  if (!isRecord(value)) return null;
  const id = readString(value.id);
  const name = asSafeText(value.name);
  const date = readString(value.date);
  if (!id || !name || !date) return null;
  const scopeRaw = readString(value.scope)?.toLowerCase();
  const scope: AdminScheduleScope =
    scopeRaw === "branch"
      ? "branch"
      : scopeRaw === "staff"
        ? "staff"
        : scopeRaw === "resource"
          ? "resource"
          : "business";
  return {
    id,
    name,
    date,
    allDay: readBoolean(value.allDay) !== false,
    closed: readBoolean(value.closed) === true,
    scope,
    scopeId: readString(value.scopeId) ?? readString(value.branchId),
    scopeName: asSafeText(value.scopeName) ?? asSafeText(value.branchName),
    description: asSafeText(value.description),
    annualRecurrence: readBoolean(value.annualRecurrence) === true,
    partialRanges: asList(value.partialRanges ?? value.ranges, ["items"])
      .map((item) => adaptInterval(item, "hol"))
      .filter((item): item is AdminScheduleTimeInterval => item != null),
  };
}

function adaptSpecialDay(value: unknown): AdminScheduleSpecialDayItem | null {
  if (!isRecord(value)) return null;
  const id = readString(value.id);
  const date = readString(value.date);
  if (!id || !date) return null;
  const semantics = adaptOverrideSemantics(value.semantics ?? value.overrideSemantics);
  const semanticsLabel =
    asSafeText(value.semanticsLabel) ?? asSafeText(value.overrideSemanticsLabel);
  return {
    id,
    date,
    name: asSafeText(value.name),
    closed: readBoolean(value.closed) === true,
    semantics: semantics !== "unknown" ? semantics : undefined,
    semanticsLabel,
    intervals: asList(value.intervals ?? value.ranges, ["items"])
      .map((item) => adaptInterval(item, "spd"))
      .filter((item): item is AdminScheduleTimeInterval => item != null),
    breaks: asList(value.breaks, ["items"])
      .map(adaptBreak)
      .filter((item): item is AdminScheduleBreakInterval => item != null),
  };
}

function adaptTimeOff(value: unknown): AdminScheduleTimeOffItem | null {
  if (!isRecord(value)) return null;
  const id = readString(value.id);
  const startsAt = readString(value.startsAt) ?? readString(value.start);
  const endsAt = readString(value.endsAt) ?? readString(value.end);
  if (!id || !startsAt || !endsAt) return null;
  const targetScopeRaw = readString(value.targetScope ?? value.scope)?.toLowerCase();
  const targetScope: AdminScheduleScope =
    targetScopeRaw === "resource"
      ? "resource"
      : targetScopeRaw === "branch"
        ? "branch"
        : "staff";
  const targetId =
    readString(value.targetId) ?? readString(value.staffId) ?? readString(value.resourceId) ?? "";
  return {
    id,
    targetName: asSafeText(value.targetName) ?? asSafeText(value.staffName) ?? asSafeText(value.resourceName),
    targetScope,
    targetId,
    startsAt,
    endsAt,
    allDay: readBoolean(value.allDay) === true,
    reason: asSafeText(value.reason),
    note: asSafeText(value.note) ?? asSafeText(value.internalNote),
  };
}

function adaptBlock(value: unknown): AdminScheduleBlockItem | null {
  if (!isRecord(value)) return null;
  const id = readString(value.id);
  const startsAt = readString(value.startsAt) ?? readString(value.start);
  const endsAt = readString(value.endsAt) ?? readString(value.end);
  if (!id || !startsAt || !endsAt) return null;
  const targetScopeRaw = readString(value.targetScope ?? value.scope)?.toLowerCase();
  const targetScope: AdminScheduleScope =
    targetScopeRaw === "branch"
      ? "branch"
      : targetScopeRaw === "staff"
        ? "staff"
        : targetScopeRaw === "resource"
          ? "resource"
          : "business";
  return {
    id,
    targetScope,
    targetId: readString(value.targetId),
    targetName: asSafeText(value.targetName),
    startsAt,
    endsAt,
    allDay: readBoolean(value.allDay) === true,
    reason: asSafeText(value.reason),
    note: asSafeText(value.note) ?? asSafeText(value.internalNote),
  };
}

function adaptAllowedActions(value: unknown): AdminScheduleAllowedActions {
  const source = isRecord(value) ? value : {};
  const read = (key: string, alt?: string) =>
    readBoolean(source[key]) === true || (alt ? readBoolean(source[alt]) === true : false);
  return {
    view: read("view"),
    edit: read("edit", "manage"),
    manageWeekly: read("manageWeekly", "weekly"),
    manageHolidays: read("manageHolidays", "holidays"),
    manageTimeOff: read("manageTimeOff", "timeOff"),
    manageBlocks: read("manageBlocks", "blocks"),
    switchInheritance: read("switchInheritance", "inheritance"),
    viewCalendar: read("viewCalendar", "calendar"),
  };
}

function adaptCapabilities(value: unknown): AdminScheduleCapabilities {
  const source = isRecord(value) ? value : {};
  const semantics = adaptOverrideSemantics(source.overrideSemantics);
  return {
    supportsOvernightIntervals: readBoolean(source.supportsOvernightIntervals) === true,
    supportsAnnualHolidayRecurrence: readBoolean(source.supportsAnnualHolidayRecurrence) === true,
    supportsBreaks: readBoolean(source.supportsBreaks) !== false,
    supportsCopyDay: readBoolean(source.supportsCopyDay) !== false,
    supportsImpactPreview: readBoolean(source.supportsImpactPreview) !== false,
    overrideSemantics: semantics !== "unknown" ? semantics : undefined,
    overrideSemanticsLabel: asSafeText(source.overrideSemanticsLabel),
    atomicSave: readBoolean(source.atomicSave) !== false,
  };
}

function scheduleCalendarHref(scope: AdminScheduleScope, reference?: string): string | undefined {
  if (scope === "staff" && reference) return adminStaffCalendarHref(reference);
  if (scope === "resource" && reference) return adminResourceCalendarHref(reference);
  if (scope === "branch" && reference) {
    return `${routes.admin.calendar}?branchId=${encodeURIComponent(reference)}`;
  }
  return routes.admin.calendar;
}

export function adaptAdminScheduleView(
  payload: unknown,
  scope: AdminScheduleScope,
  scopeReference?: string,
): AdminScheduleView | null {
  const root = unwrapPayload(payload);
  if (!isRecord(root)) return null;

  const inheritanceMode = adaptInheritanceMode(
    root.inheritanceMode ?? root.scheduleMode ?? root.mode,
  );
  const weekly = adaptWeekly(root.weekly ?? root.workingHours ?? root.days);
  const effective = adaptEffective(root.effective ?? root.effectiveSummary ?? root, inheritanceMode);
  const scopeName =
    asSafeText(root.scopeName) ??
    asSafeText(root.name) ??
    (scope === "business" ? ADMIN_SCHEDULE_SCOPE_LABELS.business : undefined);

  const holidays = asList(root.holidays, ["items"])
    .map(adaptHoliday)
    .filter((item): item is AdminScheduleHolidayItem => item != null);
  const specialDays = asList(root.specialDays ?? root.overrides, ["items"])
    .map(adaptSpecialDay)
    .filter((item): item is AdminScheduleSpecialDayItem => item != null);
  const timeOff = asList(root.timeOff ?? root.leaves, ["items"])
    .map(adaptTimeOff)
    .filter((item): item is AdminScheduleTimeOffItem => item != null);
  const blocks = asList(root.blocks ?? root.blockTimes, ["items"])
    .map(adaptBlock)
    .filter((item): item is AdminScheduleBlockItem => item != null);

  const allowedActions = adaptAllowedActions(root.allowedActions);
  const capabilities = adaptCapabilities(root.capabilities);

  return {
    scope,
    scopeReference: scopeReference ?? readString(root.scopeReference) ?? readString(root.reference),
    scopeName,
    timezone: readString(root.timezone),
    weekStartsOn: typeof root.weekStartsOn === "number" ? root.weekStartsOn : 6,
    inheritanceMode,
    weekly,
    effective,
    holidays,
    specialDays,
    timeOff,
    blocks,
    version: readString(root.version) ?? readString(root.etag),
    updatedAt: readString(root.updatedAt),
    allowedActions,
    capabilities,
    calendarHref: scheduleCalendarHref(scope, scopeReference),
  };
}

export function adaptAdminScheduleImpactPreview(payload: unknown): AdminScheduleImpactPreview | null {
  const root = unwrapPayload(payload);
  if (!isRecord(root)) return null;
  const title = asSafeText(root.title) ?? "پیش‌نمایش تأثیر";
  const summary = asSafeText(root.summary) ?? asSafeText(root.message) ?? "";
  const effects = asList(root.effects ?? root.impacts ?? root.warnings, ["items"])
    .map(asSafeText)
    .filter(Boolean) as string[];
  return {
    title,
    summary,
    effects,
    futureAppointmentCount:
      typeof root.futureAppointmentCount === "number"
        ? root.futureAppointmentCount
        : typeof root.affectedAppointmentCount === "number"
          ? root.affectedAppointmentCount
          : undefined,
    availabilityAffected: readBoolean(root.availabilityAffected) === true,
    requiresConfirmation: readBoolean(root.requiresConfirmation) !== false,
    confirmLabel: asSafeText(root.confirmLabel),
    previewVersion: readString(root.previewVersion) ?? readString(root.version),
    blocked: readBoolean(root.blocked) === true,
    blockedReason: asSafeText(root.blockedReason) ?? asSafeText(root.reason),
  };
}

export function adaptAdminScheduleMutationResult(
  payload: unknown,
  scope: AdminScheduleScope,
  scopeReference?: string,
): AdminScheduleMutationResult {
  const root = unwrapPayload(payload);
  if (!isRecord(root)) {
    return { scope, scopeReference };
  }
  return {
    scope,
    scopeReference: scopeReference ?? readString(root.scopeReference) ?? readString(root.reference),
    version: readString(root.version) ?? readString(root.etag),
    updatedAt: readString(root.updatedAt),
  };
}

export type AdminScheduleValidationIssue = {
  weekday?: number;
  intervalId?: string;
  breakId?: string;
  field?: "start" | "end";
  message: string;
};

function intervalsOverlap(a: AdminScheduleTimeInterval, b: AdminScheduleTimeInterval): boolean {
  const aStart = parseClock(a.start);
  const aEnd = parseClock(a.end);
  const bStart = parseClock(b.start);
  const bEnd = parseClock(b.end);
  if (aStart == null || aEnd == null || bStart == null || bEnd == null) return false;
  if (aEnd <= aStart || bEnd <= bStart) return false;
  return aStart < bEnd && bStart < aEnd;
}

function sameInterval(a: AdminScheduleTimeInterval, b: AdminScheduleTimeInterval): boolean {
  return a.start === b.start && a.end === b.end;
}

export function validateWeeklyDraft(
  weekly: AdminScheduleWeekdayDraft[],
  options: { supportsOvernightIntervals?: boolean; supportsBreaks?: boolean } = {},
): AdminScheduleValidationIssue[] {
  const issues: AdminScheduleValidationIssue[] = [];
  const supportsOvernight = options.supportsOvernightIntervals === true;
  const supportsBreaks = options.supportsBreaks !== false;

  for (const day of weekly) {
    if (day.closed) continue;

    if (day.intervals.length === 0) {
      issues.push({ weekday: day.weekday, message: `${day.label}: حداقل یک بازه کاری لازم است.` });
      continue;
    }

    for (const interval of day.intervals) {
      const start = parseClock(interval.start);
      const end = parseClock(interval.end);
      if (!isValidTimeFormat(interval.start)) {
        issues.push({
          weekday: day.weekday,
          intervalId: interval.id,
          field: "start",
          message: `${day.label}: زمان شروع نامعتبر است.`,
        });
      }
      if (!isValidTimeFormat(interval.end)) {
        issues.push({
          weekday: day.weekday,
          intervalId: interval.id,
          field: "end",
          message: `${day.label}: زمان پایان نامعتبر است.`,
        });
      }
      if (start != null && end != null) {
        if (!supportsOvernight && end <= start) {
          issues.push({
            weekday: day.weekday,
            intervalId: interval.id,
            message: `${day.label}: پایان باید بعد از شروع باشد.`,
          });
        }
      }
    }

    for (let i = 0; i < day.intervals.length; i++) {
      for (let j = i + 1; j < day.intervals.length; j++) {
        if (sameInterval(day.intervals[i], day.intervals[j])) {
          issues.push({
            weekday: day.weekday,
            intervalId: day.intervals[j].id,
            message: `${day.label}: بازه تکراری وجود دارد.`,
          });
        } else if (intervalsOverlap(day.intervals[i], day.intervals[j])) {
          issues.push({
            weekday: day.weekday,
            intervalId: day.intervals[j].id,
            message: `${day.label}: بازه‌های کاری هم‌پوشانی دارند.`,
          });
        }
      }
    }

    if (!supportsBreaks) continue;

    for (const brk of day.breaks) {
      const bStart = parseClock(brk.start);
      const bEnd = parseClock(brk.end);
      if (!isValidTimeFormat(brk.start) || !isValidTimeFormat(brk.end)) {
        issues.push({
          weekday: day.weekday,
          breakId: brk.id,
          message: `${day.label}: زمان استراحت نامعتبر است.`,
        });
        continue;
      }
      if (bStart != null && bEnd != null && bEnd <= bStart) {
        issues.push({
          weekday: day.weekday,
          breakId: brk.id,
          message: `${day.label}: پایان استراحت باید بعد از شروع باشد.`,
        });
      }
      const inside = day.intervals.some((interval) => {
        const iStart = parseClock(interval.start);
        const iEnd = parseClock(interval.end);
        if (iStart == null || iEnd == null || bStart == null || bEnd == null) return false;
        return bStart >= iStart && bEnd <= iEnd;
      });
      if (!inside) {
        issues.push({
          weekday: day.weekday,
          breakId: brk.id,
          message: `${day.label}: استراحت باید داخل یک بازه کاری باشد.`,
        });
      }
    }

    for (let i = 0; i < day.breaks.length; i++) {
      for (let j = i + 1; j < day.breaks.length; j++) {
        const a = day.breaks[i];
        const b = day.breaks[j];
        if (a.start === b.start && a.end === b.end) {
          issues.push({
            weekday: day.weekday,
            breakId: b.id,
            message: `${day.label}: استراحت تکراری وجود دارد.`,
          });
        } else if (
          intervalsOverlap(
            { id: a.id, start: a.start, end: a.end },
            { id: b.id, start: b.start, end: b.end },
          )
        ) {
          issues.push({
            weekday: day.weekday,
            breakId: b.id,
            message: `${day.label}: استراحت‌ها هم‌پوشانی دارند.`,
          });
        }
      }
    }
  }

  return issues;
}

export function summarizeWeekday(day: AdminScheduleWeekdayDraft): string {
  if (day.closed) return "تعطیل";
  if (day.intervals.length === 0) return "بدون بازه";
  const ranges = day.intervals.map((interval) => formatRange(interval)).join("، ");
  const breaks =
    day.breaks.length > 0
      ? ` (استراحت: ${day.breaks.map((b) => formatRange(b)).join("، ")})`
      : "";
  return `${ranges}${breaks}`;
}

export function sanitizeWeeklyBody(input: AdminScheduleWeeklyInput) {
  return {
    inheritanceMode: input.inheritanceMode,
    version: input.version,
    weekly: input.weekly.map((day) => ({
      weekday: day.weekday,
      closed: day.closed,
      intervals: day.closed
        ? []
        : day.intervals.map(({ start, end }) => ({ start, end })),
      breaks: day.closed ? [] : day.breaks.map(({ start, end, label }) => ({ start, end, label })),
    })),
  };
}

export function weeklyDraftEquals(
  left: AdminScheduleWeekdayDraft[],
  right: AdminScheduleWeekdayDraft[],
): boolean {
  return JSON.stringify(sanitizeWeeklyBody({ inheritanceMode: "custom", weekly: left })) ===
    JSON.stringify(sanitizeWeeklyBody({ inheritanceMode: "custom", weekly: right }));
}

export { DEFAULT_WEEKDAY_LABELS, WEEKDAY_INDICES };
