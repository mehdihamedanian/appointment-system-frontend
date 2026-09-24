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
import { AdminBranchFilters } from "@/features/admin/branches/admin-branch-filters";
import {
  AdminBranchListCards,
  AdminBranchListTable,
} from "@/features/admin/branches/admin-branch-list-table";
import { AdminBranchesGate } from "@/features/admin/branches/admin-branches-gate";
import { PermissionGate } from "@/features/admin/permission-gate";
import { useSession } from "@/features/auth/session-provider";
import { adminBranchListQueryOptions } from "@/lib/api/admin-branches";
import { isForbiddenError, isNotFoundError, toAppApiError } from "@/lib/api/errors";
import {
  adminBranchFiltersApplied,
  adminBranchHref,
  adminBranchNewHref,
  branchPermission,
  countActiveAdminBranchFilters,
  parseAdminBranchFilters,
  sanitizeBranchSearch,
} from "@/lib/admin/branch-filters";
import { hasPermission } from "@/lib/permissions/access";
import { routes } from "@/constants/routes";
import type { AdminBranchListFilters } from "@/types/admin-branch";

const SEARCH_DEBOUNCE_MS = 300;

export function AdminBranchScreen() {
  const { status, user } = useSession();
  const searchParams = useSearchParams();
  const filters = parseAdminBranchFilters(searchParams);
  const sessionReady = status === "authenticated" && Boolean(user?.id);

  if (status === "loading" || !sessionReady) {
    return (
      <>
        <AdminPageHeader title="شعب" description="در حال بارگذاری…" />
        <Skeleton variant="card" />
      </>
    );
  }

  return (
    <PermissionGate permission={branchPermission("view")}>
      <AdminBranchesGate>
        <AdminBranchScreenReady userId={user!.id} user={user!} filters={filters} />
      </AdminBranchesGate>
    </PermissionGate>
  );
}

function AdminBranchScreenReady({
  userId,
  user,
  filters,
}: {
  userId: string;
  user: NonNullable<ReturnType<typeof useSession>["user"]>;
  filters: AdminBranchListFilters;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [draftQuery, setDraftQuery] = useState(filters.q ?? "");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const query = useQuery(adminBranchListQueryOptions(userId, filters));
  const canCreate =
    hasPermission(user, branchPermission("create")) || user.permissionCodes.length === 0;

  const replaceFilters = useCallback(
    (next: Partial<AdminBranchListFilters>) => {
      const merged = { ...filters, ...next, page: next.page ?? 1 };
      startTransition(() => {
        router.replace(adminBranchHref(merged), { scroll: false });
      });
    },
    [filters, router, startTransition],
  );

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const q = sanitizeBranchSearch(draftQuery);
      if (q !== filters.q) {
        replaceFilters({ q, page: 1 });
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [draftQuery, filters.q, replaceFilters]);

  if (query.isLoading) {
    return (
      <>
        <AdminPageHeader title="شعب" description="مدیریت مکان‌های کسب‌وکار." />
        <Skeleton variant="card" />
      </>
    );
  }

  if (query.isError) {
    const appError = toAppApiError(query.error);
    if (isForbiddenError(appError)) {
      return <ApiErrorState title="دسترسی محدود" description="مجوز مشاهده شعب را ندارید." />;
    }
    if (isNotFoundError(appError)) {
      return (
        <ApiErrorState
          title="شعب در دسترس نیست"
          description="سرویس مدیریت شعب هنوز به Backend متصل نشده است."
        />
      );
    }
    return <ApiErrorState description={appError.message} onRetry={() => void query.refetch()} />;
  }

  const view = query.data!;
  const activeFilterCount = countActiveAdminBranchFilters(filters);
  const filtersApplied = adminBranchFiltersApplied(filters) || view.filtersApplied;

  return (
    <>
      <AdminBreadcrumb pathname={routes.admin.branches} />
      <AdminPageHeader
        title="شعب"
        description="مکان‌های فعال کسب‌وکار — نه tenant جداگانه."
        primaryAction={
          canCreate ? (
            <Button asChild>
              <Link href={adminBranchNewHref()}>
                <Plus size={16} aria-hidden="true" />
                شعبه جدید
              </Link>
            </Button>
          ) : undefined
        }
        toolbar={
          <div className="admin-branch-toolbar">
            <SearchInput
              value={draftQuery}
              placeholder="جستجو در شعب…"
              aria-label="جستجو در شعب"
              onChange={(event) => setDraftQuery(event.target.value)}
            />
            <Button
              type="button"
              variant="secondary"
              aria-expanded={filtersOpen}
              onClick={() => setFiltersOpen((open) => !open)}
            >
              فیلترها{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
            </Button>
          </div>
        }
      />

      {filtersOpen ? (
        <AdminBranchFilters filters={filters} onChange={replaceFilters} />
      ) : null}

      {view.items.length === 0 ? (
        filtersApplied ? (
          <NoResultsState
            title="نتیجه‌ای یافت نشد"
            description="فیلترها را تغییر دهید یا جستجو را پاک کنید."
            action={
              <Button
                type="button"
                variant="secondary"
                onClick={() => replaceFilters({ q: undefined, active: "all", page: 1 })}
              >
                پاک کردن فیلترها
              </Button>
            }
          />
        ) : (
          <EmptyState
            title="شعبه‌ای ثبت نشده"
            description="اولین شعبه را اضافه کنید."
            action={
              canCreate ? (
                <Button asChild>
                  <Link href={adminBranchNewHref()}>افزودن شعبه</Link>
                </Button>
              ) : undefined
            }
          />
        )
      ) : (
        <>
          <div className="admin-branch-list-desktop">
            <AdminBranchListTable items={view.items} />
          </div>
          <div className="admin-branch-list-mobile">
            <AdminBranchListCards items={view.items} />
          </div>
          {view.totalPages > 1 ? (
            <Pagination
              page={view.page}
              pageCount={view.totalPages}
              onPageChange={(page) => replaceFilters({ page })}
            />
          ) : null}
        </>
      )}
    </>
  );
}
