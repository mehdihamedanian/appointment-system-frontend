"use client";

import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/feedback/app-states";
import { StatCard } from "@/components/ui/data-display";
import { WidgetError } from "@/features/customer/widget-error";
import { formatCountMetricValue } from "@/lib/admin/dashboard-format";
import type {
  AdminDashboardAnalytics,
  DashboardAlert,
  PeakHourItem,
  PopularServiceItem,
  UtilizationItem,
} from "@/types/admin-dashboard";
import type { WidgetResult } from "@/types/customer";

function BarList({
  items,
  ariaLabel,
}: {
  items: Array<{ id: string; label: string; valueLabel?: string; barPercent?: number }>;
  ariaLabel: string;
}) {
  return (
    <ul className="admin-bar-list" role="list" aria-label={ariaLabel}>
      {items.map((item) => (
        <li key={item.id} className="admin-bar-list__item">
          <div className="admin-bar-list__label">
            <span>{item.label}</span>
            {item.valueLabel ? (
              <span className="text-caption ltr-value">{item.valueLabel}</span>
            ) : null}
          </div>
          {typeof item.barPercent === "number" ? (
            <div
              className="admin-bar-list__track"
              role="img"
              aria-label={`${item.label}: ${item.valueLabel ?? item.barPercent}`}
            >
              <span
                className="admin-bar-list__fill"
                style={{ width: `${item.barPercent}%` }}
              />
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function PopularServicesWidget({
  widget,
  onRetry,
}: {
  widget: WidgetResult<PopularServiceItem[]>;
  onRetry: () => void;
}) {
  if (widget.status === "error") {
    return (
      <WidgetError
        title="خدمات پرطرفدار دریافت نشد"
        requestId={widget.error.requestId}
        onRetry={onRetry}
      />
    );
  }
  if (widget.data.length === 0) {
    return (
      <EmptyState
        title="داده‌ای برای خدمات پرطرفدار نیست"
        description="بازه یا شعبه دیگری را امتحان کنید."
      />
    );
  }
  return (
    <BarList
      ariaLabel="خدمات پرطرفدار"
      items={widget.data.map((item, index) => ({
        id: item.id ?? `service-${index}`,
        label: item.name,
        valueLabel: item.countLabel ?? item.shareLabel,
      }))}
    />
  );
}

function UtilizationWidget({
  title,
  widget,
  onRetry,
}: {
  title: string;
  widget: WidgetResult<UtilizationItem[]>;
  onRetry: () => void;
}) {
  if (widget.status === "error") {
    return (
      <WidgetError
        title={`${title} دریافت نشد`}
        requestId={widget.error.requestId}
        onRetry={onRetry}
      />
    );
  }
  if (widget.data.length === 0) {
    return (
      <EmptyState
        title={`${title} موجود نیست`}
        description="برای این بازه داده‌ای از Backend دریافت نشد."
      />
    );
  }
  return (
    <BarList
      ariaLabel={title}
      items={widget.data.map((item) => ({
        id: item.id,
        label: item.name,
        valueLabel: item.utilizationLabel,
        barPercent: item.barPercent,
      }))}
    />
  );
}

function PeakHoursWidget({
  widget,
  onRetry,
}: {
  widget: WidgetResult<PeakHourItem[]>;
  onRetry: () => void;
}) {
  if (widget.status === "error") {
    return (
      <WidgetError
        title="ساعات شلوغ دریافت نشد"
        requestId={widget.error.requestId}
        onRetry={onRetry}
      />
    );
  }
  if (widget.data.length === 0) {
    return (
      <EmptyState
        title="داده‌ای برای ساعات شلوغ نیست"
        description="بازه تحلیلی دیگری را انتخاب کنید."
      />
    );
  }

  const summary = widget.data
    .map((item) => `${item.hourLabel}${item.countLabel ? `: ${item.countLabel}` : ""}`)
    .join("؛ ");

  return (
    <>
      <p className="visually-hidden" id="peak-hours-summary">
        {summary}
      </p>
      <BarList
        ariaLabel="ساعات شلوغ"
        items={widget.data.map((item, index) => ({
          id: `peak-${index}`,
          label: item.hourLabel,
          valueLabel: item.countLabel,
          barPercent: item.barPercent,
        }))}
      />
    </>
  );
}

export function AdminDashboardAlerts({ alerts }: { alerts: DashboardAlert[] }) {
  if (alerts.length === 0) {
    return null;
  }
  return (
    <section className="admin-dashboard__alerts" aria-labelledby="admin-alerts-title">
      <h2 id="admin-alerts-title" className="text-card-title">
        هشدارهای عملیاتی
      </h2>
      <ul className="admin-dashboard__alerts-list">
        {alerts.map((alert) => (
          <li key={alert.id}>
            <Alert
              tone={alert.tone === "danger" ? "error" : alert.tone === "information" ? "info" : alert.tone}
              title={alert.title}
              description={alert.description}
              action={
                alert.href ? (
                  <Link href={alert.href} className="ds-link">
                    مشاهده
                  </Link>
                ) : undefined
              }
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function AdminAnalyticalSection({
  analytics,
  onRetryWidget,
}: {
  analytics: AdminDashboardAnalytics;
  onRetryWidget: () => void;
}) {
  const hasAny =
    analytics.newCustomers ||
    analytics.popularServices ||
    analytics.staffUtilization ||
    analytics.resourceUtilization ||
    analytics.peakHours;

  if (!hasAny) {
    return (
      <section className="admin-dashboard__analytics" aria-labelledby="admin-analytics-title">
        <h2 id="admin-analytics-title" className="text-card-title">
          تحلیل عملیاتی
        </h2>
        <EmptyState
          title="تحلیل در دسترس نیست"
          description="Backend هنوز شاخص‌های تحلیلی این بازه را ارسال نکرده است."
        />
      </section>
    );
  }

  const newCustomers = analytics.newCustomers
    ? formatCountMetricValue(analytics.newCustomers)
    : null;

  return (
    <section className="admin-dashboard__analytics" aria-labelledby="admin-analytics-title">
      <h2 id="admin-analytics-title" className="text-card-title">
        تحلیل عملیاتی
      </h2>
      <div className="admin-dashboard__analytics-grid">
        {analytics.newCustomers ? (
          <article className="admin-analytics-widget ds-card">
            <h3 className="text-card-title">مشتریان جدید</h3>
            <StatCard
              label="در بازه انتخاب‌شده"
              value={newCustomers?.value ?? "—"}
              trend={newCustomers?.trend}
              comparison={newCustomers?.comparison}
              trendTone={newCustomers?.trendTone}
            />
          </article>
        ) : null}

        {analytics.popularServices ? (
          <article className="admin-analytics-widget ds-card">
            <h3 className="text-card-title">خدمات پرطرفدار</h3>
            <PopularServicesWidget widget={analytics.popularServices} onRetry={onRetryWidget} />
          </article>
        ) : null}

        {analytics.staffUtilization ? (
          <article className="admin-analytics-widget ds-card">
            <h3 className="text-card-title">بهره‌وری پرسنل</h3>
            <UtilizationWidget
              title="بهره‌وری پرسنل"
              widget={analytics.staffUtilization}
              onRetry={onRetryWidget}
            />
          </article>
        ) : null}

        {analytics.resourceUtilization ? (
          <article className="admin-analytics-widget ds-card">
            <h3 className="text-card-title">بهره‌وری منابع</h3>
            <UtilizationWidget
              title="بهره‌وری منابع"
              widget={analytics.resourceUtilization}
              onRetry={onRetryWidget}
            />
          </article>
        ) : null}

        {analytics.peakHours ? (
          <article className="admin-analytics-widget ds-card" aria-describedby="peak-hours-summary">
            <h3 className="text-card-title">ساعات شلوغ</h3>
            <PeakHoursWidget widget={analytics.peakHours} onRetry={onRetryWidget} />
          </article>
        ) : null}
      </div>
    </section>
  );
}
