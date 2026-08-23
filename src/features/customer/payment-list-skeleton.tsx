import { Skeleton } from "@/components/feedback/loading-states";

export function PaymentListSkeleton() {
  return (
    <div className="payment-list" aria-busy="true" aria-label="در حال بارگذاری پرداخت‌ها">
      <Skeleton variant="card" />
      <Skeleton variant="card" />
      <Skeleton variant="card" />
    </div>
  );
}
