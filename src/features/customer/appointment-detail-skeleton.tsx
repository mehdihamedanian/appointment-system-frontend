import { Skeleton } from "@/components/feedback/loading-states";

export function AppointmentDetailSkeleton() {
  return (
    <div className="appointment-detail" role="status" aria-busy="true" aria-label="در حال بارگذاری جزئیات نوبت">
      <Skeleton variant="line" />
      <div className="appointment-detail__layout">
        <div className="appointment-detail__main">
          <Skeleton variant="card" />
          <Skeleton variant="card" />
          <Skeleton variant="card" />
        </div>
        <aside className="appointment-detail__aside">
          <Skeleton variant="card" />
          <Skeleton variant="card" />
        </aside>
      </div>
    </div>
  );
}
