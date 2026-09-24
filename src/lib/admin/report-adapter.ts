import { isSafePublicId } from "@/lib/public/booking-href";
import {
  asList,
  asSafeText,
  readBoolean,
  readNumber,
  unwrapPayload,
} from "@/lib/public/read";
import { isRecord, readString } from "@/lib/utilities/records";
import type { AppApiError } from "@/types/api";
import {
  ADMIN_REPORT_COMPARISON_MODES,
  ADMIN_REPORT_DATE_PRESETS,
  ADMIN_REPORT_EXPORT_STATUS_LABELS,
  ADMIN_REPORT_TYPES,
  type AdminReportAllowedActions,
  type AdminReportBreakdownRow,
  type AdminReportComparisonMode,
  type AdminReportDatePreset,
  type AdminReportExportStatus,
  type AdminReportExportView,
  type AdminReportFilterOption,
  type AdminReportFilterOptions,
  type AdminReportHeatmap,
  type AdminReportHeatmapCell,
  type AdminReportMetaView,
  type AdminReportMetric,
  type AdminReportMetricComparison,
  type AdminReportMetricState,
  type AdminReportRangeView,
  type AdminReportSeries,
  type AdminReportSeriesPoint,
  type AdminReportTrendTone,
  type AdminReportType,
  type AdminReportView,
} from "@/types/admin-report";

function widgetError(value: unknown): AppApiError | undefined {
  if (!isRecord(value)) return undefined;
  const nested = isRecord(value.error) ? value.error : value;
  const status = typeof nested.status === "number" ? nested.status : undefined;
  const message = readString(nested.message);
  if (status && status >= 400) {
    return {
      status,
      code: readString(nested.code),
      message: message ?? "دریافت این بخش ممکن نشد.",
      requestId: readString(nested.requestId),
    };
  }
  if (readBoolean(value.failed) === true || readString(value.error)) {
    return {
      status: 500,
      message: message ?? readString(value.error) ?? "دریافت این بخش ممکن نشد.",
      requestId: readString(nested.requestId),
    };
  }
  return undefined;
}

export function parseAdminReportType(value: unknown): AdminReportType {
  const raw = readString(value)?.toLowerCase().replace(/[\s-]+/g, "_");
  if (raw && (ADMIN_REPORT_TYPES as readonly string[]).includes(raw)) {
    return raw as AdminReportType;
  }
  return "revenue";
}

export function parseAdminReportDatePreset(value: unknown): AdminReportDatePreset {
  const raw = readString(value)?.toLowerCase().replace(/[\s-]+/g, "_");
  if (raw && (ADMIN_REPORT_DATE_PRESETS as readonly string[]).includes(raw)) {
    return raw as AdminReportDatePreset;
  }
  return "last_30_days";
}

export function parseAdminReportComparisonMode(value: unknown): AdminReportComparisonMode {
  const raw = readString(value)?.toLowerCase().replace(/[\s-]+/g, "_");
  if (raw && (ADMIN_REPORT_COMPARISON_MODES as readonly string[]).includes(raw)) {
    return raw as AdminReportComparisonMode;
  }
  return "none";
}

function parseTrendTone(value: unknown): AdminReportTrendTone {
  const raw = (readString(value) ?? "neutral").toLowerCase();
  if (raw === "positive" || raw === "up" || raw === "increase") return "positive";
  if (raw === "negative" || raw === "down" || raw === "decrease") return "negative";
  return "neutral";
}

function parseMetricState(value: unknown): AdminReportMetricState {
  const raw = readString(value)?.toLowerCase();
  if (raw === "error" || raw === "failed") return "error";
  if (raw === "unavailable" || raw === "missing") return "unavailable";
  return "ready";
}

