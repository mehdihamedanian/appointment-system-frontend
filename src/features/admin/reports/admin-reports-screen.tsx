"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, SlidersHorizontal } from "lucide-react";
import { AdminBreadcrumb } from "@/components/layout/admin/admin-breadcrumb";
import { AdminPageHeader } from "@/components/layout/admin/admin-page-header";
import {
  ApiErrorState,
  EmptyState,
  PermissionDeniedState,
} from "@/components/feedback/app-states";
import { Button } from "@/components/ui/button";
import { AdminReportExportPanel } from "@/features/admin/reports/admin-report-export-panel";
import { AdminReportFilters } from "@/features/admin/reports/admin-report-filters";
import { AdminReportNav } from "@/features/admin/reports/admin-report-nav";
import { AdminReportPanel } from "@/features/admin/reports/admin-report-panel";
import { AdminReportSkeleton } from "@/features/admin/reports/admin-report-skeleton";
import { AdminReportsGate } from "@/features/admin/reports/admin-reports-gate";
import { PermissionGate } from "@/features/admin/permission-gate";
import { useSession } from "@/features/auth/session-provider";
import { isAdminMultiBranchEnabled } from "@/lib/admin/branch-context";
import {
  adminReportFiltersApplied,
  adminReportsHref,
  countActiveAdminReportFilters,
  defaultAdminReportFilters,
  parseAdminReportFilters,
  pruneUnsupportedReportFilters,
  reportPermission,
  reportTypePermission,
  validateReportRange,
} from "@/lib/admin/report-filters";
import {
  adminReportMetaQueryOptions,
  adminReportQueryOptions,
} from "@/lib/api/admin-reports";
import { isForbiddenError, isNotFoundError, toAppApiError } from "@/lib/api/errors";
import { hasPermission } from "@/lib/permissions/access";
import { routes } from "@/constants/routes";
import {
  ADMIN_REPORT_TYPES,
  ADMIN_REPORT_TYPE_LABELS,
  type AdminReportListFilters,
} from "@/types/admin-report";
import type { SessionUser } from "@/types/session";

export function AdminReportsScreen() {
  const { status, user } = useSession();
  const searchParams = useSearchParams();
  const filters = parseAdminReportFilters(searchParams);

  if (status === "loading" || !user?.id) {
    return <AdminReportSkeleton />;
  }

  return (
    <PermissionGate permission={reportPermission("view")}>
      <AdminReportsGate>
        <AdminReportsReady user={user} userId={user.id} filters={filters} />
      </AdminReportsGate>
    </PermissionGate>
  );
}

