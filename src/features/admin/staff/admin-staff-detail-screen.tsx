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
import { ApiErrorState, EmptyState } from "@/components/feedback/app-states";
import { InlineLoading, Skeleton } from "@/components/feedback/loading-states";
import { useToast } from "@/components/feedback/toast";
import { AdminStaffAvatar } from "@/features/admin/staff/admin-staff-avatar";
import { PermissionGate } from "@/features/admin/permission-gate";
import { useSession } from "@/features/auth/session-provider";
import {
  adminStaffDetailQueryOptions,
  fetchAdminStaffImpactPreview,
  submitAdminStaffLifecycleAction,
} from "@/lib/api/admin-staff";
import { adminScheduleStaffHref } from "@/lib/admin/schedule-filters";
import {
  adminStaffConflictMessage,
  isAdminStaffConflict,
} from "@/lib/admin/staff-adapter";
import { invalidateAfterAdminStaffMutation } from "@/lib/admin/staff-cache";
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
  ADMIN_STAFF_SCHEDULE_MODE_LABELS,
  type AdminStaffImpactAction,
  type AdminStaffImpactPreview,
} from "@/types/admin-staff";
import { ADMIN_SCHEDULE_EDITOR_ENABLED } from "@/types/admin-schedule";

export function AdminStaffDetailScreen() {
  const { status, user } = useSession();
  const params = useParams<{ staffReference: string }>();
  const reference = decodeURIComponent(params.staffReference ?? "");

  if (status === "loading" || !user?.id) {
    return (
      <>
        <AdminPageHeader title="کارمند" description="جزئیات پرسنل" />
        <Skeleton variant="card" />
      </>
    );
  }

  return (
    <PermissionGate permission="admin.staff.view">
      <AdminStaffDetailReady userId={user.id} user={user} reference={reference} />
    </PermissionGate>
  );
}