function adaptComparison(value: unknown): AdminReportMetricComparison | undefined {
  if (!isRecord(value)) return undefined;
  const comparison: AdminReportMetricComparison = {};
  const valueLabel = asSafeText(value.valueLabel ?? value.comparisonValueLabel);
  if (valueLabel) comparison.valueLabel = valueLabel;
  const absoluteChangeLabel = asSafeText(
    value.absoluteChangeLabel ?? value.changeLabel ?? value.deltaLabel,
  );
  if (absoluteChangeLabel) comparison.absoluteChangeLabel = absoluteChangeLabel;
  // Only accept Backend-provided percentage — never invent when baseline is zero.
  if (readBoolean(value.percentageAvailable) !== false) {
    const percentageChangeLabel = asSafeText(
      value.percentageChangeLabel ?? value.percentChangeLabel ?? value.percentageLabel,
    );
    if (percentageChangeLabel) comparison.percentageChangeLabel = percentageChangeLabel;
  }
  const periodLabel = asSafeText(value.periodLabel ?? value.comparisonPeriodLabel);
  if (periodLabel) comparison.periodLabel = periodLabel;
  comparison.tone = parseTrendTone(value.tone ?? value.direction);
  if (
    !comparison.valueLabel &&
    !comparison.absoluteChangeLabel &&
    !comparison.percentageChangeLabel &&
    !comparison.periodLabel
  ) {
    return undefined;
  }
  return comparison;
}

export function adaptAdminReportMetric(value: unknown, index = 0): AdminReportMetric | null {
  if (value == null) return null;
  if (!isRecord(value)) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return {
        key: `metric-${index}`,
        label: `شاخص ${index + 1}`,
        state: "ready",
        value: value,
        valueLabel: new Intl.NumberFormat("fa-IR").format(value),
      };
    }
    return null;
  }

  const error = widgetError(value);
  const key =
    readString(value.key) ??
    readString(value.id) ??
    readString(value.metricKey) ??
    `metric-${index}`;
  const label = asSafeText(value.label ?? value.name ?? value.title) ?? key;

  if (error) {
    return { key, label, state: "error", error };
  }

  if (
    readBoolean(value.unavailable) === true ||
    parseMetricState(value.state) === "unavailable"
  ) {
    return { key, label, state: "unavailable" };
  }

  const valueLabel =
    asSafeText(value.valueLabel ?? value.amountLabel ?? value.formattedValue) ??
    (typeof value.value === "number"
      ? new Intl.NumberFormat("fa-IR").format(value.value)
      : undefined);

  // Never coerce unavailable to zero: if Backend omitted the value, mark unavailable.
  if (valueLabel == null && value.value == null && value.count == null && value.amount == null) {
    return { key, label, state: "unavailable" };
  }

  const metric: AdminReportMetric = {
    key,
    label,
    state: "ready",
  };
  if (valueLabel) metric.valueLabel = valueLabel;
  const numeric =
    readNumber(value.value) ?? readNumber(value.count) ?? readNumber(value.amount);
  if (typeof numeric === "number") metric.value = numeric;
  const unit = asSafeText(value.unit ?? value.currency);
  if (unit) metric.unit = unit;
  const definition = asSafeText(value.definition ?? value.helpText ?? value.description);
  if (definition) metric.definition = definition;
  const comparison = adaptComparison(value.comparison ?? value.trend);
  if (comparison) metric.comparison = comparison;
  return metric;
}

function adaptSeriesPoint(value: unknown, index: number): AdminReportSeriesPoint | null {
  if (!isRecord(value)) return null;
  const label = asSafeText(value.label ?? value.name ?? value.bucketLabel ?? value.hourLabel);
  if (!label) return null;
  const point: AdminReportSeriesPoint = {
    id: readString(value.id) ?? `point-${index}`,
    label,
  };
  const valueLabel = asSafeText(value.valueLabel ?? value.countLabel ?? value.formattedValue);
  if (valueLabel) point.valueLabel = valueLabel;
  const numeric = readNumber(value.value) ?? readNumber(value.count);
  if (typeof numeric === "number") point.value = numeric;
  const barPercent = readNumber(value.barPercent ?? value.percent ?? value.intensityPercent);
  if (typeof barPercent === "number") {
    point.barPercent = Math.max(0, Math.min(100, barPercent));
  }
  return point;
}

export function adaptAdminReportSeries(value: unknown, fallbackTitle = "نمودار"): AdminReportSeries | null {
  if (!isRecord(value) && !Array.isArray(value)) return null;
  const source = isRecord(value) ? value : { points: value };
  const points = asList(source, ["points", "items", "buckets", "data"])
    .map((item, index) => adaptSeriesPoint(item, index))
    .filter((item): item is AdminReportSeriesPoint => Boolean(item));

  const series: AdminReportSeries = {
    id: readString(source.id) ?? "series",
    title: asSafeText(source.title ?? source.label ?? source.name) ?? fallbackTitle,
    points,
    empty: points.length === 0 || readBoolean(source.empty) === true,
  };
  const description = asSafeText(source.description);
  if (description) series.description = description;
  const unit = asSafeText(source.unit);
  if (unit) series.unit = unit;
  return series;
}

