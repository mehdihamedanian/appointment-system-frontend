import { Skeleton } from "@/components/feedback/loading-states";

export function AdminAppointmentListSkeleton() {
  return (
    <div className="admin-appointment-list-skeleton" aria-busy="true" aria-label="در حال بارگذاری نوبت‌ها">
      <Skeleton variant="line" />
      <Skeleton variant="card" />
      <Skeleton variant="card" />
      <Skeleton variant="card" />
    </div>
  );
}

export function AdminAppointmentDetailSkeleton() {
  return (
    <div className="admin-appointment-detail-skeleton" aria-busy="true" aria-label="در حال بارگذاری جزئیات نوبت">
      <Skeleton variant="title" />
      <Skeleton variant="card" />
      <Skeleton variant="card" />
      <Skeleton variant="card" />
    </div>
  );
}
