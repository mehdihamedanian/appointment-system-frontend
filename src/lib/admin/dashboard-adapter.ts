import { formatCurrencyAmount } from "@/lib/date-time/format";
import { parseStatusKey, type StatusKey } from "@/lib/status/status-map";
import type { AppApiError } from "@/types/api";
import type { WidgetResult } from "@/types/customer";
import type {
  AdminDashboardAnalytics,
  AdminDashboardOperational,
  AdminDashboardView,
  AdminRecentAppointment,
  DashboardAlert,
  DashboardCountMetric,
  DashboardMoneyMetric,
  DashboardTrend,
  PeakHourItem,
  PopularServiceItem,
  UtilizationItem,
} from "@/types/admin-dashboard";
import {
  asList,
  asSafeText,
  readBoolean,
  readNumber,
  unwrapPayload,
} from "@/lib/public/read";
import { isSafePublicId } from "@/lib/public/booking-href";
import { isRecord, readString } from "@/lib/utilities/records";

export const RECENT_APPOINTMENTS_LIMIT = 10;

const UNAVAILABLE_COUNT: DashboardCountMetric = { state: "unavailable" };
const UNAVAILABLE_MONEY: DashboardMoneyMetric = { state: "unavailable" };

function widgetError(value: unknown): AppApiError | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
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

function readTrend(value: unknown): DashboardTrend | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const label = asSafeText(value.label) ?? asSafeText(value.trendLabel) ?? asSafeText(value.changeLabel);
  if (!label) {
    return undefined;
  }
  const rawTone = (readString(value.tone) ?? readString(value.direction) ?? "neutral").toLowerCase();
  const tone =
    rawTone === "positive" || rawTone === "up" || rawTone === "increase"
      ? "positive"
      : rawTone === "negative" || rawTone === "down" || rawTone === "decrease"
        ? "negative"
        : "neutral";
  const comparison =
    asSafeText(value.comparison) ??
    asSafeText(value.comparisonLabel) ??
    asSafeText(value.periodLabel);
  return comparison ? { label, tone, comparison } : { label, tone };
}

function adaptCountMetric(value: unknown): DashboardCountMetric {
  if (value == null) {
    return UNAVAILABLE_COUNT;
  }
  const error = widgetError(value);
  if (error) {
    return { state: "error", error };
  }
  if (!isRecord(value)) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return { state: "ready", value: Math.trunc(value) };
    }
    return UNAVAILABLE_COUNT;
  }
  if (readBoolean(value.unavailable) === true || readString(value.state) === "unavailable") {
    return UNAVAILABLE_COUNT;
  }
  const count =
    readNumber(value.value) ??
    readNumber(value.count) ??
    readNumber(value.total);
  if (typeof count === "number" && Number.isFinite(count)) {
    return {
      state: "ready",
      value: Math.trunc(count),
      trend: readTrend(value.trend ?? value.comparison),
    };
  }
  return UNAVAILABLE_COUNT;
}

function adaptMoneyMetric(value: unknown): DashboardMoneyMetric {
  if (value == null) {
    return UNAVAILABLE_MONEY;
  }
  const error = widgetError(value);
  if (error) {
    return { state: "error", error };
  }
  if (!isRecord(value)) {
    return UNAVAILABLE_MONEY;
  }
  if (readBoolean(value.unavailable) === true || readString(value.state) === "unavailable") {
    return UNAVAILABLE_MONEY;
  }
  const amountLabel =
    readString(value.amountLabel) ??
    readString(value.formattedAmount) ??
    readString(value.label) ??
    (typeof readNumber(value.amount) === "number"
      ? formatCurrencyAmount(readNumber(value.amount) as number, readString(value.currency))
      : undefined);
  if (amountLabel) {
    return {
      state: "ready",
      amountLabel,
      trend: readTrend(value.trend ?? value.comparison),
    };
  }
  return UNAVAILABLE_MONEY;
}

function readStatus(value: unknown): StatusKey | undefined {
  return parseStatusKey(value);
}