function adaptBreakdownRow(value: unknown, index: number): AdminReportBreakdownRow | null {
  if (!isRecord(value)) return null;
  const label = asSafeText(value.label ?? value.name ?? value.customerNameMasked);
  if (!label) return null;
  const metricsSource = asList(value, ["metrics", "values", "columns"]);
  const metrics =
    metricsSource.length > 0
      ? metricsSource
          .map((item, metricIndex) => {
            if (!isRecord(item)) return null;
            const metricLabel = asSafeText(item.label ?? item.key) ?? `ستون ${metricIndex + 1}`;
            const valueLabel = asSafeText(item.valueLabel ?? item.value);
            if (!valueLabel) return null;
            return {
              key: readString(item.key) ?? `m-${metricIndex}`,
              label: metricLabel,
              valueLabel,
            };
          })
          .filter((item): item is { key: string; label: string; valueLabel: string } => Boolean(item))
      : Object.entries(value)
          .filter(([key]) => !["id", "label", "name", "href", "secondaryLabel", "metrics"].includes(key))
          .map(([key, raw]) => {
            const valueLabel = asSafeText(raw);
            if (!valueLabel) return null;
            return { key, label: key, valueLabel };
          })
          .filter((item): item is { key: string; label: string; valueLabel: string } => Boolean(item));

  const row: AdminReportBreakdownRow = {
    id: readString(value.id) ?? `row-${index}`,
    label,
    metrics,
  };
  const secondaryLabel = asSafeText(value.secondaryLabel ?? value.subtitle ?? value.maskedId);
  if (secondaryLabel) row.secondaryLabel = secondaryLabel;
  const href = readString(value.href);
  if (href && href.startsWith("/")) row.href = href;
  return row;
}

function adaptHeatmapCell(value: unknown): AdminReportHeatmapCell | null {
  if (!isRecord(value)) return null;
  const rowId = readString(value.rowId ?? value.yId ?? value.dayId);
  const columnId = readString(value.columnId ?? value.xId ?? value.hourId);
  const rowLabel = asSafeText(value.rowLabel ?? value.yLabel ?? value.dayLabel);
  const columnLabel = asSafeText(value.columnLabel ?? value.xLabel ?? value.hourLabel);
  const valueLabel = asSafeText(value.valueLabel ?? value.countLabel ?? value.value);
  if (!rowId || !columnId || !rowLabel || !columnLabel || !valueLabel) return null;
  const cell: AdminReportHeatmapCell = {
    rowId,
    columnId,
    rowLabel,
    columnLabel,
    valueLabel,
  };
  const intensity = readNumber(value.intensityPercent ?? value.barPercent ?? value.percent);
  if (typeof intensity === "number") {
    cell.intensityPercent = Math.max(0, Math.min(100, intensity));
  }
  return cell;
}

function adaptHeatmap(value: unknown): AdminReportHeatmap | undefined {
  if (!isRecord(value)) return undefined;
  const cells = asList(value, ["cells", "items", "data"])
    .map((item) => adaptHeatmapCell(item))
    .filter((item): item is AdminReportHeatmapCell => Boolean(item));
  const rows = asList(value, ["rows", "yAxis"]).map((item, index) => {
    if (!isRecord(item)) return null;
    const id = readString(item.id) ?? `row-${index}`;
    const label = asSafeText(item.label);
    return label ? { id, label } : null;
  }).filter((item): item is { id: string; label: string } => Boolean(item));
  const columns = asList(value, ["columns", "xAxis"]).map((item, index) => {
    if (!isRecord(item)) return null;
    const id = readString(item.id) ?? `col-${index}`;
    const label = asSafeText(item.label);
    return label ? { id, label } : null;
  }).filter((item): item is { id: string; label: string } => Boolean(item));

  const heatmap: AdminReportHeatmap = {
    title: asSafeText(value.title ?? value.label) ?? "نقشه حرارتی",
    rows:
      rows.length > 0
        ? rows
        : Array.from(new Map(cells.map((cell) => [cell.rowId, { id: cell.rowId, label: cell.rowLabel }])).values()),
    columns:
      columns.length > 0
        ? columns
        : Array.from(
            new Map(cells.map((cell) => [cell.columnId, { id: cell.columnId, label: cell.columnLabel }])).values(),
          ),
    cells,
    empty: cells.length === 0 || readBoolean(value.empty) === true,
  };
  const description = asSafeText(value.description);
  if (description) heatmap.description = description;
  return heatmap;
}