function AdminStaffDetailReady({
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
  const [impact, setImpact] = useState<AdminStaffImpactPreview | null>(null);
  const [impactLoading, setImpactLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [conflict, setConflict] = useState<string>();

  const detailQuery = useQuery(adminStaffDetailQueryOptions(userId, reference));
  const view = detailQuery.data;

  const canEdit =
    view?.allowedActions.edit !== false &&
    (hasPermission(user, "admin.staff.edit") || user.permissionCodes.length === 0);

  async function prepareAction(action: AdminStaffImpactAction, context?: { branchId?: string; serviceId?: string }) {
    if (!view || actionLock.current) return;
    setImpactLoading(true);
    setConflict(undefined);
    try {
      const preview = await fetchAdminStaffImpactPreview(view.reference, action, {
        version: view.version,
        branchId: context?.branchId,
        serviceId: context?.serviceId,
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
      await submitAdminStaffLifecycleAction(
        view.reference,
        impact.action,
        {
          previewVersion: impact.previewVersion,
          version: view.version,
          branchId: impact.contextId && impact.action === "remove_branch" ? impact.contextId : undefined,
          serviceId: impact.contextId && impact.action === "remove_service" ? impact.contextId : undefined,
        },
        createIdempotencyKey(),
      );
      invalidateAfterAdminStaffMutation(queryClient, userId, view.reference, {
        affectsCustomerVisibleProvider: view.customerVisible,
        affectsBookableProvider: view.bookable,
        affectsServiceAssignment: true,
      });
      toast.success("عملیات با موفقیت انجام شد.");
      setImpact(null);
      await detailQuery.refetch();
    } catch (error) {
      const apiError = toAppApiError(error);
      if (isAdminStaffConflict(apiError)) {
        setConflict(adminStaffConflictMessage());
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
        <AdminPageHeader title="کارمند" description="در حال بارگذاری" />
        <InlineLoading label="بارگذاری کارمند" />
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
          title="کارمند پیدا نشد"
          description="شناسه نامعتبر است یا حذف شده."
          action={
            <Button asChild variant="secondary">
              <Link href={routes.admin.staff}>بازگشت به فهرست</Link>
            </Button>
          }
        />
      );
    }
    return (
      <ApiErrorState
        title="جزئیات کارمند دریافت نشد"
        description={error.message}
        onRetry={() => void detailQuery.refetch()}
      />
    );
  }

  return (
    <>
      <AdminPageHeader
        title={view.name}
        description={`${view.jobTitle ?? "بدون سمت"} · ${view.lifecycleLabel}`}
        breadcrumb={
          <AdminBreadcrumb
            pathname={routes.admin.staff}
            items={[
              { href: routes.admin.home, label: "پنل مدیریت" },
              { href: routes.admin.staff, label: "کارکنان" },
              { label: view.name },
            ]}
          />
        }
        primaryAction={
          view.allowedActions.viewCalendar !== false && view.calendarHref ? (
            <Button asChild>
              <Link href={routes.admin.staffCalendar(view.reference)}>تقویم کارمند</Link>
            </Button>
          ) : null
        }
        secondaryActions={
          <>
            {canEdit ? (
              <Button asChild variant="secondary">
                <Link href={routes.admin.staffEdit(view.reference)}>ویرایش</Link>
              </Button>
            ) : null}
            {view.performanceHref && view.allowedActions.viewPerformance !== false ? (
              <Button asChild variant="secondary">
                <Link href={view.performanceHref}>عملکرد</Link>
              </Button>
            ) : null}
          </>
        }
      />

      {conflict ? <Alert tone="warning" title="تداخل نسخه" description={conflict} /> : null}

      <section className="admin-staff-detail" aria-labelledby="staff-detail-title">
        <h2 id="staff-detail-title" className="visually-hidden">
          جزئیات کارمند
        </h2>

        <div className="admin-staff-detail__head">
          <AdminStaffAvatar avatar={view.avatar} name={view.name} size="lg" />
          <div className="admin-staff-flags">
            <span className="admin-staff-flag" data-active={view.customerVisible ? "true" : "false"}>
              {view.customerVisible ? "نمایش مشتری" : "مخفی از مشتری"}
            </span>
            <span className="admin-staff-flag" data-active={view.bookable ? "true" : "false"}>
              {view.bookable ? "قابل رزرو" : "غیرقابل رزرو"}
            </span>
            <span data-lifecycle={view.lifecycle}>{view.lifecycleLabel}</span>
          </div>
        </div>

        <dl className="booking-summary">
          <div>
            <dt>شناسه</dt>
            <dd className="ltr-value">{view.reference}</dd>
          </div>
          {view.jobTitle ? (
            <div>
              <dt>سمت</dt>
              <dd>{view.jobTitle}</dd>
            </div>
          ) : null}
          {view.specialty ? (
            <div>
              <dt>تخصص</dt>
              <dd>{view.specialty}</dd>
            </div>
          ) : null}
          {view.publicDescription ? (
            <div>
              <dt>توضیحات مشتری</dt>
              <dd>{view.publicDescription}</dd>
            </div>
          ) : null}
          {view.privateContact ? (
            <div>
              <dt>تماس خصوصی</dt>
              <dd>
                {view.privateContact.phone ? (
                  <div className="ltr-value">{view.privateContact.phone}</div>
                ) : null}
                {view.privateContact.email ? (
                  <div className="ltr-value">{view.privateContact.email}</div>
                ) : null}
                {view.privateContact.masked ? (
                  <p className="ds-help">اطلاعات تماس ماسک شده — مجوز کامل لازم است.</p>
                ) : null}
              </dd>
            </div>
          ) : null}
          {view.branches.length > 0 ? (
            <div>
              <dt>شعب</dt>
              <dd>
                {view.branches
                  .map((b) => (b.primary ? `${b.name} (اصلی)` : b.name))
                  .join("، ")}
              </dd>
            </div>
          ) : null}
          {view.services.length > 0 ? (
            <div>
              <dt>خدمات</dt>
              <dd>{view.services.map((s) => s.name).join("، ")}</dd>
            </div>
          ) : null}
        </dl>

        {view.resourceHref ? (
          <Alert
            tone="info"
            title="مرجع منبع زمان‌بندی"
            description="این کارمند در مدل یکپارچه Resource نیز ثبت شده است."
          />
        ) : null}
        {view.resourceHref ? (
          <Button asChild variant="secondary">
            <Link href={view.resourceHref}>مشاهده منبع</Link>
          </Button>
        ) : null}

        {view.adminUserHref ? (
          <p className="ds-help">
            حساب مدیریت:{" "}
            <Link href={view.adminUserHref} className="ltr-value">
              {view.adminUserReference}
            </Link>
          </p>
        ) : (
          <p className="ds-help">این کارمند حساب ورود جداگانه به پنل مدیریت ندارد.</p>
        )}

        <section aria-labelledby="staff-schedule-title">
          <h3 id="staff-schedule-title" className="text-card-title">
            زمان‌بندی مؤثر
          </h3>
          <p>
            {view.schedule.sourceLabel ?? ADMIN_STAFF_SCHEDULE_MODE_LABELS[view.schedule.mode]}
          </p>
          {view.schedule.summary ? <p className="ds-help">{view.schedule.summary}</p> : null}
          <ul className="admin-staff-schedule-list">
            {view.schedule.workingHoursLabel ? (
              <li>ساعات کاری: {view.schedule.workingHoursLabel}</li>
            ) : null}
            {view.schedule.breaksLabel ? <li>استراحت: {view.schedule.breaksLabel}</li> : null}
            {view.schedule.leaveLabel ? <li>مرخصی: {view.schedule.leaveLabel}</li> : null}
            {view.schedule.blockTimeLabel ? (
              <li>زمان مسدود: {view.schedule.blockTimeLabel}</li>
            ) : null}
          </ul>
          {ADMIN_SCHEDULE_EDITOR_ENABLED &&
          (view.allowedActions.manageSchedule !== false || canEdit) ? (
            <Button asChild variant="secondary">
              <Link href={adminScheduleStaffHref(reference)}>ویرایش زمان‌بندی</Link>
            </Button>
          ) : (
            <p className="ds-help">ویرایش زمان‌بندی از منوی زمان‌بندی در دسترس است.</p>
          )}
        </section>

        <div className="admin-staff-lifecycle-actions">
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
