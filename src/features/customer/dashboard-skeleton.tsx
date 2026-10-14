import { Skeleton } from "@/components/feedback/loading-states";

export function DashboardSkeleton() {
  return (
    <div className="customer-dashboard" role="status" aria-busy="true" aria-live="polite" aria-label="در حال بارگذاری داشبورد">
      <Skeleton variant="title" />
      <Skeleton variant="line-short" />
      <div className="dashboard-next-skeleton">
        <Skeleton variant="card" />
      </div>
      <div className="dashboard-upcoming-skeleton">
        <Skeleton variant="line" />
        <Skeleton variant="card" />
        <Skeleton variant="card" />
      </div>
    </div>
  );
}
