"use client";

import { Skeleton } from "@/components/feedback/loading-states";

export function AdminActivityLogListSkeleton() {
  return (
    <div
      className="admin-activity-log-skeleton"
      aria-busy="true"
      aria-label="در حال بارگذاری گزارش فعالیت"
    >
      <Skeleton variant="card" />
      <Skeleton variant="card" />
      <Skeleton variant="card" />
    </div>
  );
}

export function AdminActivityLogDetailSkeleton() {
  return (
    <div
      className="admin-activity-log-detail-skeleton"
      aria-busy="true"
      aria-label="در حال بارگذاری جزئیات رویداد"
    >
      <Skeleton variant="card" />
      <Skeleton variant="card" />
    </div>
  );
}
