"use client";

import { useCallback, useId, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/data-display";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { IconButton } from "@/components/ui/icon-button";
import { Popover } from "@/components/ui/popover";
import { useToast } from "@/components/feedback/toast";
import { NotificationBellGlyph } from "@/features/customer/notification-type-icon";
import { NotificationListItem } from "@/features/customer/notification-list-item";
import { NotificationListSkeleton } from "@/features/customer/notification-list-skeleton";
import { useSession } from "@/features/auth/session-provider";
import {
  applyMarkReadToCaches,
  invalidateCustomerNotifications,
  markNotificationRead,
  notificationUnreadCountQueryOptions,
  recentNotificationsQueryOptions,
} from "@/lib/api/customer-notifications";
import { clampUnreadBadge } from "@/lib/customer/notification-adapter";
import { isForbiddenError, toAppApiError } from "@/lib/api/errors";
import { queryKeys } from "@/lib/query/keys";
import { routes } from "@/constants/routes";

function subscribeMobile(onChange: () => void) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => undefined;
  }
  const media = window.matchMedia("(max-width: 767px)");
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function getMobileSnapshot() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(max-width: 767px)").matches;
}

function getServerMobileSnapshot() {
  return false;
}

function useIsMobileViewport() {
  return useSyncExternalStore(subscribeMobile, getMobileSnapshot, getServerMobileSnapshot);
}

function NotificationPreviewPanel({
  onClose,
  userId,
}: {
  onClose: () => void;
  userId: string;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [markingId, setMarkingId] = useState<string | null>(null);
  const markLock = useRef(false);

  const unreadQuery = useQuery(notificationUnreadCountQueryOptions(userId));
  const recentQuery = useQuery(recentNotificationsQueryOptions(userId));

  const unreadCount = unreadQuery.data?.unreadCount ?? 0;
  const items = recentQuery.data ?? [];
  const loading = unreadQuery.isPending || recentQuery.isPending;
  const error = unreadQuery.isError
    ? toAppApiError(unreadQuery.error)
    : recentQuery.isError
      ? toAppApiError(recentQuery.error)
      : undefined;

  const onMarkRead = useCallback(
    async (id: string) => {
      if (markLock.current) return;
      markLock.current = true;
      setMarkingId(id);
      const previousUnread = queryClient.getQueryData<{ unreadCount: number }>(
        queryKeys.customer.notificationUnreadCount(userId),
      );
      const previousRecent = queryClient.getQueryData(queryKeys.customer.notificationRecent(userId));
      applyMarkReadToCaches(queryClient, userId, id);
      try {
        await markNotificationRead(id);
        invalidateCustomerNotifications(queryClient, userId);
        toast.success("اعلان به‌عنوان خوانده‌شده علامت‌گذاری شد.");
      } catch (err) {
        if (previousUnread) {
          queryClient.setQueryData(
            queryKeys.customer.notificationUnreadCount(userId),
            previousUnread,
          );
        }
        if (previousRecent !== undefined) {
          queryClient.setQueryData(queryKeys.customer.notificationRecent(userId), previousRecent);
        }
        invalidateCustomerNotifications(queryClient, userId);
        toast.error(toAppApiError(err).message || "علامت‌گذاری ناموفق بود.");
      } finally {
        markLock.current = false;
        setMarkingId(null);
      }
    },
    [queryClient, toast, userId],
  );

  return (
    <div className="notification-popover">
      <div className="notification-popover__head">
        <p className="text-card-title">اعلان‌های اخیر</p>
        {unreadCount > 0 ? (
          <Badge tone="primary">{clampUnreadBadge(unreadCount)} خوانده‌نشده</Badge>
        ) : (
          <Badge tone="neutral">همه خوانده شده</Badge>
        )}
      </div>
      <span className="visually-hidden" aria-live="polite">
        {loading ? "در حال بارگذاری اعلان‌ها." : ""}
        {error ? "بارگذاری اعلان‌ها با خطا روبه‌رو شد." : ""}
      </span>
      {loading ? <NotificationListSkeleton count={3} /> : null}
      {error && !loading ? (
        <div className="notification-popover__error">
          <p className="text-body-sm">
            {isForbiddenError(error)
              ? "دسترسی به اعلان‌ها مجاز نیست."
              : "اعلان‌ها بارگذاری نشد."}
          </p>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              void unreadQuery.refetch();
              void recentQuery.refetch();
            }}
          >
            تلاش دوباره
          </Button>
        </div>
      ) : null}
      {!loading && !error && items.length === 0 ? (
        <p className="text-body-sm">اعلان جدیدی ندارید.</p>
      ) : null}
      {!loading && !error && items.length > 0 ? (
        <ul className="notification-popover__list">
          {items.map((item) => (
            <li key={item.id}>
              <NotificationListItem
                item={item}
                compact
                marking={markingId === item.id}
                onMarkRead={(id) => void onMarkRead(id)}
              />
            </li>
          ))}
        </ul>
      ) : null}
      <div className="notification-popover__footer">
        <Button asChild variant="secondary">
          <Link href={routes.customer.notifications} onClick={onClose}>
            مشاهده همه اعلان‌ها
          </Link>
        </Button>
      </div>
    </div>
  );
}

export function CustomerNotificationBell() {
  const { status, user } = useSession();
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobileViewport();
  const panelId = useId();
  const sessionReady = status === "authenticated" && Boolean(user?.id);
  const userId = user?.id ?? "anonymous";

  const unreadQuery = useQuery({
    ...notificationUnreadCountQueryOptions(userId),
    enabled: sessionReady,
  });

  const unreadCount = unreadQuery.data?.unreadCount ?? 0;
  const badge = clampUnreadBadge(unreadCount);
  const accessibleLabel =
    unreadCount > 0
      ? `اعلان‌ها، ${new Intl.NumberFormat("fa-IR").format(unreadCount)} خوانده‌نشده`
      : "اعلان‌ها";

  if (!sessionReady) {
    return (
      <IconButton label="اعلان‌ها" disabled>
        <NotificationBellGlyph />
      </IconButton>
    );
  }

  const bellInner = (
    <>
      <NotificationBellGlyph />
      {badge ? (
        <span className="notification-bell__badge" aria-hidden="true">
          {badge}
        </span>
      ) : null}
    </>
  );

  if (isMobile) {
    return (
      <>
        <IconButton
          label={accessibleLabel}
          className="notification-bell"
          data-unread={unreadCount > 0 ? "true" : "false"}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          {bellInner}
        </IconButton>
        <Drawer open={open} onClose={() => setOpen(false)} title="اعلان‌ها" placement="bottom">
          <NotificationPreviewPanel userId={userId} onClose={() => setOpen(false)} />
        </Drawer>
      </>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen} placement="bottom-end" trigger={
      <IconButton
        label={accessibleLabel}
        className="notification-bell"
        data-unread={unreadCount > 0 ? "true" : "false"}
        aria-controls={open ? panelId : undefined}
      >
        {bellInner}
      </IconButton>
    }>
      <div id={panelId}>
        <NotificationPreviewPanel userId={userId} onClose={() => setOpen(false)} />
      </div>
    </Popover>
  );
}
