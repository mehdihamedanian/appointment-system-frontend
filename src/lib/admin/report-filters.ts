import { routes } from "@/constants/routes";
import { sanitizeIsoDate, sanitizeBranchId } from "@/lib/admin/dashboard-filters";
import {
  parseAdminReportComparisonMode,
  parseAdminReportDatePreset,
  parseAdminReportType,
} from "@/lib/admin/report-adapter";
import { isSafePublicId } from "@/lib/public/booking-href";
import {
  ADMIN_REPORT_TYPES,
  type AdminReportDatePreset,
  type AdminReportListFilters,
  type AdminReportType,
} from "@/types/admin-report";

function sanitizeReference(value: string | null | undefined): string | undefined {
  const raw = value?.trim();
  if (!raw || raw === "all" || /^\d+$/.test(raw)) return undefined;
  if (!isSafePublicId(raw) && !/^[a-zA-Z0-9_.-]+$/.test(raw)) return undefined;
  return raw;
}

/** Filters supported per report — unsupported keys are stripped from API params. */
export const REPORT_SUPPORTED_FILTERS: Record<
  AdminReportType,
  ReadonlyArray<keyof AdminReportListFilters>
> = {
  revenue: [
    "report",
    "preset",
    "from",
    "to",
    "comparison",
    "compareFrom",
    "compareTo",
    "branchId",
    "serviceId",
    "paymentStatus",
  ],
  bookings: [
    "report",
    "preset",
    "from",
    "to",
    "comparison",
    "compareFrom",
    "compareTo",
    "branchId",
    "serviceId",
    "staffId",
    "appointmentStatus",
  ],
  customers: [
    "report",
    "preset",
    "from",
    "to",
    "comparison",
    "compareFrom",
    "compareTo",
    "branchId",
  ],
  services: [
    "report",
    "preset",
    "from",
    "to",
    "comparison",
    "compareFrom",
    "compareTo",
    "branchId",
    "serviceId",
  ],
  staff: [
    "report",
    "preset",
    "from",
    "to",
    "comparison",
    "compareFrom",
    "compareTo",
    "branchId",
    "staffId",
    "serviceId",
  ],
  resources: [
    "report",
    "preset",
    "from",
    "to",
    "comparison",
    "compareFrom",
    "compareTo",
    "branchId",
    "resourceId",
    "resourceType",
  ],
  branches: [
    "report",
    "preset",
    "from",
    "to",
    "comparison",
    "compareFrom",
    "compareTo",
    "branchId",
  ],
  peak: [
    "report",
    "preset",
    "from",
    "to",
    "comparison",
    "compareFrom",
    "compareTo",
    "branchId",
    "serviceId",
    "staffId",
    "resourceId",
  ],
};

export function defaultAdminReportFilters(): AdminReportListFilters {
  return {
    report: "revenue",
    preset: "last_30_days",
    comparison: "none",
  };
}

export function parseAdminReportFilters(search: {
  get(name: string): string | null;
}): AdminReportListFilters {
  const report = parseAdminReportType(search.get("report"));
  const preset = parseAdminReportDatePreset(search.get("preset") ?? search.get("range"));
  const comparison = parseAdminReportComparisonMode(
    search.get("comparison") ?? search.get("compare"),
  );

  const filters: AdminReportListFilters = {
    report,
    preset,
    comparison,
  };

  const from = sanitizeIsoDate(search.get("from"));
  if (from) filters.from = from;
  const to = sanitizeIsoDate(search.get("to"));
  if (to) filters.to = to;
  const compareFrom = sanitizeIsoDate(search.get("compareFrom"));
  if (compareFrom) filters.compareFrom = compareFrom;
  const compareTo = sanitizeIsoDate(search.get("compareTo"));
  if (compareTo) filters.compareTo = compareTo;

  const branchId =
    sanitizeBranchId(search.get("branchId")) ?? sanitizeBranchId(search.get("branch"));
  if (branchId) filters.branchId = branchId;

  const serviceId = sanitizeReference(search.get("serviceId") ?? search.get("service"));
  if (serviceId) filters.serviceId = serviceId;
  const staffId = sanitizeReference(search.get("staffId") ?? search.get("staff"));
  if (staffId) filters.staffId = staffId;
  const resourceId = sanitizeReference(search.get("resourceId") ?? search.get("resource"));
  if (resourceId) filters.resourceId = resourceId;
  const resourceType = sanitizeReference(search.get("resourceType"));
  if (resourceType) filters.resourceType = resourceType;
  const appointmentStatus = sanitizeReference(search.get("appointmentStatus"));
  if (appointmentStatus) filters.appointmentStatus = appointmentStatus;
  const paymentStatus = sanitizeReference(search.get("paymentStatus"));
  if (paymentStatus) filters.paymentStatus = paymentStatus;

  return pruneUnsupportedReportFilters(filters);
}

