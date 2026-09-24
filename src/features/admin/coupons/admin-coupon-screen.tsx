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
import { AdminCouponFilters } from "@/features/admin/coupons/admin-coupon-filters";
import {
  AdminCouponListCards,
  AdminCouponListTable,
} from "@/features/admin/coupons/admin-coupon-list-table";
import { AdminCouponListSkeleton } from "@/features/admin/coupons/admin-coupon-skeleton";
import { AdminCouponsGate } from "@/features/admin/coupons/admin-coupons-gate";
import { PermissionGate } from "@/features/admin/permission-gate";
import { useSession } from "@/features/auth/session-provider";
import { adminCouponListQueryOptions } from "@/lib/api/admin-coupons";
import { isForbiddenError, isNotFoundError, toAppApiError } from "@/lib/api/errors";
import {
  adminCouponFiltersApplied,
  adminCouponNewHref,
  adminCouponsHref,
  countActiveAdminCouponFilters,
  couponPermission,
  parseAdminCouponFilters,
  sanitizeCouponSearch,
} from "@/lib/admin/coupon-filters";
import { hasPermission } from "@/lib/permissions/access";
import { routes } from "@/constants/routes";
import type { AdminCouponListFilters } from "@/types/admin-coupon";

const SEARCH_DEBOUNCE_MS = 300;

export function AdminCouponsScreen() {
  const { status, user } = useSession();
  const searchParams = useSearchParams();
  const filters = parseAdminCouponFilters(searchParams);
  const sessionReady = status === "authenticated" && Boolean(user?.id);

  if (status === "loading" || !sessionReady) {
    return (
      <>
        <AdminPageHeader title="کوپن‌ها" description="در حال بارگذاری…" />
        <AdminCouponListSkeleton />
      </>
    );
  }

  return (
    <PermissionGate permission={couponPermission("view")}>
      <AdminCouponsGate>
        <AdminCouponsScreenReady userId={user!.id} user={user!} filters={filters} />
      </AdminCouponsGate>
    </PermissionGate>
  );
}

function AdminCouponsScreenReady({
  userId,
  user,
  filters,
}: {
  userId: string;
  user: NonNullable<ReturnType<typeof useSession>["user"]>;
  filters: AdminCouponListFilters;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [draftQuery, setDraftQuery] = useState(filters.q ?? "");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const query = useQuery({
    ...adminCouponListQueryOptions(userId, filters),
  });

  const canCreate =
    hasPermission(user, couponPermission("create")) || user.permissionCodes.length === 0;

  const replaceFilters = useCallback(
    (next: Partial<AdminCouponListFilters>) => {
      const merged = { ...filters, ...next, page: next.page ?? 1 };
      startTransition(() => {
        router.replace(adminCouponsHref(merged), { scroll: false });
      });
    },
    [filters, router, startTransition],
  );

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const next = sanitizeCouponSearch(draftQuery);
      if ((next ?? "") === (filters.q ?? "")) return;
      replaceFilters({ q: next, page: 1 });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [draftQuery, filters.q, replaceFilters]);

  const activeCount = countActiveAdminCouponFilters(filters);
  const error = query.isError ? toAppApiError(query.error) : undefined;
  const items = query.data?.items ?? [];
  const showBranch = (query.data?.filterOptions?.branches?.length ?? 0) > 1;
  const emptyHistory = Boolean(
    query.data?.emptyHistory && !adminCouponFiltersApplied(filters),
  );
  const noResults = Boolean(
    query.data &&
      items.length === 0 &&
      (query.data.filtersApplied || adminCouponFiltersApplied(filters)) &&
      !emptyHistory,
  );

  function clearFilters() {
    setDraftQuery("");
    replaceFilters({
      q: undefined,
      status: "all",
      discountType: "all",
      validity: "all",
      serviceId: undefined,
      branchId: undefined,
      sort: "updatedAt",
      direction: "desc",
      page: 1,
    });
  }

  return (
    <>
      <AdminPageHeader
        title="کوپن‌ها"
        description="مدیریت کدهای تخفیف. وضعیت و مبالغ فقط از سرویس خوانده می‌شوند."
        breadcrumb={
          <AdminBreadcrumb
            pathname={routes.admin.coupons}
            items={[
              { href: routes.admin.home, label: "پنل مدیریت" },
              { label: "کوپن‌ها" },
            ]}
          />
        }
        primaryAction={
          canCreate ? (
            <Button asChild leadingIcon={<Plus size={16} aria-hidden="true" />}>
              <Link href={adminCouponNewHref()}>کوپن جدید</Link>
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

      <div className="admin-coupon-toolbar">
        <SearchInput
          value={draftQuery}
          onChange={(event) => setDraftQuery(event.target.value)}
          placeholder="کد یا عنوان داخلی"
          aria-label="جستجوی کوپن"
        />
        <Button
          variant="secondary"
          leadingIcon={<SlidersHorizontal size={16} aria-hidden="true" />}
          onClick={() => setMobileFiltersOpen(true)}
        >
          فیلترها{activeCount > 0 ? ` (${activeCount})` : ""}
        </Button>
      </div>

      <AdminCouponFilters
        filters={filters}
        options={query.data?.filterOptions}
        showBranchFilter={showBranch}
        mobileOpen={mobileFiltersOpen}
        onMobileOpenChange={setMobileFiltersOpen}
        onChange={replaceFilters}
        onClear={clearFilters}
      />

      {typeof query.data?.totalCount === "number" ? (
        <p className="admin-coupon-result-count" aria-live="polite">
          {new Intl.NumberFormat("fa-IR").format(query.data.totalCount)} نتیجه
        </p>
      ) : null}

      <span className="visually-hidden" aria-live="polite">
        {query.isPending ? "در حال بارگذاری کوپن‌ها." : ""}
        {query.isError ? "بارگذاری کوپن‌ها با خطا روبه‌رو شد." : ""}
      </span>

      {query.isPending ? <AdminCouponListSkeleton /> : null}

      {error ? (
        isForbiddenError(error) || isNotFoundError(error) ? (
          <PermissionDeniedState
            title="دسترسی به کوپن‌ها ندارید"
            description="مجوز مشاهده کوپن‌ها برای حساب شما فعال نیست."
          />
        ) : (
          <ApiErrorState
            title="کوپن‌ها بارگذاری نشد"
            description={error.message}
            requestId={error.requestId}
            onRetry={() => void query.refetch()}
          />
        )
      ) : null}

      {!query.isPending && !error && emptyHistory ? (
        <EmptyState
          title="کوپنی ثبت نشده"
          description="هنوز کوپن تخفیفی ایجاد نشده است."
          action={
            canCreate ? (
              <Button asChild>
                <Link href={adminCouponNewHref()}>ایجاد اولین کوپن</Link>
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
          <AdminCouponListTable items={items} />
          <AdminCouponListCards items={items} />
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
