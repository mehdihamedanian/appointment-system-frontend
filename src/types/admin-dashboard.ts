import type { StatusKey } from "@/lib/status/status-map";
import type { AppApiError } from "@/types/api";
import type { WidgetResult } from "@/types/customer";

export type DashboardMetricState = "ready" | "unavailable" | "error";

export type DashboardTrend = {
  label: string;
  tone: "positive" | "negative" | "neutral";
  comparison?: string;
};

export type DashboardCountMetric = {
  state: DashboardMetricState;
  value?: number;
  error?: AppApiError;
  trend?: DashboardTrend;
};

export type DashboardMoneyMetric = {
  state: DashboardMetricState;
  amountLabel?: string;
  error?: AppApiError;
  trend?: DashboardTrend;
};

export type AdminRecentAppointment = {
  id: string;
  startsAt: string;
  timezone?: string;
  customerName: string;
  serviceName: string;
  providerName?: string;
  resourceName?: string;
  branchName?: string;
  status: StatusKey;
  paymentStatus?: StatusKey;
  reference?: string;
};

export type PopularServiceItem = {
  id?: string;
  name: string;
  countLabel?: string;
  shareLabel?: string;
};

export type UtilizationItem = {
  id: string;
  name: string;
  utilizationLabel: string;
  barPercent?: number;
};

export type PeakHourItem = {
  hourLabel: string;
  countLabel?: string;
  barPercent?: number;
};

export type DashboardAlert = {
  id: string;
  tone: "warning" | "danger" | "information";
  title: string;
  description?: string;
  href?: string;
};

export type AdminDashboardAnalytics = {
  newCustomers?: DashboardCountMetric;
  popularServices?: WidgetResult<PopularServiceItem[]>;
  staffUtilization?: WidgetResult<UtilizationItem[]>;
  resourceUtilization?: WidgetResult<UtilizationItem[]>;
  peakHours?: WidgetResult<PeakHourItem[]>;
};

export type AdminDashboardOperational = {
  todayAppointments: DashboardCountMetric;
  upcoming: DashboardCountMetric;
  needingAction: DashboardCountMetric;
  completed: DashboardCountMetric;
  cancelled: DashboardCountMetric;
  noShow: DashboardCountMetric;
  todayRevenue: DashboardMoneyMetric;
};

export type AdminDashboardView = {
  timezone?: string;
  operationalDate: string;
  serverNow?: string;
  lastUpdatedAt?: string;
  branchId?: string;
  operational: AdminDashboardOperational;
  recentAppointments: WidgetResult<AdminRecentAppointment[]>;
  alerts: DashboardAlert[];
  analytics: AdminDashboardAnalytics;
  manualBookingEnabled: boolean;
};

export type AdminDashboardFilters = {
  date: string;
  analyticsFrom?: string;
  analyticsTo?: string;
  branchId?: string;
};
