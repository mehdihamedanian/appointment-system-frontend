import { Skeleton } from "@/components/feedback/loading-states";

export function AdminNotificationListSkeleton() {
  return (
    <div className="admin-notification-skeleton">
      <Skeleton variant="line" />
      <Skeleton variant="card" />
      <Skeleton variant="card" />
    </div>
  );
}

export function AdminNotificationDetailSkeleton() {
  return (
    <div className="admin-notification-skeleton">
      <Skeleton variant="card" />
      <Skeleton variant="card" />
    </div>
  );
}
