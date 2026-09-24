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

export function formatOperationalDateLabel(isoDate: string, timeZone?: string): string {
  const date = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }
  try {
    return new Intl.DateTimeFormat("fa-IR", {
      calendar: "gregory",
      timeZone: timeZone || undefined,
      dateStyle: "full",
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat("fa-IR", {
      calendar: "gregory",
      dateStyle: "full",
    }).format(date);
  }
}

export function formatLastUpdatedLabel(iso: string | undefined, timeZone?: string): string | null {
  if (!iso) {
    return null;
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  try {
    return new Intl.DateTimeFormat("fa-IR", {
      calendar: "gregory",
      timeZone: timeZone || undefined,
      dateStyle: "medium",
      timeStyle: "short",
      hourCycle: "h23",
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat("fa-IR", {
      dateStyle: "medium",
      timeStyle: "short",
      hourCycle: "h23",
    }).format(date);
  }
}
