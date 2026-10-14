/** Schedule management scope — one shared editor for all levels. */
export type AdminScheduleScope = "business" | "branch" | "staff" | "resource";

export type AdminScheduleInheritanceMode =
  | "inherit_business"
  | "inherit_branch"
  | "custom"
  | "unknown";

export type AdminScheduleTimeInterval = {
  id: string;
  start: string;
  end: string;
};

export type AdminScheduleBreakInterval = {
  id: string;
  start: string;
  end: string;
  label?: string;
};

export type AdminScheduleWeekdayDraft = {
  weekday: number;
  label: string;
  closed: boolean;
  intervals: AdminScheduleTimeInterval[];
  breaks: AdminScheduleBreakInterval[];
};

export type AdminScheduleOverrideSemantics = "replace" | "merge" | "unknown";

export type AdminScheduleHolidayItem = {
  id: string;
  name: string;
  date: string;
  allDay: boolean;
  closed?: boolean;
  scope: AdminScheduleScope;
  scopeId?: string;
  scopeName?: string;
  description?: string;
  annualRecurrence?: boolean;
  partialRanges?: AdminScheduleTimeInterval[];
};

export type AdminScheduleSpecialDayItem = {
  id: string;
  date: string;
  name?: string;
  closed: boolean;
  semantics?: AdminScheduleOverrideSemantics;
  semanticsLabel?: string;
  intervals?: AdminScheduleTimeInterval[];
  breaks?: AdminScheduleBreakInterval[];
};

export type AdminScheduleTimeOffItem = {
  id: string;
  targetName?: string;
  targetScope: AdminScheduleScope;
  targetId: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  reason?: string;
  note?: string;
};

export type AdminScheduleBlockItem = {
  id: string;
  targetScope: AdminScheduleScope;
  targetId?: string;
  targetName?: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  reason?: string;
  note?: string;
};

export type AdminScheduleEffectiveSummary = {
  sourceLabel?: string;
  inheritanceMode: AdminScheduleInheritanceMode;
  inheritanceLabel?: string;
  weeklySummary?: string[];
  activeOverrides?: string[];
  activeSpecialDays?: string[];
  timeOffSummary?: string[];
  blockSummary?: string[];
  lastUpdatedAt?: string;
};

export type AdminScheduleAllowedActions = {
  view?: boolean;
  edit?: boolean;
  manageWeekly?: boolean;
  manageHolidays?: boolean;
  manageTimeOff?: boolean;
  manageBlocks?: boolean;
  switchInheritance?: boolean;
  viewCalendar?: boolean;
};

export type AdminScheduleCapabilities = {
  supportsOvernightIntervals: boolean;
  supportsAnnualHolidayRecurrence: boolean;
  supportsBreaks: boolean;
  supportsCopyDay: boolean;
  supportsImpactPreview: boolean;
  overrideSemantics?: AdminScheduleOverrideSemantics;
  overrideSemanticsLabel?: string;
  atomicSave: boolean;
};

export type AdminScheduleView = {
  scope: AdminScheduleScope;
  scopeReference?: string;
  scopeName?: string;
  timezone?: string;
  weekStartsOn?: number;
  inheritanceMode: AdminScheduleInheritanceMode;
  weekly: AdminScheduleWeekdayDraft[];
  effective: AdminScheduleEffectiveSummary;
  holidays: AdminScheduleHolidayItem[];
  specialDays: AdminScheduleSpecialDayItem[];
  timeOff: AdminScheduleTimeOffItem[];
  blocks: AdminScheduleBlockItem[];
  version?: string;
  updatedAt?: string;
  allowedActions: AdminScheduleAllowedActions;
  capabilities: AdminScheduleCapabilities;
  calendarHref?: string;
  /** When set, weekly hours are shown read-only (Backend-computed effective schedule) for this reason. */
  weeklyReadOnlyReason?: string;
};

export type AdminScheduleWeeklyInput = {
  inheritanceMode: AdminScheduleInheritanceMode;
  weekly: AdminScheduleWeekdayDraft[];
  version?: string;
};

export type AdminScheduleImpactPreview = {
  title: string;
  summary: string;
  effects: string[];
  futureAppointmentCount?: number;
  availabilityAffected?: boolean;
  requiresConfirmation: boolean;
  confirmLabel?: string;
  previewVersion?: string;
  blocked?: boolean;
  blockedReason?: string;
};

export type AdminScheduleMutationResult = {
  scope: AdminScheduleScope;
  scopeReference?: string;
  version?: string;
  updatedAt?: string;
};

export const ADMIN_SCHEDULE_EDITOR_ENABLED = true;

export const ADMIN_SCHEDULE_INHERITANCE_LABELS: Record<
  Exclude<AdminScheduleInheritanceMode, "unknown">,
  string
> = {
  inherit_business: "از ساعات کسب‌وکار",
  inherit_branch: "از ساعات شعبه",
  custom: "سفارشی",
};

export const ADMIN_SCHEDULE_SCOPE_LABELS: Record<AdminScheduleScope, string> = {
  business: "کسب‌وکار",
  branch: "شعبه",
  staff: "کارمند",
  resource: "منبع",
};

export const WEEKDAY_INDICES = [6, 0, 1, 2, 3, 4, 5] as const;

export const DEFAULT_WEEKDAY_LABELS = [
  "یکشنبه",
  "دوشنبه",
  "سه‌شنبه",
  "چهارشنبه",
  "پنجشنبه",
  "جمعه",
  "شنبه",
] as const;
