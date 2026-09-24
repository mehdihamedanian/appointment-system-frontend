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
import { AdminWaitingListFilters } from "@/features/admin/waiting-list/admin-waiting-list-filters";
import {
  AdminWaitingListListCards,
  AdminWaitingListListTable,
} from "@/features/admin/waiting-list/admin-waiting-list-list-table";
import { AdminWaitingListListSkeleton } from "@/features/admin/waiting-list/admin-waiting-list-skeleton";
import { AdminWaitingListGate } from "@/features/admin/waiting-list/admin-waiting-list-gate";
import { PermissionGate } from "@/features/admin/permission-gate";
import { useSession } from "@/features/auth/session-provider";
import { adminWaitingListQueryOptions } from "@/lib/api/admin-waiting-list";
import { isForbiddenError, isNotFoundError, toAppApiError } from "@/lib/api/errors";
import {
  adminWaitingListFiltersApplied,
  adminWaitingListNewHref,
  adminWaitingListHref,
  countActiveAdminWaitingListFilters,
  parseAdminWaitingListFilters,
  sanitizeWaitingListSearch,
  waitingListPermission,
} from "@/lib/admin/waiting-list-filters";
import { hasPermission } from "@/lib/permissions/access";
import { routes } from "@/constants/routes";
import type { AdminWaitingListListFilters } from "@/types/admin-waiting-list";

const SEARCH_DEBOUNCE_MS = 300;

export function AdminWaitingListScreen() {
  const { status, user } = useSession();
  const searchParams = useSearchParams();
  const filters = parseAdminWaitingListFilters(searchParams);
  const sessionReady = status === "authenticated" && Boolean(user?.id);

  if (status === "loading" || !sessionReady) {
    return (
      <>
        <AdminPageHeader title="لیست انتظار" description="در حال بارگذاری…" />
        <AdminWaitingListListSkeleton />
      </>
    );
  }

  return (
    <PermissionGate permission={waitingListPermission("view")}>
      <AdminWaitingListGate>
        <AdminWaitingListScreenReady userId={user!.id} user={user!} filters={filters} />
      </AdminWaitingListGate>
    </PermissionGate>
  );
}

function AdminWaitingListScreenReady({
  userId,
  user,
  filters,
}: {
  userId: string;
  user: NonNullable<ReturnType<typeof useSession>["user"]>;
  filters: AdminWaitingListListFilters;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [draftQuery, setDraftQuery] = useState(filters.q ?? "");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const query = useQuery({
    ...adminWaitingListQueryOptions(userId, filters),
  });

  const canCreate =
    hasPermission(user, waitingListPermission("create")) || user.permissionCodes.length === 0;

  const replaceFilters = useCallback(
    (next: Partial<AdminWaitingListListFilters>) => {
      const merged = { ...filters, ...next, page: next.page ?? 1 };
      startTransition(() => {
        router.replace(adminWaitingListHref(merged), { scroll: false });
      });
    },
    [filters, router, startTransition],
  );

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const next = sanitizeWaitingListSearch(draftQuery);
      if ((next ?? "") === (filters.q ?? "")) return;
      replaceFilters({ q: next, page: 1 });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [draftQuery, filters.q, replaceFilters]);

  const activeCount = countActiveAdminWaitingListFilters(filters);
  const error = query.isError ? toAppApiError(query.error) : undefined;
  const items = query.data?.items ?? [];
  const showBranch = (query.data?.filterOptions?.branches?.length ?? 0) > 1;
  const emptyHistory = Boolean(
    query.data?.emptyHistory && !adminWaitingListFiltersApplied(filters),
  );
  const noResults = Boolean(
    query.data &&
      items.length === 0 &&
      (query.data.filtersApplied || adminWaitingListFiltersApplied(filters)) &&
      !emptyHistory,
  );

  function clearFilters() {
    setDraftQuery("");
    replaceFilters({
      q: undefined,
      entryStatus: "all",
      offerStatus: "all",
      serviceId: undefined,
      providerId: undefined,
      branchId: undefined,
      preferredFrom: undefined,
      preferredTo: undefined,
      createdFrom: undefined,
      createdTo: undefined,
      sort: "createdAt",
      direction: "desc",
      page: 1,
    });
  }

  return (
    <>
      <AdminPageHeader
        title="لیست انتظار"
        description="مدیریت درخواست‌ها و ارسال پیشنهاد زمان. وضعیت‌ها فقط از سرویس خوانده می‌شوند."
        breadcrumb={
          <AdminBreadcrumb
            pathname={routes.admin.waitingList}
            items={[
              { href: routes.admin.home, label: "پنل مدیریت" },
              { label: "لیست انتظار" },
            ]}
          />
        }
        primaryAction={
          canCreate ? (
            <Button asChild leadingIcon={<Plus size={16} aria-hidden="true" />}>
              <Link href={adminWaitingListNewHref()}>ثبت درخواست</Link>
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

      <div className="admin-waiting-list-toolbar">
        <SearchInput
          value={draftQuery}
          onChange={(event) => setDraftQuery(event.target.value)}
          placeholder="نام مشتری، خدمت یا شناسه"
          aria-label="جستجوی لیست انتظار"
        />
        <Button
          variant="secondary"
          leadingIcon={<SlidersHorizontal size={16} aria-hidden="true" />}
          onClick={() => setMobileFiltersOpen(true)}
        >
          فیلترها{activeCount > 0 ? ` (${activeCount})` : ""}
        </Button>
      </div>

      <AdminWaitingListFilters
        filters={filters}
        options={query.data?.filterOptions}
        showBranchFilter={showBranch}
        mobileOpen={mobileFiltersOpen}
        onMobileOpenChange={setMobileFiltersOpen}
        onChange={replaceFilters}
        onClear={clearFilters}
      />

      {typeof query.data?.totalCount === "number" ? (
        <p className="admin-waiting-list-result-count" aria-live="polite">
          {new Intl.NumberFormat("fa-IR").format(query.data.totalCount)} نتیجه
        </p>
      ) : null}

      <span className="visually-hidden" aria-live="polite">
        {query.isPending ? "در حال بارگذاری لیست انتظار." : ""}
        {query.isError ? "بارگذاری لیست انتظار با خطا روبه‌رو شد." : ""}
      </span>

      {query.isPending ? <AdminWaitingListListSkeleton /> : null}

      {error ? (
        isForbiddenError(error) || isNotFoundError(error) ? (
          <PermissionDeniedState
            title="دسترسی به لیست انتظار ندارید"
            description="مجوز مشاهده لیست انتظار برای حساب شما فعال نیست."
          />
        ) : (
          <ApiErrorState
            title="لیست انتظار بارگذاری نشد"
            description={error.message}
            requestId={error.requestId}
            onRetry={() => void query.refetch()}
          />
        )
      ) : null}

      {!query.isPending && !error && emptyHistory ? (
        <EmptyState
          title="درخواستی ثبت نشده"
          description="هنوز درخواستی در لیست انتظار ثبت نشده است."
          action={
            canCreate ? (
              <Button asChild>
                <Link href={adminWaitingListNewHref()}>ثبت اولین درخواست</Link>
              </Button>
            ) : undefined
          }
        />
      ) : null}

      {!query.isPending && !error && noResults ? (
        <NoResultsState
          title="نتیجه‌ای یافت نشد"
          description="فیلترها یا عبارت جستجو را تغییر دهید."
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
          <AdminWaitingListListTable items={items} />
          <AdminWaitingListListCards items={items} />
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