function adaptFilterOption(value: unknown): AdminReportFilterOption | null {
  if (!isRecord(value)) return null;
  const id = readString(value.id) ?? readString(value.value) ?? readString(value.reference);
  const label = asSafeText(value.label ?? value.name);
  if (!id || !label) return null;
  if (!isSafePublicId(id) && !/^[a-zA-Z0-9_.-]+$/.test(id)) return null;
  return { id, label };
}

function adaptFilterOptions(value: unknown): AdminReportFilterOptions | undefined {
  if (!isRecord(value)) return undefined;
  const options: AdminReportFilterOptions = {};
  const branches = asList(value, ["branches"]).map(adaptFilterOption).filter(Boolean) as AdminReportFilterOption[];
  if (branches.length) options.branches = branches;
  const services = asList(value, ["services"]).map(adaptFilterOption).filter(Boolean) as AdminReportFilterOption[];
  if (services.length) options.services = services;
  const staff = asList(value, ["staff", "providers"]).map(adaptFilterOption).filter(Boolean) as AdminReportFilterOption[];
  if (staff.length) options.staff = staff;
  const resources = asList(value, ["resources"]).map(adaptFilterOption).filter(Boolean) as AdminReportFilterOption[];
  if (resources.length) options.resources = resources;
  const resourceTypes = asList(value, ["resourceTypes"]).map(adaptFilterOption).filter(Boolean) as AdminReportFilterOption[];
  if (resourceTypes.length) options.resourceTypes = resourceTypes;
  const appointmentStatuses = asList(value, ["appointmentStatuses"]).map(adaptFilterOption).filter(Boolean) as AdminReportFilterOption[];
  if (appointmentStatuses.length) options.appointmentStatuses = appointmentStatuses;
  const paymentStatuses = asList(value, ["paymentStatuses"]).map(adaptFilterOption).filter(Boolean) as AdminReportFilterOption[];
  if (paymentStatuses.length) options.paymentStatuses = paymentStatuses;
  const presets = asList(value, ["presets"])
    .map((item) => parseAdminReportDatePreset(isRecord(item) ? item.id ?? item.value : item))
    .filter((item, index, all) => all.indexOf(item) === index);
  if (presets.length) options.presets = presets;
  const comparisonModes = asList(value, ["comparisonModes"])
    .map((item) => parseAdminReportComparisonMode(isRecord(item) ? item.id ?? item.value : item))
    .filter((item, index, all) => all.indexOf(item) === index);
  if (comparisonModes.length) options.comparisonModes = comparisonModes;
  const maxRangeDays = readNumber(value.maxRangeDays);
  if (typeof maxRangeDays === "number" && maxRangeDays > 0) options.maxRangeDays = maxRangeDays;
  const timezone = readString(value.timezone);
  if (timezone) options.timezone = timezone;
  return Object.keys(options).length > 0 ? options : undefined;
}

function adaptAllowedActions(value: unknown): AdminReportAllowedActions {
  if (!isRecord(value)) {
    return { export: false };
  }
  return {
    export: readBoolean(value.export) === true,
    viewStaff: readBoolean(value.viewStaff) !== false,
    viewResources: readBoolean(value.viewResources) !== false,
    viewBranches: readBoolean(value.viewBranches) !== false,
    blockedReason: asSafeText(value.blockedReason),
  };
}

function adaptRange(value: unknown, fallbackFrom?: string, fallbackTo?: string): AdminReportRangeView {
  if (!isRecord(value)) {
    return {
      from: fallbackFrom ?? "",
      to: fallbackTo ?? "",
    };
  }
  const range: AdminReportRangeView = {
    from: readString(value.from ?? value.start) ?? fallbackFrom ?? "",
    to: readString(value.to ?? value.end) ?? fallbackTo ?? "",
  };
  const label = asSafeText(value.label ?? value.rangeLabel);
  if (label) range.label = label;
  const timezone = readString(value.timezone);
  if (timezone) range.timezone = timezone;
  return range;
}

