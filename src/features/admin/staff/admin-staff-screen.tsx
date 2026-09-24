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
import { AdminStaffFilters } from "@/features/admin/staff/admin-staff-filters";
import { AdminStaffListCards, AdminStaffListTable } from "@/features/admin/staff/admin-staff-list-table";
import { PermissionGate } from "@/features/admin/permission-gate";
import { useSession } from "@/features/auth/session-provider";
import { adminStaffListQueryOptions } from "@/lib/api/admin-staff";
import { isForbiddenError, isNotFoundError, toAppApiError } from "@/lib/api/errors";
import {
  adminStaffFiltersApplied,
  adminStaffHref,
  countActiveAdminStaffFilters,
  parseAdminStaffFilters,
  sanitizeStaffSearch,
} from "@/lib/admin/staff-filters";
import { isCapabilityVisible, getBusinessCapabilities } from "@/config/capabilities";
import { fetchPublicBusiness } from "@/lib/api/public";
import { hasPermission } from "@/lib/permissions/access";
import { queryKeys } from "@/lib/query/keys";
import { routes } from "@/constants/routes";
import type { AdminStaffListFilters } from "@/types/admin-staff";

const SEARCH_DEBOUNCE_MS = 300;

export function AdminStaffScreen() {
  const { status, user } = useSession();
  const searchParams = useSearchParams();
  const filters = parseAdminStaffFilters(searchParams);
  const sessionReady = status === "authenticated" && Boolean(user?.id);

  if (status === "loading" || !sessionReady) {
    return (
      <>
        <AdminPageHeader title="کارکنان" description="مدیریت پرسنل و ارائه‌دهندگان." />
        <Skeleton variant="card" />
      </>
    );
  }

  return (
    <PermissionGate permission="admin.staff.view">
      <AdminStaffScreenReady userId={user!.id} user={user!} filters={filters} />
    </PermissionGate>
  );
}

function AdminStaffScreenReady({
  userId,
  user,
  filters,
}: {
  userId: string;
  user: NonNullable<ReturnType<typeof useSession>["user"]>;
  filters: AdminStaffListFilters;
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

  const query = useQuery(adminStaffListQueryOptions(userId, filters));
  const canCreate =
    hasPermission(user, "admin.staff.create") || user.permissionCodes.length === 0;

  const replaceFilters = useCallback(
    (next: Partial<AdminStaffListFilters>) => {
      const merged = { ...filters, ...next, page: next.page ?? 1 };
      startTransition(() => {
        router.replace(adminStaffHref(merged), { scroll: false });
      });
    },
    [filters, router, startTransition],
  );

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const next = sanitizeStaffSearch(draftQuery);
      if ((next ?? "") === (filters.q ?? "")) return;
      replaceFilters({ q: next, page: 1 });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [draftQuery, filters.q, replaceFilters]);

  const activeCount = countActiveAdminStaffFilters(filters);
  const error = query.isError ? toAppApiError(query.error) : undefined;
  const items = query.data?.items ?? [];
  const filtersApplied =
    adminStaffFiltersApplied(filters) || Boolean(query.data?.filtersApplied);
  const emptyCatalog = Boolean(query.data && items.length === 0 && !filtersApplied);
  const noResults = Boolean(query.data && items.length === 0 && filtersApplied && !emptyCatalog);

  return (
    <>
      <AdminPageHeader
        title="کارکنان"
        description="پرسنل داخلی، ارائه‌دهندگان قابل رزرو، و نمایش مشتری — جدا از حساب‌های مدیریت."
        breadcrumb={
          <AdminBreadcrumb
            pathname={routes.admin.staff}
            items={[
              { href: routes.admin.home, label: "پنل مدیریت" },
              { label: "کارکنان" },
            ]}
          />
        }
        primaryAction={
          canCreate ? (
            <Button asChild leadingIcon={<Plus size={16} aria-hidden="true" />}>
              <Link href={routes.admin.staffNew}>کارمند جدید</Link>
            </Button>
          ) : null
        }
      />

      <div className="admin-staff-toolbar">
        <SearchInput
          aria-label="جستجوی کارمند"
          value={draftQuery}
          loading={query.isFetching}
          onChange={(event) => setDraftQuery(event.target.value)}
          onClear={() => setDraftQuery("")}
          placeholder="نام، سمت یا شناسه"
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
              isNotFoundError(error) ? "فهرست کارکنان در دسترس نیست" : "فهرست کارکنان بارگذاری نشد"
            }
            description={
              isNotFoundError(error)
                ? "Backend باید GET /admin/staff را ارائه کند."
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
              title="کارمندی ثبت نشده"
              description="اولین عضو تیم را اضافه کنید. حساب مدیریت جداگانه در بخش کاربران است."
              action={
                canCreate ? (
                  <Button asChild>
                    <Link href={routes.admin.staffNew}>افزودن کارمند</Link>
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
              <div className="admin-staff-desktop">
                <AdminStaffListTable items={items} showBranch={showBranch} />
              </div>
              <div className="admin-staff-mobile">
                <AdminStaffListCards items={items} />
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

      <AdminStaffFilters
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        filters={filters}
        options={query.data?.filterOptions}
        showBranch={showBranch}
        onChange={replaceFilters}
        onClear={() =>
          replaceFilters({
            q: undefined,
            active: "all",
            customerVisible: "all",
            bookable: "all",
            branchId: undefined,
            serviceId: undefined,
            jobTitle: undefined,
            specialty: undefined,
            page: 1,
          })
        }
      />
    </>
  );
}
