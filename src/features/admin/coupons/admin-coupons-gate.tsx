"use client";

import { useQuery } from "@tanstack/react-query";
import { FeatureDisabledState } from "@/components/feedback/app-states";
import { Skeleton } from "@/components/feedback/loading-states";
import { fetchPublicBusiness } from "@/lib/api/public";
import { isAdminCouponsEnabled } from "@/lib/admin/coupon-context";
import { queryKeys } from "@/lib/query/keys";
import { ADMIN_COUPON_MANAGEMENT_ENABLED } from "@/types/admin-coupon";

export function AdminCouponsGate({ children }: { children: React.ReactNode }) {
  const businessQuery = useQuery({
    queryKey: queryKeys.publicBusiness,
    queryFn: ({ signal }) => fetchPublicBusiness(signal),
    staleTime: 60_000,
  });

  if (!ADMIN_COUPON_MANAGEMENT_ENABLED) {
    return (
      <FeatureDisabledState
        title="کوپن‌ها"
        description="ماژول مدیریت کوپن در این نسخه فعال نیست."
      />
    );
  }

  if (businessQuery.isLoading) {
    return <Skeleton variant="card" />;
  }

  if (!isAdminCouponsEnabled(businessQuery.data)) {
    return (
      <FeatureDisabledState
        title="کوپن‌ها غیرفعال است"
        description="این قابلیت برای کسب‌وکار شما فعال نیست. پس از فعال‌سازی توسط Backend، مدیریت کوپن در دسترس خواهد بود."
      />
    );
  }

  return <>{children}</>;
}
