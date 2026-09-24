"use client";

import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WidgetError } from "@/features/customer/widget-error";
import { hasEmptyOperationalDay } from "@/lib/admin/dashboard-adapter";
import {
  formatLastUpdatedLabel,
  formatOperationalDateLabel,
} from "@/lib/admin/dashboard-format";
import { isManualBookingRouteEnabled } from "@/lib/admin/dashboard-filters";
import { hasPermission } from "@/lib/permissions/access";
import { routes } from "@/constants/routes";
import {
  AdminAnalyticalSection,
  AdminDashboardAlerts,
} from "@/features/admin/admin-analytical-section";
import {
  AdminEmptyOperationalDay,
  AdminOperationalStats,
} from "@/features/admin/admin-operational-stats";
import { AdminRecentAppointments } from "@/features/admin/admin-recent-appointments";
import type { AdminDashboardView } from "@/types/admin-dashboard";
import type { SessionUser } from "@/types/session";
import type { PublicBranch } from "@/types/public";

export function AdminDashboardView({
  view,
  user,
  branches,
  showBranchFilter,
  showResourceUtilization,
  refreshing,
  onRefresh,
  onRetryWidget,
}: {
  view: AdminDashboardView;
  user: SessionUser;
  branches: PublicBranch[];
  showBranchFilter: boolean;
  showResourceUtilization: boolean;
  refreshing?: boolean;
  onRefresh: () => void;
  onRetryWidget: () => void;
}) {
  const timezone = view.timezone;
  const todayLabel = formatOperationalDateLabel(view.operationalDate, timezone);
  const lastUpdated = formatLastUpdatedLabel(view.lastUpdatedAt, timezone);
  const emptyDay = hasEmptyOperationalDay(view);
  const showQuickAdd =
    isManualBookingRouteEnabled() && view.manualBookingEnabled && hasPermission(user, "admin.appointments.view");

  const recent = view.recentAppointments;
  const recentItems = recent.status === "ready" ? recent.data : [];
  const showBranchColumn =
    showBranchFilter || branches.length > 1 || recentItems.some((item) => Boolean(item.branchName));
  const showResourceColumn =
    showResourceUtilization && recentItems.some((item) => Boolean(item.resourceName));

  const analytics = showResourceUtilization
    ? view.analytics
    : {
        ...view.analytics,
        resourceUtilization: undefined,
      };

  return (
    <div className="admin-dashboard">
      <div className="admin-dashboard__context" role="status">
        <p className="text-caption">
          امروز: <span className="text-numeric">{todayLabel}</span>
          {timezone ? (
            <>
              {" "}
              (<span className="ltr-value">{timezone}</span>)
            </>
          ) : null}
        </p>
        {lastUpdated ? (
          <p className="text-caption">
            آخرین به‌روزرسانی: <span className="text-numeric ltr-value">{lastUpdated}</span>
          </p>
        ) : null}
        <Button
          variant="secondary"
          size="sm"
          loading={refreshing}
          leadingIcon={<RefreshCw size={16} aria-hidden="true" />}
          onClick={onRefresh}
        >
          به‌روزرسانی
        </Button>
      </div>

      {showQuickAdd ? (
        <div className="admin-dashboard__quick-add">
          <Button asChild>
            <Link href={routes.admin.manualBooking}>ثبت نوبت جدید</Link>
          </Button>
        </div>
      ) : null}

      <AdminOperationalStats operational={view.operational} />
      {emptyDay ? <AdminEmptyOperationalDay /> : null}

      <AdminDashboardAlerts alerts={view.alerts} />

      <section className="admin-dashboard__secondary" aria-labelledby="admin-recent-title">
        <div className="dashboard-widget-head">
          <h2 id="admin-recent-title" className="text-card-title">
            نوبت‌های اخیر
          </h2>
          <Link href={routes.admin.appointments}>مشاهده همه</Link>
        </div>
        {recent.status === "error" ? (
          <WidgetError
            title="نوبت‌های اخیر دریافت نشد"
            requestId={recent.error.requestId}
            onRetry={onRetryWidget}
          />
        ) : (
          <AdminRecentAppointments
            items={recentItems}
            showBranch={showBranchColumn}
            showResources={showResourceColumn}
          />
        )}
      </section>

      <AdminAnalyticalSection analytics={analytics} onRetryWidget={onRetryWidget} />
    </div>
  );
}
