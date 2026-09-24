"use client";

import { Skeleton } from "@/components/feedback/loading-states";

export function AdminReportSkeleton() {
  return (
    <div className="admin-report-skeleton" aria-busy="true" aria-label="در حال بارگذاری گزارش">
      <div className="admin-report-skeleton__metrics">
        <Skeleton variant="card" />
        <Skeleton variant="card" />
        <Skeleton variant="card" />
        <Skeleton variant="card" />
      </div>
      <Skeleton variant="card" />
      <Skeleton variant="card" />
    </div>
  );
}

export function AdminReportSectionSkeleton() {
  return (
    <div className="admin-report-skeleton__section" aria-busy="true" aria-label="در حال بارگذاری">
      <Skeleton variant="card" />
    </div>
  );
}
