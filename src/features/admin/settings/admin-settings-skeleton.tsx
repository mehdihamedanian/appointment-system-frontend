"use client";

import { Skeleton } from "@/components/feedback/loading-states";

export function AdminSettingsSkeleton() {
  return (
    <div className="admin-settings-skeleton" role="status" aria-busy="true" aria-label="در حال بارگذاری تنظیمات">
      <Skeleton variant="card" />
      <Skeleton variant="card" />
    </div>
  );
}

export function AdminSettingsSectionSkeleton() {
  return (
    <div
      className="admin-settings-section-skeleton"
      role="status" aria-busy="true"
      aria-label="در حال بارگذاری بخش تنظیمات"
    >
      <Skeleton variant="card" />
      <Skeleton variant="card" />
      <Skeleton variant="card" />
    </div>
  );
}
