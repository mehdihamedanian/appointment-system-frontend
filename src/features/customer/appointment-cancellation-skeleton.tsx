import { Skeleton } from "@/components/feedback/loading-states";

export function AppointmentCancellationSkeleton() {
  return (
    <div className="appointment-cancel" role="status" aria-busy="true" aria-label="در حال بارگذاری پیش‌نمایش لغو">
      <Skeleton variant="line" />
      <Skeleton variant="card" />
      <Skeleton variant="card" />
      <Skeleton variant="card" />
    </div>
  );
}