export function adaptAdminReportMeta(payload: unknown): AdminReportMetaView {
  const root = unwrapPayload(payload);
  const source = isRecord(root) ? root : {};
  const supportedReports = asList(source, ["supportedReports", "reports"])
    .map((item) => parseAdminReportType(isRecord(item) ? item.id ?? item.key : item))
    .filter((item, index, all) => all.indexOf(item) === index);
  const presets = asList(source, ["presets"])
    .map((item) => parseAdminReportDatePreset(isRecord(item) ? item.id ?? item.value : item))
    .filter((item, index, all) => all.indexOf(item) === index);
  const comparisonModes = asList(source, ["comparisonModes"])
    .map((item) => parseAdminReportComparisonMode(isRecord(item) ? item.id ?? item.value : item))
    .filter((item, index, all) => all.indexOf(item) === index);

  const meta: AdminReportMetaView = {
    supportedReports: supportedReports.length > 0 ? supportedReports : [...ADMIN_REPORT_TYPES],
    presets: presets.length > 0 ? presets : [...ADMIN_REPORT_DATE_PRESETS],
    comparisonModes:
      comparisonModes.length > 0 ? comparisonModes : [...ADMIN_REPORT_COMPARISON_MODES],
  };
  const timezone = readString(source.timezone);
  if (timezone) meta.timezone = timezone;
  const maxRangeDays = readNumber(source.maxRangeDays);
  if (typeof maxRangeDays === "number") meta.maxRangeDays = maxRangeDays;
  const filterOptions = adaptFilterOptions(source.filterOptions ?? source.filters);
  if (filterOptions) meta.filterOptions = filterOptions;
  if (readBoolean(source.branchesEnabled) !== undefined) {
    meta.branchesEnabled = readBoolean(source.branchesEnabled) === true;
  }
  meta.defaultPreset = parseAdminReportDatePreset(source.defaultPreset ?? "last_30_days");
  const defaultFrom = readString(source.defaultFrom);
  if (defaultFrom) meta.defaultFrom = defaultFrom;
  const defaultTo = readString(source.defaultTo);
  if (defaultTo) meta.defaultTo = defaultTo;
  return meta;
}

export function adaptAdminReportView(
  payload: unknown,
  reportType: AdminReportType,
  fallbackFrom?: string,
  fallbackTo?: string,
): AdminReportView {
  const root = unwrapPayload(payload);
  const source = isRecord(root) ? root : {};

  const metrics = asList(source, ["metrics", "kpis", "summary"])
    .map((item, index) => adaptAdminReportMetric(item, index))
    .filter((item): item is AdminReportMetric => Boolean(item));

  const series = asList(source, ["series", "charts", "trends"])
    .map((item, index) => adaptAdminReportSeries(item, `نمودار ${index + 1}`))
    .filter((item): item is AdminReportSeries => Boolean(item));

  const breakdown = asList(source, ["breakdown", "rows", "table"])
    .map((item, index) => adaptBreakdownRow(item, index))
    .filter((item): item is AdminReportBreakdownRow => Boolean(item));

  const peakHours =
    adaptAdminReportSeries(source.peakHours, "ساعات اوج") ??
    (reportType === "peak" ? adaptAdminReportSeries(source.hours, "ساعات اوج") : null);
  const peakDays =
    adaptAdminReportSeries(source.peakDays, "روزهای اوج") ??
    (reportType === "peak" ? adaptAdminReportSeries(source.days, "روزهای اوج") : null);

  const emptyFlag = readBoolean(source.empty) ?? readBoolean(source.isEmpty);
  const empty =
    emptyFlag === true ||
    (metrics.length === 0 &&
      series.every((item) => item.empty === true) &&
      breakdown.length === 0 &&
      (!peakHours || peakHours.empty === true) &&
      (!peakDays || peakDays.empty === true));

  const view: AdminReportView = {
    reportType: parseAdminReportType(source.reportType ?? source.type ?? reportType),
    range: adaptRange(source.range ?? source.period, fallbackFrom, fallbackTo),
    metrics,
    series,
    breakdown,
    empty,
    allowedActions: adaptAllowedActions(source.allowedActions),
  };

  const timezone = readString(source.timezone) ?? view.range.timezone;
  if (timezone) view.timezone = timezone;
  if (isRecord(source.comparisonRange) || isRecord(source.comparison)) {
    view.comparisonRange = adaptRange(source.comparisonRange ?? source.comparison);
  }
  const lastUpdatedAt = readString(source.lastUpdatedAt ?? source.snapshotAt ?? source.generatedAt);
  if (lastUpdatedAt) view.lastUpdatedAt = lastUpdatedAt;
  const scopeLabel = asSafeText(source.scopeLabel ?? source.branchScopeLabel);
  if (scopeLabel) view.scopeLabel = scopeLabel;
  const currency = readString(source.currency);
  if (currency) view.currency = currency;
  if (peakHours) view.peakHours = peakHours;
  if (peakDays) view.peakDays = peakDays;
  const heatmap = adaptHeatmap(source.heatmap ?? source.peakHeatmap);
  if (heatmap) view.heatmap = heatmap;
  const emptyReason = asSafeText(source.emptyReason ?? source.emptyMessage);
  if (emptyReason) view.emptyReason = emptyReason;
  if (readBoolean(source.rangeInvalid) === true) {
    view.rangeInvalid = true;
    view.rangeInvalidMessage =
      asSafeText(source.rangeInvalidMessage ?? source.message) ??
      "بازه انتخاب‌شده معتبر نیست یا از سقف مجاز بیشتر است.";
  }
  const filterOptions = adaptFilterOptions(source.filterOptions ?? source.filters);
  if (filterOptions) view.filterOptions = filterOptions;
  return view;
}

