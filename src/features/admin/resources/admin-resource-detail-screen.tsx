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
import { PermissionGate } from "@/features/admin/permission-gate";
import { useSession } from "@/features/auth/session-provider";
import {
  adminResourceDetailQueryOptions,
  fetchAdminResourceImpactPreview,
  submitAdminResourceLifecycleAction,
} from "@/lib/api/admin-resources";
import {
  adminResourceConflictMessage,
  isAdminResourceConflict,
} from "@/lib/admin/resource-adapter";
import { adminScheduleResourceHref } from "@/lib/admin/schedule-filters";
import { invalidateAfterAdminResourceMutation } from "@/lib/admin/resource-cache";
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
  ADMIN_RESOURCE_SCHEDULE_MODE_LABELS,
  type AdminResourceImpactAction,
  type AdminResourceImpactPreview,
} from "@/types/admin-resource";
import { ADMIN_SCHEDULE_EDITOR_ENABLED } from "@/types/admin-schedule";

export function AdminResourceDetailScreen() {
  const { status, user } = useSession();
  const params = useParams<{ resourceReference: string }>();
  const reference = decodeURIComponent(params.resourceReference ?? "");

  if (status === "loading" || !user?.id) {
    return (
      <>
        <AdminPageHeader title="منبع" description="جزئیات منبع عملیاتی" />
        <Skeleton variant="card" />
      </>
    );
  }

  return (
    <PermissionGate permission="admin.resources.view">
      <AdminResourceDetailReady userId={user.id} user={user} reference={reference} />
    </PermissionGate>
  );
}

