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
import { AdminCustomerFilters } from "@/features/admin/customers/admin-customer-filters";
import {
  AdminCustomerListCards,
  AdminCustomerListTable,
} from "@/features/admin/customers/admin-customer-list-table";
import { PermissionGate } from "@/features/admin/permission-gate";
import { useSession } from "@/features/auth/session-provider";
import { adminCustomerListQueryOptions } from "@/lib/api/admin-customers";
import { isForbiddenError, isNotFoundError, toAppApiError } from "@/lib/api/errors";
import {
  adminCustomerFiltersApplied,
  adminCustomerHref,
  adminCustomerNewHref,
  countActiveAdminCustomerFilters,
  customerPermission,
  parseAdminCustomerFilters,
  sanitizeCustomerSearch,
} from "@/lib/admin/customer-filters";
import { hasPermission } from "@/lib/permissions/access";
import { routes } from "@/constants/routes";
import { ADMIN_CUSTOMER_SEARCH_MIN_LENGTH } from "@/types/admin-customer";
import type { AdminCustomerListFilters } from "@/types/admin-customer";

const SEARCH_DEBOUNCE_MS = 300;

export function AdminCustomerScreen() {
  const { status, user } = useSession();
  const searchParams = useSearchParams();
  const filters = parseAdminCustomerFilters(searchParams);
  const sessionReady = status === "authenticated" && Boolean(user?.id);

  if (status === "loading" || !sessionReady) {
    return (
      <>
        <AdminPageHeader title="مشتریان" description="در حال بارگذاری…" />
        <Skeleton variant="card" />
      </>
    );
  }

  return (
    <PermissionGate permission={customerPermission("view")}>
      <AdminCustomerScreenReady userId={user!.id} user={user!} filters={filters} />
    </PermissionGate>
  );
}

function AdminCustomerScreenReady({
  userId,
  user,
  filters,
}: {
  userId: string;
  user: NonNullable<ReturnType<typeof useSession>["user"]>;
  filters: AdminCustomerListFilters;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [draftQuery, setDraftQuery] = useState(filters.q ?? "");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const query = useQuery(adminCustomerListQueryOptions(userId, filters));
  const canCreate =
    hasPermission(user, customerPermission("create")) || user.permissionCodes.length === 0;

  const replaceFilters = useCallback(
    (next: Partial<AdminCustomerListFilters>) => {
      const merged = { ...filters, ...next, page: next.page ?? 1 };
      startTransition(() => {
        router.replace(adminCustomerHref(merged), { scroll: false });
      });
    },
    [filters, router, startTransition],
  );

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const q = sanitizeCustomerSearch(draftQuery);
      if (q !== filters.q) {
        replaceFilters({ q, page: 1 });
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [draftQuery, filters.q, replaceFilters]);

  if (query.isLoading) {
    return (
      <>
        <AdminPageHeader title="مشتریان" description="مدیریت مشتریان این کسب‌وکار." />
        <Skeleton variant="card" />
      </>
    );
  }

  if (query.isError) {
    const appError = toAppApiError(query.error);
    if (isForbiddenError(appError)) {
      return <ApiErrorState title="دسترسی محدود" description="مجوز مشاهده مشتریان را ندارید." />;
    }
    if (isNotFoundError(appError)) {
      return (
        <ApiErrorState
          title="مشتریان در دسترس نیست"
          description="سرویس مدیریت مشتریان هنوز به Backend متصل نشده است."
        />
      );
    }
    return <ApiErrorState description={appError.message} onRetry={() => void query.refetch()} />;
  }

  const view = query.data!;
  const activeFilterCount = countActiveAdminCustomerFilters(filters);
  const filtersApplied = adminCustomerFiltersApplied(filters) || view.filtersApplied;

  return (
    <>
      <AdminBreadcrumb pathname={routes.admin.customers} />
      <AdminPageHeader
        title="مشتریان"
        description="مدیریت مشتریان — نه CRM عمومی یا پرونده پزشکی."
        primaryAction={
          canCreate ? (
            <Button asChild>
              <Link href={adminCustomerNewHref()}>
                <Plus size={16} aria-hidden="true" />
                مشتری جدید
              </Link>
            </Button>
          ) : undefined
        }
        toolbar={
          <div className="admin-customer-toolbar">
            <SearchInput
              value={draftQuery}
              placeholder="جستجو نام، موبایل، ایمیل یا شناسه…"
              aria-label="جستجوی مشتریان"
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
      {draftQuery.length > 0 && draftQuery.length < ADMIN_CUSTOMER_SEARCH_MIN_LENGTH ? (
        <p className="ds-help">حداقل {ADMIN_CUSTOMER_SEARCH_MIN_LENGTH} کاراکتر برای جستجو.</p>
      ) : null}

      {filtersOpen ? (
        <AdminCustomerFilters
          filters={filters}
          options={view.filterOptions}
          onChange={replaceFilters}
        />
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
                onClick={() =>
                  replaceFilters({
                    q: undefined,
                    active: "all",
                    upcoming: "all",
                    lastVisitFrom: undefined,
                    lastVisitTo: undefined,
                    serviceId: undefined,
                    branchId: undefined,
                    tagId: undefined,
                    page: 1,
                  })
                }
              >
                پاک کردن فیلترها
              </Button>
            }
          />
        ) : (
          <EmptyState
            title="مشتری‌ای ثبت نشده"
            description="اولین مشتری را اضافه کنید یا از رزرو دستی استفاده کنید."
            action={
              canCreate ? (
                <Button asChild>
                  <Link href={adminCustomerNewHref()}>افزودن مشتری</Link>
                </Button>
              ) : undefined
            }
          />
        )
      ) : (
        <>
          <div className="admin-customer-list-desktop">
            <AdminCustomerListTable items={view.items} />
          </div>
          <div className="admin-customer-list-mobile">
            <AdminCustomerListCards items={view.items} />
          </div>
          {view.pageCount > 1 ? (
            <Pagination
              page={view.page}
              pageCount={view.pageCount}
              onPageChange={(page) => replaceFilters({ page })}
            />
          ) : null}
        </>
      )}
    </>
  );
}
