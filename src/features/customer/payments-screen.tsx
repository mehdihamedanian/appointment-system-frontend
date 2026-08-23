"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CreditCard, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
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
import { PaymentHistoryCard } from "@/features/customer/payment-history-card";
import { PaymentHistoryTable } from "@/features/customer/payment-history-table";
import { PaymentListSkeleton } from "@/features/customer/payment-list-skeleton";
import { useSession } from "@/features/auth/session-provider";
import {
  customerPaymentHistoryQueryOptions,
  fetchCustomerPaymentHistory,
} from "@/lib/api/customer-payments";
import { isForbiddenError, isNotFoundError, toAppApiError } from "@/lib/api/errors";
import {
  parsePaymentHistoryFilters,
  paymentsHref,
  sanitizeIsoDate,
  sanitizePaymentSearchQuery,
} from "@/lib/customer/payment-history-filters";
import { routes } from "@/constants/routes";
import {
  PAYMENT_HISTORY_STATUS_FILTERS,
  PAYMENT_HISTORY_STATUS_LABELS,
  type PaymentHistoryFilters,
  type PaymentHistoryItemView,
  type PaymentHistoryListView,
  type PaymentHistoryStatusFilter,
} from "@/types/payment-history";

const SEARCH_DEBOUNCE_MS = 300;

const STATUS_OPTIONS = PAYMENT_HISTORY_STATUS_FILTERS.map((value) => ({
  value,
  label: PAYMENT_HISTORY_STATUS_LABELS[value],
}));

