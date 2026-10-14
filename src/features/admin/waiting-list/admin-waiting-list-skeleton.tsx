import { Skeleton } from "@/components/feedback/loading-states";

export function AdminWaitingListListSkeleton() {
  return (
    <div className="admin-waiting-list-skeleton" role="status" aria-busy="true" aria-label="در حال بارگذاری لیست انتظار">
      <Skeleton variant="line" />
      <Skeleton variant="card" />
      <Skeleton variant="card" />
    </div>
  );
}

export function AdminWaitingListDetailSkeleton() {
  return (
    <div className="admin-waiting-list-skeleton" role="status" aria-busy="true" aria-label="در حال بارگذاری جزئیات">
      <Skeleton variant="line" />
      <Skeleton variant="card" />
      <Skeleton variant="card" />
    </div>
  );
}

export function AdminWaitingListFormSkeleton() {
  return (
    <div className="admin-waiting-list-skeleton" role="status" aria-busy="true" aria-label="در حال بارگذاری فرم">
      <Skeleton variant="card" />
      <Skeleton variant="card" />
    </div>
  );
}
