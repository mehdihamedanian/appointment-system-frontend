"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, SlidersHorizontal } from "lucide-react";
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
import { AdminNotificationTemplateFilters } from "@/features/admin/notifications/admin-notification-template-filters";
import { AdminNotificationTemplateListTable } from "@/features/admin/notifications/admin-notification-template-list-table";
import { AdminNotificationListSkeleton } from "@/features/admin/notifications/admin-notification-skeleton";
import { AdminNotificationsGate } from "@/features/admin/notifications/admin-notifications-gate";
import { AdminNotificationsHubScreen } from "@/features/admin/notifications/admin-notifications-hub-screen";
import { PermissionGate } from "@/features/admin/permission-gate";
import { useSession } from "@/features/auth/session-provider";
import { adminNotificationTemplateListQueryOptions } from "@/lib/api/admin-notifications";
import { isForbiddenError, isNotFoundError, toAppApiError } from "@/lib/api/errors";
import {
  adminNotificationTemplateFiltersApplied,
  adminNotificationTemplatesHref,
  countActiveAdminNotificationTemplateFilters,
  notificationPermission,
  parseAdminNotificationTemplateFilters,
  sanitizeNotificationSearch,
} from "@/lib/admin/notification-filters";
import { routes } from "@/constants/routes";
import type { AdminNotificationTemplateListFilters } from "@/types/admin-notification";

const SEARCH_DEBOUNCE_MS = 300;

export function AdminNotificationTemplatesScreen() {
  const { status, user } = useSession();
  const searchParams = useSearchParams();
  const filters = parseAdminNotificationTemplateFilters(searchParams);

  if (status === "loading" || !user?.id) {
    return (
      <>
        <AdminNotificationsHubScreen />
        <AdminNotificationListSkeleton />
      </>
    );
  }

  return (
    <PermissionGate permission={notificationPermission("templatesView")}>
      <AdminNotificationsGate>
        <AdminNotificationTemplatesReady userId={user.id} filters={filters} />
      </AdminNotificationsGate>
    </PermissionGate>
  );
}

function AdminNotificationTemplatesReady({
  userId,
  filters,
}: {
  userId: string;
  filters: AdminNotificationTemplateListFilters;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [draftQuery, setDraftQuery] = useState(filters.q ?? "");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const query = useQuery(adminNotificationTemplateListQueryOptions(userId, filters));

  const replaceFilters = useCallback(
    (next: Partial<AdminNotificationTemplateListFilters>) => {
      startTransition(() => {
        router.replace(adminNotificationTemplatesHref({ ...filters, ...next, page: next.page ?? 1 }), {
          scroll: false,
        });
      });
    },
    [filters, router, startTransition],
  );

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const next = sanitizeNotificationSearch(draftQuery);
      if ((next ?? "") === (filters.q ?? "")) return;
      replaceFilters({ q: next, page: 1 });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [draftQuery, filters.q, replaceFilters]);

  const activeCount = countActiveAdminNotificationTemplateFilters(filters);
  const error = query.isError ? toAppApiError(query.error) : undefined;
  const items = query.data?.items ?? [];
  const showBranch = (query.data?.filterOptions?.branches?.length ?? 0) > 1;
  const emptyHistory = Boolean(
    query.data?.emptyHistory && !adminNotificationTemplateFiltersApplied(filters),
  );
  const noResults = Boolean(
    query.data &&
      items.length === 0 &&
      (query.data.filtersApplied || adminNotificationTemplateFiltersApplied(filters)) &&
      !emptyHistory,
  );

  function clearFilters() {
    setDraftQuery("");
    replaceFilters({
      q: undefined,
      eventType: "all",
      channel: "all",
      status: "all",
      language: undefined,
      branchId: undefined,
      sort: "updatedAt",
      direction: "desc",
      page: 1,
    });
  }

  return (
    <>
      <AdminNotificationsHubScreen />
      <AdminPageHeader
        title="قالب‌های اعلان"
        description="ویرایش محتوای پیامک و ایمیل برای رویدادهای کسب‌وکار."
        breadcrumb={
          <AdminBreadcrumb
            pathname={routes.admin.notificationTemplates}
            items={[
              { href: routes.admin.home, label: "پنل مدیریت" },
              { href: routes.admin.notifications, label: "اعلان‌ها" },
              { label: "قالب‌ها" },
            ]}
          />
        }
        secondaryActions={
          <Button
            variant="secondary"
            leadingIcon={<RefreshCw size={16} aria-hidden="true" />}
            loading={query.isFetching && !query.isPending}
            onClick={() => void query.refetch()}
          >
            به‌روزرسانی
          </Button>
        }
      />

      <div className="admin-notification-toolbar">
        <SearchInput
          value={draftQuery}
          onChange={(event) => setDraftQuery(event.target.value)}
          placeholder="رویداد، کانال یا شناسه"
          aria-label="جستجوی قالب"
        />
        <Button
          variant="secondary"
          leadingIcon={<SlidersHorizontal size={16} aria-hidden="true" />}
          onClick={() => setMobileFiltersOpen(true)}
        >
          فیلترها{activeCount > 0 ? ` (${activeCount})` : ""}
        </Button>
      </div>

      <AdminNotificationTemplateFilters
        filters={filters}
        options={query.data?.filterOptions}
        showBranchFilter={showBranch}
        mobileOpen={mobileFiltersOpen}
        onMobileOpenChange={setMobileFiltersOpen}
        onChange={replaceFilters}
        onClear={clearFilters}
      />

      {typeof query.data?.totalCount === "number" ? (
        <p className="admin-notification-result-count" aria-live="polite">
          {new Intl.NumberFormat("fa-IR").format(query.data.totalCount)} نتیجه
        </p>
      ) : null}

      {query.isPending ? <AdminNotificationListSkeleton /> : null}

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
        <EmptyState title="قالبی تعریف نشده" description="Backend هنوز قالب اعلانی برنگردانده است." />
      ) : null}

      {!query.isPending && !error && noResults ? (
        <NoResultsState
          title="نتیجه‌ای یافت نشد"
          description="فیلترها را تغییر دهید."
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
          <AdminNotificationTemplateListTable items={items} />
          {query.data?.pageCount && query.data.pageCount > 1 ? (
            <Pagination
              page={filters.page}
              pageCount={query.data.pageCount}
              onPageChange={(page) => replaceFilters({ page })}
            />
          ) : null}
        </>
      ) : null}
    </>
  );
}
