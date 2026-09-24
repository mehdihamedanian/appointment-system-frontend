"use client";

import { useQuery } from "@tanstack/react-query";
import { FeatureDisabledState } from "@/components/feedback/app-states";
import { Skeleton } from "@/components/feedback/loading-states";
import { fetchPublicBusiness } from "@/lib/api/public";
import { isAdminWaitingListEnabled } from "@/lib/admin/waiting-list-context";
import { queryKeys } from "@/lib/query/keys";
import { ADMIN_WAITING_LIST_MANAGEMENT_ENABLED } from "@/types/admin-waiting-list";

export function AdminWaitingListGate({ children }: { children: React.ReactNode }) {
  const businessQuery = useQuery({
    queryKey: queryKeys.publicBusiness,
    queryFn: ({ signal }) => fetchPublicBusiness(signal),
    staleTime: 60_000,
  });

  if (!ADMIN_WAITING_LIST_MANAGEMENT_ENABLED) {
    return (
      <FeatureDisabledState
        title="لیست انتظار"
        description="ماژول مدیریت لیست انتظار در این نسخه فعال نیست."
      />
    );
  }

  if (businessQuery.isLoading) {
    return <Skeleton variant="card" />;
  }

  if (!isAdminWaitingListEnabled(businessQuery.data)) {
    return (
      <FeatureDisabledState
        title="لیست انتظار غیرفعال است"
        description="این قابلیت برای کسب‌وکار شما فعال نیست. پس از فعال‌سازی توسط Backend، مدیریت لیست انتظار در دسترس خواهد بود."
      />
    );
  }

  return <>{children}</>;
}