function readAppointmentId(source: Record<string, unknown>): string | undefined {
  const id =
    readString(source.booking_reference) ??
    readString(source.id) ??
    readString(source.appointmentId) ??
    readString(source.reference);
  return isSafePublicId(id) ? id : undefined;
}

function firstStaffName(value: unknown): string | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const first: unknown = value[0];
  return isRecord(first) ? readString(first.display_name) : undefined;
}

function readAdminDeepLink(value: unknown): string | undefined {
  const href = readString(value);
  if (!href || !href.startsWith("/admin")) {
    return undefined;
  }
  return href;
}

function adaptRecentAppointment(value: unknown): AdminRecentAppointment | null {
  if (!isRecord(value)) {
    return null;
  }
  const id = readAppointmentId(value);
  const serviceName =
    readString(value.serviceName) ??
    (isRecord(value.service)
      ? readString(value.service.name) ?? readString(value.service.title)
      : undefined);
  const startsAt =
    readString(value.startsAt) ??
    readString(value.starts_at) ??
    readString(value.startAt) ??
    readString(value.scheduledAt);
  const rawStatus = value.status ?? value.appointmentStatus;
  const status =
    readStatus(rawStatus) ??
    (readString(rawStatus) ? ("unknown" as StatusKey) : undefined);
  const customerName =
    asSafeText(value.customerName) ??
    (isRecord(value.customer)
      ? asSafeText(value.customer.displayName) ??
        asSafeText(value.customer.display_name) ??
        asSafeText(value.customer.name) ??
        asSafeText(value.customer.maskedName)
      : undefined);
  if (!id || !serviceName || !startsAt || !status || !customerName) {
    return null;
  }

  const providerName =
    readString(value.providerName) ??
    (isRecord(value.provider)
      ? readString(value.provider.publicName) ?? readString(value.provider.name)
      : undefined) ??
    (isRecord(value.staff) ? readString(value.staff.publicName) ?? readString(value.staff.name) : undefined) ??
    firstStaffName(value.staff);

  const resourceName =
    readString(value.resourceName) ??
    (isRecord(value.resource) ? readString(value.resource.name) : undefined);

  return {
    id,
    serviceName,
    customerName,
    providerName,
    resourceName,
    branchName:
      readString(value.branchName) ??
      (isRecord(value.branch) ? readString(value.branch.name) : undefined),
    startsAt,
    timezone: readString(value.timezone) ?? readString(value.timeZone),
    status,
    paymentStatus: readStatus(value.paymentStatus ?? value.payment_status),
    reference:
      readString(value.reference) ??
      readString(value.bookingReference) ??
      readString(value.booking_reference),
  };
}

function adaptRecentAppointments(value: unknown): WidgetResult<AdminRecentAppointment[]> {
  const error = widgetError(value);
  if (error) {
    return { status: "error", error };
  }
  const items = asList(value, ["items", "appointments", "recent", "results"])
    .map(adaptRecentAppointment)
    .filter((item): item is AdminRecentAppointment => Boolean(item))
    .slice(0, RECENT_APPOINTMENTS_LIMIT);
  return { status: "ready", data: items };
}

function adaptPopularServices(value: unknown): WidgetResult<PopularServiceItem[]> {
  const error = widgetError(value);
  if (error) {
    return { status: "error", error };
  }
  const items = asList(value, ["items", "services", "results"])
    .map((item) => {
      if (!isRecord(item)) {
        return null;
      }
      const name = asSafeText(item.name) ?? asSafeText(item.serviceName);
      if (!name) {
        return null;
      }
      return {
        id: readString(item.id) ?? readString(item.serviceId),
        name,
        countLabel:
          readString(item.countLabel) ??
          readString(item.appointmentCountLabel) ??
          (typeof readNumber(item.count) === "number"
            ? String(readNumber(item.count))
            : undefined),
        shareLabel: readString(item.shareLabel) ?? readString(item.percentageLabel),
      } as PopularServiceItem;
    })
    .filter((item): item is PopularServiceItem => Boolean(item));
  return { status: "ready", data: items };
}

