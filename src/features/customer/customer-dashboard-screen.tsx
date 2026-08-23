"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ApiErrorState,
  PermissionDeniedState,
} from "@/components/feedback/app-states";
import { customerDashboardQueryOptions } from "@/lib/api/customer";
import { fetchPublicBusiness } from "@/lib/api/public";
import { isForbiddenError, toAppApiError } from "@/lib/api/errors";
import { queryKeys } from "@/lib/query/keys";
import { useSession } from "@/features/auth/session-provider";
import { DashboardSkeleton } from "@/features/customer/dashboard-skeleton";
import { DashboardView } from "@/features/customer/dashboard-view";

export function CustomerDashboardScreen() {
  const { status, user } = useSession();
  const userId = user?.id;
  const sessionReady = status === "authenticated" && Boolean(userId);

  const dashboardQuery = useQuery({
    ...customerDashboardQueryOptions(userId ?? "anonymous"),
    enabled: sessionReady,
  });

  const businessQuery = useQuery({
    queryKey: queryKeys.publicBusiness,
    queryFn: ({ signal }) => fetchPublicBusiness(signal),
    staleTime: 60_000,
    retry: 0,
    enabled: sessionReady,
  });

  if (status === "loading" || status === "unauthenticated" || status === "expired" || !sessionReady) {
    return <DashboardSkeleton />;
  }

  if (dashboardQuery.isPending) {
    return <DashboardSkeleton />;
  }

  if (dashboardQuery.isError || !dashboardQuery.data) {
    const error = toAppApiError(dashboardQuery.error);
    if (isForbiddenError(error)) {
      return (
        <PermissionDeniedState description="برای مشاهده داشبورد مشتری مجوز لازم را ندارید." />
      );
    }
    return (
      <ApiErrorState
        title="داشبورد بارگذاری نشد"
        description={error.message}
        requestId={error.requestId}
        onRetry={() => {
          void dashboardQuery.refetch();
        }}
      />
    );
  }

  const view = {
    ...dashboardQuery.data,
    customer: {
      displayName:
        user?.displayName?.trim() || dashboardQuery.data.customer.displayName,
    },
  };
  const bookingEnabled = view.bookingEnabled && (businessQuery.data?.bookingEnabled ?? true);

  return (
    <DashboardView
      view={view}
      bookingEnabled={bookingEnabled}
      phone={businessQuery.data?.phone}
      onRetry={() => {
        void dashboardQuery.refetch();
      }}
    />
  );
}
