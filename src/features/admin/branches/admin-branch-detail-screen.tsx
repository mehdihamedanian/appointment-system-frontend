"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AdminBreadcrumb } from "@/components/layout/admin/admin-breadcrumb";
import { AdminPageHeader } from "@/components/layout/admin/admin-page-header";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import {
  ApiErrorState,
  EmptyState,
} from "@/components/feedback/app-states";
import { InlineLoading, Skeleton } from "@/components/feedback/loading-states";
import { useToast } from "@/components/feedback/toast";
import { AdminBranchAssignmentsPanel } from "@/features/admin/branches/admin-branch-assignments-panel";
import { AdminBranchesGate } from "@/features/admin/branches/admin-branches-gate";
import { PermissionGate } from "@/features/admin/permission-gate";
import { useSession } from "@/features/auth/session-provider";
import {
  adminBranchDetailQueryOptions,
  fetchAdminBranchImpactPreview,
  submitAdminBranchLifecycleAction,
} from "@/lib/api/admin-branches";
import {
  adminBranchConflictMessage,
  isAdminBranchConflict,
} from "@/lib/admin/branch-adapter";
import { invalidateAfterAdminBranchMutation } from "@/lib/admin/branch-cache";
import { adminScheduleBranchHref } from "@/lib/admin/branch-filters";
import { createIdempotencyKey } from "@/lib/booking/idempotency";
import {
  isForbiddenError,
  isNotFoundError,
  isSessionExpiredError,
  toAppApiError,
} from "@/lib/api/errors";
import { hasPermission } from "@/lib/permissions/access";
import { routes } from "@/constants/routes";
import {
  ADMIN_BRANCH_SCHEDULE_MODE_LABELS,
  type AdminBranchImpactAction,
  type AdminBranchImpactPreview,
} from "@/types/admin-branch";
import { ADMIN_SCHEDULE_EDITOR_ENABLED } from "@/types/admin-schedule";

export function AdminBranchDetailScreen() {
  const { status, user } = useSession();
  const params = useParams<{ branchReference: string }>();
  const reference = decodeURIComponent(params.branchReference ?? "");

  if (status === "loading" || !user?.id) {
    return (
      <>
        <AdminPageHeader title="شعبه" description="جزئیات شعبه" />
        <Skeleton variant="card" />
      </>
    );
  }

  return (
    <PermissionGate permission="admin.branches.view">
      <AdminBranchesGate>
        <AdminBranchDetailReady userId={user.id} user={user} reference={reference} />
      </AdminBranchesGate>
    </PermissionGate>
  );
}

