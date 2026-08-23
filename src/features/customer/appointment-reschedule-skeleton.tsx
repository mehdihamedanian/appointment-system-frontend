import { Skeleton } from "@/components/feedback/loading-states";

export function AppointmentRescheduleSkeleton() {
  return (
    <div className="appointment-reschedule" aria-busy="true" aria-label="در حال بارگذاری زمان‌بندی مجدد">
      <Skeleton variant="line" />
      <Skeleton variant="card" />
      <Skeleton variant="card" />
      <Skeleton variant="card" />
    </div>
  );
}
