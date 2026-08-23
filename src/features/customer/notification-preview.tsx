import Link from "next/link";
import { Badge, Card } from "@/components/ui/data-display";
import { routes } from "@/constants/routes";
import { formatRelativeTime } from "@/lib/date-time/format";
import type { NotificationPreview } from "@/types/customer";

export function NotificationPreviewList({
  unreadCount,
  notifications,
}: {
  unreadCount: number;
  notifications: NotificationPreview[];
}) {
  if (notifications.length === 0 && unreadCount === 0) {
    return null;
  }

  return (
    <section aria-labelledby="dashboard-notifications-title">
      <Card>
        <div className="dashboard-widget-head">
          <h2 id="dashboard-notifications-title" className="text-card-title">
            اعلان‌ها
          </h2>
          {unreadCount > 0 ? (
            <Badge tone="primary">{unreadCount} خوانده‌نشده</Badge>
          ) : (
            <Badge tone="neutral">همه خوانده شده</Badge>
          )}
        </div>
        {notifications.length > 0 ? (
          <ul className="dashboard-notify-list">
            {notifications.map((item) => {
              const when = formatRelativeTime(item.createdAt);
              const content = (
                <>
                  <span className="dashboard-notify-title">
                    {item.title}
                    {item.read ? (
                      <span className="visually-hidden">، خوانده‌شده</span>
                    ) : (
                      <span className="visually-hidden">، خوانده‌نشده</span>
                    )}
                  </span>
                  {item.body ? <span>{item.body}</span> : null}
                  {when ? (
                    <time dateTime={item.createdAt} className="text-caption">
                      {when}
                    </time>
                  ) : null}
                </>
              );
              return (
                <li key={item.id} data-read={item.read ? "true" : "false"}>
                  {item.href ? (
                    <Link href={item.href} className="dashboard-notify-link">
                      {content}
                    </Link>
                  ) : (
                    <div className="dashboard-notify-link">{content}</div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : null}
        <Link href={routes.customer.notifications}>مشاهده همه اعلان‌ها</Link>
      </Card>
    </section>
  );
}