/** Drop filters that are not valid for the active report domain. */
export function pruneUnsupportedReportFilters(
  filters: AdminReportListFilters,
): AdminReportListFilters {
  const allowed = new Set(REPORT_SUPPORTED_FILTERS[filters.report]);
  const next: AdminReportListFilters = {
    report: filters.report,
    preset: filters.preset,
    comparison: allowed.has("comparison") ? filters.comparison : "none",
  };
  if (allowed.has("from") && filters.from) next.from = filters.from;
  if (allowed.has("to") && filters.to) next.to = filters.to;
  if (allowed.has("compareFrom") && filters.compareFrom) next.compareFrom = filters.compareFrom;
  if (allowed.has("compareTo") && filters.compareTo) next.compareTo = filters.compareTo;
  if (allowed.has("branchId") && filters.branchId) next.branchId = filters.branchId;
  if (allowed.has("serviceId") && filters.serviceId) next.serviceId = filters.serviceId;
  if (allowed.has("staffId") && filters.staffId) next.staffId = filters.staffId;
  if (allowed.has("resourceId") && filters.resourceId) next.resourceId = filters.resourceId;
  if (allowed.has("resourceType") && filters.resourceType) next.resourceType = filters.resourceType;
  if (allowed.has("appointmentStatus") && filters.appointmentStatus) {
    next.appointmentStatus = filters.appointmentStatus;
  }
  if (allowed.has("paymentStatus") && filters.paymentStatus) {
    next.paymentStatus = filters.paymentStatus;
  }

  // Custom range requires from/to; otherwise clear custom dates when using presets.
  if (next.preset !== "custom") {
    delete next.from;
    delete next.to;
  }
  if (next.comparison !== "custom") {
    delete next.compareFrom;
    delete next.compareTo;
  }

  return next;
}

export function adminReportFiltersApplied(filters: AdminReportListFilters): boolean {
  return (
    filters.preset !== "last_30_days" ||
    filters.comparison !== "none" ||
    Boolean(filters.branchId) ||
    Boolean(filters.serviceId) ||
    Boolean(filters.staffId) ||
    Boolean(filters.resourceId) ||
    Boolean(filters.resourceType) ||
    Boolean(filters.appointmentStatus) ||
    Boolean(filters.paymentStatus) ||
    Boolean(filters.from) ||
    Boolean(filters.to)
  );
}

export function countActiveAdminReportFilters(filters: AdminReportListFilters): number {
  let count = 0;
  if (filters.preset !== "last_30_days") count += 1;
  if (filters.comparison !== "none") count += 1;
  if (filters.branchId) count += 1;
  if (filters.serviceId) count += 1;
  if (filters.staffId) count += 1;
  if (filters.resourceId) count += 1;
  if (filters.resourceType) count += 1;
  if (filters.appointmentStatus) count += 1;
  if (filters.paymentStatus) count += 1;
  if (filters.from || filters.to) count += 1;
  return count;
}

