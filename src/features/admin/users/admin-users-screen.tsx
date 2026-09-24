"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Plus, RefreshCw, SlidersHorizontal } from "lucide-react";
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
import { AdminAccessGate } from "@/features/admin/access/admin-access-gate";
import { AdminAccessListSkeleton } from "@/features/admin/access/admin-access-skeleton";
import { AdminUserFilters } from "@/features/admin/users/admin-user-filters";
import { AdminUserListTable } from "@/features/admin/users/admin-user-list-table";
import { PermissionGate } from "@/features/admin/permission-gate";
import { useSession } from "@/features/auth/session-provider";
import { isAdminMultiBranchEnabled } from "@/lib/admin/branch-context";
import {
  accessPermission,
  adminUserFiltersApplied,
  adminUsersHref,
  countActiveAdminUserFilters,
  defaultAdminUserFilters,
  parseAdminUserFilters,
} from "@/lib/admin/access-filters";
import { sanitizeAccessSearch } from "@/lib/admin/access-adapter";
import { adminUserListQueryOptions } from "@/lib/api/admin-access";
import { isForbiddenError, isNotFoundError, toAppApiError } from "@/lib/api/errors";
import { hasPermission } from "@/lib/permissions/access";
import { routes } from "@/constants/routes";
import type { AdminUserListFilters } from "@/types/admin-access";

const SEARCH_DEBOUNCE_MS = 300;

export function AdminUsersScreen() {
  const { status, user } = useSession();
  const searchParams = useSearchParams();
  const filters = parseAdminUserFilters(searchParams);

  if (status === "loading" || !user?.id) {
    return <AdminAccessListSkeleton />;
  }

  return (
    <PermissionGate permission={accessPermission("usersView")}>
      <AdminAccessGate>
        <AdminUsersReady userId={user.id} filters={filters} canCreate={
          hasPermission(user, accessPermission("usersCreate")) ||
          user.permissionCodes.length === 0
        } />
      </AdminAccessGate>
    </PermissionGate>
  );
}

function AdminUsersReady({
  userId,
  filters,
  canCreate,
}: {
  userId: string;
  filters: AdminUserListFilters;
  canCreate: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [draftQuery, setDraftQuery] = useState(filters.q ?? "");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const query = useQuery(adminUserListQueryOptions(userId, filters));

  const replaceFilters = useCallback(
    (next: Partial<AdminUserListFilters>) => {
      startTransition(() => {
        router.replace(adminUsersHref({ ...filters, ...next, page: next.page ?? 1 }), {
          scroll: false,
        });
      });
    },
    [filters, router, startTransition],
  );

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const next = sanitizeAccessSearch(draftQuery);
      if ((next ?? "") === (filters.q ?? "")) return;
      replaceFilters({ q: next, page: 1 });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [draftQuery, filters.q, replaceFilters]);

  const activeCount = countActiveAdminUserFilters(filters);
  const error = query.isError ? toAppApiError(query.error) : undefined;
  const items = query.data?.items ?? [];
  const showBranch =
    isAdminMultiBranchEnabled({ branchesEnabled: true }) ||
    (query.data?.filterOptions?.branches?.length ?? 0) > 1;
  const emptyHistory = Boolean(
    query.data?.emptyHistory && !adminUserFiltersApplied(filters),
  );
  const noResults = Boolean(
    query.data &&
      items.length === 0 &&
      (query.data.filtersApplied || adminUserFiltersApplied(filters)) &&
      !emptyHistory,
  );

  function clearFilters() {
    setDraftQuery("");
    replaceFilters({ ...defaultAdminUserFilters() });
  }

  return (
    <>
      <AdminPageHeader
        title="کاربران"
        description="حساب‌های پنل مدیریت — جدا از پرسنل و مشتریان."
        breadcrumb={
          <AdminBreadcrumb
            pathname={routes.admin.users}
            items={[
              { href: routes.admin.home, label: "پنل مدیریت" },
              { label: "کاربران" },
            ]}
          />
        }
        primaryAction={
          canCreate ? (
            <Button asChild leadingIcon={<Plus size={16} aria-hidden="true" />}>
              <Link href={routes.admin.userNew}>دعوت کاربر</Link>
            </Button>
          ) : undefined
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

      <div className="admin-access-toolbar">
        <SearchInput
          value={draftQuery}
          onChange={(event) => setDraftQuery(event.target.value)}
          placeholder="نام، ایمیل یا موبایل"
          aria-label="جستجوی کاربر"
        />
        <Button
          variant="secondary"
          leadingIcon={<SlidersHorizontal size={16} aria-hidden="true" />}
          onClick={() => setMobileFiltersOpen(true)}
          className="admin-access-toolbar__mobile-filters"
        >
          فیلترها{activeCount > 0 ? ` (${activeCount})` : ""}
        </Button>
      </div>

      <AdminUserFilters
        filters={filters}
        options={query.data?.filterOptions}
        showBranchFilter={showBranch}
        mobileOpen={mobileFiltersOpen}
        onMobileOpenChange={setMobileFiltersOpen}
        onChange={replaceFilters}
        onClear={clearFilters}
      />

      {query.isPending ? <AdminAccessListSkeleton /> : null}

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
          title="کاربری ثبت نشده"
          description="هنوز کاربر پنل مدیریتی دعوت نشده است."
          action={
            canCreate ? (
              <Button asChild>
                <Link href={routes.admin.userNew}>دعوت کاربر</Link>
              </Button>
            ) : undefined
          }
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
          <AdminUserListTable items={items} />
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
