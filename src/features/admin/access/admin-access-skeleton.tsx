"use client";

import { Skeleton } from "@/components/feedback/loading-states";

export function AdminAccessListSkeleton() {
  return (
    <div className="admin-access-skeleton" role="status" aria-busy="true" aria-label="در حال بارگذاری">
      <Skeleton variant="line" />
      <Skeleton variant="card" />
      <Skeleton variant="card" />
    </div>
  );
}

export function AdminAccessDetailSkeleton() {
  return (
    <div className="admin-access-skeleton" role="status" aria-busy="true" aria-label="در حال بارگذاری">
      <Skeleton variant="card" />
      <Skeleton variant="card" />
    </div>
  );
}
