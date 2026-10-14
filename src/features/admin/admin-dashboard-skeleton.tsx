import { Skeleton } from "@/components/feedback/loading-states";

export function AdminDashboardSkeleton() {
  return (
    <div
      className="admin-dashboard"
      role="status" aria-busy="true"
      aria-live="polite"
      aria-label="در حال بارگذاری داشبورد مدیریت"
    >
      <div className="admin-dashboard__stats">
        {Array.from({ length: 7 }).map((_, index) => (
          <div key={index} className="ds-card ds-stat">
            <Skeleton variant="line-short" />
            <Skeleton variant="title" />
          </div>
        ))}
      </div>
      <div className="admin-dashboard__secondary">
        <Skeleton variant="card" />
        <Skeleton variant="card" />
      </div>
      <div className="admin-dashboard__analytics">
        <Skeleton variant="card" />
        <Skeleton variant="card" />
      </div>
    </div>
  );
}
