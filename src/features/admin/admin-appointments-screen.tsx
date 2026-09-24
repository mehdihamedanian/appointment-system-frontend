"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
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
import { AdminAppointmentFilters } from "@/features/admin/admin-appointment-filters";
import {
  AdminAppointmentListCards,
  AdminAppointmentListTable,
} from "@/features/admin/admin-appointment-list-table";
import { AdminAppointmentListSkeleton } from "@/features/admin/admin-appointment-skeleton";
import { PermissionGate } from "@/features/admin/permission-gate";
import { useSession } from "@/features/auth/session-provider";
import { adminAppointmentListQueryOptions } from "@/lib/api/admin-appointments";
import { isForbiddenError, isNotFoundError, toAppApiError } from "@/lib/api/errors";
import {
  adminAppointmentFiltersApplied,
  adminAppointmentsHref,
  countActiveAdminAppointmentFilters,
  parseAdminAppointmentFilters,
  sanitizeSearchQuery,
} from "@/lib/admin/appointment-filters";
import { hasPermission } from "@/lib/permissions/access";
import { routes } from "@/constants/routes";
import type { AdminAppointmentListFilters } from "@/types/admin-appointment";

const SEARCH_DEBOUNCE_MS = 300;

export function AdminAppointmentsScreen() {
  const { status, user } = useSession();
  const searchParams = useSearchParams();
  const filters = parseAdminAppointmentFilters(searchParams);
  const sessionReady = status === "authenticated" && Boolean(user?.id);

  if (status === "loading" || !sessionReady) {
    return (
      <>
        <AdminPageHeader
          title="نوبت‌ها"
          description="جستجو، فیلتر و مدیریت نوبت‌های عملیاتی."
          breadcrumb={
            <AdminBreadcrumb
              pathname={routes.admin.appointments}
              items={[
                { href: routes.admin.home, label: "پنل مدیریت" },
                { label: "نوبت‌ها" },
              ]}
            />
          }
        />
        <AdminAppointmentListSkeleton />
      </>
    );
  }

  return (
    <PermissionGate permission="admin.appointments.view">
      <AdminAppointmentsScreenReady userId={user!.id} user={user!} filters={filters} />
    </PermissionGate>
  );
}

function AdminAppointmentsScreenReady({
  userId,
  user,
  filters,
}: {
  userId: string;
  user: NonNullable<ReturnType<typeof useSession>["user"]>;
  filters: AdminAppointmentListFilters;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [draftQuery, setDraftQuery] = useState(filters.q ?? "");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const showResourceFilter = hasPermission(user, "admin.resources.view");

  const query = useQuery({
    ...adminAppointmentListQueryOptions(userId, filters),
  });

  const replaceFilters = useCallback(
    (next: Partial<AdminAppointmentListFilters>) => {
      const merged = { ...filters, ...next, page: next.page ?? 1 };
      startTransition(() => {
        router.replace(adminAppointmentsHref(merged), { scroll: false });
      });
    },
    [filters, router, startTransition],
  );

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const next = sanitizeSearchQuery(draftQuery);
      if ((next ?? "") === (filters.q ?? "")) return;
      replaceFilters({ q: next, page: 1 });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [draftQuery, filters.q, replaceFilters]);

  const activeCount = countActiveAdminAppointmentFilters(filters);
  const error = query.isError ? toAppApiError(query.error) : undefined;
  const items = query.data?.items ?? [];
  const showBranch = items.some((item) => Boolean(item.branch?.name));
  const showResource =
    showResourceFilter && items.some((item) => Boolean(item.resourceName));
  const emptyHistory = Boolean(query.data?.emptyHistory && !adminAppointmentFiltersApplied(filters));
  const noResults = Boolean(
    query.data &&
      items.length === 0 &&
      (query.data.filtersApplied || adminAppointmentFiltersApplied(filters)) &&
      !emptyHistory,
  );

  function clearFilters() {
    setDraftQuery("");
    replaceFilters({
      q: undefined,
      date: undefined,
      from: undefined,
      to: undefined,
      status: "all",
      paymentStatus: "all",
      serviceId: undefined,
      staffId: undefined,
      resourceId: undefined,
      customerId: undefined,
      branchId: undefined,
      bookingSource: undefined,
      sort: "startsAt",
      direction: "desc",
      page: 1,
    });
  }

  return (
    <>
      <AdminPageHeader
        title="نوبت‌ها"
        description="جستجو، فیلتر و مدیریت نوبت‌های عملیاتی."
        breadcrumb={
          <AdminBreadcrumb
            pathname={routes.admin.appointments}
            items={[
              { href: routes.admin.home, label: "پنل مدیریت" },
              { label: "نوبت‌ها" },
            ]}
          />
        }
        toolbar={
          <div className="admin-appointment-toolbar">
            <SearchInput
              value={draftQuery}
              onChange={(event) => setDraftQuery(event.target.value)}
              placeholder="جستجو بر اساس مشتری، کد رزرو یا خدمت"
              aria-label="جستجوی نوبت"
            />
            <AdminAppointmentFilters
              filters={filters}
              options={query.data?.filterOptions}
              activeCount={activeCount}
              showResourceFilter={showResourceFilter}
              mobileOpen={mobileFiltersOpen}
              onMobileOpenChange={setMobileFiltersOpen}
              onChange={replaceFilters}
              onClear={clearFilters}
            />
          </div>
        }
      />

      {query.isPending ? <AdminAppointmentListSkeleton /> : null}

      {error ? (
        isForbiddenError(error) ? (
          <PermissionDeniedState description="مجوز لازم برای مشاهده نوبت‌ها را ندارید." />
        ) : isNotFoundError(error) ? (
          <ApiErrorState
            title="فهرست نوبت‌ها در دسترس نیست"
            description="Backend هنوز endpoint مدیریت نوبت‌ها را ارائه نکرده است."
            requestId={error.requestId}
            onRetry={() => void query.refetch()}
          />
        ) : (
          <ApiErrorState
            title="نوبت‌ها بارگذاری نشد"
            description={error.message}
            requestId={error.requestId}
            onRetry={() => void query.refetch()}
          />
        )
      ) : null}

      {!query.isPending && !error && query.data ? (
        <>
          {emptyHistory ? (
            <EmptyState
              title="هنوز نوبتی ثبت نشده"
              description="وقتی نوبتی ثبت شود، اینجا نمایش داده می‌شود."
            />
          ) : noResults ? (
            <NoResultsState
              title="نتیجه‌ای پیدا نشد"
              description="عبارت یا فیلتر دیگری را امتحان کنید."
              action={
                activeCount > 0 ? (
                  <Button variant="secondary" onClick={clearFilters}>
                    پاک کردن فیلترها
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <>
              <AdminAppointmentListTable
                items={items}
                showBranch={showBranch}
                showResource={showResource}
              />
              <AdminAppointmentListCards items={items} />
            </>
          )}
          {query.data.pageCount && query.data.pageCount > 1 ? (
            <Pagination
              page={filters.page}
              pageCount={query.data.pageCount}
              disabled={query.isFetching}
              onPageChange={(page) => replaceFilters({ page })}
            />
          ) : null}
        </>
      ) : null}
    </>
  );
}