function AdminResourceDetailReady({
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
  const [impact, setImpact] = useState<AdminResourceImpactPreview | null>(null);
  const [impactLoading, setImpactLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [conflict, setConflict] = useState<string>();

  const detailQuery = useQuery(adminResourceDetailQueryOptions(userId, reference));
  const view = detailQuery.data;

  const canEdit =
    view?.allowedActions.edit !== false &&
    (hasPermission(user, "admin.resources.edit") || user.permissionCodes.length === 0);

  async function prepareAction(action: AdminResourceImpactAction) {
    if (!view || actionLock.current) return;
    setImpactLoading(true);
    setConflict(undefined);
    try {
      const preview = await fetchAdminResourceImpactPreview(view.reference, action, {
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

  async function confirmImpact() {
    if (!view || !impact || actionLock.current || impact.blocked) return;
    actionLock.current = true;
    setActionBusy(true);
    try {
      await submitAdminResourceLifecycleAction(
        view.reference,
        impact.action,
        {
          previewVersion: impact.previewVersion,
          version: view.version,
        },
        createIdempotencyKey(),
      );
      invalidateAfterAdminResourceMutation(queryClient, userId, view.reference, {
        affectsCustomerVisibleProvider: view.type === "staff" && view.customerVisible,
      });
      toast.success("عملیات با موفقیت انجام شد.");
      setImpact(null);
      await detailQuery.refetch();
    } catch (error) {
      const apiError = toAppApiError(error);
      if (isAdminResourceConflict(apiError)) {
        setConflict(adminResourceConflictMessage());
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
        <AdminPageHeader title="منبع" description="در حال بارگذاری" />
        <InlineLoading label="بارگذاری منبع" />
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
          title="منبع پیدا نشد"
          description="شناسه منبع نامعتبر است یا حذف شده است."
          action={
            <Button asChild variant="secondary">
              <Link href={routes.admin.resources}>بازگشت به فهرست</Link>
            </Button>
          }
        />
      );
    }
    return (
      <ApiErrorState
        title="جزئیات منبع دریافت نشد"
        description={error.message}
        onRetry={() => void detailQuery.refetch()}
      />
    );
  }

  return (
    <>
      <AdminPageHeader
        title={view.name}
        description={`${view.typeLabel} · ${view.lifecycleLabel}`}
        breadcrumb={
          <AdminBreadcrumb
            pathname={routes.admin.resources}
            items={[
              { href: routes.admin.home, label: "پنل مدیریت" },
              { href: routes.admin.resources, label: "منابع" },
              { label: view.name },
            ]}
          />
        }
        primaryAction={
          view.allowedActions.viewCalendar !== false && view.calendarHref ? (
            <Button asChild>
              <Link href={routes.admin.resourceCalendar(view.reference)}>تقویم منبع</Link>
            </Button>
          ) : null
        }
        secondaryActions={
          canEdit ? (
            <Button asChild variant="secondary">
              <Link href={routes.admin.resourceEdit(view.reference)}>ویرایش</Link>
            </Button>
          ) : null
        }
      />

      {conflict ? <Alert tone="warning" title="تداخل نسخه" description={conflict} /> : null}

      <section className="admin-resource-detail" aria-labelledby="resource-detail-title">
        <h2 id="resource-detail-title" className="visually-hidden">
          جزئیات منبع
        </h2>
        <dl className="booking-summary">
          <div>
            <dt>شناسه</dt>
            <dd className="ltr-value">{view.reference}</dd>
          </div>
          <div>
            <dt>نوع</dt>
            <dd>{view.typeLabel}</dd>
          </div>
          <div>
            <dt>وضعیت</dt>
            <dd>
              <span data-lifecycle={view.lifecycle}>{view.lifecycleLabel}</span>
            </dd>
          </div>
          {view.branch ? (
            <div>
              <dt>شعبه</dt>
              <dd>{view.branch.name}</dd>
            </div>
          ) : null}
          {view.capacity ? (
            <div>
              <dt>ظرفیت</dt>
              <dd>
                <span className="ltr-value">{view.capacity.label ?? view.capacity.value}</span>
                {view.capacity.semanticsLabel ? (
                  <p className="ds-help">{view.capacity.semanticsLabel}</p>
                ) : null}
              </dd>
            </div>
          ) : null}
          {view.description ? (
            <div>
              <dt>توضیحات</dt>
              <dd>{view.description}</dd>
            </div>
          ) : null}
        </dl>

        <section aria-labelledby="schedule-summary-title">
          <h3 id="schedule-summary-title" className="text-card-title">
            زمان‌بندی مؤثر
          </h3>
          <p>
            {view.schedule.sourceLabel ??
              ADMIN_RESOURCE_SCHEDULE_MODE_LABELS[view.schedule.mode]}
          </p>
          {view.schedule.summary ? <p className="ds-help">{view.schedule.summary}</p> : null}
          <ul className="admin-resource-schedule-list">
            {view.schedule.workingHoursLabel ? (
              <li>ساعات کاری: {view.schedule.workingHoursLabel}</li>
            ) : null}
            {view.schedule.breaksLabel ? <li>استراحت: {view.schedule.breaksLabel}</li> : null}
            {view.schedule.timeOffLabel ? <li>مرخصی: {view.schedule.timeOffLabel}</li> : null}
            {view.schedule.blockTimeLabel ? (
              <li>زمان مسدود: {view.schedule.blockTimeLabel}</li>
            ) : null}
          </ul>
          {ADMIN_SCHEDULE_EDITOR_ENABLED &&
          (view.allowedActions.manageSchedule !== false || canEdit) ? (
            <Button asChild variant="secondary">
              <Link href={adminScheduleResourceHref(reference)}>ویرایش زمان‌بندی</Link>
            </Button>
          ) : (
            <p className="ds-help">ویرایش زمان‌بندی از منوی زمان‌بندی در دسترس است.</p>
          )}
        </section>

        {view.relatedServices.length > 0 ? (
          <section aria-labelledby="related-services-title">
            <h3 id="related-services-title" className="text-card-title">
              خدمات مرتبط
            </h3>
            <ul>
              {view.relatedServices.map((service) => (
                <li key={service.id}>{service.name}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {view.type === "staff" && view.staffHref ? (
          <Alert
            tone="info"
            title="منبع از نوع کارمند"
            description="برای تخصص، پرونده و مدیریت شغلی به ماژول کارکنان بروید."
          />
        ) : null}
        {view.type === "staff" && view.staffHref ? (
          <Button asChild variant="secondary">
            <Link href={view.staffHref}>باز کردن پرونده کارکنان</Link>
          </Button>
        ) : null}

        <div className="admin-resource-lifecycle-actions">
          {view.allowedActions.deactivate ? (
            <Button
              variant="secondary"
              loading={impactLoading}
              onClick={() => void prepareAction("deactivate")}
            >
              غیرفعال‌سازی
            </Button>
          ) : null}
          {view.allowedActions.activate ? (
            <Button
              variant="secondary"
              loading={impactLoading}
              onClick={() => void prepareAction("activate")}
            >
              فعال‌سازی
            </Button>
          ) : null}
          {view.allowedActions.archive ? (
            <Button
              variant="secondary"
              loading={impactLoading}
              onClick={() => void prepareAction("archive")}
            >
              بایگانی
            </Button>
          ) : null}
          {view.allowedActions.delete ? (
            <Button
              variant="destructive"
              loading={impactLoading}
              onClick={() => void prepareAction("delete")}
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
          void confirmImpact();
        }}
      />
    </>
  );
}
