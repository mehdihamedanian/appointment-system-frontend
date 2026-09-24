"use client";

import type { CSSProperties } from "react";
import { EmptyState } from "@/components/feedback/app-states";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AdminReportHeatmap } from "@/types/admin-report";

export function AdminReportHeatmap({ heatmap }: { heatmap: AdminReportHeatmap }) {
  const titleId = "admin-report-heatmap-title";
  const summaryId = "admin-report-heatmap-summary";

  if (heatmap.empty || heatmap.cells.length === 0) {
    return (
      <article className="admin-report-heatmap ds-card" aria-labelledby={titleId}>
        <h3 id={titleId} className="text-card-title">
          {heatmap.title}
        </h3>
        <EmptyState title="نقشه حرارتی خالی است" description="داده‌ای برای نمایش اوج زمانی نیست." />
      </article>
    );
  }

  const cellMap = new Map(
    heatmap.cells.map((cell) => [`${cell.rowId}:${cell.columnId}`, cell] as const),
  );
  const summary = heatmap.cells
    .map((cell) => `${cell.rowLabel} / ${cell.columnLabel}: ${cell.valueLabel}`)
    .join("؛ ");

  return (
    <article
      className="admin-report-heatmap ds-card"
      aria-labelledby={titleId}
      aria-describedby={summaryId}
    >
      <h3 id={titleId} className="text-card-title">
        {heatmap.title}
      </h3>
      {heatmap.description ? <p className="ds-help">{heatmap.description}</p> : null}
      <p id={summaryId} className="visually-hidden">
        {summary}
      </p>

      <div
        className="admin-report-heatmap__grid"
        role="grid"
        aria-label={heatmap.title}
        style={
          {
            gridTemplateColumns: `minmax(4rem, 8rem) repeat(${heatmap.columns.length}, minmax(2.5rem, 1fr))`,
          } as CSSProperties
        }
      >
        <div className="admin-report-heatmap__corner" aria-hidden="true" />
        {heatmap.columns.map((column) => (
          <div key={column.id} className="admin-report-heatmap__col-label" role="columnheader">
            {column.label}
          </div>
        ))}
        {heatmap.rows.map((row) => (
          <div key={row.id} className="admin-report-heatmap__row" role="row">
            <div className="admin-report-heatmap__row-label" role="rowheader">
              {row.label}
            </div>
            {heatmap.columns.map((column) => {
              const cell = cellMap.get(`${row.id}:${column.id}`);
              const intensity = cell?.intensityPercent ?? 0;
              return (
                <div
                  key={`${row.id}-${column.id}`}
                  className="admin-report-heatmap__cell"
                  role="gridcell"
                  tabIndex={0}
                  aria-label={`${row.label}، ${column.label}: ${cell?.valueLabel ?? "—"}`}
                  style={
                    {
                      "--admin-report-heat": `${intensity}%`,
                    } as CSSProperties
                  }
                >
                  <span className="admin-report-heatmap__cell-value ltr-value">
                    {cell?.valueLabel ?? "—"}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="admin-report-heatmap__table-wrap">
        <Table caption={`جدول ${heatmap.title}`}>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">ردیف</TableHead>
              <TableHead scope="col">ستون</TableHead>
              <TableHead scope="col">مقدار</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {heatmap.cells.map((cell) => (
              <TableRow key={`${cell.rowId}-${cell.columnId}`}>
                <TableCell>{cell.rowLabel}</TableCell>
                <TableCell>{cell.columnLabel}</TableCell>
                <TableCell className="ltr-value">{cell.valueLabel}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </article>
  );
}