function adaptUtilization(value: unknown): WidgetResult<UtilizationItem[]> {
  const error = widgetError(value);
  if (error) {
    return { status: "error", error };
  }
  const items = asList(value, ["items", "staff", "resources", "results"])
    .map((item) => {
      if (!isRecord(item)) {
        return null;
      }
      const id = readString(item.id) ?? readString(item.staffId) ?? readString(item.resourceId);
      const name =
        asSafeText(item.name) ??
        asSafeText(item.staffName) ??
        asSafeText(item.resourceName);
      const utilizationLabel =
        readString(item.utilizationLabel) ??
        readString(item.label) ??
        readString(item.formattedUtilization);
      if (!id || !name || !utilizationLabel) {
        return null;
      }
      const barPercent = readNumber(item.barPercent) ?? readNumber(item.utilizationPercent);
      return {
        id,
        name,
        utilizationLabel,
        barPercent:
          typeof barPercent === "number" && barPercent >= 0 && barPercent <= 100
            ? barPercent
            : undefined,
      } as UtilizationItem;
    })
    .filter((item): item is UtilizationItem => Boolean(item));
  return { status: "ready", data: items };
}

function adaptPeakHours(value: unknown): WidgetResult<PeakHourItem[]> {
  const error = widgetError(value);
  if (error) {
    return { status: "error", error };
  }
  const items = asList(value, ["items", "hours", "buckets", "results"])
    .map((item) => {
      if (!isRecord(item)) {
        return null;
      }
      const hourLabel =
        readString(item.hourLabel) ??
        readString(item.label) ??
        readString(item.hour);
      if (!hourLabel) {
        return null;
      }
      const barPercent = readNumber(item.barPercent) ?? readNumber(item.intensityPercent);
      return {
        hourLabel,
        countLabel: readString(item.countLabel) ?? readString(item.appointmentCountLabel),
        barPercent:
          typeof barPercent === "number" && barPercent >= 0 && barPercent <= 100
            ? barPercent
            : undefined,
      } as PeakHourItem;
    })
    .filter((item): item is PeakHourItem => Boolean(item));
  return { status: "ready", data: items };
}

function adaptAlerts(value: unknown): DashboardAlert[] {
  return asList(value, ["items", "alerts", "warnings", "results"])
    .map((item) => {
      if (!isRecord(item)) {
        return null;
      }
      const id = readString(item.id) ?? readString(item.alertId);
      const title = asSafeText(item.title) ?? asSafeText(item.label);
      if (!id || !title) {
        return null;
      }
      const rawTone = (readString(item.tone) ?? readString(item.severity) ?? "information").toLowerCase();
      const tone =
        rawTone === "danger" || rawTone === "error" || rawTone === "critical"
          ? "danger"
          : rawTone === "warning"
            ? "warning"
            : "information";
      const alert: DashboardAlert = {
        id,
        title,
        tone,
      };
      const description = asSafeText(item.description) ?? asSafeText(item.message);
      if (description) {
        alert.description = description;
      }
      const href = readAdminDeepLink(item.href) ?? readAdminDeepLink(item.link);
      if (href) {
        alert.href = href;
      }
      return alert;
    })
    .filter((item): item is DashboardAlert => Boolean(item));
}

function readOperationalMetrics(source: Record<string, unknown>): AdminDashboardOperational {
  const metrics = isRecord(source.operational)
    ? source.operational
    : isRecord(source.metrics)
      ? source.metrics
      : isRecord(source.stats)
        ? source.stats
        : source;

  return {
    todayAppointments: adaptCountMetric(
      metrics.todayAppointments ?? metrics.today ?? metrics.todaysAppointments,
    ),
    upcoming: adaptCountMetric(metrics.upcoming ?? metrics.upcomingAppointments),
    needingAction: adaptCountMetric(
      metrics.needingAction ?? metrics.actionRequired ?? metrics.needsAction,
    ),
    completed: adaptCountMetric(metrics.completed ?? metrics.completedToday),
    cancelled: adaptCountMetric(metrics.cancelled ?? metrics.cancelledToday),
    noShow: adaptCountMetric(metrics.noShow ?? metrics.noShows ?? metrics.no_show),
    todayRevenue: adaptMoneyMetric(metrics.todayRevenue ?? metrics.revenue ?? metrics.revenueToday),
  };
}

