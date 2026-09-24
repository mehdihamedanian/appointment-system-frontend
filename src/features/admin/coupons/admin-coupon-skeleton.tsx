import { Skeleton } from "@/components/feedback/loading-states";

export function AdminCouponListSkeleton() {
  return (
    <div className="admin-coupon-skeleton" aria-busy="true" aria-label="در حال بارگذاری کوپن‌ها">
      <Skeleton variant="line" />
      <Skeleton variant="card" />
      <Skeleton variant="card" />
    </div>
  );
}

export function AdminCouponDetailSkeleton() {
  return (
    <div className="admin-coupon-skeleton" aria-busy="true" aria-label="در حال بارگذاری جزئیات کوپن">
      <Skeleton variant="line" />
      <Skeleton variant="card" />
      <Skeleton variant="card" />
    </div>
  );
}

export function AdminCouponFormSkeleton() {
  return (
    <div className="admin-coupon-skeleton" aria-busy="true" aria-label="در حال بارگذاری فرم کوپن">
      <Skeleton variant="card" />
      <Skeleton variant="card" />
    </div>
  );
}
