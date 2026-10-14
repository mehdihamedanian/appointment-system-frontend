import { apiClient } from "@/lib/api/client";
import { ApiError, isNotFoundError } from "@/lib/api/errors";
import {
  adaptCustomerNotificationDetail,
  adaptCustomerNotificationList,
  adaptRecentNotifications,
  adaptUnreadCount,
} from "@/lib/customer/notification-adapter";
import { isSafePublicId } from "@/lib/public/booking-href";
import { asList, unwrapPayload } from "@/lib/public/read";
import { isRecord } from "@/lib/utilities/records";
import { queryKeys } from "@/lib/query/keys";
import { UNREAD_COUNT_POLL, boundedPollInterval } from "@/lib/query/policies";
import type { QueryClient } from "@tanstack/react-query";
import {
  NOTIFICATION_LIST_LIMIT,
  NOTIFICATION_RECENT_LIMIT,
  type CustomerNotificationDetailView,
  type CustomerNotificationListView,
  type CustomerNotificationView,
  type NotificationReadFilter,
  type NotificationUnreadCountView,
} from "@/types/customer-notification";

function missingNotificationError(): ApiError {
  return new ApiError({
    status: 404,
    code: "NOTIFICATION_NOT_FOUND",
    message: "اعلان پیدا نشد.",
  });
}

/** Backend in-app inbox: offset pagination, `unread_only` filter, at most 100 per request. */
const IN_APP_PATH = "/notifications/in-app";
const IN_APP_MAX_LIMIT = 100;

export async function fetchCustomerNotifications(
  input: { page: number; read: NotificationReadFilter },
  signal?: AbortSignal,
): Promise<CustomerNotificationListView> {
  const page = input.page > 0 ? input.page : 1;
  // One extra row tells whether a next page exists; the Backend returns no total.
  const payload = await apiClient<unknown>(IN_APP_PATH, {
    method: "GET",
    signal,
    query: {
      limit: NOTIFICATION_LIST_LIMIT + 1,
      offset: (page - 1) * NOTIFICATION_LIST_LIMIT,
      unread_only: input.read === "unread" ? true : undefined,
    },
  });
  const view = adaptCustomerNotificationList(payload, { page, readFilter: input.read });
  const pageItems = view.items.slice(0, NOTIFICATION_LIST_LIMIT);
  return {
    ...view,
    hasMore: view.items.length > NOTIFICATION_LIST_LIMIT,
    // The Backend can only filter unread rows, so "read" is applied to the fetched page.
    items: input.read === "read" ? pageItems.filter((item) => item.read) : pageItems,
  };
}

export function customerNotificationListQueryOptions(
  userId: string,
  input: { page: number; read: NotificationReadFilter },
) {
  return {
    queryKey: queryKeys.customer.notificationList(userId, input),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      fetchCustomerNotifications(input, signal),
    staleTime: 15_000,
    refetchOnMount: "always" as const,
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
    retry: false,
  };
}

export async function fetchNotificationUnreadCount(
  signal?: AbortSignal,
): Promise<NotificationUnreadCountView> {
  try {
    const payload = await apiClient<unknown>(`${IN_APP_PATH}/unread-count`, {
      method: "GET",
      signal,
    });
    return adaptUnreadCount(payload);
  } catch (error) {
    if (error instanceof ApiError && isNotFoundError(error)) {
      return { unreadCount: 0 };
    }
    throw error;
  }
}

export function notificationUnreadCountQueryOptions(userId: string) {
  return {
    queryKey: queryKeys.customer.notificationUnreadCount(userId),
    queryFn: ({ signal }: { signal: AbortSignal }) => fetchNotificationUnreadCount(signal),
    staleTime: 15_000,
    refetchOnMount: "always" as const,
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
    refetchInterval: boundedPollInterval<NotificationUnreadCountView>(
      () => true,
      UNREAD_COUNT_POLL,
    ),
    retry: false,
  };
}

export async function fetchRecentNotifications(
  signal?: AbortSignal,
): Promise<CustomerNotificationView[]> {
  const payload = await apiClient<unknown>(IN_APP_PATH, {
    method: "GET",
    signal,
    query: { limit: NOTIFICATION_RECENT_LIMIT },
  });
  return adaptRecentNotifications(payload, NOTIFICATION_RECENT_LIMIT);
}

export function recentNotificationsQueryOptions(userId: string) {
  return {
    queryKey: queryKeys.customer.notificationRecent(userId),
    queryFn: ({ signal }: { signal: AbortSignal }) => fetchRecentNotifications(signal),
    staleTime: 15_000,
    refetchOnMount: "always" as const,
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
    retry: false,
  };
}

