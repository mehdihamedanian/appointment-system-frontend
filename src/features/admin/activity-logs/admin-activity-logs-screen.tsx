"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Download, RefreshCw, SlidersHorizontal } from "lucide-react";
import { AdminBreadcrumb } from "@/components/layout/admin/admin-breadcrumb";
import { AdminPageHeader } from "@/components/layout/admin/admin-page-header";
import {
  ApiErrorState,
  EmptyState,
  NoResultsState,
  PermissionDeniedState,
} from "@/components/feedback/app-states";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { useToast } from "@/components/feedback/toast";
import { AdminActivityLogFilters } from "@/features/admin/activity-logs/admin-activity-log-filters";
import { AdminActivityLogListTable } from "@/features/admin/activity-logs/admin-activity-log-list-table";
import { AdminActivityLogsGate } from "@/features/admin/activity-logs/admin-activity-logs-gate";
import { AdminActivityLogListSkeleton } from "@/features/admin/activity-logs/admin-activity-log-skeleton";
import { PermissionGate } from "@/features/admin/permission-gate";
import { useSession } from "@/features/auth/session-provider";
import {
  adminActivityLogFiltersApplied,
  adminActivityLogsHref,
  activityLogPermission,
  countActiveAdminActivityLogFilters,
  defaultAdminActivityLogFilters,
  parseAdminActivityLogFilters,
  sanitizeActivityLogSearch,
} from "@/lib/admin/activity-log-filters";
import {
  adminActivityLogListQueryOptions,
  createAdminActivityLogExport,
  fetchAdminActivityLogExport,
} from "@/lib/api/admin-activity-logs";
import { isForbiddenError, isNotFoundError, toAppApiError } from "@/lib/api/errors";
import { createIdempotencyKey } from "@/lib/booking/idempotency";
import { hasPermission } from "@/lib/permissions/access";
import { routes } from "@/constants/routes";
import type { AdminActivityLogListFilters } from "@/types/admin-activity-log";

const SEARCH_DEBOUNCE_MS = 300;

export function AdminActivityLogsScreen() {
  const { status, user } = useSession();
  const searchParams = useSearchParams();
  const filters = parseAdminActivityLogFilters(searchParams);

  if (status === "loading" || !user?.id) {
    return <AdminActivityLogListSkeleton />;
  }

  return (
    <PermissionGate permission={activityLogPermission("view")}>
      <AdminActivityLogsGate>
        <AdminActivityLogsReady userId={user.id} user={user} filters={filters} />
      </AdminActivityLogsGate>
    </PermissionGate>
  );
}

