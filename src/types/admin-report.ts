import type { AppApiError } from "@/types/api";
import type { WidgetResult } from "@/types/customer";

export const ADMIN_REPORTS_ENABLED = true;

/** Report domains supported by the admin Reports UI. */
export const ADMIN_REPORT_TYPES = [
  "revenue",
  "bookings",
  "customers",
  "services",
  "staff",
  "resources",
  "branches",
  "peak",
] as const;

export type AdminReportType = (typeof ADMIN_REPORT_TYPES)[number];

export const ADMIN_REPORT_TYPE_LABELS: Record<AdminReportType, string> = {
  revenue: "درآمد",
  bookings: "نوبت‌ها",
  customers: "مشتریان",
  services: "خدمات",
  staff: "پرسنل",
  resources: "منابع",
  branches: "شعب",
  peak: "ساعات و روزهای اوج",
};

export const ADMIN_REPORT_DATE_PRESETS = [
  "today",
  "last_7_days",
  "last_30_days",
  "this_month",
  "previous_month",
  "custom",
] as const;

export type AdminReportDatePreset = (typeof ADMIN_REPORT_DATE_PRESETS)[number];

export const ADMIN_REPORT_DATE_PRESET_LABELS: Record<AdminReportDatePreset, string> = {
  today: "امروز",
  last_7_days: "۷ روز اخیر",
  last_30_days: "۳۰ روز اخیر",
  this_month: "ماه جاری",
  previous_month: "ماه قبل",
  custom: "بازه سفارشی",
};

export const ADMIN_REPORT_COMPARISON_MODES = [
  "none",
  "previous_period",
  "previous_year",
  "custom",
] as const;

export type AdminReportComparisonMode = (typeof ADMIN_REPORT_COMPARISON_MODES)[number];

export const ADMIN_REPORT_COMPARISON_MODE_LABELS: Record<AdminReportComparisonMode, string> = {
  none: "بدون مقایسه",
  previous_period: "بازه قبلی",
  previous_year: "سال قبل",
  custom: "بازه سفارشی",
};

export type AdminReportMetricState = "ready" | "unavailable" | "error";

export type AdminReportTrendTone = "positive" | "negative" | "neutral";

export type AdminReportMetricComparison = {
  valueLabel?: string;
  absoluteChangeLabel?: string;
  /** Only when Backend provides a defined percentage (never invent when baseline is 0). */
  percentageChangeLabel?: string;
  tone?: AdminReportTrendTone;
  periodLabel?: string;
};

export type AdminReportMetric = {
  key: string;
  label: string;
  state: AdminReportMetricState;
  valueLabel?: string;
  value?: number;
  unit?: string;
  definition?: string;
  comparison?: AdminReportMetricComparison;
  error?: AppApiError;
};

export type AdminReportSeriesPoint = {
  id: string;
  label: string;
  valueLabel?: string;
  value?: number;
  barPercent?: number;
};

export type AdminReportSeries = {
  id: string;
  title: string;
  description?: string;
  unit?: string;
  points: AdminReportSeriesPoint[];
  empty?: boolean;
};

export type AdminReportBreakdownRow = {
  id: string;
  label: string;
  /** Masked when Backend masks customer/staff identities. */
  secondaryLabel?: string;
  metrics: Array<{ key: string; label: string; valueLabel: string }>;
  href?: string;
};

export type AdminReportHeatmapCell = {
  rowId: string;
  columnId: string;
  rowLabel: string;
  columnLabel: string;
  valueLabel: string;
  intensityPercent?: number;
};

export type AdminReportHeatmap = {
  title: string;
  description?: string;
  rows: Array<{ id: string; label: string }>;
  columns: Array<{ id: string; label: string }>;
  cells: AdminReportHeatmapCell[];
  empty?: boolean;
};

export type AdminReportFilterOption = {
  id: string;
  label: string;
};

export type AdminReportFilterOptions = {
  branches?: AdminReportFilterOption[];
  services?: AdminReportFilterOption[];
  staff?: AdminReportFilterOption[];
  resources?: AdminReportFilterOption[];
  resourceTypes?: AdminReportFilterOption[];
  appointmentStatuses?: AdminReportFilterOption[];
  paymentStatuses?: AdminReportFilterOption[];
  presets?: AdminReportDatePreset[];
  comparisonModes?: AdminReportComparisonMode[];
  maxRangeDays?: number;
  timezone?: string;
};

export type AdminReportAllowedActions = {
  export?: boolean;
  viewStaff?: boolean;
  viewResources?: boolean;
  viewBranches?: boolean;
  blockedReason?: string;
};

export type AdminReportRangeView = {
  from: string;
  to: string;
  label?: string;
  timezone?: string;
};

export type AdminReportView = {
  reportType: AdminReportType;
  timezone?: string;
  range: AdminReportRangeView;
  comparisonRange?: AdminReportRangeView;
  lastUpdatedAt?: string;
  scopeLabel?: string;
  currency?: string;
  metrics: AdminReportMetric[];
  series: AdminReportSeries[];
  breakdown: AdminReportBreakdownRow[];
  peakHours?: AdminReportSeries;
  peakDays?: AdminReportSeries;
  heatmap?: AdminReportHeatmap;
  empty: boolean;
  emptyReason?: string;
  rangeInvalid?: boolean;
  rangeInvalidMessage?: string;
  filterOptions?: AdminReportFilterOptions;
  allowedActions: AdminReportAllowedActions;
  widgets?: Record<string, WidgetResult<unknown>>;
};

export type AdminReportMetaView = {
  timezone?: string;
  maxRangeDays?: number;
  supportedReports: AdminReportType[];
  presets: AdminReportDatePreset[];
  comparisonModes: AdminReportComparisonMode[];
  filterOptions?: AdminReportFilterOptions;
  branchesEnabled?: boolean;
  defaultPreset?: AdminReportDatePreset;
  defaultFrom?: string;
  defaultTo?: string;
};

export type AdminReportListFilters = {
  report: AdminReportType;
  preset: AdminReportDatePreset;
  from?: string;
  to?: string;
  comparison: AdminReportComparisonMode;
  compareFrom?: string;
  compareTo?: string;
  branchId?: string;
  serviceId?: string;
  staffId?: string;
  resourceId?: string;
  resourceType?: string;
  appointmentStatus?: string;
  paymentStatus?: string;
};

export type AdminReportExportStatus =
  | "pending"
  | "processing"
  | "ready"
  | "failed"
  | "expired"
  | "unknown";

export type AdminReportExportView = {
  jobId: string;
  status: AdminReportExportStatus;
  statusLabel: string;
  downloadUrl?: string;
  expiresAtLabel?: string;
  errorMessage?: string;
  progressLabel?: string;
  reportType: AdminReportType;
};

export const ADMIN_REPORT_EXPORT_STATUS_LABELS: Record<AdminReportExportStatus, string> = {
  pending: "در صف",
  processing: "در حال آماده‌سازی",
  ready: "آماده دانلود",
  failed: "ناموفق",
  expired: "منقضی‌شده",
  unknown: "نامشخص",
};
