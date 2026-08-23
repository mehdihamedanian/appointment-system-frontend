"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import {
  ApiErrorState,
  NoResultsState,
  PermissionDeniedState,
} from "@/components/feedback/app-states";
import { useToast } from "@/components/feedback/toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/data-display";
import {
  notificationTypeIcon,
  notificationTypeLabel,
} from "@/features/customer/notification-type-icon";
import { NotificationListSkeleton } from "@/features/customer/notification-list-skeleton";
import { useSession } from "@/features/auth/session-provider";
import {
  applyMarkReadToCaches,
  customerNotificationDetailQueryOptions,
  invalidateCustomerNotifications,
  markNotificationRead,
} from "@/lib/api/customer-notifications";
import { isForbiddenError, isNotFoundError, toAppApiError } from "@/lib/api/errors";
import { formatAppointmentParts, formatRelativeTime } from "@/lib/date-time/format";
import { isSafePublicId } from "@/lib/public/booking-href";
import { notificationsHref } from "@/lib/customer/notification-filters";
import { routes } from "@/constants/routes";

export function NotificationDetailScreen() {
  const params = useParams<{ notificationId?: string }>();
  const id = typeof params.notificationId === "string" ? params.notificationId : "";
  const validId = isSafePublicId(id) ? id : "";
  const { status, user } = useSession();
  const sessionReady = status === "authenticated" && Boolean(user?.id);
  const toast = useToast();
  const queryClient = useQueryClient();
  const [marking, setMarking] = useState(false);
  const markLock = useRef(false);

  const query = useQuery({
    ...customerNotificationDetailQueryOptions(user?.id ?? "anonymous", validId),
    enabled: sessionReady && Boolean(validId),
  });

  if (!validId) {
    return (
      <div className="notifications-page">
        <PageHeader title="جزئیات اعلان" />
        <NoResultsState
          title="اعلان پیدا نشد"
          description="شناسه اعلان معتبر نیست."
          action={
            <Button asChild variant="secondary">
              <Link href={routes.customer.notifications}>بازگشت به اعلان‌ها</Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (status === "loading" || status === "unauthenticated" || status === "expired" || !sessionReady) {
    return (
      <div className="notifications-page">
        <PageHeader title="جزئیات اعلان" description="جزئیات اعلان پس از ورود نمایش داده می‌شود." />
        <NotificationListSkeleton count={2} />
      </div>
    );
  }

  const error = query.isError ? toAppApiError(query.error) : undefined;
  const item = query.data;
  const when = item ? formatRelativeTime(item.createdAt) : null;
  const absolute = item ? formatAppointmentParts(item.createdAt)?.label : null;

  async function onMarkRead() {
    if (!item || item.read || markLock.current) return;
    markLock.current = true;
    setMarking(true);
    applyMarkReadToCaches(queryClient, user!.id, item.id);
    try {
      await markNotificationRead(item.id);
      invalidateCustomerNotifications(queryClient, user!.id);
      toast.success("اعلان خوانده شد.");
    } catch (err) {
      invalidateCustomerNotifications(queryClient, user!.id);
      toast.error(toAppApiError(err).message || "علامت‌گذاری ناموفق بود.");
    } finally {
      markLock.current = false;
      setMarking(false);
    }
  }

  return (
    <div className="notifications-page notification-detail">
      <PageHeader
        title="جزئیات اعلان"
        breadcrumb={
          <nav aria-label="مسیر صفحه">
            <ol className="ds-breadcrumb">
              <li>
                <Link href={notificationsHref()}>اعلان‌ها</Link>
                <span aria-hidden="true">/</span>
              </li>
              <li>
                <span aria-current="page">جزئیات</span>
              </li>
            </ol>
          </nav>
        }
      />

      {query.isPending ? <NotificationListSkeleton count={2} /> : null}

      {error ? (
        isForbiddenError(error) || isNotFoundError(error) ? (
          <PermissionDeniedState
            title="اعلان در دسترس نیست"
            description="این اعلان پیدا نشد یا دسترسی به آن ندارید."
          />
        ) : (
          <ApiErrorState
            title="جزئیات اعلان بارگذاری نشد"
            description={error.message}
            requestId={error.requestId}
            onRetry={() => {
              void query.refetch();
            }}
          />
        )
      ) : null}

      {!query.isPending && !error && item ? (
        <article className="notification-detail__card" aria-labelledby="notification-detail-title">
          <div className="notification-item__meta">
            <span className="notification-item__icon" aria-hidden="true">
              {notificationTypeIcon(item.type)}
            </span>
            <span className="text-caption">{notificationTypeLabel(item.type)}</span>
            <Badge tone={item.read ? "neutral" : "primary"}>
              {item.read ? "خوانده‌شده" : "خوانده‌نشده"}
            </Badge>
          </div>
          <h2 id="notification-detail-title" className="notification-item__title">
            {item.title}
          </h2>
          {item.detailMessage || item.message ? (
            <p className="notification-item__message">{item.detailMessage ?? item.message}</p>
          ) : null}
          {when || absolute ? (
            <p className="text-caption">
              {when ? <time dateTime={item.createdAt}>{when}</time> : null}
              {absolute ? ` — ${absolute}` : null}
            </p>
          ) : null}
          {item.entityReference ? (
            <p className="text-caption">
              مرجع: <span className="ltr-value">{item.entityReference}</span>
            </p>
          ) : null}
          <div className="notification-item__actions">
            {item.href ? (
              <Button asChild>
                <Link href={item.href}>{item.actionLabel ?? "مشاهده"}</Link>
              </Button>
            ) : null}
            {!item.read ? (
              <Button variant="secondary" loading={marking} onClick={() => void onMarkRead()}>
                علامت به‌عنوان خوانده‌شده
              </Button>
            ) : null}
            <Button asChild variant="ghost">
              <Link href={notificationsHref()}>بازگشت به فهرست</Link>
            </Button>
          </div>
        </article>
      ) : null}
    </div>
  );
}