function AdminActivityLogsReady({
  userId,
  user,
  filters,
}: {
  userId: string;
  user: NonNullable<ReturnType<typeof useSession>["user"]>;
  filters: AdminActivityLogListFilters;
}) {
  const router = useRouter();
  const toast = useToast();
  const [, startTransition] = useTransition();
  const [draftQuery, setDraftQuery] = useState(filters.q ?? "");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);

  const query = useQuery(adminActivityLogListQueryOptions(userId, filters));

  const replaceFilters = useCallback(
    (next: Partial<AdminActivityLogListFilters>) => {
      startTransition(() => {
        router.replace(adminActivityLogsHref({ ...filters, ...next, page: next.page ?? 1 }), {
          scroll: false,
        });
      });
    },
    [filters, router, startTransition],
  );

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const next = sanitizeActivityLogSearch(draftQuery);
      if ((next ?? "") === (filters.q ?? "")) return;
      replaceFilters({ q: next, page: 1 });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [draftQuery, filters.q, replaceFilters]);

  const activeCount = countActiveAdminActivityLogFilters(filters);
  const error = query.isError ? toAppApiError(query.error) : undefined;
  const items = query.data?.items ?? [];
  const showBranch =
    (query.data?.capabilities.supportsBranchFilter !== false &&
      (query.data?.filterOptions?.branches?.length ?? 0) > 1) ||
    Boolean(filters.branchId);
  const emptyHistory = Boolean(
    query.data?.emptyHistory && !adminActivityLogFiltersApplied(filters),
  );
  const noResults = Boolean(
    query.data &&
      items.length === 0 &&
      (query.data.filtersApplied || adminActivityLogFiltersApplied(filters)) &&
      !emptyHistory,
  );

  const canExport =
    query.data?.capabilities.supportsExport === true &&
    query.data?.allowedActions.export === true &&
    (user.permissionCodes.length === 0 ||
      hasPermission(user, activityLogPermission("export")));

  function clearFilters() {
    setDraftQuery("");
    replaceFilters(defaultAdminActivityLogFilters());
  }

  async function onExport() {
    if (!canExport || exportBusy) return;
    setExportBusy(true);
    try {
      let job = await createAdminActivityLogExport(filters, createIdempotencyKey());
      let attempts = 0;
      while (job.status === "preparing" && job.jobId && attempts < 30) {
        await new Promise((resolve) => window.setTimeout(resolve, 2000));
        job = await fetchAdminActivityLogExport(job.jobId);
        attempts += 1;
      }
      if (job.status === "ready" && job.downloadUrl) {
        window.open(job.downloadUrl, "_blank", "noopener,noreferrer");
        toast.success("خروجی آماده شد");
        return;
      }
      toast.error(job.message ?? "خروجی در دسترس نیست");
    } catch (err) {
      toast.error(toAppApiError(err).message);
    } finally {
      setExportBusy(false);
    }
  }

  const pageCount =
    query.data?.totalCount && query.data.pageSize
      ? Math.max(1, Math.ceil(query.data.totalCount / query.data.pageSize))
      : query.data?.hasMore
        ? filters.page + 1
        : filters.page;

  return (
    <>
      <AdminPageHeader
        title="گزارش فعالیت"
        description="سوابق ممیزی مدیریتی فقط‌خواندنی. رویدادها توسط Backend ثبت می‌شوند."
        breadcrumb={
          <AdminBreadcrumb
            pathname={routes.admin.activityLogs}
            items={[
              { href: routes.admin.home, label: "پنل مدیریت" },
              { label: "گزارش فعالیت" },
            ]}
          />
        }
        secondaryActions={
          <>
            {canExport ? (
              <Button
                variant="secondary"
                leadingIcon={<Download size={16} aria-hidden="true" />}
                loading={exportBusy}
                onClick={() => void onExport()}
              >
                خروجی
              </Button>
            ) : null}
            <Button
              variant="secondary"
              leadingIcon={<RefreshCw size={16} aria-hidden="true" />}
              loading={query.isFetching && !query.isPending}
              onClick={() => void query.refetch()}
            >
              به‌روزرسانی
            </Button>
          </>
        }
      />

      <div className="admin-activity-log-toolbar">
        <SearchInput
          value={draftQuery}
          onChange={(event) => setDraftQuery(event.target.value)}
          placeholder="عامل، مرجع موجودیت یا کلیدواژه"
          aria-label="جستجوی گزارش فعالیت"
        />
        <Button
          variant="secondary"
          leadingIcon={<SlidersHorizontal size={16} aria-hidden="true" />}
          onClick={() => setMobileFiltersOpen(true)}
        >
          فیلترها{activeCount > 0 ? ` (${activeCount})` : ""}
        </Button>
      </div>

      <AdminActivityLogFilters
        filters={filters}
        options={query.data?.filterOptions}
        showBranchFilter={showBranch}
        mobileOpen={mobileFiltersOpen}
        onMobileOpenChange={setMobileFiltersOpen}
        onChange={replaceFilters}
        onClear={clearFilters}
      />

      {query.data?.timezoneLabel ? (
        <p className="ds-help admin-activity-log-timezone">
          منطقه زمانی نمایش:{" "}
          <span className="ltr-value">{query.data.timezoneLabel}</span>
        </p>
      ) : null}

      {query.isPending ? <AdminActivityLogListSkeleton /> : null}

      {error ? (
        isForbiddenError(error) || isNotFoundError(error) ? (
          <PermissionDeniedState title="دسترسی مجاز نیست" description={error.message} />
        ) : (
          <ApiErrorState
            title="بارگذاری ناموفق"
            description={error.message}
            onRetry={() => void query.refetch()}
          />
        )
      ) : null}

      {!query.isPending && !error && emptyHistory ? (
        <EmptyState
          title="رویدادی ثبت نشده"
          description="هنوز سابقه فعالیت مدیریتی برای نمایش وجود ندارد."
        />
      ) : null}

      {!query.isPending && !error && noResults ? (
        <NoResultsState
          title="نتیجه‌ای یافت نشد"
          action={
            activeCount > 0 ? (
              <Button variant="secondary" onClick={clearFilters}>
                پاک کردن فیلترها
              </Button>
            ) : undefined
          }
        />
      ) : null}

      {!query.isPending && !error && items.length > 0 ? (
        <>
          <AdminActivityLogListTable items={items} showBranch={showBranch} />
          {pageCount > 1 ? (
            <Pagination
              page={filters.page}
              pageCount={pageCount}
              onPageChange={(page) => replaceFilters({ page })}
            />
          ) : null}
        </>
      ) : null}
    </>
  );
}
