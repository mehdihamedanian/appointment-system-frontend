import { Skeleton } from "@/components/feedback/loading-states";

export function NotificationListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div
      className="notification-list"
      role="status" aria-busy="true"
      aria-label="در حال بارگذاری اعلان‌ها"
    >
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} variant="card" />
      ))}
    </div>
  );
}
