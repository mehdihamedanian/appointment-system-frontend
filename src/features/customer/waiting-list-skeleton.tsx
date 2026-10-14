import { Skeleton } from "@/components/feedback/loading-states";

export function WaitingListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="waiting-list" role="status" aria-busy="true" aria-label="در حال بارگذاری لیست انتظار">
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} variant="card" />
      ))}
    </div>
  );
}
