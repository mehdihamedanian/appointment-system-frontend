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
import { routes } from "@/constants/routes";
import { AdminDashboardSkeleton } from "@/features/admin/admin-dashboard-skeleton";
import { AdminDashboardToolbar } from "@/features/admin/admin-dashboard-toolbar";
import { AdminDashboardView } from "@/features/admin/admin-dashboard-view";
import { PermissionGate } from "@/features/admin/permission-gate";
import { useSession } from "@/features/auth/session-provider";
import { adminDashboardQueryOptions, fetchBusinessTimezone } from "@/lib/api/admin-dashboard";
import {
  isForbiddenError,
  isNotFoundError,
  isSessionExpiredError,
  toAppApiError,
} from "@/lib/api/errors";
import { parseAdminDashboardFilters } from "@/lib/admin/dashboard-filters";
import { hasPermission } from "@/lib/permissions/access";
import { queryKeys } from "@/lib/query/keys";

export function AdminDashboardScreen() {
  const { status, user } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const userId = user?.id;
  const sessionReady = status === "authenticated" && Boolean(userId);

  // Roles without settings access fall back to the browser timezone for the default day.
  const timezoneQuery = useQuery({
    queryKey: queryKeys.admin.businessTimezone(userId ?? "anonymous"),
    queryFn: ({ signal }) => fetchBusinessTimezone(signal),
    staleTime: 60_000,
    retry: 0,
    enabled: sessionReady,
  });

  const timezone = timezoneQuery.data;
  const filters = useMemo(
    () => parseAdminDashboardFilters(searchParams, timezone),
    [searchParams, timezone],
  );

  const dashboardQuery = useQuery({
    ...adminDashboardQueryOptions(userId ?? "anonymous", filters, timezone),
    enabled: sessionReady && !timezoneQuery.isPending,
  });

  // The Backend exposes no branch listing endpoint, so the branch filter stays hidden.
  const showBranchFilter = false;

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
              branches={[]}
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
          if (error.code === "BUSINESS_SETTINGS_NOT_INITIALIZED") {
            return (
              <ApiErrorState
                title="تنظیمات کسب‌وکار مقداردهی نشده است"
                description="پیش از مشاهده داشبورد، تنظیمات کسب‌وکار باید با فرایند راه‌اندازی Backend مقداردهی شود."
                requestId={error.requestId}
                onRetry={() => {
                  void dashboardQuery.refetch();
                }}
              />
            );
          }
          if (isNotFoundError(error)) {
            return (
              <ApiErrorState
                title="داشبورد مدیریت در دسترس نیست"
                description="Backend مسیر خلاصه داشبورد را پیدا نکرد. جزئیات قرارداد در BACKEND_DEPENDENCIES.md ثبت شده است."
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
          branches={[]}
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
