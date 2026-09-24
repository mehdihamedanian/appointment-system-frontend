"use client";

import { EmptyState } from "@/components/feedback/app-states";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AdminReportSeries } from "@/types/admin-report";

/**
 * Accessible chart: CSS bars + mandatory data table.
 * No third-party chart library — keeps Design Tokens and reduced-motion friendly.
 */
export function AdminReportChart({ series }: { series: AdminReportSeries }) {
  const titleId = `report-chart-${series.id}-title`;
  const descId = `report-chart-${series.id}-desc`;
  const summaryId = `report-chart-${series.id}-summary`;

  if (series.empty || series.points.length === 0) {
    return (
      <article className="admin-report-chart ds-card" aria-labelledby={titleId}>
        <h3 id={titleId} className="text-card-title">
          {series.title}
        </h3>
        <EmptyState
          title="داده‌ای برای نمودار نیست"
          description="برای این بازه سری زمانی از Backend دریافت نشد."
        />
      </article>
    );
  }

  const summary = series.points
    .map((point) => `${point.label}${point.valueLabel ? `: ${point.valueLabel}` : ""}`)
    .join("؛ ");

  return (
    <article
      className="admin-report-chart ds-card"
      aria-labelledby={titleId}
      aria-describedby={`${descId} ${summaryId}`}
    >
      <h3 id={titleId} className="text-card-title">
        {series.title}
      </h3>
      {series.description ? (
        <p id={descId} className="ds-help">
          {series.description}
        </p>
      ) : (
        <p id={descId} className="visually-hidden">
          نمودار میله‌ای با جدول داده‌های معادل
        </p>
      )}
      <p id={summaryId} className="visually-hidden">
        {summary}
      </p>

      <ul className="admin-report-chart__bars" role="list" aria-label={series.title}>
        {series.points.map((point) => (
          <li key={point.id} className="admin-report-chart__bar-item">
            <div className="admin-report-chart__bar-label">
              <span>{point.label}</span>
              {point.valueLabel ? (
                <span className="text-caption ltr-value">{point.valueLabel}</span>
              ) : null}
            </div>
            {typeof point.barPercent === "number" ? (
              <div
                className="admin-report-chart__track"
                role="img"
                aria-label={`${point.label}: ${point.valueLabel ?? point.barPercent}`}
              >
                <span
                  className="admin-report-chart__fill"
                  style={{ width: `${point.barPercent}%` }}
                />
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      <div className="admin-report-chart__table-wrap">
        <Table caption={`جدول داده‌های ${series.title}`}>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">بازه</TableHead>
              <TableHead scope="col">مقدار{series.unit ? ` (${series.unit})` : ""}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {series.points.map((point) => (
              <TableRow key={point.id}>
                <TableCell>{point.label}</TableCell>
                <TableCell className="ltr-value">{point.valueLabel ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </article>
  );
}
