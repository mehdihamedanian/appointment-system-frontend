"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { AdminBreadcrumb } from "@/components/layout/admin/admin-breadcrumb";
import { AdminPageHeader } from "@/components/layout/admin/admin-page-header";
import {
  ApiErrorState,
  EmptyState,
  NoResultsState,
} from "@/components/feedback/app-states";
import { Skeleton } from "@/components/feedback/loading-states";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { AdminServiceFilters } from "@/features/admin/services/admin-service-filters";
import {
  AdminServiceListCards,
  AdminServiceListTable,
} from "@/features/admin/services/admin-service-list-table";
import { PermissionGate } from "@/features/admin/permission-gate";
import { useSession } from "@/features/auth/session-provider";
import { adminServiceListQueryOptions } from "@/lib/api/admin-services";
import { isForbiddenError, isNotFoundError, toAppApiError } from "@/lib/api/errors";
import {
  adminServiceFiltersApplied,
  adminServiceHref,
  countActiveAdminServiceFilters,
  parseAdminServiceFilters,
  sanitizeServiceSearch,
} from "@/lib/admin/service-filters";
import { isCapabilityVisible, getBusinessCapabilities } from "@/config/capabilities";
import { fetchPublicBusiness } from "@/lib/api/public";
import { hasPermission } from "@/lib/permissions/access";
import { queryKeys } from "@/lib/query/keys";
import { routes } from "@/constants/routes";
import type { AdminServiceListFilters } from "@/types/admin-service";

const SEARCH_DEBOUNCE_MS = 300;

export function AdminServiceScreen() {
  const { status, user } = useSession();
  const searchParams = useSearchParams();
  const filters = parseAdminServiceFilters(searchParams);
  const sessionReady = status === "authenticated" && Boolean(user?.id);

  if (status === "loading" || !sessionReady) {
    return (
      <>
        <AdminPageHeader title="خدمات" description="مدیریت خدمات و تنظیمات رزرو." />
        <Skeleton variant="card" />
      </>
    );
  }

  return (
    <PermissionGate permission="admin.services.view">
      <AdminServiceScreenReady userId={user!.id} user={user!} filters={filters} />
    </PermissionGate>
  );
}

function AdminServiceScreenReady({
  userId,
  user,
  filters,
}: {
  userId: string;
  user: NonNullable<ReturnType<typeof useSession>["user"]>;
  filters: AdminServiceListFilters;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [draftQuery, setDraftQuery] = useState(filters.q ?? "");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const businessQuery = useQuery({
    queryKey: queryKeys.publicBusiness,
    queryFn: ({ signal }) => fetchPublicBusiness(signal),
    staleTime: 60_000,
  });
  const showBranch =
    isCapabilityVisible(getBusinessCapabilities(), "multipleBranches") &&
    businessQuery.data?.branchesEnabled === true;

  const query = useQuery(adminServiceListQueryOptions(userId, filters));
  const canCreate =
    hasPermission(user, "admin.services.create") || user.permissionCodes.length === 0;

  const replaceFilters = useCallback(
    (next: Partial<AdminServiceListFilters>) => {
      const merged = { ...filters, ...next, page: next.page ?? 1 };
      startTransition(() => {
        router.replace(adminServiceHref(merged), { scroll: false });
      });
    },
    [filters, router, startTransition],
  );

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const next = sanitizeServiceSearch(draftQuery);
      if ((next ?? "") === (filters.q ?? "")) return;
      replaceFilters({ q: next, page: 1 });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [draftQuery, filters.q, replaceFilters]);

  const activeCount = countActiveAdminServiceFilters(filters);
  const error = query.isError ? toAppApiError(query.error) : undefined;
  const items = query.data?.items ?? [];
  const filtersApplied =
    adminServiceFiltersApplied(filters) || Boolean(query.data?.filtersApplied);
  const emptyCatalog = Boolean(query.data && items.length === 0 && !filtersApplied);
  const noResults = Boolean(query.data && items.length === 0 && filtersApplied && !emptyCatalog);

  return (
    <>
      <AdminPageHeader
        title="خدمات"
        description="مدیریت خدمات، قیمت‌گذاری، Provider، شعب و نیازمندی‌های منبع."
        breadcrumb={
          <AdminBreadcrumb
            pathname={routes.admin.services}
            items={[
              { href: routes.admin.home, label: "پنل مدیریت" },
              { label: "خدمات" },
            ]}
          />
        }
        primaryAction={
          canCreate ? (
            <Button asChild>
              <Link href={routes.admin.serviceNew}>
                <Plus size={16} aria-hidden="true" />
                افزودن خدمت
              </Link>
            </Button>
          ) : undefined
        }
      />

      <div className="admin-service-toolbar">
        <SearchInput
          value={draftQuery}
          placeholder="جستجوی نام خدمت"
          aria-label="جستجوی خدمات"
          onChange={(event) => setDraftQuery(event.target.value)}
        />
        <Button type="button" variant="secondary" onClick={() => setFiltersOpen(true)}>
          فیلتر{activeCount > 0 ? ` (${activeCount})` : ""}
        </Button>
      </div>

      <AdminServiceFilters
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        filters={filters}
        options={query.data?.filterOptions}
        showBranch={showBranch}
        onChange={replaceFilters}
        onClear={() => replaceFilters({ q: undefined, active: "all", branchId: undefined, providerId: undefined, resourceType: undefined, page: 1 })}
      />

      {query.isPending ? <Skeleton variant="card" /> : null}

      {error ? (
        isForbiddenError(error) ? (
          <ApiErrorState title="دسترسی مجاز نیست" description={error.message} />
        ) : isNotFoundError(error) ? (
          <EmptyState
            title="فهرست خدمات در دسترس نیست"
            description="Backend باید GET /admin/services را ارائه کند."
          />
        ) : (
          <ApiErrorState
            title="خدمات بارگذاری نشد"
            description={error.message}
            onRetry={() => void query.refetch()}
          />
        )
      ) : null}

      {emptyCatalog ? (
        <EmptyState
          title="هنوز خدمتی ثبت نشده"
          description="اولین خدمت را ایجاد کنید تا مشتریان بتوانند رزرو کنند."
          action={
            canCreate ? (
              <Button asChild>
                <Link href={routes.admin.serviceNew}>افزودن خدمت</Link>
              </Button>
            ) : undefined
          }
        />
      ) : null}

      {noResults ? (
        <NoResultsState
          title="نتیجه‌ای پیدا نشد"
          description="فیلترها یا عبارت جستجو را تغییر دهید."
          action={
            <Button type="button" variant="secondary" onClick={() => replaceFilters({ q: undefined, active: "all", branchId: undefined, providerId: undefined, resourceType: undefined, page: 1 })}>
              پاک کردن فیلترها
            </Button>
          }
        />
      ) : null}

      {items.length > 0 ? (
        <>
          <div className="admin-service-list-desktop">
            <AdminServiceListTable items={items} showBranch={showBranch} />
          </div>
          <div className="admin-service-list-mobile">
            <AdminServiceListCards items={items} />
          </div>
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
