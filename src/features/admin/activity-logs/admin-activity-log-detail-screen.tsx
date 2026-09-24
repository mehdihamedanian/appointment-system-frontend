"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/data-display";
import { AdminBreadcrumb } from "@/components/layout/admin/admin-breadcrumb";
import { AdminPageHeader } from "@/components/layout/admin/admin-page-header";
import {
  ApiErrorState,
  EmptyState,
  PermissionDeniedState,
} from "@/components/feedback/app-states";
import { AdminActivityLogChangeDiff } from "@/features/admin/activity-logs/admin-activity-log-change-diff";
import { AdminActivityLogsGate } from "@/features/admin/activity-logs/admin-activity-logs-gate";
import { AdminActivityLogDetailSkeleton } from "@/features/admin/activity-logs/admin-activity-log-skeleton";
import { PermissionGate } from "@/features/admin/permission-gate";
import { useSession } from "@/features/auth/session-provider";
import { activityLogPermission, adminActivityLogsHref } from "@/lib/admin/activity-log-filters";
import { adminActivityLogDetailQueryOptions } from "@/lib/api/admin-activity-logs";
import {
  isForbiddenError,
  isNotFoundError,
  toAppApiError,
} from "@/lib/api/errors";
import { hasPermission } from "@/lib/permissions/access";
import { routes } from "@/constants/routes";
import type { AdminActivityLogResult } from "@/types/admin-activity-log";

const AdminActivityLogStructuredPreview = dynamic(
  () =>
    import("@/features/admin/activity-logs/admin-activity-log-structured-preview").then(
      (mod) => mod.AdminActivityLogStructuredPreview,
    ),
  { ssr: false },
);

function resultTone(result: AdminActivityLogResult) {
  switch (result) {
    case "success":
      return "success" as const;
    case "failure":
    case "denied":
      return "danger" as const;
    case "partial":
      return "warning" as const;
    default:
      return "neutral" as const;
  }
}

export function AdminActivityLogDetailScreen() {
  const { status, user } = useSession();
  const params = useParams<{ logReference: string }>();
  const reference = decodeURIComponent(params.logReference ?? "");

  if (status === "loading" || !user?.id || !reference) {
    return (
      <>
        <AdminPageHeader title="جزئیات رویداد" />
        <AdminActivityLogDetailSkeleton />
      </>
    );
  }

  const canViewDetail =
    user.permissionCodes.length === 0 ||
    hasPermission(user, activityLogPermission("viewDetail")) ||
    hasPermission(user, activityLogPermission("view"));

  if (!canViewDetail) {
    return (
      <PermissionDeniedState
        title="دسترسی مجاز نیست"
        description="مجوز مشاهده جزئیات گزارش فعالیت را ندارید."
      />
    );
  }

  return (
    <PermissionGate permission={activityLogPermission("view")}>
      <AdminActivityLogsGate>
        <AdminActivityLogDetailReady userId={user.id} user={user} reference={reference} />
      </AdminActivityLogsGate>
    </PermissionGate>
  );
}

