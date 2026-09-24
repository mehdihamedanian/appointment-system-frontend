"use client";

import { StatCard } from "@/components/ui/data-display";
import { Skeleton } from "@/components/feedback/loading-states";
import { formatAdminReportMetricValue } from "@/lib/admin/report-adapter";
import type { AdminReportMetric } from "@/types/admin-report";

export function AdminReportMetricGrid({
  metrics,
  loading,
}: {
  metrics: AdminReportMetric[];
  loading?: boolean;
}) {
  if (!loading && metrics.length === 0) {
    return null;
  }

  return (
    <section className="admin-report-metrics" aria-labelledby="admin-report-metrics-title">
      <h2 id="admin-report-metrics-title" className="visually-hidden">
        شاخص‌های گزارش
      </h2>
      <div className="admin-report-metrics__grid">
        {loading
          ? Array.from({ length: 4 }).map((_, index) => (
              <div key={`loading-${index}`} className="admin-report-metrics__item">
                <Skeleton variant="card" />
              </div>
            ))
          : metrics.map((metric) => {
              const formatted = formatAdminReportMetricValue(metric);
              return (
                <div key={metric.key} className="admin-report-metrics__item">
                  <StatCard
                    label={metric.label}
                    value={formatted.value}
                    trend={formatted.trend}
                    comparison={formatted.comparison}
                    trendTone={formatted.trendTone}
                    loading={loading}
                  />
                  {metric.definition ? (
                    <p className="admin-report-metrics__definition ds-help">{metric.definition}</p>
                  ) : null}
                  {metric.unit ? (
                    <p className="text-caption">
                      واحد: <span className="ltr-value">{metric.unit}</span>
                    </p>
                  ) : null}
                </div>
              );
            })}
      </div>
    </section>
  );
}
