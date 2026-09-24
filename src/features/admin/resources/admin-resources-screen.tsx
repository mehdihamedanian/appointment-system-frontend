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
import { AdminResourceFilters } from "@/features/admin/resources/admin-resource-filters";
import {
  AdminResourceListCards,
  AdminResourceListTable,
} from "@/features/admin/resources/admin-resource-list-table";
import { PermissionGate } from "@/features/admin/permission-gate";
import { useSession } from "@/features/auth/session-provider";
import { adminResourceListQueryOptions } from "@/lib/api/admin-resources";
import { isForbiddenError, isNotFoundError, toAppApiError } from "@/lib/api/errors";
import {
  adminResourceFiltersApplied,
  adminResourcesHref,
  countActiveAdminResourceFilters,
  parseAdminResourceFilters,
  sanitizeResourceSearch,
} from "@/lib/admin/resource-filters";
import { isCapabilityVisible, getBusinessCapabilities } from "@/config/capabilities";
import { fetchPublicBusiness } from "@/lib/api/public";
import { hasPermission } from "@/lib/permissions/access";
import { queryKeys } from "@/lib/query/keys";
import { routes } from "@/constants/routes";
import type { AdminResourceListFilters } from "@/types/admin-resource";

const SEARCH_DEBOUNCE_MS = 300;

export function AdminResourcesScreen() {
  const { status, user } = useSession();
  const searchParams = useSearchParams();
  const filters = parseAdminResourceFilters(searchParams);
  const sessionReady = status === "authenticated" && Boolean(user?.id);

  if (status === "loading" || !sessionReady) {
    return (
      <>
        <AdminPageHeader
          title="منابع"
          description="مدیریت اتاق‌ها، دستگاه‌ها و سایر منابع عملیاتی."
          breadcrumb={
            <AdminBreadcrumb
              pathname={routes.admin.resources}
              items={[
                { href: routes.admin.home, label: "پنل مدیریت" },
                { label: "منابع" },
              ]}
            />
          }
        />
        <Skeleton variant="card" />
      </>
    );
  }

  return (
    <PermissionGate permission="admin.resources.view">
      <AdminResourcesScreenReady userId={user!.id} user={user!} filters={filters} />
    </PermissionGate>
  );
}

function AdminResourcesScreenReady({
  userId,
  user,
  filters,
}: {
  userId: string;
  user: NonNullable<ReturnType<typeof useSession>["user"]>;
  filters: AdminResourceListFilters;
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

  const query = useQuery(adminResourceListQueryOptions(userId, filters));
  const canCreate =
    hasPermission(user, "admin.resources.create") || user.permissionCodes.length === 0;

  const replaceFilters = useCallback(
    (next: Partial<AdminResourceListFilters>) => {
      const merged = { ...filters, ...next, page: next.page ?? 1 };
      startTransition(() => {
        router.replace(adminResourcesHref(merged), { scroll: false });
      });
    },
    [filters, router, startTransition],
  );

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const next = sanitizeResourceSearch(draftQuery);
      if ((next ?? "") === (filters.q ?? "")) return;
      replaceFilters({ q: next, page: 1 });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [draftQuery, filters.q, replaceFilters]);

  const activeCount = countActiveAdminResourceFilters(filters);
  const error = query.isError ? toAppApiError(query.error) : undefined;
  const items = query.data?.items ?? [];
  const filtersApplied =
    adminResourceFiltersApplied(filters) || Boolean(query.data?.filtersApplied);
  const emptyCatalog = Boolean(
    query.data && items.length === 0 && !filtersApplied,
  );
  const noResults = Boolean(
    query.data && items.length === 0 && filtersApplied && !emptyCatalog,
  );

  return (
    <>
      <AdminPageHeader
        title="منابع"
        description="اتاق، دستگاه، صندلی و سایر منابع داخلی — کارکنان از طریق ماژول کارکنان مدیریت می‌شوند."
        breadcrumb={
          <AdminBreadcrumb
            pathname={routes.admin.resources}
            items={[
              { href: routes.admin.home, label: "پنل مدیریت" },
              { label: "منابع" },
            ]}
          />
        }
        primaryAction={
          canCreate ? (
            <Button asChild leadingIcon={<Plus size={16} aria-hidden="true" />}>
              <Link href={routes.admin.resourceNew}>منبع جدید</Link>
            </Button>
          ) : null
        }
      />

      <div className="admin-resources-toolbar">
        <SearchInput
          aria-label="جستجوی منبع"
          value={draftQuery}
          loading={query.isFetching}
          onChange={(event) => setDraftQuery(event.target.value)}
          onClear={() => setDraftQuery("")}
          placeholder="نام یا شناسه منبع"
        />
        <Button variant="secondary" onClick={() => setFiltersOpen(true)}>
          فیلترها{activeCount > 0 ? ` (${activeCount})` : ""}
        </Button>
      </div>

      {query.isPending ? <Skeleton variant="card" /> : null}

      {error ? (
        isForbiddenError(error) ? (
          <ApiErrorState title="دسترسی مجاز نیست" description={error.message} />
        ) : (
          <ApiErrorState
            title={
              isNotFoundError(error)
                ? "فهرست منابع در دسترس نیست"
                : "فهرست منابع بارگذاری نشد"
            }
            description={
              isNotFoundError(error)
                ? "Backend باید GET /admin/resources را ارائه کند."
                : error.message
            }
            requestId={error.requestId}
            onRetry={() => void query.refetch()}
          />
        )
      ) : null}

      {query.data && !error ? (
        <>
          {emptyCatalog ? (
            <EmptyState
              title="منبعی پیکربندی نشده"
              description="اولین اتاق، دستگاه یا منبع عملیاتی را اضافه کنید. کارکنان از بخش کارکنان مدیریت می‌شوند."
              action={
                canCreate ? (
                  <Button asChild>
                    <Link href={routes.admin.resourceNew}>افزودن منبع</Link>
                  </Button>
                ) : undefined
              }
            />
          ) : null}
          {noResults ? (
            <NoResultsState
              title="نتیجه‌ای با این فیلترها نیست"
              description="فیلترها را تغییر دهید یا پاک کنید."
            />
          ) : null}
          {items.length > 0 ? (
            <>
              <div className="admin-resources-desktop">
                <AdminResourceListTable items={items} showBranch={showBranch} />
              </div>
              <div className="admin-resources-mobile">
                <AdminResourceListCards items={items} />
              </div>
              {query.data.pageCount && query.data.pageCount > 1 ? (
                <Pagination
                  page={filters.page}
                  pageCount={query.data.pageCount}
                  onPageChange={(page) => replaceFilters({ page })}
                />
              ) : null}
            </>
          ) : null}
        </>
      ) : null}

      <AdminResourceFilters
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        filters={filters}
        options={query.data?.filterOptions}
        showBranch={showBranch}
        onChange={replaceFilters}
        onClear={() =>
          replaceFilters({
            q: undefined,
            type: "all",
            active: "all",
            branchId: undefined,
            serviceId: undefined,
            page: 1,
          })
        }
      />
    </>
  );
}
