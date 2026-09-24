"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AdminBreadcrumb } from "@/components/layout/admin/admin-breadcrumb";
import { AdminPageHeader } from "@/components/layout/admin/admin-page-header";
import {
  ApiErrorState,
  PermissionDeniedState,
} from "@/components/feedback/app-states";
import { isCapabilityVisible } from "@/config/capabilities";
import { getBusinessCapabilities } from "@/config/capabilities";
import { routes } from "@/constants/routes";
import { AdminDashboardSkeleton } from "@/features/admin/admin-dashboard-skeleton";
import { AdminDashboardToolbar } from "@/features/admin/admin-dashboard-toolbar";
import { AdminDashboardView } from "@/features/admin/admin-dashboard-view";
import { PermissionGate } from "@/features/admin/permission-gate";
import { useSession } from "@/features/auth/session-provider";
import { adminDashboardQueryOptions } from "@/lib/api/admin-dashboard";
import {
  isForbiddenError,
  isNotFoundError,
  isSessionExpiredError,
  toAppApiError,
} from "@/lib/api/errors";
import { fetchPublicBranches, fetchPublicBusiness } from "@/lib/api/public";
import { parseAdminDashboardFilters } from "@/lib/admin/dashboard-filters";
import { hasPermission } from "@/lib/permissions/access";
import { queryKeys } from "@/lib/query/keys";

export function AdminDashboardScreen() {
  const { status, user } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const userId = user?.id;
  const sessionReady = status === "authenticated" && Boolean(userId);

  const businessQuery = useQuery({
    queryKey: queryKeys.publicBusiness,
    queryFn: ({ signal }) => fetchPublicBusiness(signal),
    staleTime: 60_000,
    retry: 0,
    enabled: sessionReady,
  });

  const timezone = businessQuery.data?.timezone;
  const filters = useMemo(
    () => parseAdminDashboardFilters(searchParams, timezone),
    [searchParams, timezone],
  );

  const dashboardQuery = useQuery({
    ...adminDashboardQueryOptions(userId ?? "anonymous", filters, timezone),
    enabled: sessionReady,
  });

  const capabilities = getBusinessCapabilities();
  const multipleBranchesVisible = isCapabilityVisible(capabilities, "multipleBranches");
  const branchesEnabled = businessQuery.data?.branchesEnabled === true;
  const showBranchFilter = multipleBranchesVisible && branchesEnabled;

  const branchesQuery = useQuery({
    queryKey: queryKeys.publicBranches,
    queryFn: ({ signal }) => fetchPublicBranches(signal),
    staleTime: 60_000,
    retry: 0,
    enabled: sessionReady && showBranchFilter,
  });

  const showResourceUtilization = hasPermission(user, "admin.resources.view");

  if (status === "expired") {
    return (
      <ApiErrorState
        title="نشست منقضی شده"
        description="برای مشاهده داشبورد دوباره وارد شوید."
        onRetry={() => {
          router.push(routes.auth.sessionExpired);
        }}
      />
    );
  }

  if (status === "loading" || !sessionReady) {
    return (
      <>
        <AdminPageHeader
          title="نمای کلی"
          description="شاخص‌های عملیاتی امروز و وضعیت نوبت‌ها."
          breadcrumb={
            <AdminBreadcrumb
              pathname={routes.admin.home}
              items={[
                { href: routes.admin.home, label: "پنل مدیریت" },
                { label: "نمای کلی" },
              ]}
            />
          }
        />
        <AdminDashboardSkeleton />
      </>
    );
  }

  return (
    <PermissionGate permission="admin.dashboard.view">
      <AdminPageHeader
        title="نمای کلی"
        description="شاخص‌های عملیاتی امروز و وضعیت نوبت‌ها."
        breadcrumb={
          <AdminBreadcrumb
            pathname={routes.admin.home}
            items={[
              { href: routes.admin.home, label: "پنل مدیریت" },
              { label: "نمای کلی" },
            ]}
          />
        }
        toolbar={
          showBranchFilter || dashboardQuery.data ? (
            <AdminDashboardToolbar
              filters={filters}
              branches={branchesQuery.data ?? []}
              showBranchFilter={showBranchFilter}
              analyticsRangeSupported
            />
          ) : null
        }
      />

      {dashboardQuery.isPending ? <AdminDashboardSkeleton /> : null}

      {dashboardQuery.isError || (!dashboardQuery.isPending && !dashboardQuery.data) ? (
        (() => {
          const error = toAppApiError(dashboardQuery.error);
          if (isForbiddenError(error)) {
            return (
              <PermissionDeniedState description="مجوز لازم برای مشاهده داشبورد را ندارید." />
            );
          }
          if (isSessionExpiredError(error)) {
            return (
              <ApiErrorState
                title="نشست منقضی شده"
                description={error.message}
                onRetry={() => {
                  router.push(routes.auth.sessionExpired);
                }}
              />
            );
          }
          if (isNotFoundError(error)) {
            return (
              <ApiErrorState
                title="داشبورد مدیریت در دسترس نیست"
                description="Backend هنوز endpoint داشبورد مدیریت را ارائه نکرده است. جزئیات قرارداد در BACKEND_DEPENDENCIES.md ثبت شده است."
                requestId={error.requestId}
                onRetry={() => {
                  void dashboardQuery.refetch();
                }}
              />
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
        })()
      ) : null}

      {dashboardQuery.data && user ? (
        <AdminDashboardView
          view={dashboardQuery.data}
          user={user}
          branches={branchesQuery.data ?? []}
          showBranchFilter={showBranchFilter}
          showResourceUtilization={showResourceUtilization}
          refreshing={dashboardQuery.isFetching && !dashboardQuery.isPending}
          onRefresh={() => {
            void dashboardQuery.refetch();
          }}
          onRetryWidget={() => {
            void dashboardQuery.refetch();
          }}
        />
      ) : null}
    </PermissionGate>
  );
}