export function parseAdminReportExportStatus(value: unknown): AdminReportExportStatus {
  const raw = readString(value)?.toLowerCase().replace(/[\s-]+/g, "_");
  if (
    raw === "pending" ||
    raw === "processing" ||
    raw === "ready" ||
    raw === "failed" ||
    raw === "expired"
  ) {
    return raw;
  }
  if (raw === "completed" || raw === "done" || raw === "available") return "ready";
  if (raw === "error") return "failed";
  return "unknown";
}

export function adaptAdminReportExport(payload: unknown, reportType: AdminReportType): AdminReportExportView | null {
  const root = unwrapPayload(payload);
  if (!isRecord(root)) return null;
  const jobId =
    readString(root.jobId) ??
    readString(root.id) ??
    readString(root.exportId) ??
    readString(root.reference);
  if (!jobId || /^\d+$/.test(jobId)) return null;
  const status = parseAdminReportExportStatus(root.status);
  const view: AdminReportExportView = {
    jobId,
    status,
    statusLabel: asSafeText(root.statusLabel) ?? ADMIN_REPORT_EXPORT_STATUS_LABELS[status],
    reportType: parseAdminReportType(root.reportType ?? reportType),
  };
  // Prefer relative or absolute https download URLs — never put auth tokens in app routes.
  const downloadUrl = readString(root.downloadUrl ?? root.url ?? root.fileUrl);
  if (downloadUrl && (downloadUrl.startsWith("https://") || downloadUrl.startsWith("http://") || downloadUrl.startsWith("/"))) {
    view.downloadUrl = downloadUrl;
  }
  const expiresAtLabel = asSafeText(root.expiresAtLabel ?? root.expiresAt);
  if (expiresAtLabel) view.expiresAtLabel = expiresAtLabel;
  const errorMessage = asSafeText(root.errorMessage ?? root.message);
  if (errorMessage && (status === "failed" || status === "expired")) {
    view.errorMessage = errorMessage;
  }
  const progressLabel = asSafeText(root.progressLabel ?? root.progress);
  if (progressLabel) view.progressLabel = progressLabel;
  return view;
}

/** Format metric for StatCard — never replace unavailable with zero. */
export function formatAdminReportMetricValue(metric: AdminReportMetric): {
  value: string;
  trend?: string;
  comparison?: string;
  trendTone?: AdminReportTrendTone;
  unavailable?: boolean;
  errored?: boolean;
} {
  if (metric.state === "error") {
    return { value: "خطا", errored: true };
  }
  if (metric.state === "unavailable" || !metric.valueLabel) {
    return { value: "—", unavailable: true };
  }
  const trendParts = [
    metric.comparison?.absoluteChangeLabel,
    metric.comparison?.percentageChangeLabel,
  ].filter(Boolean);
  return {
    value: metric.valueLabel,
    trend: trendParts.length > 0 ? trendParts.join(" · ") : undefined,
    comparison: metric.comparison?.periodLabel ?? metric.comparison?.valueLabel,
    trendTone: metric.comparison?.tone ?? "neutral",
  };
}
