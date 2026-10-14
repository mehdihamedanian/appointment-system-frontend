import { formatAppointmentParts, formatIsoDateLabel } from "@/lib/date-time/format";
import type {
  DashboardCountMetric,
  DashboardMoneyMetric,
} from "@/types/admin-dashboard";

export const METRIC_UNAVAILABLE_LABEL = "—";
export const METRIC_ERROR_LABEL = "خطا";

export function formatCountMetricValue(metric: DashboardCountMetric): {
  value: string;
  trend?: string;
  comparison?: string;
  trendTone?: "positive" | "negative" | "neutral";
  unavailable?: boolean;
  errored?: boolean;
} {
  if (metric.state === "error") {
    return { value: METRIC_ERROR_LABEL, errored: true };
  }
  if (metric.state === "unavailable") {
    return { value: METRIC_UNAVAILABLE_LABEL, unavailable: true };
  }
  const numeric = metric.value ?? 0;
  return {
    value: new Intl.NumberFormat("fa-IR").format(numeric),
    trend: metric.trend?.label,
    comparison: metric.trend?.comparison,
    trendTone: metric.trend?.tone,
  };
}

export function formatMoneyMetricValue(metric: DashboardMoneyMetric): {
  value: string;
  trend?: string;
  comparison?: string;
  trendTone?: "positive" | "negative" | "neutral";
  unavailable?: boolean;
  errored?: boolean;
} {
  if (metric.state === "error") {
    return { value: METRIC_ERROR_LABEL, errored: true };
  }
  if (metric.state === "unavailable" || !metric.amountLabel) {
    return { value: METRIC_UNAVAILABLE_LABEL, unavailable: true };
  }
  return {
    value: metric.amountLabel,
    trend: metric.trend?.label,
    comparison: metric.trend?.comparison,
    trendTone: metric.trend?.tone,
  };
}

/** Operational dates are business-local calendar dates; no timezone shift applies. */
export function formatOperationalDateLabel(isoDate: string): string {
  return formatIsoDateLabel(isoDate, { style: "full" }) ?? isoDate;
}

export function formatLastUpdatedLabel(iso: string | undefined, timeZone?: string): string | null {
  return iso ? (formatAppointmentParts(iso, timeZone)?.label ?? null) : null;
}
