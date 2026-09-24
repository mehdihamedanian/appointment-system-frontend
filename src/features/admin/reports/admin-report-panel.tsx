"use client";

import { EmptyState } from "@/components/feedback/app-states";
import { Alert } from "@/components/ui/alert";
import { formatLastUpdatedLabel } from "@/lib/admin/dashboard-format";
import { AdminReportBreakdownTable } from "@/features/admin/reports/admin-report-breakdown-table";
import { AdminReportChart } from "@/features/admin/reports/admin-report-chart";
import { AdminReportHeatmap } from "@/features/admin/reports/admin-report-heatmap";
import { AdminReportMetricGrid } from "@/features/admin/reports/admin-report-metric-grid";
import type { AdminReportView } from "@/types/admin-report";

export function AdminReportPanel({ view }: { view: AdminReportView }) {
  const lastUpdated = formatLastUpdatedLabel(view.lastUpdatedAt, view.timezone);

  if (view.rangeInvalid) {
    return (
      <Alert
        tone="warning"
        title="بازه نامعتبر"
        description={view.rangeInvalidMessage ?? "بازه انتخاب‌شده قابل پردازش نیست."}
      />
    );
  }

  if (view.empty) {
    return (
      <EmptyState
        title="گزارش خالی است"
        description={
          view.emptyReason ??
          "برای این فیلترها داده‌ای از Backend دریافت نشد. بازه یا شعبه دیگری را امتحان کنید."
        }
      />
    );
  }

  return (
    <div className="admin-report-panel">
      <div className="admin-report-panel__context" role="status">
        {view.range.label || (view.range.from && view.range.to) ? (
          <p className="text-caption">
            بازه:{" "}
            <span className="text-numeric">
              {view.range.label ?? `${view.range.from} — ${view.range.to}`}
            </span>
            {view.timezone ? (
              <>
                {" "}
                (<span className="ltr-value">{view.timezone}</span>)
              </>
            ) : null}
          </p>
        ) : null}
        {view.comparisonRange ? (
          <p className="text-caption">
            مقایسه:{" "}
            <span className="text-numeric">
              {view.comparisonRange.label ??
                `${view.comparisonRange.from} — ${view.comparisonRange.to}`}
            </span>
          </p>
        ) : null}
        {view.scopeLabel ? <p className="text-caption">محدوده: {view.scopeLabel}</p> : null}
        {lastUpdated ? (
          <p className="text-caption">
            آخرین به‌روزرسانی: <span className="text-numeric ltr-value">{lastUpdated}</span>
          </p>
        ) : null}
      </div>

      <AdminReportMetricGrid metrics={view.metrics} />

      <div className="admin-report-panel__charts">
        {view.series.map((series) => (
          <AdminReportChart key={series.id} series={series} />
        ))}
        {view.peakHours ? <AdminReportChart series={view.peakHours} /> : null}
        {view.peakDays ? <AdminReportChart series={view.peakDays} /> : null}
        {view.heatmap ? <AdminReportHeatmap heatmap={view.heatmap} /> : null}
      </div>

      <AdminReportBreakdownTable rows={view.breakdown} />
    </div>
  );
}