function AdminActivityLogDetailReady({
  userId,
  user,
  reference,
}: {
  userId: string;
  user: NonNullable<ReturnType<typeof useSession>["user"]>;
  reference: string;
}) {
  const detailQuery = useQuery(adminActivityLogDetailQueryOptions(userId, reference));
  const view = detailQuery.data;

  const canViewChanges =
    user.permissionCodes.length === 0 ||
    hasPermission(user, activityLogPermission("viewChanges"));
  const canViewPrivate =
    user.permissionCodes.length === 0 ||
    hasPermission(user, activityLogPermission("viewPrivate"));

  if (detailQuery.isPending) {
    return (
      <>
        <AdminPageHeader title="جزئیات رویداد" />
        <AdminActivityLogDetailSkeleton />
      </>
    );
  }

  if (detailQuery.isError || !view) {
    const error = toAppApiError(detailQuery.error);
    if (isForbiddenError(error)) {
      return <PermissionDeniedState title="دسترسی مجاز نیست" description={error.message} />;
    }
    if (isNotFoundError(error)) {
      return (
        <EmptyState
          title="رویداد پیدا نشد"
          action={
            <Button asChild variant="secondary">
              <Link href={adminActivityLogsHref()}>بازگشت به فهرست</Link>
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

  if (view.allowedActions.viewDetail === false) {
    return (
      <PermissionDeniedState
        title="جزئیات در دسترس نیست"
        description={view.allowedActions.blockedReason ?? "مجوز مشاهده جزئیات را ندارید."}
      />
    );
  }

  const showChanges =
    canViewChanges &&
    view.allowedActions.viewChanges &&
    !view.securityHidden &&
    (view.changesAvailable || view.changes.length > 0);

  return (
    <>
      <AdminPageHeader
        title="جزئیات رویداد"
        description={view.summary}
        breadcrumb={
          <AdminBreadcrumb
            pathname={routes.admin.activityLogDetail(reference)}
            items={[
              { href: routes.admin.home, label: "پنل مدیریت" },
              { href: routes.admin.activityLogs, label: "گزارش فعالیت" },
              { label: view.reference },
            ]}
          />
        }
        secondaryActions={
          <Button asChild variant="secondary">
            <Link href={adminActivityLogsHref()}>بازگشت</Link>
          </Button>
        }
      />

      <div className="admin-activity-log-detail">
        <Card>
          <dl className="admin-activity-log-detail__meta">
            <div>
              <dt>مرجع رویداد</dt>
              <dd className="ltr-value">{view.reference}</dd>
            </div>
            <div>
              <dt>عامل</dt>
              <dd>
                {view.actorLabel}
                {view.actorReference ? (
                  <>
                    {" "}
                    <code className="ltr-value text-caption">{view.actorReference}</code>
                  </>
                ) : null}
              </dd>
            </div>
            <div>
              <dt>اقدام</dt>
              <dd>
                {view.actionLabel}
                <div>
                  <code className="ltr-value text-caption">{view.actionCode || "—"}</code>
                </div>
              </dd>
            </div>
            <div>
              <dt>موجودیت</dt>
              <dd>
                {view.entityTypeLabel}
                {view.entityReference ? (
                  <>
                    {" "}
                    <code className="ltr-value">{view.entityReference}</code>
                  </>
                ) : null}
              </dd>
            </div>
            <div>
              <dt>زمان</dt>
              <dd>
                <time dateTime={view.occurredAtIso ?? view.occurredAt}>
                  {view.occurredAtLabel}
                </time>
                {view.relativeTimeLabel ? (
                  <span className="text-caption"> ({view.relativeTimeLabel})</span>
                ) : null}
                {view.timezoneLabel ? (
                  <div className="text-caption">
                    منطقه زمانی: <span className="ltr-value">{view.timezoneLabel}</span>
                  </div>
                ) : null}
                {view.occurredAtIso ? (
                  <div className="text-caption ltr-value">{view.occurredAtIso}</div>
                ) : null}
              </dd>
            </div>
            <div>
              <dt>نتیجه</dt>
              <dd>
                <Badge tone={resultTone(view.result)} data-result={view.result}>
                  {view.resultLabel}
                </Badge>
              </dd>
            </div>
            {view.branchLabel ? (
              <div>
                <dt>شعبه</dt>
                <dd>{view.branchLabel}</dd>
              </div>
            ) : null}
            {view.sourceLabel ? (
              <div>
                <dt>منبع</dt>
                <dd>{view.sourceLabel}</dd>
              </div>
            ) : null}
            {view.requestId ? (
              <div>
                <dt>شناسه درخواست</dt>
                <dd className="ltr-value">{view.requestId}</dd>
              </div>
            ) : null}
          </dl>

          <p className="admin-activity-log-detail__summary">{view.summary}</p>

          {view.entityUnavailable ? (
            <Alert
              tone="warning"
              title="موجودیت در دسترس نیست"
              description={
                view.entityUnavailableReason ??
                "موجودیت حذف شده یا آرشیو شده است. خود رویداد همچنان قابل مشاهده است."
              }
            />
          ) : view.entityLink?.available && view.entityLink.href ? (
            <p>
              <Link href={view.entityLink.href}>{view.entityLink.label}</Link>
            </p>
          ) : view.entityLink && !view.entityLink.available ? (
            <Alert
              tone="info"
              title="پیوند موجودیت"
              description={view.entityLink.unavailableReason ?? "پیوند در دسترس نیست."}
            />
          ) : null}

          {view.securityHidden ? (
            <Alert
              tone="warning"
              title="رویداد امنیتی"
              description="جزئیات حساس این رویداد برای نقش شما پنهان است."
            />
          ) : null}
        </Card>

        <section
          className="admin-activity-log-detail__changes"
          aria-labelledby="activity-log-changes-title"
        >
          <h2 id="activity-log-changes-title" className="text-card-title">
            تغییرات قبل / بعد
          </h2>
          {view.changesHiddenReason ? (
            <Alert tone="info" title="تغییرات پنهان" description={view.changesHiddenReason} />
          ) : null}
          {!canViewChanges ? (
            <PermissionDeniedState
              title="مشاهده تغییرات مجاز نیست"
              description="مجوز مشاهده مقادیر قبل و بعد را ندارید."
            />
          ) : showChanges ? (
            <AdminActivityLogChangeDiff changes={view.changes} />
          ) : !view.changesHiddenReason ? (
            <p className="ds-help">تغییر فیلدی برای این رویداد موجود نیست.</p>
          ) : null}
          {!canViewPrivate && view.changes.some((c) => c.sensitive) ? (
            <p className="ds-help">برخی فیلدهای حساس ماسک شده‌اند.</p>
          ) : null}
        </section>

        {view.structuredPayloadPreview ? (
          <AdminActivityLogStructuredPreview value={view.structuredPayloadPreview} />
        ) : null}
      </div>
    </>
  );
}
