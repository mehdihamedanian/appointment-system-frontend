"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/data-display";
import { AdminBreadcrumb } from "@/components/layout/admin/admin-breadcrumb";
import { AdminPageHeader } from "@/components/layout/admin/admin-page-header";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import {
  ApiErrorState,
  EmptyState,
} from "@/components/feedback/app-states";
import { InlineLoading } from "@/components/feedback/loading-states";
import { useToast } from "@/components/feedback/toast";
import { AdminNotificationsGate } from "@/features/admin/notifications/admin-notifications-gate";
import { AdminNotificationDetailSkeleton } from "@/features/admin/notifications/admin-notification-skeleton";
import { PermissionGate } from "@/features/admin/permission-gate";
import { useSession } from "@/features/auth/session-provider";
import { invalidateAfterAdminNotificationLogMutation } from "@/lib/admin/notification-cache";
import {
  adminNotificationLogsHref,
  notificationPermission,
} from "@/lib/admin/notification-filters";
import {
  adminNotificationLogDetailQueryOptions,
  retryAdminNotificationLog,
} from "@/lib/api/admin-notifications";
import { createIdempotencyKey } from "@/lib/booking/idempotency";
import {
  isForbiddenError,
  isNotFoundError,
  isSessionExpiredError,
  toAppApiError,
} from "@/lib/api/errors";
import { hasPermission } from "@/lib/permissions/access";
import { routes } from "@/constants/routes";
import type { AdminNotificationDeliveryStatus } from "@/types/admin-notification";

function deliveryTone(status: AdminNotificationDeliveryStatus) {
  switch (status) {
    case "delivered":
      return "success" as const;
    case "sent":
      return "primary" as const;
    case "queued":
    case "processing":
      return "warning" as const;
    case "failed":
    case "bounced":
    case "rejected":
      return "danger" as const;
    default:
      return "neutral" as const;
  }
}

export function AdminNotificationLogDetailScreen() {
  const { status, user } = useSession();
  const params = useParams<{ logReference: string }>();
  const reference = decodeURIComponent(params.logReference ?? "");

  if (status === "loading" || !user?.id) {
    return (
      <>
        <AdminPageHeader title="گزارش ارسال" />
        <AdminNotificationDetailSkeleton />
      </>
    );
  }

  return (
    <PermissionGate permission={notificationPermission("logsView")}>
      <AdminNotificationsGate>
        <AdminNotificationLogDetailReady userId={user.id} user={user} reference={reference} />
      </AdminNotificationsGate>
    </PermissionGate>
  );
}