function AdminBranchDetailReady({
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
  const actionLock = useRef(false);
  const [impact, setImpact] = useState<AdminBranchImpactPreview | null>(null);
  const [impactLoading, setImpactLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [conflict, setConflict] = useState<string>();

  const detailQuery = useQuery(adminBranchDetailQueryOptions(userId, reference));
  const view = detailQuery.data;

  const canEdit =
    view?.allowedActions.edit !== false &&
    (hasPermission(user, "admin.branches.edit") || user.permissionCodes.length === 0);

  async function prepareLifecycle(action: Extract<AdminBranchImpactAction, "activate" | "deactivate" | "archive" | "delete">) {
    if (!view || actionLock.current) return;
    setImpactLoading(true);
    setConflict(undefined);
    try {
      const preview = await fetchAdminBranchImpactPreview(view.reference, action, {
        version: view.version,
      });
      setImpact(preview);
    } catch (error) {
      const apiError = toAppApiError(error);
      if (isSessionExpiredError(apiError)) {
        router.push(routes.auth.sessionExpired);
        return;
      }
      if (isNotFoundError(apiError)) {
        toast.error("پیش‌نمایش اثر هنوز متصل نیست. عملیات بدون تأیید ایمن انجام نمی‌شود.");
        return;
      }
      toast.error(apiError.message);
    } finally {
      setImpactLoading(false);
    }
  }

  async function confirmLifecycle() {
    if (!view || !impact || actionLock.current || impact.blocked) return;
    if (
      impact.action !== "activate" &&
      impact.action !== "deactivate" &&
      impact.action !== "archive" &&
      impact.action !== "delete"
    ) {
      return;
    }
    actionLock.current = true;
    setActionBusy(true);
    try {
      await submitAdminBranchLifecycleAction(
        view.reference,
        impact.action,
        {
          previewVersion: impact.previewVersion,
          version: view.version,
        },
        createIdempotencyKey(),
      );
      invalidateAfterAdminBranchMutation(queryClient, userId, view.reference, {
        lifecycleChanged: true,
        affectsAvailability: true,
        affectsAssignments: true,
      });
      toast.success("عملیات با موفقیت انجام شد.");
      setImpact(null);
      await detailQuery.refetch();
    } catch (error) {
      const apiError = toAppApiError(error);
      if (isAdminBranchConflict(apiError)) {
        setConflict(adminBranchConflictMessage());
        setImpact(null);
        await detailQuery.refetch();
        return;
      }
      toast.error(apiError.message);
    } finally {
      actionLock.current = false;
      setActionBusy(false);
    }
  }

  if (detailQuery.isPending) {
    return (
      <>
        <AdminPageHeader title="شعبه" description="در حال بارگذاری" />
        <InlineLoading label="بارگذاری شعبه" />
        <Skeleton variant="card" />
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
          title="شعبه پیدا نشد"
          description="شناسه نامعتبر است یا حذف شده."
          action={
            <Button asChild variant="secondary">
              <Link href={routes.admin.branches}>بازگشت به فهرست</Link>
            </Button>
          }
        />
      );
    }
    return (
      <ApiErrorState
        title="جزئیات شعبه دریافت نشد"
        description={error.message}
        onRetry={() => void detailQuery.refetch()}
      />
    );
  }

  const scheduleModeLabel =
    view.schedule.mode !== "unknown"
      ? ADMIN_BRANCH_SCHEDULE_MODE_LABELS[view.schedule.mode]
      : (view.schedule.sourceLabel ?? "نامشخص");

  return (
    <>
      <AdminPageHeader
        title={view.name}
        description={`${view.lifecycleLabel} · ${scheduleModeLabel}`}
        breadcrumb={
          <AdminBreadcrumb
            pathname={routes.admin.branchDetail(reference)}
            items={[
              { href: routes.admin.home, label: "پنل مدیریت" },
              { href: routes.admin.branches, label: "شعب" },
              { label: view.name },
            ]}
          />
        }
        primaryAction={
          view.allowedActions.viewCalendar !== false && view.calendarHref ? (
            <Button asChild>
              <Link href={routes.admin.branchCalendar(view.reference)}>تقویم شعبه</Link>
            </Button>
          ) : null
        }
        secondaryActions={
          canEdit ? (
            <Button asChild variant="secondary">
              <Link href={routes.admin.branchEdit(view.reference)}>ویرایش</Link>
            </Button>
          ) : null
        }
      />

      {conflict ? <Alert tone="warning" title="تداخل نسخه" description={conflict} /> : null}

      {view.operationalWarnings.length > 0 ? (
        <div className="admin-branch-warnings" role="list" aria-label="هشدارهای عملیاتی">
          {view.operationalWarnings.map((warning) => (
            <Alert
              key={warning.id}
              tone={warning.severity === "danger" ? "error" : warning.severity === "warning" ? "warning" : "info"}
              title="هشدار عملیاتی"
              description={warning.message}
            />
          ))}
        </div>
      ) : null}

      <section className="admin-branch-detail" aria-labelledby="branch-detail-title">
        <h2 id="branch-detail-title" className="visually-hidden">
          جزئیات شعبه
        </h2>

        <div className="admin-branch-detail__head">
          <span className="admin-branch-lifecycle" data-lifecycle={view.lifecycle}>
            {view.lifecycleLabel}
          </span>
          {view.publicTitle && view.publicTitle !== view.name ? (
            <span className="text-caption">{view.publicTitle}</span>
          ) : null}
        </div>

        <section aria-labelledby="branch-contact-title">
          <h3 id="branch-contact-title" className="text-card-title">
            اطلاعات تماس و عمومی
          </h3>
          <dl className="booking-summary">
            <div>
              <dt>شناسه</dt>
              <dd className="ltr-value">{view.reference}</dd>
            </div>
            {view.address ? (
              <div>
                <dt>آدرس</dt>
                <dd>{view.address}</dd>
              </div>
            ) : null}
            {view.phone ? (
              <div>
                <dt>تلفن</dt>
                <dd className="ltr-value">{view.phone}</dd>
              </div>
            ) : null}
            {view.location?.latitude != null && view.location.longitude != null ? (
              <div>
                <dt>مختصات</dt>
                <dd className="ltr-value">
                  {view.location.latitude}, {view.location.longitude}
                </dd>
              </div>
            ) : null}
            {view.location?.mapUrl ? (
              <div>
                <dt>نقشه</dt>
                <dd>
                  <a href={view.location.mapUrl} className="ltr-value" target="_blank" rel="noopener noreferrer">
                    {view.location.mapUrl}
                  </a>
                </dd>
              </div>
            ) : null}
            {view.timezone ? (
              <div>
                <dt>منطقه زمانی</dt>
                <dd className="ltr-value">{view.timezone}</dd>
              </div>
            ) : null}
          </dl>
        </section>

        <section aria-labelledby="branch-schedule-title">
          <h3 id="branch-schedule-title" className="text-card-title">
            زمان‌بندی مؤثر
          </h3>
          <p>{view.schedule.sourceLabel ?? scheduleModeLabel}</p>
          {view.schedule.summary ? <p className="ds-help">{view.schedule.summary}</p> : null}
          <ul className="admin-branch-schedule-list">
            {view.schedule.workingHoursLabel ? (
              <li>ساعات کاری: {view.schedule.workingHoursLabel}</li>
            ) : null}
            {view.holidaysSummary ?? view.schedule.holidaysLabel ? (
              <li>تعطیلات: {view.holidaysSummary ?? view.schedule.holidaysLabel}</li>
            ) : null}
          </ul>
          {ADMIN_SCHEDULE_EDITOR_ENABLED &&
          (view.allowedActions.manageSchedule !== false || canEdit) &&
          view.scheduleHref ? (
            <Button asChild variant="secondary">
              <Link href={adminScheduleBranchHref(view.reference)}>ویرایش زمان‌بندی</Link>
            </Button>
          ) : (
            <p className="ds-help">ویرایش ساعات از منوی زمان‌بندی در دسترس است.</p>
          )}
        </section>

        <AdminBranchAssignmentsPanel
          userId={userId}
          view={view}
          onRefetch={() => void detailQuery.refetch()}
        />

        <div className="admin-branch-lifecycle-actions">
          {view.allowedActions.deactivate ? (
            <Button
              variant="secondary"
              loading={impactLoading}
              onClick={() => void prepareLifecycle("deactivate")}
            >
              غیرفعال‌سازی
            </Button>
          ) : null}
          {view.allowedActions.activate ? (
            <Button
              variant="secondary"
              loading={impactLoading}
              onClick={() => void prepareLifecycle("activate")}
            >
              فعال‌سازی
            </Button>
          ) : null}
          {view.allowedActions.archive ? (
            <Button
              variant="secondary"
              loading={impactLoading}
              onClick={() => void prepareLifecycle("archive")}
            >
              بایگانی
            </Button>
          ) : null}
          {view.allowedActions.delete ? (
            <Button
              variant="destructive"
              loading={impactLoading}
              onClick={() => void prepareLifecycle("delete")}
            >
              حذف
            </Button>
          ) : null}
        </div>
      </section>

      <ConfirmDialog
        open={Boolean(impact)}
        title={impact?.title ?? "تأیید"}
        description={
          impact
            ? [
                impact.summary,
                ...(impact.effects ?? []),
                typeof impact.futureAppointmentCount === "number"
                  ? `نوبت‌های آینده: ${impact.futureAppointmentCount}`
                  : "",
                impact.waitingListAffected ? "لیست انتظار تحت تأثیر است." : "",
                impact.availabilityAffected ? "دسترسی‌پذیری تغییر می‌کند." : "",
                impact.blockedReason ?? "",
              ]
                .filter(Boolean)
                .join(" ")
            : ""
        }
        confirmLabel={impact?.confirmLabel ?? "تأیید و ادامه"}
        cancelLabel="انصراف"
        variant={impact?.action === "delete" ? "destructive" : "primary"}
        busy={actionBusy}
        onCancel={() => setImpact(null)}
        onConfirm={() => {
          if (impact?.blocked) return;
          void confirmLifecycle();
        }}
      />
    </>
  );
}