function readAnalytics(source: Record<string, unknown>): AdminDashboardAnalytics {
  const analytics = isRecord(source.analytics) ? source.analytics : source;
  const popularRaw = analytics.popularServices ?? analytics.topServices;
  const staffRaw = analytics.staffUtilization ?? analytics.staff;
  const resourceRaw = analytics.resourceUtilization ?? analytics.resources;
  const peakRaw = analytics.peakHours ?? analytics.busyHours;

  const analyticsView: AdminDashboardAnalytics = {};

  const newCustomers = analytics.newCustomers ?? analytics.newCustomerCount;
  if (newCustomers !== undefined) {
    analyticsView.newCustomers = adaptCountMetric(newCustomers);
  }

  if (popularRaw !== undefined) {
    analyticsView.popularServices = adaptPopularServices(popularRaw);
  }
  if (staffRaw !== undefined) {
    analyticsView.staffUtilization = adaptUtilization(staffRaw);
  }
  if (resourceRaw !== undefined) {
    analyticsView.resourceUtilization = adaptUtilization(resourceRaw);
  }
  if (peakRaw !== undefined) {
    analyticsView.peakHours = adaptPeakHours(peakRaw);
  }

  return analyticsView;
}

export function adaptAdminDashboard(
  payload: unknown,
  fallbackDate: string,
): AdminDashboardView {
  const root = unwrapPayload(payload);
  const source = isRecord(root) ? root : {};

  const operationalDate =
    readString(source.operationalDate) ??
    readString(source.date) ??
    readString(source.today) ??
    fallbackDate;

  return {
    timezone: readString(source.timezone) ?? readString(source.timeZone),
    operationalDate,
    serverNow: readString(source.serverNow) ?? readString(source.now),
    lastUpdatedAt:
      readString(source.lastUpdatedAt) ??
      readString(source.updatedAt) ??
      readString(source.generatedAt),
    branchId: readString(source.branchId),
    operational: readOperationalMetrics(source),
    recentAppointments: adaptRecentAppointments(
      source.recentAppointments ?? source.recent ?? source.appointments,
    ),
    alerts: adaptAlerts(source.alerts ?? source.warnings ?? source.operationalAlerts),
    analytics: readAnalytics(source),
    manualBookingEnabled: readBoolean(source.manualBookingEnabled) === true,
  };
}

export type DashboardSectionResult =
  | { ok: true; payload: unknown }
  | { ok: false; error: AppApiError };

export type DashboardSummarySources = {
  day: unknown;
  analytics: DashboardSectionResult;
  recent: DashboardSectionResult;
};

function summaryCount(value: unknown): DashboardCountMetric {
  const count = readNumber(value);
  return typeof count === "number" ? { state: "ready", value: Math.trunc(count) } : UNAVAILABLE_COUNT;
}

function summaryCountSum(...values: unknown[]): DashboardCountMetric {
  let total = 0;
  for (const value of values) {
    const count = readNumber(value);
    if (typeof count !== "number") {
      return UNAVAILABLE_COUNT;
    }
    total += Math.trunc(count);
  }
  return { state: "ready", value: total };
}

