"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  notificationTypeIcon,
  notificationTypeLabel,
} from "@/features/customer/notification-type-icon";
import { formatRelativeTime } from "@/lib/date-time/format";
import { routes } from "@/constants/routes";
import type { CustomerNotificationView } from "@/types/customer-notification";
import { NOTIFICATION_DETAIL_ENABLED } from "@/types/customer-notification";

export function NotificationListItem({
  item,
  onMarkRead,
  marking,
  compact = false,
}: {
  item: CustomerNotificationView;
  onMarkRead?: (id: string) => void;
  marking?: boolean;
  compact?: boolean;
}) {
  const when = formatRelativeTime(item.createdAt);
  const typeLabel = notificationTypeLabel(item.type);
  const titleId = `notification-${item.id}-title`;

  return (
    <article
      className="notification-item"
      data-read={item.read ? "true" : "false"}
      aria-labelledby={titleId}
    >
      <div className="notification-item__icon" aria-hidden="true">
        {notificationTypeIcon(item.type)}
      </div>
      <div className="notification-item__body">
        <div className="notification-item__meta">
          <span className="text-caption">{typeLabel}</span>
          {!item.read ? (
            <span className="notification-item__unread-dot" aria-hidden="true" />
          ) : null}
          <span className="visually-hidden">{item.read ? "خوانده‌شده" : "خوانده‌نشده"}</span>
        </div>
        <h3 id={titleId} className="notification-item__title">
          {item.title}
        </h3>
        {item.message ? <p className="notification-item__message">{item.message}</p> : null}
        {when ? (
          <time dateTime={item.createdAt} className="text-caption">
            {when}
          </time>
        ) : null}
        <div className="notification-item__actions">
          {item.href ? (
            <Button asChild size="sm" variant={compact ? "ghost" : "secondary"}>
              <Link href={item.href}>{item.actionLabel ?? "مشاهده"}</Link>
            </Button>
          ) : null}
          {NOTIFICATION_DETAIL_ENABLED && !compact ? (
            <Button asChild size="sm" variant="ghost">
              <Link href={routes.customer.notificationDetail(item.id)}>جزئیات</Link>
            </Button>
          ) : null}
          {!item.read && onMarkRead ? (
            <Button
              size="sm"
              variant="ghost"
              loading={marking}
              onClick={() => onMarkRead(item.id)}
            >
              علامت به‌عنوان خوانده‌شده
            </Button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
