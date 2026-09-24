"use client";

import Link from "next/link";
import { adminReportsHref } from "@/lib/admin/report-filters";
import { cx } from "@/lib/utilities/cx";
import {
  ADMIN_REPORT_TYPE_LABELS,
  type AdminReportListFilters,
  type AdminReportType,
} from "@/types/admin-report";

export function AdminReportNav({
  filters,
  availableReports,
}: {
  filters: AdminReportListFilters;
  availableReports: AdminReportType[];
}) {
  return (
    <nav className="admin-report-nav" aria-label="انواع گزارش">
      {availableReports.map((report) => {
        const active = filters.report === report;
        const href = adminReportsHref({
          ...filters,
          report,
        });
        return (
          <Link
            key={report}
            href={href}
            className={cx("admin-report-nav__link", active && "is-active")}
            aria-current={active ? "page" : undefined}
          >
            {ADMIN_REPORT_TYPE_LABELS[report]}
          </Link>
        );
      })}
    </nav>
  );
}