function formatDecimalMoney(amount: number, currency?: string): string | undefined {
  if (Number.isInteger(amount)) {
    return formatCurrencyAmount(amount, currency);
  }
  try {
    return new Intl.NumberFormat("fa-IR", {
      style: currency ? "currency" : "decimal",
      currency: currency || "IRR",
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return String(amount);
  }
}

function summaryRevenue(value: unknown): DashboardMoneyMetric {
  if (!isRecord(value)) {
    return UNAVAILABLE_MONEY;
  }
  const amount = readNumber(value.net_revenue);
  const amountLabel =
    typeof amount === "number" ? formatDecimalMoney(amount, readString(value.currency)) : undefined;
  return amountLabel ? { state: "ready", amountLabel } : UNAVAILABLE_MONEY;
}

function summaryPopularServices(value: unknown): WidgetResult<PopularServiceItem[]> {
  const items = asList(value, [])
    .map((item): PopularServiceItem | null => {
      if (!isRecord(item)) {
        return null;
      }
      const name = asSafeText(item.title);
      if (!name) {
        return null;
      }
      const count = readNumber(item.completed_appointment_count);
      const share = readNumber(item.share_percentage);
      return {
        id: readString(item.service_id),
        name,
        countLabel: typeof count === "number" ? String(count) : undefined,
        shareLabel: typeof share === "number" ? `${share}%` : undefined,
      };
    })
    .filter((item): item is PopularServiceItem => Boolean(item));
  return { status: "ready", data: items };
}

function summaryAnalytics(result: DashboardSectionResult): AdminDashboardAnalytics {
  if (!result.ok) {
    return {
      newCustomers: { state: "error", error: result.error },
      popularServices: { status: "error", error: result.error },
    };
  }
  const root = unwrapPayload(result.payload);
  const source = isRecord(root) ? root : {};
  const customerTypes = isRecord(source.customer_types) ? source.customer_types : {};
  return {
    newCustomers: summaryCount(customerTypes.new_customers),
    popularServices: summaryPopularServices(source.popular_services),
  };
}

/**
 * Adapts `GET /admin/dashboard/summary` (operational day + analytics range) and
 * `GET /admin/appointments` (recent appointments of the operational day).
 */
export function adaptDashboardSummary(
  sources: DashboardSummarySources,
  fallbackDate: string,
): AdminDashboardView {
  const root = unwrapPayload(sources.day);
  const source = isRecord(root) ? root : {};
  const period = isRecord(source.period) ? source.period : {};
  const filters = isRecord(source.filters) ? source.filters : {};
  const appointments = isRecord(source.appointments) ? source.appointments : {};
  const counts = isRecord(appointments.status_counts) ? appointments.status_counts : {};

  return {
    timezone: readString(period.timezone),
    operationalDate: readString(period.start_date) ?? fallbackDate,
    lastUpdatedAt: readString(source.generated_at),
    branchId: readString(filters.branch_id),
    operational: {
      todayAppointments: summaryCount(appointments.total_count),
      upcoming: summaryCountSum(counts.pending, counts.confirmed),
      needingAction: summaryCount(counts.pending),
      completed: summaryCount(counts.completed),
      cancelled: summaryCount(counts.cancelled),
      noShow: summaryCount(counts.no_show),
      todayRevenue: summaryRevenue(source.revenue),
    },
    recentAppointments: sources.recent.ok
      ? adaptRecentAppointments(unwrapPayload(sources.recent.payload))
      : { status: "error", error: sources.recent.error },
    alerts: [],
    analytics: summaryAnalytics(sources.analytics),
    manualBookingEnabled: false,
  };
}

export function hasEmptyOperationalDay(view: AdminDashboardView): boolean {
  const { operational, recentAppointments } = view;
  const countsReady =
    operational.todayAppointments.state === "ready" &&
    operational.upcoming.state === "ready" &&
    operational.completed.state === "ready";
  if (!countsReady) {
    return false;
  }
  const allZero =
    (operational.todayAppointments.value ?? 0) === 0 &&
    (operational.upcoming.value ?? 0) === 0 &&
    (operational.completed.value ?? 0) === 0;
  const recentEmpty =
    recentAppointments.status === "ready" && recentAppointments.data.length === 0;
  return allZero && recentEmpty;
}