export async function fetchCustomerNotificationDetail(
  id: string,
  signal?: AbortSignal,
): Promise<CustomerNotificationDetailView> {
  if (!isSafePublicId(id)) {
    throw missingNotificationError();
  }
  // The Backend has no single-notification read; resolve it from the most recent page.
  const payload = await apiClient<unknown>(IN_APP_PATH, {
    method: "GET",
    signal,
    query: { limit: IN_APP_MAX_LIMIT },
  });
  const match = asList(unwrapPayload(payload), ["items"]).find(
    (item) => isRecord(item) && item.id === id,
  );
  const view = match ? adaptCustomerNotificationDetail(match) : null;
  if (!view) {
    throw missingNotificationError();
  }
  return view;
}

export function customerNotificationDetailQueryOptions(userId: string, id: string) {
  return {
    queryKey: queryKeys.customer.notificationDetail(userId, id),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      fetchCustomerNotificationDetail(id, signal),
    enabled: Boolean(userId) && isSafePublicId(id),
    staleTime: 0,
    gcTime: 30_000,
    refetchOnMount: "always" as const,
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
    retry: false,
  };
}

export async function markNotificationRead(
  id: string,
  signal?: AbortSignal,
): Promise<CustomerNotificationView | null> {
  if (!isSafePublicId(id)) {
    throw missingNotificationError();
  }
  const payload = await apiClient<unknown>(`${IN_APP_PATH}/${encodeURIComponent(id)}/read`, {
    method: "POST",
    signal,
  });
  return adaptCustomerNotificationDetail(payload);
}

export async function markAllNotificationsRead(signal?: AbortSignal): Promise<NotificationUnreadCountView> {
  const payload = await apiClient<unknown>(`${IN_APP_PATH}/read-all`, {
    method: "POST",
    signal,
  });
  if (payload == null) {
    return { unreadCount: 0 };
  }
  return adaptUnreadCount(payload);
}

export function invalidateCustomerNotifications(queryClient: QueryClient, userId: string) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.customer.notifications(userId) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.customer.dashboard(userId) });
}

export function applyMarkReadToCaches(
  queryClient: QueryClient,
  userId: string,
  notificationId: string,
) {
  queryClient.setQueryData(
    queryKeys.customer.notificationUnreadCount(userId),
    (current: NotificationUnreadCountView | undefined) => {
      const prev = current?.unreadCount ?? 0;
      return { unreadCount: Math.max(0, prev - 1) };
    },
  );

  queryClient.setQueriesData(
    { queryKey: queryKeys.customer.notifications(userId) },
    (current: unknown) => {
      if (!current || typeof current !== "object") {
        return current;
      }
      if (Array.isArray(current)) {
        return (current as CustomerNotificationView[]).map((item) =>
          item.id === notificationId ? { ...item, read: true } : item,
        );
      }
      const list = current as CustomerNotificationListView;
      if (!Array.isArray(list.items)) {
        return current;
      }
      const wasUnread = list.items.some((item) => item.id === notificationId && !item.read);
      return {
        ...list,
        items: list.items.map((item) =>
          item.id === notificationId ? { ...item, read: true } : item,
        ),
        unreadCount:
          typeof list.unreadCount === "number" && wasUnread
            ? Math.max(0, list.unreadCount - 1)
            : list.unreadCount,
      };
    },
  );

  queryClient.setQueryData(
    queryKeys.customer.notificationDetail(userId, notificationId),
    (current: CustomerNotificationDetailView | undefined) =>
      current ? { ...current, read: true } : current,
  );
}

export function applyMarkAllReadToCaches(queryClient: QueryClient, userId: string) {
  queryClient.setQueryData(queryKeys.customer.notificationUnreadCount(userId), {
    unreadCount: 0,
  });
  queryClient.setQueriesData(
    { queryKey: queryKeys.customer.notifications(userId) },
    (current: unknown) => {
      if (!current || typeof current !== "object") {
        return current;
      }
      if (Array.isArray(current)) {
        return (current as CustomerNotificationView[]).map((item) => ({ ...item, read: true }));
      }
      const list = current as CustomerNotificationListView;
      if (!Array.isArray(list.items)) {
        return current;
      }
      return {
        ...list,
        items: list.items.map((item) => ({ ...item, read: true })),
        unreadCount: 0,
      };
    },
  );
}
