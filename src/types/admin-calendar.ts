import type { StatusKey } from "@/lib/status/status-map";
import type {
  AdminAppointmentStatusFilter,
  AdminPaymentStatusFilter,
} from "@/types/admin-appointment";

/** Independent of grouping — never combine into one enum. */
export type AdminCalendarRange = "day" | "week" | "month";

/** Independent of range. */
export type AdminCalendarGrouping = "general" | "staff" | "resource" | "branch";

export type AdminCalendarPresentation = "grid" | "agenda";

export type AdminCalendarEventType = "appointment" | "blocked" | "time_off";

export type AdminCalendarColumnKind = "general" | "staff" | "resource" | "branch";

export type AdminCalendarWorkingHours = {
  /** 0 = Sunday … 6 = Saturday (Backend-authoritative). */
  dayOfWeek: number;
  start: string;
  end: string;
};

export type AdminCalendarClosedPeriod = {
  date: string;
  reason?: string;
  allDay?: boolean;
};

export type AdminCalendarColumn = {
  id: string;
  label: string;
  kind: AdminCalendarColumnKind;
};

export type AdminCalendarEventView = {
  id: string;
  type: AdminCalendarEventType;
  startsAt: string;
  endsAt: string;
  allDay?: boolean;
  columnId: string;
  title: string;
  accessibleName: string;
  customerName?: string;
  serviceName?: string;
  staffName?: string;
  branchName?: string;
  resourceName?: string;
  status?: StatusKey;
  paymentStatus?: StatusKey;
  appointmentReference?: string;
  blockReason?: string;
  timeOffLabel?: string;
};

export type AdminCalendarDaySummary = {
  date: string;
  appointmentCount: number;
  closed?: boolean;
  closedReason?: string;
  density?: "none" | "low" | "medium" | "high";
};

export type AdminCalendarFilterOptions = {
  services?: Array<{ id: string; name: string }>;
  staff?: Array<{ id: string; name: string }>;
  resources?: Array<{ id: string; name: string; type?: string }>;
  resourceTypes?: Array<{ value: string; label: string }>;
  branches?: Array<{ id: string; name: string }>;
};

export type AdminCalendarPartialError = {
  message: string;
  requestId?: string;
};

export type AdminCalendarView = {
  from: string;
  to: string;
  timezone: string;
  weekStartsOn: number;
  slotIntervalMinutes: number;
  serverNow?: string;
  lastUpdatedAt?: string;
  workingHours: AdminCalendarWorkingHours[];
  closedPeriods: AdminCalendarClosedPeriod[];
  columns: AdminCalendarColumn[];
  events: AdminCalendarEventView[];
  daySummaries: AdminCalendarDaySummary[];
  filterOptions?: AdminCalendarFilterOptions;
  emptyHistory: boolean;
  filtersApplied: boolean;
  noColumnsConfigured?: boolean;
  partialErrors?: {
    blockedTime?: AdminCalendarPartialError;
    timeOff?: AdminCalendarPartialError;
  };
};

export type AdminCalendarState = {
  range: AdminCalendarRange;
  grouping: AdminCalendarGrouping;
  presentation: AdminCalendarPresentation;
  /** Anchor date for the visible range (ISO YYYY-MM-DD). */
  date: string;
  branchId?: string;
  staffId?: string;
  resourceId?: string;
  resourceType?: string;
  serviceId?: string;
  status: AdminAppointmentStatusFilter;
  paymentStatus: AdminPaymentStatusFilter;
  /** Appointment reference opened in Quick View. */
  event?: string;
};

export const ADMIN_CALENDAR_RANGES: AdminCalendarRange[] = ["day", "week", "month"];
export const ADMIN_CALENDAR_GROUPINGS: AdminCalendarGrouping[] = [
  "general",
  "staff",
  "resource",
  "branch",
];

export const ADMIN_CALENDAR_RANGE_LABELS: Record<AdminCalendarRange, string> = {
  day: "روز",
  week: "هفته",
  month: "ماه",
};

export const ADMIN_CALENDAR_GROUPING_LABELS: Record<AdminCalendarGrouping, string> = {
  general: "عمومی",
  staff: "کارکنان",
  resource: "منابع",
  branch: "شعبه",
};

/** Drag & Drop is explicitly out of scope for Phase 27. */
export const ADMIN_CALENDAR_DRAG_DROP_ENABLED = false;
