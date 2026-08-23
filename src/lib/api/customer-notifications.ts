import { apiClient } from "@/lib/api/client";
import { ApiError, isNotFoundError } from "@/lib/api/errors";
import {
  adaptCustomerNotificationDetail,
  adaptCustomerNotificationList,
  adaptRecentNotifications,
  adaptUnreadCount,
} from "@/lib/customer/notification-adapter";
import { isSafePublicId } from "@/lib/public/booking-href";
import { queryKeys } from "@/lib/query/keys";
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

export async function fetchCustomerNotifications(
  input: { page: number; read: NotificationReadFilter; cursor?: string },
  signal?: AbortSignal,
): Promise<CustomerNotificationListView> {
  const params = new URLSearchParams();
  params.set("page", String(input.page > 0 ? input.page : 1));
  params.set("limit", String(NOTIFICATION_LIST_LIMIT));
  if (input.read !== "all") {
    params.set("read", input.read);
  }
  if (input.cursor) {
    params.set("cursor", input.cursor);
  }
  const payload = await apiClient<unknown>(`/customer/notifications?${params.toString()}`, {
    method: "GET",
    signal,
  });
  return adaptCustomerNotificationList(payload, {
    page: input.page,
    readFilter: input.read,
  });
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
    const payload = await apiClient<unknown>("/customer/notifications/unread-count", {
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
    retry: false,
  };
}

export async function fetchRecentNotifications(
  signal?: AbortSignal,
): Promise<CustomerNotificationView[]> {
  try {
    const params = new URLSearchParams({ limit: String(NOTIFICATION_RECENT_LIMIT) });
    const payload = await apiClient<unknown>(
      `/customer/notifications/recent?${params.toString()}`,
      { method: "GET", signal },
    );
    return adaptRecentNotifications(payload, NOTIFICATION_RECENT_LIMIT);
  } catch (error) {
    if (error instanceof ApiError && isNotFoundError(error)) {
      // Fallback: first page of inbox when dedicated recent endpoint is absent.
      try {
        const list = await fetchCustomerNotifications({ page: 1, read: "all" }, signal);
        return list.items.slice(0, NOTIFICATION_RECENT_LIMIT);
      } catch {
        return [];
      }
    }
    throw error;
  }
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
  const payload = await apiClient<unknown>(`/customer/notifications/${encodeURIComponent(id)}`, {
    method: "GET",
    signal,
  });
  const view = adaptCustomerNotificationDetail(payload);
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
  const payload = await apiClient<unknown>(
    `/customer/notifications/${encodeURIComponent(id)}/read`,
    {
      method: "POST",
      signal,
      body: {},
    },
  );
  return adaptCustomerNotificationDetail(payload);
}

export async function markAllNotificationsRead(signal?: AbortSignal): Promise<NotificationUnreadCountView> {
  const payload = await apiClient<unknown>("/customer/notifications/read-all", {
    method: "POST",
    signal,
    body: {},
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