function PaymentListBody({
  filters,
  data,
}: {
  filters: PaymentHistoryFilters;
  data: PaymentHistoryListView;
}) {
  const [extraItems, setExtraItems] = useState<PaymentHistoryItemView[]>([]);
  const [extraCursor, setExtraCursor] = useState<string | undefined>(data.nextCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(data.hasMore && !data.pageCount);
  const loadLock = useRef(false);

  const items = [
    ...data.items,
    ...extraItems.filter((item) => !data.items.some((current) => current.id === item.id)),
  ];
  const canLoadMore = hasMore || Boolean(extraCursor && !data.pageCount);

  async function onLoadMore() {
    if (loadLock.current || !canLoadMore) {
      return;
    }
    loadLock.current = true;
    setLoadingMore(true);
    try {
      const next = await fetchCustomerPaymentHistory(
        { ...filters, page: filters.page + 1 },
        undefined,
        extraCursor,
      );
      setExtraItems((current) => {
        const seen = new Set([...data.items, ...current].map((item) => item.id));
        return [...current, ...next.items.filter((item) => !seen.has(item.id))];
      });
      setExtraCursor(next.nextCursor);
      setHasMore(Boolean(next.hasMore || next.nextCursor) && !next.pageCount);
    } finally {
      loadLock.current = false;
      setLoadingMore(false);
    }
  }

  return (
    <>
      <div className="payment-list payment-list--cards">
        <ul className="payment-list">
          {items.map((item) => (
            <li key={item.id}>
              <PaymentHistoryCard item={item} />
            </li>
          ))}
        </ul>
      </div>
      <div className="payment-list payment-list--table">
        <PaymentHistoryTable items={items} />
      </div>
      {canLoadMore ? (
        <Button variant="secondary" onClick={() => void onLoadMore()} loading={loadingMore}>
          نمایش پرداخت‌های بیشتر
        </Button>
      ) : null}
    </>
  );
}

export function PaymentsScreen() {
  const { status, user } = useSession();
  const searchParams = useSearchParams();
  const filters = parsePaymentHistoryFilters(searchParams);
  const sessionReady = status === "authenticated" && Boolean(user?.id);

  if (status === "loading" || status === "unauthenticated" || status === "expired" || !sessionReady) {
    return (
      <div className="payments-page">
        <PageHeader title="پرداخت‌ها" description="سوابق پرداخت این حساب پس از ورود نمایش داده می‌شود." />
        <PaymentListSkeleton />
      </div>
    );
  }

  return (
    <PaymentsScreenReady
      key={`${filters.status}:${filters.q ?? ""}:${filters.from ?? ""}:${filters.to ?? ""}:${filters.appointmentId ?? ""}`}
      userId={user!.id}
      filters={filters}
    />
  );
}

function PaymentsScreenReady({
  userId,
  filters,
}: {
  userId: string;
  filters: PaymentHistoryFilters;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [draftQuery, setDraftQuery] = useState(filters.q ?? "");
  const [draftFrom, setDraftFrom] = useState(filters.from ?? "");
  const [draftTo, setDraftTo] = useState(filters.to ?? "");

  const query = useQuery({
    ...customerPaymentHistoryQueryOptions(userId, filters),
  });

  const error = query.isError ? toAppApiError(query.error) : undefined;

  const replaceFilters = useCallback(
    (next: Partial<PaymentHistoryFilters>) => {
      const merged: PaymentHistoryFilters = {
        status: next.status ?? filters.status,
        page: next.page ?? 1,
      };
      const q = next.q !== undefined ? next.q : filters.q;
      if (q) merged.q = q;
      const appointmentId =
        next.appointmentId !== undefined ? next.appointmentId : filters.appointmentId;
      if (appointmentId) merged.appointmentId = appointmentId;
      const from = next.from !== undefined ? next.from : filters.from;
      if (from) merged.from = from;
      const to = next.to !== undefined ? next.to : filters.to;
      if (to) merged.to = to;
      startTransition(() => {
        router.replace(paymentsHref(merged), { scroll: false });
      });
    },
    [filters, router, startTransition],
  );

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const next = sanitizePaymentSearchQuery(draftQuery);
      if ((next ?? "") === (filters.q ?? "")) {
        return;
      }
      replaceFilters({ q: next, page: 1 });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [draftQuery, filters.q, replaceFilters]);

  const hasItems = Boolean(query.data && query.data.items.length > 0);
  const emptyHistory = Boolean(query.data?.emptyHistory && !query.data.filtersApplied);
  const noResults = Boolean(
    query.data &&
      query.data.items.length === 0 &&
      (query.data.filtersApplied || !query.data.emptyHistory) &&
      !emptyHistory,
  );

  return (
    <div className="payments-page">
      <PageHeader
        title="پرداخت‌ها"
        description="سوابق پرداخت مرتبط با نوبت‌های شما. مبالغ و وضعیت‌ها فقط از سرویس خوانده می‌شوند."
        secondaryActions={
          <Button
            variant="secondary"
            leadingIcon={<RefreshCw size={16} aria-hidden="true" />}
            onClick={() => {
              void query.refetch();
            }}
            loading={query.isFetching && !query.isPending}
          >
            به‌روزرسانی
          </Button>
        }
      />
      <span className="visually-hidden" aria-live="polite">
        {query.isPending ? "در حال بارگذاری پرداخت‌ها." : ""}
        {query.isError ? "بارگذاری پرداخت‌ها با خطا روبه‌رو شد." : ""}
        {!query.isPending && !query.isError && emptyHistory ? "هنوز پرداختی ثبت نشده است." : ""}
        {!query.isPending && !query.isError && noResults ? "نتیجه‌ای برای این فیلترها نیست." : ""}
      </span>

      <section className="payment-filters" aria-label="فیلتر پرداخت‌ها">
        <div className="payment-filters__row">
          <div className="payment-filters__field">
            <Label htmlFor="payment-search">جستجو</Label>
            <SearchInput
              id="payment-search"
              value={draftQuery}
              placeholder="کد پرداخت یا رزرو"
              onChange={(event) => setDraftQuery(event.target.value)}
              onClear={() => {
                setDraftQuery("");
                replaceFilters({ q: undefined, page: 1 });
              }}
              loading={query.isFetching && Boolean(filters.q)}
            />
          </div>
          <div className="payment-filters__field">
            <Label htmlFor="payment-status">وضعیت</Label>
            <Select
              id="payment-status"
              value={filters.status}
              options={STATUS_OPTIONS}
              onChange={(value) =>
                replaceFilters({
                  status: (value as PaymentHistoryStatusFilter | undefined) ?? "all",
                  page: 1,
                })
              }
            />
          </div>
        </div>
        <div className="payment-filters__row">
          <div className="payment-filters__field">
            <Label htmlFor="payment-from">از تاریخ</Label>
            <input
              id="payment-from"
              className="ds-control ltr-value"
              type="date"
              value={draftFrom}
              onChange={(event) => setDraftFrom(event.target.value)}
              onBlur={() => {
                const next = sanitizeIsoDate(draftFrom);
                if ((next ?? "") !== (filters.from ?? "")) {
                  replaceFilters({ from: next, page: 1 });
                }
              }}
            />
          </div>
          <div className="payment-filters__field">
            <Label htmlFor="payment-to">تا تاریخ</Label>
            <input
              id="payment-to"
              className="ds-control ltr-value"
              type="date"
              value={draftTo}
              onChange={(event) => setDraftTo(event.target.value)}
              onBlur={() => {
                const next = sanitizeIsoDate(draftTo);
                if ((next ?? "") !== (filters.to ?? "")) {
                  replaceFilters({ to: next, page: 1 });
                }
              }}
            />
          </div>
          {filters.appointmentId ? (
            <div className="payment-filters__chip">
              <span className="text-caption">
                فیلتر نوبت: <span className="ltr-value">{filters.appointmentId}</span>
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => replaceFilters({ appointmentId: undefined, page: 1 })}
              >
                حذف فیلتر نوبت
              </Button>
            </div>
          ) : null}
        </div>
      </section>

      {query.isPending ? <PaymentListSkeleton /> : null}
      {error ? (
        isForbiddenError(error) ? (
          <PermissionDeniedState description="برای مشاهده سوابق پرداخت مجوز لازم را ندارید." />
        ) : (
          <ApiErrorState
            title={isNotFoundError(error) ? "سوابق پرداخت هنوز متصل نیست" : "پرداخت‌ها بارگذاری نشد"}
            description={
              isNotFoundError(error)
                ? "سرویس فهرست پرداخت‌های مشتری هنوز در دسترس نیست. فهرستی ساخته نشد."
                : error.message
            }
            requestId={error.requestId}
            onRetry={() => {
              void query.refetch();
            }}
          />
        )
      ) : null}

      {!query.isPending && !error && emptyHistory ? (
        <EmptyState
          title="هنوز پرداختی ندارید"
          description="پس از پرداخت آنلاین برای نوبت، سوابق اینجا نمایش داده می‌شود."
          action={
            <Button asChild>
              <Link href={routes.customer.booking}>رزرو نوبت</Link>
            </Button>
          }
          icon={<CreditCard size={20} aria-hidden="true" />}
        />
      ) : null}

      {!query.isPending && !error && noResults ? (
        <NoResultsState
          title="نتیجه‌ای پیدا نشد"
          description="فیلترها را تغییر دهید یا جستجو را پاک کنید."
          action={
            <Button
              variant="secondary"
              onClick={() => {
                router.replace(routes.customer.payments);
              }}
            >
              پاک کردن فیلترها
            </Button>
          }
        />
      ) : null}

      {!query.isPending && !error && hasItems && query.data ? (
        <>
          {typeof query.data.totalCount === "number" ? (
            <p className="text-caption payment-total">
              تعداد کل: <span className="ltr-value">{query.data.totalCount}</span>
            </p>
          ) : null}
          <PaymentListBody
            key={`${filters.status}:${filters.page}:${filters.q ?? ""}:${filters.appointmentId ?? ""}:${filters.from ?? ""}:${filters.to ?? ""}`}
            filters={filters}
            data={query.data}
          />
          {query.data.pageCount && query.data.pageCount > 1 ? (
            <Pagination
              page={query.data.page}
              pageCount={query.data.pageCount}
              onPageChange={(page) => replaceFilters({ page })}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}