function AdminNotificationLogDetailReady({
  userId,
  user,
  reference,
}: {
  userId: string;
  user: NonNullable<ReturnType<typeof useSession>["user"]>;
  reference: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const retryLock = useRef(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [retryBusy, setRetryBusy] = useState(false);

  const detailQuery = useQuery(adminNotificationLogDetailQueryOptions(userId, reference));
  const view = detailQuery.data;

  const canRetry =
    view?.allowedActions.retry === true &&
    (hasPermission(user, notificationPermission("logsRetry")) || user.permissionCodes.length === 0);

  async function onRetry() {
    if (!view || !canRetry || retryLock.current) return;
    retryLock.current = true;
    setRetryBusy(true);
    try {
      await retryAdminNotificationLog(reference, createIdempotencyKey(), { version: view.version });
      invalidateAfterAdminNotificationLogMutation(queryClient, userId, reference);
      toast.success("درخواست ارسال مجدد ثبت شد.");
      setConfirmOpen(false);
      await detailQuery.refetch();
    } catch (error) {
      const apiError = toAppApiError(error);
      if (isSessionExpiredError(apiError)) {
        router.push(routes.auth.sessionExpired);
        return;
      }
      toast.error(apiError.message);
    } finally {
      retryLock.current = false;
      setRetryBusy(false);
    }
  }

  if (detailQuery.isPending) {
    return (
      <>
        <AdminPageHeader title="گزارش ارسال" />
        <InlineLoading label="بارگذاری گزارش" />
        <AdminNotificationDetailSkeleton />
      </>
    );
  }

  if (detailQuery.isError || !view) {
    const error = toAppApiError(detailQuery.error);
    if (isForbiddenError(error)) {
      return <ApiErrorState title="دسترسی مجاز نیست" description={error.message} />;
    }
    if (isNotFoundError(error)) {
      return (
        <EmptyState
          title="گزارش پیدا نشد"
          action={
            <Button asChild variant="secondary">
              <Link href={adminNotificationLogsHref()}>بازگشت</Link>
            </Button>
          }
        />
      );
    }
    return (
      <ApiErrorState
        title="بارگذاری ناموفق"
        description={error.message}
        onRetry={() => void detailQuery.refetch()}
      />
    );
  }

  return (
    <>
      <AdminPageHeader
        title="جزئیات ارسال"
        description={view.eventTypeLabel}
        breadcrumb={
          <AdminBreadcrumb
            pathname={routes.admin.notificationLogDetail(reference)}
            items={[
              { href: routes.admin.home, label: "پنل مدیریت" },
              { href: routes.admin.notifications, label: "اعلان‌ها" },
              { href: adminNotificationLogsHref(), label: "گزارش ارسال" },
              { label: reference },
            ]}
          />
        }
        secondaryActions={
          canRetry ? (
            <Button variant="secondary" onClick={() => setConfirmOpen(true)}>
              تلاش مجدد ارسال
            </Button>
          ) : undefined
        }
      />

      {view.allowedActions.blockedReason ? (
        <Alert tone="warning" title="محدودیت" description={view.allowedActions.blockedReason} />
      ) : null}

      <section className="admin-notification-log-detail">
        <Card title="خلاصه">
          <dl className="admin-notification-detail__meta">
            <div>
              <dt>زمان</dt>
              <dd>{view.sentAtLabel}</dd>
            </div>
            <div>
              <dt>رویداد</dt>
              <dd>{view.eventTypeLabel}</dd>
            </div>
            <div>
              <dt>کانال</dt>
              <dd>{view.channelLabel}</dd>
            </div>
            <div>
              <dt>گیرنده</dt>
              <dd className="ltr-value">{view.maskedRecipient}</dd>
            </div>
            <div>
              <dt>وضعیت</dt>
              <dd>
                <Badge tone={deliveryTone(view.deliveryStatus)} data-status={view.deliveryStatus}>
                  {view.deliveryStatusLabel}
                </Badge>
              </dd>
            </div>
            {view.templateReference ? (
              <div>
                <dt>قالب</dt>
                <dd>
                  {view.templateHref ? (
                    <Link href={view.templateHref}>{view.templateReference}</Link>
                  ) : (
                    view.templateReference
                  )}
                  {view.templateVersionLabel ? ` · ${view.templateVersionLabel}` : ""}
                </dd>
              </div>
            ) : null}
            {view.relatedCustomerLabel ? (
              <div>
                <dt>مشتری</dt>
                <dd>
                  {view.relatedCustomerHref ? (
                    <Link href={view.relatedCustomerHref}>{view.relatedCustomerLabel}</Link>
                  ) : (
                    view.relatedCustomerLabel
                  )}
                </dd>
              </div>
            ) : null}
            {view.relatedAppointmentLabel ? (
              <div>
                <dt>نوبت</dt>
                <dd>
                  {view.relatedAppointmentHref ? (
                    <Link href={view.relatedAppointmentHref}>{view.relatedAppointmentLabel}</Link>
                  ) : (
                    view.relatedAppointmentLabel
                  )}
                </dd>
              </div>
            ) : null}
            {view.branchName ? (
              <div>
                <dt>شعبه</dt>
                <dd>{view.branchName}</dd>
              </div>
            ) : null}
            {view.errorCategory ? (
              <div>
                <dt>دسته خطا</dt>
                <dd>{view.errorCategory}</dd>
              </div>
            ) : null}
            {view.errorMessage ? (
              <div>
                <dt>پیام خطا</dt>
                <dd>{view.errorMessage}</dd>
              </div>
            ) : null}
          </dl>
        </Card>

        {view.timeline.length ? (
          <Card title="خط زمانی وضعیت">
            <ol className="admin-notification-timeline">
              {view.timeline.map((entry) => (
                <li key={entry.id}>
                  <div className="admin-notification-timeline__head">
                    <Badge tone={deliveryTone(entry.status)} data-status={entry.status}>
                      {entry.statusLabel}
                    </Badge>
                    <span>{entry.atLabel}</span>
                  </div>
                  {entry.detail ? <p>{entry.detail}</p> : null}
                </li>
              ))}
            </ol>
          </Card>
        ) : null}
      </section>

      <ConfirmDialog
        open={confirmOpen}
        title="تلاش مجدد ارسال"
        description="این عمل ممکن است پیام تکراری برای مشتری ارسال کند. فقط در صورت تأیید Backend ادامه دهید."
        confirmLabel="ارسال مجدد"
        cancelLabel="انصراف"
        variant="destructive"
        busy={retryBusy}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void onRetry()}
      />
    </>
  );
}
