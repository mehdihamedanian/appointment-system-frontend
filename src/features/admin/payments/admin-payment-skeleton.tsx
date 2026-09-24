import { Skeleton } from "@/components/feedback/loading-states";

export function AdminPaymentListSkeleton() {
  return (
    <div className="admin-payment-skeleton" aria-hidden="true">
      <Skeleton variant="line" />
      <Skeleton variant="card" />
      <Skeleton variant="card" />
    </div>
  );
}
