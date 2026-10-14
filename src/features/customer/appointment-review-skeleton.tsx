import { Skeleton } from "@/components/feedback/loading-states";

export function AppointmentReviewSkeleton() {
  return (
    <div className="appointment-review" role="status" aria-busy="true" aria-label="در حال بارگذاری فرم نظر">
      <Skeleton variant="line" />
      <Skeleton variant="card" />
      <Skeleton variant="card" />
      <Skeleton variant="card" />
    </div>
  );
}
