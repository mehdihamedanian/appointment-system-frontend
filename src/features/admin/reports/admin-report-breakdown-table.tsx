"use client";

import Link from "next/link";
import { EmptyState } from "@/components/feedback/app-states";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AdminReportBreakdownRow } from "@/types/admin-report";

export function AdminReportBreakdownTable({
  rows,
  title = "جزئیات",
}: {
  rows: AdminReportBreakdownRow[];
  title?: string;
}) {
  if (rows.length === 0) {
    return null;
  }

  const metricKeys = Array.from(
    new Map(
      rows.flatMap((row) => row.metrics.map((metric) => [metric.key, metric.label] as const)),
    ).entries(),
  );

  return (
    <section className="admin-report-breakdown" aria-labelledby="admin-report-breakdown-title">
      <h2 id="admin-report-breakdown-title" className="text-card-title">
        {title}
      </h2>

      <div className="admin-report-list-desktop admin-report-table-wrap">
        <Table caption={title}>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">مورد</TableHead>
              {metricKeys.map(([key, label]) => (
                <TableHead key={key} scope="col">
                  {label}
                </TableHead>
              ))}
              <TableHead scope="col">عملیات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const byKey = new Map(row.metrics.map((metric) => [metric.key, metric.valueLabel]));
              return (
                <TableRow key={row.id}>
                  <TableCell>
                    <div className="admin-report-breakdown__label">
                      <strong>{row.label}</strong>
                      {row.secondaryLabel ? (
                        <span className="text-caption ltr-value">{row.secondaryLabel}</span>
                      ) : null}
                    </div>
                  </TableCell>
                  {metricKeys.map(([key]) => (
                    <TableCell key={key} className="ltr-value">
                      {byKey.get(key) ?? "—"}
                    </TableCell>
                  ))}
                  <TableCell>
                    {row.href ? (
                      <Button asChild size="sm" variant="secondary">
                        <Link href={row.href}>جزئیات</Link>
                      </Button>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <ul className="admin-report-list-mobile admin-report-cards">
        {rows.map((row) => (
          <li key={row.id} className="admin-report-card">
            <div className="admin-report-card__head">
              <strong>{row.label}</strong>
              {row.secondaryLabel ? (
                <span className="text-caption ltr-value">{row.secondaryLabel}</span>
              ) : null}
            </div>
            <dl className="admin-report-card__meta">
              {row.metrics.map((metric) => (
                <div key={metric.key}>
                  <dt>{metric.label}</dt>
                  <dd className="ltr-value">{metric.valueLabel}</dd>
                </div>
              ))}
            </dl>
            {row.href ? (
              <Button asChild size="sm" variant="secondary">
                <Link href={row.href}>جزئیات</Link>
              </Button>
            ) : null}
          </li>
        ))}
      </ul>

      {rows.length === 0 ? (
        <EmptyState title="ردیفی برای نمایش نیست" description="جزئیات این گزارش خالی است." />
      ) : null}
    </section>
  );
}