export function adminReportsHref(input: Partial<AdminReportListFilters> = {}): string {
  const merged = pruneUnsupportedReportFilters({
    ...defaultAdminReportFilters(),
    ...input,
    report: input.report ?? defaultAdminReportFilters().report,
  });
  const params = new URLSearchParams();
  if (merged.report !== "revenue") params.set("report", merged.report);
  if (merged.preset !== "last_30_days") params.set("preset", merged.preset);
  if (merged.from) params.set("from", merged.from);
  if (merged.to) params.set("to", merged.to);
  if (merged.comparison !== "none") params.set("comparison", merged.comparison);
  if (merged.compareFrom) params.set("compareFrom", merged.compareFrom);
  if (merged.compareTo) params.set("compareTo", merged.compareTo);
  if (merged.branchId) params.set("branchId", merged.branchId);
  if (merged.serviceId) params.set("serviceId", merged.serviceId);
  if (merged.staffId) params.set("staffId", merged.staffId);
  if (merged.resourceId) params.set("resourceId", merged.resourceId);
  if (merged.resourceType) params.set("resourceType", merged.resourceType);
  if (merged.appointmentStatus) params.set("appointmentStatus", merged.appointmentStatus);
  if (merged.paymentStatus) params.set("paymentStatus", merged.paymentStatus);
  const query = params.toString();
  return query ? `${routes.admin.reports}?${query}` : routes.admin.reports;
}

export function filtersToAdminReportParams(
  filters: AdminReportListFilters,
): Record<string, string> {
  const pruned = pruneUnsupportedReportFilters(filters);
  const params: Record<string, string> = {
    report: pruned.report,
    preset: pruned.preset,
  };
  if (pruned.from) params.from = pruned.from;
  if (pruned.to) params.to = pruned.to;
  if (pruned.comparison !== "none") params.comparison = pruned.comparison;
  if (pruned.compareFrom) params.compareFrom = pruned.compareFrom;
  if (pruned.compareTo) params.compareTo = pruned.compareTo;
  if (pruned.branchId) params.branchId = pruned.branchId;
  if (pruned.serviceId) params.serviceId = pruned.serviceId;
  if (pruned.staffId) params.staffId = pruned.staffId;
  if (pruned.resourceId) params.resourceId = pruned.resourceId;
  if (pruned.resourceType) params.resourceType = pruned.resourceType;
  if (pruned.appointmentStatus) params.appointmentStatus = pruned.appointmentStatus;
  if (pruned.paymentStatus) params.paymentStatus = pruned.paymentStatus;
  return params;
}

export function reportPermission(
  kind:
    | "view"
    | "revenue"
    | "bookings"
    | "customers"
    | "services"
    | "staff"
    | "resources"
    | "branches"
    | "peak"
    | "export",
): string {
  switch (kind) {
    case "view":
      return "admin.reports.view";
    case "export":
      return "admin.reports.export";
    default:
      return `admin.reports.${kind}.view`;
  }
}

export function reportTypePermission(report: AdminReportType): string {
  return reportPermission(report);
}

export function isKnownAdminReportType(value: string): value is AdminReportType {
  return (ADMIN_REPORT_TYPES as readonly string[]).includes(value);
}

export function resolveDatePresetForApi(
  preset: AdminReportDatePreset,
): AdminReportDatePreset {
  return preset;
}

export function validateReportRange(
  filters: AdminReportListFilters,
  maxRangeDays?: number,
): { valid: boolean; message?: string } {
  if (filters.preset !== "custom") {
    return { valid: true };
  }
  if (!filters.from || !filters.to) {
    return { valid: false, message: "برای بازه سفارشی تاریخ شروع و پایان را وارد کنید." };
  }
  if (filters.from > filters.to) {
    return { valid: false, message: "تاریخ شروع نمی‌تواند بعد از تاریخ پایان باشد." };
  }
  if (typeof maxRangeDays === "number" && maxRangeDays > 0) {
    const start = new Date(`${filters.from}T12:00:00`);
    const end = new Date(`${filters.to}T12:00:00`);
    const days = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
    if (days > maxRangeDays) {
      return {
        valid: false,
        message: `حداکثر بازه مجاز ${new Intl.NumberFormat("fa-IR").format(maxRangeDays)} روز است.`,
      };
    }
  }
  return { valid: true };
}
