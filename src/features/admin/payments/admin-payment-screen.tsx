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
import { AdminPaymentFilters } from "@/features/admin/payments/admin-payment-filters";
import {
  AdminPaymentListCards,
  AdminPaymentListTable,
} from "@/features/admin/payments/admin-payment-list-table";
import { AdminPaymentRevenueSummary } from "@/features/admin/payments/admin-payment-revenue-summary";
import { AdminPaymentListSkeleton } from "@/features/admin/payments/admin-payment-skeleton";
import { PermissionGate } from "@/features/admin/permission-gate";
import { useSession } from "@/features/auth/session-provider";
import { adminPaymentListQueryOptions } from "@/lib/api/admin-payments";
import { isForbiddenError, isNotFoundError, toAppApiError } from "@/lib/api/errors";
import {
  adminPaymentFiltersApplied,
  adminPaymentsHref,
  countActiveAdminPaymentFilters,
  parseAdminPaymentFilters,
  paymentPermission,
} from "@/lib/admin/payment-filters";
import { sanitizePaymentSearchQuery } from "@/lib/customer/payment-history-filters";
import { hasPermission } from "@/lib/permissions/access";
import { routes } from "@/constants/routes";
import type { AdminPaymentListFilters } from "@/types/admin-payment";

const SEARCH_DEBOUNCE_MS = 300;

export function AdminPaymentsScreen() {
  const { status, user } = useSession();
  const searchParams = useSearchParams();
  const filters = parseAdminPaymentFilters(searchParams);
  const sessionReady = status === "authenticated" && Boolean(user?.id);

  if (status === "loading" || !sessionReady) {
    return (
      <>
        <AdminPageHeader title="پرداخت‌ها" description="در حال بارگذاری…" />
        <AdminPaymentListSkeleton />
      </>
    );
  }

  return (
    <PermissionGate permission={paymentPermission("view")}>
      <AdminPaymentsScreenReady userId={user!.id} user={user!} filters={filters} />
    </PermissionGate>
  );
}

function AdminPaymentsScreenReady({
  userId,
  user,
  filters,
}: {
  userId: string;
  user: NonNullable<ReturnType<typeof useSession>["user"]>;
  filters: AdminPaymentListFilters;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [draftQuery, setDraftQuery] = useState(filters.q ?? "");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const query = useQuery({
    ...adminPaymentListQueryOptions(userId, filters),
  });

  const canViewRevenue =
    hasPermission(user, paymentPermission("revenue")) || user.permissionCodes.length === 0;
  const showRevenue = canViewRevenue && (query.data?.revenueSummaryAvailable ?? false);

  const replaceFilters = useCallback(
    (next: Partial<AdminPaymentListFilters>) => {
      const merged = { ...filters, ...next, page: next.page ?? 1 };
      startTransition(() => {
        router.replace(adminPaymentsHref(merged), { scroll: false });
      });
    },
    [filters, router, startTransition],
  );

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const next = sanitizePaymentSearchQuery(draftQuery);
      if ((next ?? "") === (filters.q ?? "")) return;
      replaceFilters({ q: next, page: 1 });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [draftQuery, filters.q, replaceFilters]);

  const activeCount = countActiveAdminPaymentFilters(filters);
  const error = query.isError ? toAppApiError(query.error) : undefined;
  const items = query.data?.items ?? [];
  const showBranch =
    (query.data?.filterOptions?.branches?.length ?? 0) > 1 ||
    items.some((item) => Boolean(item.branch?.name));
  const emptyHistory = Boolean(
    query.data?.emptyHistory && !adminPaymentFiltersApplied(filters),
  );
  const noResults = Boolean(
    query.data &&
      items.length === 0 &&
      (query.data.filtersApplied || adminPaymentFiltersApplied(filters)) &&
      !emptyHistory,
  );

  function clearFilters() {
    setDraftQuery("");
    replaceFilters({
      q: undefined,
      status: "all",
      refundStatus: "all",
      method: "all",
      appointmentId: undefined,
      customerId: undefined,
      branchId: undefined,
      from: undefined,
      to: undefined,
      sort: "createdAt",
      direction: "desc",
      page: 1,
    });
  }

  return (
    <>
      <AdminPageHeader
        title="پرداخت‌ها"
        description="جستجو، فیلتر و مدیریت پرداخت‌های عملیاتی. مبالغ فقط از سرویس خوانده می‌شوند."
        breadcrumb={
          <AdminBreadcrumb
            pathname={routes.admin.payments}
            items={[
              { href: routes.admin.home, label: "پنل مدیریت" },
              { label: "پرداخت‌ها" },
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

      <div className="admin-payment-toolbar">
        <SearchInput
          value={draftQuery}
          onChange={(event) => setDraftQuery(event.target.value)}
          placeholder="کد پرداخت، تراکنش، نوبت یا مشتری"
          aria-label="جستجوی پرداخت"
        />
        <Button
          variant="secondary"
          leadingIcon={<SlidersHorizontal size={16} aria-hidden="true" />}
          onClick={() => setMobileFiltersOpen(true)}
        >
          فیلترها{activeCount > 0 ? ` (${activeCount})` : ""}
        </Button>
      </div>

      <AdminPaymentFilters
        filters={filters}
        options={query.data?.filterOptions}
        showBranchFilter={showBranch}
        mobileOpen={mobileFiltersOpen}
        onMobileOpenChange={setMobileFiltersOpen}
        onChange={replaceFilters}
        onClear={clearFilters}
      />

      <AdminPaymentRevenueSummary userId={userId} filters={filters} enabled={showRevenue} />

      {typeof query.data?.totalCount === "number" ? (
        <p className="admin-payment-result-count" aria-live="polite">
          {new Intl.NumberFormat("fa-IR").format(query.data.totalCount)} نتیجه
        </p>
      ) : null}

      <span className="visually-hidden" aria-live="polite">
        {query.isPending ? "در حال بارگذاری پرداخت‌ها." : ""}
        {query.isError ? "بارگذاری پرداخت‌ها با خطا روبه‌رو شد." : ""}
      </span>

      {query.isPending ? <AdminPaymentListSkeleton /> : null}

      {error ? (
        isForbiddenError(error) || isNotFoundError(error) ? (
          <PermissionDeniedState
            title="دسترسی به پرداخت‌ها ندارید"
            description="مجوز مشاهده پرداخت‌ها برای حساب شما فعال نیست."
          />
        ) : (
          <ApiErrorState
            title="پرداخت‌ها بارگذاری نشد"
            description={error.message}
            requestId={error.requestId}
            onRetry={() => void query.refetch()}
          />
        )
      ) : null}

      {!query.isPending && !error && emptyHistory ? (
        <EmptyState
          title="پرداختی ثبت نشده"
          description="هنوز پرداختی در این کسب‌وکار ثبت نشده است."
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
          <AdminPaymentListTable items={items} />
          <AdminPaymentListCards items={items} />
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