function AdminReportsReady({
  user,
  userId,
  filters,
}: {
  user: SessionUser;
  userId: string;
  filters: AdminReportListFilters;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const metaQuery = useQuery(adminReportMetaQueryOptions(userId));
  const maxRangeDays = metaQuery.data?.maxRangeDays;
  const rangeValidation = validateReportRange(filters, maxRangeDays);

  const reportAllowed =
    hasPermission(user, reportTypePermission(filters.report)) ||
    user.permissionCodes.length === 0;

  const reportQuery = useQuery({
    ...adminReportQueryOptions(userId, filters),
    enabled: Boolean(userId) && reportAllowed && rangeValidation.valid,
  });

  const replaceFilters = useCallback(
    (next: Partial<AdminReportListFilters>) => {
      startTransition(() => {
        const merged = pruneUnsupportedReportFilters({ ...filters, ...next });
        router.replace(adminReportsHref(merged), { scroll: false });
      });
    },
    [filters, router, startTransition],
  );

  const availableReports = useMemo(() => {
    const supported = metaQuery.data?.supportedReports?.length
      ? metaQuery.data.supportedReports
      : [...ADMIN_REPORT_TYPES];
    return supported.filter((report) => {
      if (report === "branches" && metaQuery.data?.branchesEnabled === false) {
        return false;
      }
      return (
        hasPermission(user, reportTypePermission(report)) || user.permissionCodes.length === 0
      );
    });
  }, [metaQuery.data, user]);

  const showBranchFilter = useMemo(() => {
    if (metaQuery.data?.branchesEnabled === false) return false;
    if (metaQuery.data?.branchesEnabled === true) return true;
    return isAdminMultiBranchEnabled({ branchesEnabled: true }) ||
      (metaQuery.data?.filterOptions?.branches?.length ?? 0) > 1 ||
      (reportQuery.data?.filterOptions?.branches?.length ?? 0) > 1;
  }, [metaQuery.data, reportQuery.data]);

  const filterOptions = reportQuery.data?.filterOptions ?? metaQuery.data?.filterOptions;
  const activeCount = countActiveAdminReportFilters(filters);
  const error = reportQuery.isError ? toAppApiError(reportQuery.error) : undefined;

  function clearFilters() {
    replaceFilters({
      ...defaultAdminReportFilters(),
      report: filters.report,
    });
  }

  if (!reportAllowed) {
    return (
      <>
        <ReportsHeader />
        <AdminReportNav filters={filters} availableReports={availableReports} />
        <PermissionDeniedState
          title="دسترسی مجاز نیست"
          description={`مجوز مشاهده گزارش «${ADMIN_REPORT_TYPE_LABELS[filters.report]}» را ندارید.`}
        />
      </>
    );
  }

  return (
    <>
      <ReportsHeader
        secondaryActions={
          <>
            <AdminReportExportPanel
              user={user}
              userId={userId}
              filters={filters}
              exportAllowed={reportQuery.data?.allowedActions.export}
              blockedReason={reportQuery.data?.allowedActions.blockedReason}
            />
            <Button
              variant="secondary"
              leadingIcon={<RefreshCw size={16} aria-hidden="true" />}
              loading={reportQuery.isFetching && !reportQuery.isPending}
              onClick={() => void reportQuery.refetch()}
            >
              به‌روزرسانی
            </Button>
          </>
        }
      />

      <AdminReportNav filters={filters} availableReports={availableReports} />

      <div className="admin-report-toolbar">
        <p className="text-caption admin-report-toolbar__title">
          {ADMIN_REPORT_TYPE_LABELS[filters.report]}
          {adminReportFiltersApplied(filters) ? " · فیلتر فعال" : ""}
        </p>
        <Button
          variant="secondary"
          leadingIcon={<SlidersHorizontal size={16} aria-hidden="true" />}
          onClick={() => setMobileFiltersOpen(true)}
          className="admin-report-toolbar__mobile-filters"
        >
          فیلترها{activeCount > 0 ? ` (${activeCount})` : ""}
        </Button>
      </div>

      <AdminReportFilters
        filters={filters}
        options={filterOptions}
        showBranchFilter={showBranchFilter}
        mobileOpen={mobileFiltersOpen}
        onMobileOpenChange={setMobileFiltersOpen}
        onChange={replaceFilters}
        onClear={clearFilters}
      />

      {!rangeValidation.valid ? (
        <AlertRange message={rangeValidation.message} />
      ) : null}

      {rangeValidation.valid && reportQuery.isPending ? <AdminReportSkeleton /> : null}

      {error ? (
        isForbiddenError(error) || isNotFoundError(error) ? (
          <PermissionDeniedState title="دسترسی مجاز نیست" description={error.message} />
        ) : (
          <ApiErrorState
            title="بارگذاری گزارش ناموفق"
            description={error.message}
            onRetry={() => void reportQuery.refetch()}
          />
        )
      ) : null}

      {rangeValidation.valid && !reportQuery.isPending && !error && reportQuery.data ? (
        <AdminReportPanel view={reportQuery.data} />
      ) : null}

      {rangeValidation.valid &&
      !reportQuery.isPending &&
      !error &&
      !reportQuery.data ? (
        <EmptyState
          title="گزارشی در دسترس نیست"
          description="Backend هنوز داده این گزارش را ارسال نکرده است."
        />
      ) : null}
    </>
  );
}

function ReportsHeader({ secondaryActions }: { secondaryActions?: React.ReactNode }) {
  return (
    <AdminPageHeader
      title="گزارش‌ها"
      description="تحلیل تاریخی درآمد، نوبت‌ها و عملکرد — جدا از خلاصه عملیاتی داشبورد."
      breadcrumb={
        <AdminBreadcrumb
          pathname={routes.admin.reports}
          items={[
            { href: routes.admin.home, label: "پنل مدیریت" },
            { label: "گزارش‌ها" },
          ]}
        />
      }
      secondaryActions={secondaryActions}
    />
  );
}

function AlertRange({ message }: { message?: string }) {
  return (
    <div className="admin-report-range-alert" role="alert">
      <EmptyState
        title="بازه نامعتبر"
        description={message ?? "بازه انتخاب‌شده معتبر نیست."}
      />
    </div>
  );
}
