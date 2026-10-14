"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import {
  ApiErrorState,
  EmptyState,
  NoResultsState,
  PermissionDeniedState,
} from "@/components/feedback/app-states";
import { useToast } from "@/components/feedback/toast";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { Pagination } from "@/components/ui/pagination";
import { Tab, TabList, Tabs } from "@/components/ui/tabs";
import { NotificationListItem } from "@/features/customer/notification-list-item";
import { NotificationListSkeleton } from "@/features/customer/notification-list-skeleton";
import { useSession } from "@/features/auth/session-provider";
import {
  applyMarkAllReadToCaches,
  applyMarkReadToCaches,
  customerNotificationListQueryOptions,
  fetchCustomerNotifications,
  invalidateCustomerNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/api/customer-notifications";
import { isForbiddenError, isNotFoundError, toAppApiError } from "@/lib/api/errors";
import {
  notificationsHref,
  parseNotificationPage,
  parseNotificationReadFilter,
} from "@/lib/customer/notification-filters";
import { routes } from "@/constants/routes";
import {
  NOTIFICATION_READ_FILTERS,
  NOTIFICATION_READ_FILTER_LABELS,
  type CustomerNotificationListView,
  type CustomerNotificationView,
  type NotificationReadFilter,
} from "@/types/customer-notification";
import { queryKeys } from "@/lib/query/keys";

function NotificationListBody({
  read,
  page,
  data,
  onMarkRead,
  markingId,
}: {
  read: NotificationReadFilter;
  page: number;
  data: CustomerNotificationListView;
  onMarkRead: (id: string) => void;
  markingId: string | null;
}) {
  const [extraItems, setExtraItems] = useState<CustomerNotificationView[]>([]);
  const [extraCursor, setExtraCursor] = useState<string | undefined>(data.nextCursor);
  const [nextPage, setNextPage] = useState(page + 1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(data.hasMore && !data.pageCount);
  const loadLock = useRef(false);

  const items = [
    ...data.items,
    ...extraItems.filter((item) => !data.items.some((current) => current.id === item.id)),
  ];
  const canLoadMore = hasMore || Boolean(extraCursor && !data.pageCount);

  async function onLoadMore() {
    if (loadLock.current || !canLoadMore) return;
    loadLock.current = true;
    setLoadingMore(true);
    try {
      const next = await fetchCustomerNotifications({ read, page: nextPage });
      setExtraItems((current) => {
        const seen = new Set([...data.items, ...current].map((item) => item.id));
        return [...current, ...next.items.filter((item) => !seen.has(item.id))];
      });
      setNextPage((current) => current + 1);
      setExtraCursor(next.nextCursor);
      setHasMore(Boolean(next.hasMore || next.nextCursor) && !next.pageCount);
    } finally {
      loadLock.current = false;
      setLoadingMore(false);
    }
  }

  return (
    <>
      <ul className="notification-list">
        {items.map((item) => (
          <li key={item.id}>
            <NotificationListItem
              item={item}
              headingLevel="h2"
              marking={markingId === item.id}
              onMarkRead={onMarkRead}
            />
          </li>
        ))}
      </ul>
      {canLoadMore ? (
        <Button variant="secondary" loading={loadingMore} onClick={() => void onLoadMore()}>
          نمایش اعلان‌های بیشتر
        </Button>
      ) : null}
    </>
  );
}

export function NotificationsScreen() {
  const { status, user } = useSession();
  const searchParams = useSearchParams();
  const read = parseNotificationReadFilter(searchParams.get("read"));
  const page = parseNotificationPage(searchParams.get("page"));
  const sessionReady = status === "authenticated" && Boolean(user?.id);

  if (status === "loading" || status === "unauthenticated" || status === "expired" || !sessionReady) {
    return (
      <div className="notifications-page">
        <PageHeader title="اعلان‌ها" description="اعلان‌های این حساب پس از ورود نمایش داده می‌شود." />
        <NotificationListSkeleton />
      </div>
    );
  }

  return (
    <NotificationsScreenReady
      key={`${read}:${page}`}
      userId={user!.id}
      read={read}
      page={page}
    />
  );
}

function NotificationsScreenReady({
  userId,
  read,
  page,
}: {
  userId: string;
  read: NotificationReadFilter;
  page: number;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [markAllOpen, setMarkAllOpen] = useState(false);
  const [markAllLoading, setMarkAllLoading] = useState(false);
  const markLock = useRef(false);

  const query = useQuery(customerNotificationListQueryOptions(userId, { page, read }));
  const error = query.isError ? toAppApiError(query.error) : undefined;

  const replaceFilter = useCallback(
    (next: { read?: NotificationReadFilter; page?: number }) => {
      startTransition(() => {
        router.replace(
          notificationsHref({
            read: next.read ?? read,
            page: next.page ?? 1,
          }),
          { scroll: false },
        );
      });
    },
    [read, router, startTransition],
  );

  async function onMarkRead(id: string) {
    if (markLock.current) return;
    markLock.current = true;
    setMarkingId(id);
    applyMarkReadToCaches(queryClient, userId, id);
    try {
      await markNotificationRead(id);
      invalidateCustomerNotifications(queryClient, userId);
      toast.success("اعلان خوانده شد.");
    } catch (err) {
      invalidateCustomerNotifications(queryClient, userId);
      toast.error(toAppApiError(err).message || "علامت‌گذاری ناموفق بود.");
    } finally {
      markLock.current = false;
      setMarkingId(null);
    }
  }

  async function onConfirmMarkAll() {
    if (markLock.current) return;
    markLock.current = true;
    setMarkAllLoading(true);
    const previous = {
      unread: queryClient.getQueryData(queryKeys.customer.notificationUnreadCount(userId)),
      list: queryClient.getQueriesData({ queryKey: queryKeys.customer.notifications(userId) }),
    };
    applyMarkAllReadToCaches(queryClient, userId);
    try {
      await markAllNotificationsRead();
      invalidateCustomerNotifications(queryClient, userId);
      setMarkAllOpen(false);
      toast.success("همه اعلان‌ها خوانده شد.");
    } catch (err) {
      if (previous.unread !== undefined) {
        queryClient.setQueryData(
          queryKeys.customer.notificationUnreadCount(userId),
          previous.unread,
        );
      }
      invalidateCustomerNotifications(queryClient, userId);
      toast.error(toAppApiError(err).message || "خواندن همه اعلان‌ها ناموفق بود.");
    } finally {
      markLock.current = false;
      setMarkAllLoading(false);
    }
  }

  const hasItems = Boolean(query.data && query.data.items.length > 0);
  const emptyInbox = Boolean(query.data?.emptyInbox && !query.data.filtersApplied);
  const noResults = Boolean(
    query.data &&
      query.data.items.length === 0 &&
      (query.data.filtersApplied || !query.data.emptyInbox) &&
      !emptyInbox,
  );
  const unreadCount = query.data?.unreadCount ?? 0;

  return (
    <div className="notifications-page">
      <PageHeader
        title="اعلان‌ها"
        description="اعلان‌های مرتبط با نوبت، پرداخت و وضعیت حساب شما."
        secondaryActions={
          <div className="ds-inline">
            <Button
              variant="secondary"
              leadingIcon={<RefreshCw size={16} aria-hidden="true" />}
              loading={query.isFetching && !query.isPending}
              onClick={() => {
                void query.refetch();
              }}
            >
              به‌روزرسانی
            </Button>
            <Button
              variant="secondary"
              disabled={unreadCount === 0 && !query.isPending}
              onClick={() => setMarkAllOpen(true)}
            >
              خواندن همه
            </Button>
          </div>
        }
      />
      <span className="visually-hidden" aria-live="polite">
        {query.isPending ? "در حال بارگذاری اعلان‌ها." : ""}
        {query.isError ? "بارگذاری اعلان‌ها با خطا روبه‌رو شد." : ""}
        {!query.isPending && !query.isError && emptyInbox ? "هنوز اعلانی ندارید." : ""}
        {!query.isPending && !query.isError && noResults ? "نتیجه‌ای برای این فیلتر نیست." : ""}
      </span>

      <Tabs
        value={read}
        defaultValue="all"
        onValueChange={(next) => replaceFilter({ read: parseNotificationReadFilter(next) })}
      >
        <TabList>
          {NOTIFICATION_READ_FILTERS.map((item) => (
            <Tab key={item} value={item}>
              {NOTIFICATION_READ_FILTER_LABELS[item]}
            </Tab>
          ))}
        </TabList>
      </Tabs>

      {query.isPending ? <NotificationListSkeleton /> : null}
      {error ? (
        isForbiddenError(error) ? (
          <PermissionDeniedState description="برای مشاهده اعلان‌ها مجوز لازم را ندارید." />
        ) : (
          <ApiErrorState
            title={isNotFoundError(error) ? "اعلان‌ها هنوز متصل نیست" : "اعلان‌ها بارگذاری نشد"}
            description={
              isNotFoundError(error)
                ? "سرویس اعلان‌های مشتری هنوز در دسترس نیست."
                : error.message
            }
            requestId={error.requestId}
            onRetry={() => {
              void query.refetch();
            }}
          />
        )
      ) : null}

      {!query.isPending && !error && emptyInbox ? (
        <EmptyState
          title="هنوز اعلانی ندارید"
          description="وقتی رویدادی برای حساب شما ثبت شود، اینجا نمایش داده می‌شود."
          icon={<Bell size={20} aria-hidden="true" />}
          action={
            <Button asChild>
              <Link href={routes.customer.dashboard}>بازگشت به داشبورد</Link>
            </Button>
          }
        />
      ) : null}

      {!query.isPending && !error && noResults ? (
        <NoResultsState
          title="نتیجه‌ای پیدا نشد"
          description="فیلتر خوانده‌شده یا خوانده‌نشده را تغییر دهید."
          action={
            <Button variant="secondary" onClick={() => replaceFilter({ read: "all" })}>
              نمایش همه
            </Button>
          }
        />
      ) : null}

      {!query.isPending && !error && hasItems && query.data ? (
        <>
          <NotificationListBody
            key={`${read}:${page}`}
            read={read}
            page={page}
            data={query.data}
            markingId={markingId}
            onMarkRead={(id) => void onMarkRead(id)}
          />
          {query.data.pageCount && query.data.pageCount > 1 ? (
            <Pagination
              page={query.data.page}
              pageCount={query.data.pageCount}
              onPageChange={(nextPage) => replaceFilter({ page: nextPage })}
            />
          ) : null}
        </>
      ) : null}

      <ConfirmDialog
        open={markAllOpen}
        title="خواندن همه اعلان‌ها"
        description="همه اعلان‌های خوانده‌نشده به‌عنوان خوانده‌شده علامت می‌خورند."
        confirmLabel="خواندن همه"
        cancelLabel="انصراف"
        variant="primary"
        busy={markAllLoading}
        onCancel={() => setMarkAllOpen(false)}
        onConfirm={() => void onConfirmMarkAll()}
      />
    </div>
  );
}
