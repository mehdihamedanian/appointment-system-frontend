"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { Tab, TabList, TabPanel, Tabs } from "@/components/ui/tabs";
import { PageHeader } from "@/components/layout/page-header";
import {
  ApiErrorState,
  EmptyState,
  PermissionDeniedState,
} from "@/components/feedback/app-states";
import { AppointmentCard } from "@/features/customer/appointment-card";
import { AppointmentListSkeleton } from "@/features/customer/appointment-list-skeleton";
import { useSession } from "@/features/auth/session-provider";
import {
  customerAppointmentListQueryOptions,
  fetchCustomerAppointments,
} from "@/lib/api/appointments";
import { isForbiddenError, isNotFoundError, toAppApiError } from "@/lib/api/errors";
import {
  appointmentsHref,
  parseAppointmentCategory,
  parseAppointmentPage,
} from "@/lib/customer/appointment-category";
import { routes } from "@/constants/routes";
import {
  APPOINTMENT_CATEGORIES,
  CATEGORY_EMPTY,
  CATEGORY_LABELS,
  type AppointmentCategory,
  type AppointmentListItemView,
  type AppointmentListView,
} from "@/types/appointment-list";

function AppointmentListBody({
  category,
  page,
  data,
}: {
  category: AppointmentCategory;
  page: number;
  data: AppointmentListView;
}) {
  const [extraItems, setExtraItems] = useState<AppointmentListItemView[]>([]);
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
      const next = await fetchCustomerAppointments({
        category,
        page: page + 1,
        cursor: extraCursor,
      });
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
      <ul className="appointment-list">
        {items.map((item) => (
          <li key={item.id}>
            <AppointmentCard item={item} />
          </li>
        ))}
      </ul>
      {canLoadMore ? (
        <Button variant="secondary" onClick={() => void onLoadMore()} loading={loadingMore}>
          نمایش نوبت‌های بیشتر
        </Button>
      ) : null}
    </>
  );
}

export function AppointmentsScreen() {
  const { status, user } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);
  const category = parseAppointmentCategory(searchParams.get("category"));
  const page = parseAppointmentPage(searchParams.get("page"));
  const sessionReady = status === "authenticated" && Boolean(user?.id);

  const query = useQuery({
    ...customerAppointmentListQueryOptions(user?.id ?? "anonymous", category, { page }),
    enabled: sessionReady,
  });

  const counts = query.data?.counts;
  const error = query.isError ? toAppApiError(query.error) : undefined;

  function onCategoryChange(next: string) {
    router.push(appointmentsHref({ category: parseAppointmentCategory(next) }));
    window.requestAnimationFrame(() => {
      panelRef.current?.focus();
    });
  }

  if (status === "loading" || status === "unauthenticated" || status === "expired" || !sessionReady) {
    return (
      <div className="appointments-page">
        <PageHeader title="نوبت‌های من" description="نوبت‌های این حساب پس از ورود نمایش داده می‌شود." />
        <AppointmentListSkeleton />
      </div>
    );
  }

  return (
    <div className="appointments-page">
      <PageHeader
        title="نوبت‌های من"
        description="فهرست نوبت‌ها بر اساس گروه‌بندی سرویس نوبت‌دهی نمایش داده می‌شود."
      />
      <span className="visually-hidden" aria-live="polite">
        {query.isPending ? "در حال بارگذاری نوبت‌ها." : ""}
        {query.isError ? "بارگذاری نوبت‌ها با خطا روبه‌رو شد." : ""}
        {!query.isPending && !query.isError && query.data?.items.length === 0 ? CATEGORY_EMPTY[category] : ""}
      </span>
      <Tabs value={category} defaultValue="upcoming" onValueChange={onCategoryChange}>
        <TabList>
          {APPOINTMENT_CATEGORIES.map((item) => (
            <Tab key={item} value={item}>
              {CATEGORY_LABELS[item]}
              {typeof counts?.[item] === "number" ? (
                <span className="ltr-value appointment-tab-count">{counts[item]}</span>
              ) : null}
            </Tab>
          ))}
        </TabList>
        {APPOINTMENT_CATEGORIES.map((item) => (
          <TabPanel key={item} value={item}>
            <div ref={item === category ? panelRef : undefined} tabIndex={-1} className="appointment-panel">
              {query.isPending ? <AppointmentListSkeleton /> : null}
              {error ? (
                isForbiddenError(error) ? (
                  <PermissionDeniedState description="برای مشاهده نوبت‌های خود مجوز لازم را ندارید." />
                ) : (
                  <ApiErrorState
                    title={isNotFoundError(error) ? "فهرست نوبت‌ها هنوز متصل نیست" : "نوبت‌ها بارگذاری نشد"}
                    description={
                      isNotFoundError(error)
                        ? "سرویس فهرست نوبت‌های مشتری هنوز در دسترس نیست. فهرستی ساخته نشد."
                        : error.message
                    }
                    requestId={error.requestId}
                    onRetry={() => {
                      void query.refetch();
                    }}
                  />
                )
              ) : null}
              {!query.isPending && !error && query.data && query.data.items.length === 0 ? (
                <EmptyState
                  title={CATEGORY_EMPTY[item]}
                  description={
                    item === "upcoming"
                      ? "برای رزرو نوبت جدید از دکمه زیر استفاده کنید."
                      : "وقتی نوبتی در این گروه باشد، اینجا نمایش داده می‌شود."
                  }
                  action={
                    item === "upcoming" ? (
                      <Button asChild>
                        <Link href={routes.customer.booking}>رزرو نوبت</Link>
                      </Button>
                    ) : undefined
                  }
                  icon={item === "upcoming" ? <CalendarPlus size={20} aria-hidden="true" /> : undefined}
                />
              ) : null}
              {!query.isPending && !error && query.data && query.data.items.length > 0 ? (
                <>
                  <AppointmentListBody
                    key={`${category}-${page}`}
                    category={category}
                    page={page}
                    data={query.data}
                  />
                  {query.data.pageCount && query.data.pageCount > 1 ? (
                    <Pagination
                      page={query.data.page}
                      pageCount={query.data.pageCount}
                      onPageChange={(nextPage) => {
                        router.push(appointmentsHref({ category, page: nextPage }));
                      }}
                      disabled={query.isFetching}
                    />
                  ) : null}
                </>
              ) : null}
            </div>
          </TabPanel>
        ))}
      </Tabs>
    </div>
  );
}
