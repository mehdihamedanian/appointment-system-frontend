"use client";

import { useQuery } from "@tanstack/react-query";
import { FeatureDisabledState } from "@/components/feedback/app-states";
import { Skeleton } from "@/components/feedback/loading-states";
import { fetchPublicBusiness } from "@/lib/api/public";
import { isAdminMultiBranchEnabled } from "@/lib/admin/branch-context";
import { queryKeys } from "@/lib/query/keys";
import { ADMIN_BRANCH_MANAGEMENT_ENABLED } from "@/types/admin-branch";

export function AdminBranchesGate({ children }: { children: React.ReactNode }) {
  const businessQuery = useQuery({
    queryKey: queryKeys.publicBusiness,
    queryFn: ({ signal }) => fetchPublicBusiness(signal),
    staleTime: 60_000,
  });

  if (!ADMIN_BRANCH_MANAGEMENT_ENABLED) {
    return (
      <FeatureDisabledState
        title="مدیریت شعب"
        description="ماژول مدیریت شعب در این نسخه فعال نیست."
      />
    );
  }

  if (businessQuery.isLoading) {
    return <Skeleton variant="card" />;
  }

  if (!isAdminMultiBranchEnabled(businessQuery.data)) {
    return (
      <FeatureDisabledState
        title="تک‌شعبه"
        description="این کسب‌وکار در حالت تک‌شعبه است. مدیریت چند شعبه زمانی نمایش داده می‌شود که Backend قابلیت چندشعبه‌ای را فعال کند."
      />
    );
  }

  return <>{children}</>;
}
