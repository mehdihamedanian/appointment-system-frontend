import { Skeleton } from "@/components/feedback/loading-states";

export function AppointmentListSkeleton() {
  return (
    <div className="appointment-list" role="status" aria-busy="true" aria-label="در حال بارگذاری نوبت‌ها">
      <Skeleton variant="card" />
      <Skeleton variant="card" />
      <Skeleton variant="card" />
    </div>
  );
}
