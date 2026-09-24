"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Plus, RefreshCw } from "lucide-react";
import { AdminBreadcrumb } from "@/components/layout/admin/admin-breadcrumb";
import { AdminPageHeader } from "@/components/layout/admin/admin-page-header";
import {
  ApiErrorState,
  EmptyState,
  NoResultsState,
  PermissionDeniedState,
} from "@/components/feedback/app-states";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/form-field";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { AdminAccessGate } from "@/features/admin/access/admin-access-gate";
import { AdminAccessListSkeleton } from "@/features/admin/access/admin-access-skeleton";
import { AdminRoleListTable } from "@/features/admin/roles/admin-role-list-table";
import { PermissionGate } from "@/features/admin/permission-gate";
import { useSession } from "@/features/auth/session-provider";
import { sanitizeAccessSearch } from "@/lib/admin/access-adapter";
import {
  accessPermission,
  adminRoleFiltersApplied,
  adminRolesHref,
  countActiveAdminRoleFilters,
  defaultAdminRoleFilters,
  parseAdminRoleFilters,
} from "@/lib/admin/access-filters";
import { adminRoleListQueryOptions } from "@/lib/api/admin-access";
import { isForbiddenError, isNotFoundError, toAppApiError } from "@/lib/api/errors";
import { hasPermission } from "@/lib/permissions/access";
import { routes } from "@/constants/routes";
import type { AdminRoleListFilters } from "@/types/admin-access";

const SEARCH_DEBOUNCE_MS = 300;

export function AdminRolesScreen() {
  const { status, user } = useSession();
  const searchParams = useSearchParams();
  const filters = parseAdminRoleFilters(searchParams);

  if (status === "loading" || !user?.id) {
    return <AdminAccessListSkeleton />;
  }

  return (
    <PermissionGate permission={accessPermission("rolesView")}>
      <AdminAccessGate>
        <AdminRolesReady
          userId={user.id}
          filters={filters}
          canCreate={
            hasPermission(user, accessPermission("rolesCreate")) ||
            user.permissionCodes.length === 0
          }
        />
      </AdminAccessGate>
    </PermissionGate>
  );
}

function AdminRolesReady({
  userId,
  filters,
  canCreate,
}: {
  userId: string;
  filters: AdminRoleListFilters;
  canCreate: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [draftQuery, setDraftQuery] = useState(filters.q ?? "");
  const query = useQuery(adminRoleListQueryOptions(userId, filters));

  const replaceFilters = useCallback(
    (next: Partial<AdminRoleListFilters>) => {
      startTransition(() => {
        router.replace(adminRolesHref({ ...filters, ...next, page: next.page ?? 1 }), {
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

  const activeCount = countActiveAdminRoleFilters(filters);
  const error = query.isError ? toAppApiError(query.error) : undefined;
  const items = query.data?.items ?? [];
  const emptyHistory = Boolean(
    query.data?.emptyHistory && !adminRoleFiltersApplied(filters),
  );
  const noResults = Boolean(
    query.data &&
      items.length === 0 &&
      (query.data.filtersApplied || adminRoleFiltersApplied(filters)) &&
      !emptyHistory,
  );

  return (
    <>
      <AdminPageHeader
        title="نقش‌ها"
        description="نقش‌های سیستمی و سفارشی و ماتریس مجوزها."
        breadcrumb={
          <AdminBreadcrumb
            pathname={routes.admin.roles}
            items={[
              { href: routes.admin.home, label: "پنل مدیریت" },
              { label: "نقش‌ها" },
            ]}
          />
        }
        primaryAction={
          canCreate ? (
            <Button asChild leadingIcon={<Plus size={16} aria-hidden="true" />}>
              <Link href={routes.admin.roleNew}>نقش سفارشی</Link>
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
          placeholder="نام نقش"
          aria-label="جستجوی نقش"
        />
        <div className="admin-access-filters__field">
          <Label htmlFor="admin-role-system">نوع</Label>
          <Select
            id="admin-role-system"
            value={filters.system}
            options={[
              { value: "all", label: "همه" },
              { value: "system", label: "سیستمی" },
              { value: "custom", label: "سفارشی" },
            ]}
            onChange={(value) =>
              replaceFilters({
                system: (value as AdminRoleListFilters["system"]) ?? "all",
                page: 1,
              })
            }
            allowClear={false}
          />
        </div>
        {activeCount > 0 ? (
          <Button
            variant="secondary"
            onClick={() => {
              setDraftQuery("");
              replaceFilters({ ...defaultAdminRoleFilters() });
            }}
          >
            پاک کردن
          </Button>
        ) : null}
      </div>

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
        <EmptyState title="نقشی ثبت نشده" description="هنوز نقشی از Backend دریافت نشده است." />
      ) : null}

      {!query.isPending && !error && noResults ? (
        <NoResultsState title="نتیجه‌ای یافت نشد" />
      ) : null}

      {!query.isPending && !error && items.length > 0 ? (
        <>
          <AdminRoleListTable items={items} />
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
