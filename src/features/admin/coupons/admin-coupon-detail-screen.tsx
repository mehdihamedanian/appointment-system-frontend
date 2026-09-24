"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/data-display";
import { AdminBreadcrumb } from "@/components/layout/admin/admin-breadcrumb";
import { AdminPageHeader } from "@/components/layout/admin/admin-page-header";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import {
  ApiErrorState,
  EmptyState,
} from "@/components/feedback/app-states";
import { InlineLoading } from "@/components/feedback/loading-states";
import { useToast } from "@/components/feedback/toast";
import { AdminCouponsGate } from "@/features/admin/coupons/admin-coupons-gate";
import { AdminCouponDetailSkeleton } from "@/features/admin/coupons/admin-coupon-skeleton";
import { PermissionGate } from "@/features/admin/permission-gate";
import { useSession } from "@/features/auth/session-provider";
import {
  adminCouponConflictMessage,
  isAdminCouponConflict,
} from "@/lib/admin/coupon-adapter";
import { invalidateAfterAdminCouponMutation } from "@/lib/admin/coupon-cache";
import {
  adminCouponDetailHref,
  adminCouponEditHref,
  couponPermission,
} from "@/lib/admin/coupon-filters";
import {
  adminCouponDetailQueryOptions,
  fetchAdminCouponImpactPreview,
  submitAdminCouponLifecycleAction,
} from "@/lib/api/admin-coupons";
import { createIdempotencyKey } from "@/lib/booking/idempotency";
import {
  isForbiddenError,
  isNotFoundError,
  isSessionExpiredError,
  toAppApiError,
} from "@/lib/api/errors";
import { hasPermission } from "@/lib/permissions/access";
import { routes } from "@/constants/routes";
import type {
  AdminCouponImpactAction,
  AdminCouponImpactPreview,
} from "@/types/admin-coupon";

function CouponLifecycleBadge({ lifecycle, label }: { lifecycle: string; label: string }) {
  return (
    <span className="admin-coupon-lifecycle" data-lifecycle={lifecycle}>
      {label}
    </span>
  );
}

export function AdminCouponDetailScreen() {
  const { status, user } = useSession();
  const params = useParams<{ couponReference: string }>();
  const reference = decodeURIComponent(params.couponReference ?? "");

  if (status === "loading" || !user?.id) {
    return (
      <>
        <AdminPageHeader title="کوپن" description="جزئیات کوپن" />
        <AdminCouponDetailSkeleton />
      </>
    );
  }

  return (
    <PermissionGate permission={couponPermission("view")}>
      <AdminCouponsGate>
        <AdminCouponDetailReady userId={user.id} user={user} reference={reference} />
      </AdminCouponsGate>
    </PermissionGate>
  );
}

function AdminCouponDetailReady({
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
  const [impact, setImpact] = useState<AdminCouponImpactPreview | null>(null);
  const [impactAction, setImpactAction] = useState<AdminCouponImpactAction>();
  const [impactLoading, setImpactLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [conflict, setConflict] = useState<string>();

  const detailQuery = useQuery(adminCouponDetailQueryOptions(userId, reference));
  const view = detailQuery.data;

  const canEdit =
    view?.allowedActions.edit !== false &&
    (hasPermission(user, couponPermission("edit")) || user.permissionCodes.length === 0);
  const canLifecycle =
    hasPermission(user, couponPermission("lifecycle")) || user.permissionCodes.length === 0;

  async function prepareLifecycle(action: Extract<AdminCouponImpactAction, "pause" | "activate" | "archive">) {
    if (!view || actionLock.current) return;
    setImpactLoading(true);
    setConflict(undefined);
    setImpactAction(action);
    try {
      const preview = await fetchAdminCouponImpactPreview(view.reference, action);
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
    if (!view || !impact || !impactAction || actionLock.current || impact.blocked) return;
    if (impactAction !== "pause" && impactAction !== "activate" && impactAction !== "archive") {
      return;
    }
    actionLock.current = true;
    setActionBusy(true);
    try {
      await submitAdminCouponLifecycleAction(
        view.reference,
        impactAction,
        createIdempotencyKey(),
        view.version,
      );
      invalidateAfterAdminCouponMutation(queryClient, userId, view.reference);
      toast.success("عملیات با موفقیت انجام شد.");
      setImpact(null);
      setImpactAction(undefined);
      await detailQuery.refetch();
    } catch (error) {
      const apiError = toAppApiError(error);
      if (isAdminCouponConflict(apiError)) {
        setConflict(adminCouponConflictMessage());
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
        <AdminPageHeader title="کوپن" description="در حال بارگذاری" />
        <InlineLoading label="بارگذاری کوپن" />
        <AdminCouponDetailSkeleton />
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
          title="کوپن پیدا نشد"
          description="شناسه نامعتبر است یا حذف شده."
          action={
            <Button asChild variant="secondary">
              <Link href={routes.admin.coupons}>بازگشت به فهرست</Link>
            </Button>
          }
        />
      );
    }
    return (
      <ApiErrorState
        title="جزئیات کوپن دریافت نشد"
        description={error.message}
        onRetry={() => void detailQuery.refetch()}
      />
    );
  }

  const usageParts = [
    view.stats.confirmedUsage !== undefined
      ? `${new Intl.NumberFormat("fa-IR").format(view.stats.confirmedUsage)} مصرف`
      : null,
    view.stats.totalUsageLimit !== undefined
      ? `از ${new Intl.NumberFormat("fa-IR").format(view.stats.totalUsageLimit)}`
      : view.stats.usageLimitLabel ?? null,
    view.stats.remainingUsage !== undefined
      ? `${new Intl.NumberFormat("fa-IR").format(view.stats.remainingUsage)} باقی‌مانده`
      : null,
  ].filter(Boolean);

  return (
    <>
      <AdminPageHeader
        title={view.title}
        description={
          view.serverStatusLabel
            ? `وضعیت سرویس: ${view.serverStatusLabel}`
            : view.lifecycleLabel
        }
        breadcrumb={
          <AdminBreadcrumb
            pathname={adminCouponDetailHref(view.reference)}
            items={[
              { href: routes.admin.home, label: "پنل مدیریت" },
              { href: routes.admin.coupons, label: "کوپن‌ها" },
              { label: view.code },
            ]}
          />
        }
        secondaryActions={
          <>
            {canEdit ? (
              <Button asChild variant="secondary">
                <Link href={adminCouponEditHref(view.reference)}>ویرایش</Link>
              </Button>
            ) : null}
            <Button variant="secondary" onClick={() => void detailQuery.refetch()}>
              به‌روزرسانی
            </Button>
          </>
        }
      />

      {conflict ? <Alert tone="warning" title="تداخل نسخه" description={conflict} /> : null}
      {view.allowedActions.blockedReason ? (
        <Alert tone="warning" title="محدودیت" description={view.allowedActions.blockedReason} />
      ) : null}

      <section className="admin-coupon-detail">
        <Card title="شناسه">
          <dl className="admin-coupon-detail__meta">
            <div>
              <dt>کد</dt>
              <dd className="ltr-value admin-coupon-code">{view.code}</dd>
            </div>
            <div>
              <dt>وضعیت</dt>
              <dd>
                <CouponLifecycleBadge lifecycle={view.lifecycle} label={view.lifecycleLabel} />
              </dd>
            </div>
            {view.serverTimeLabel ? (
              <div>
                <dt>زمان سرویس</dt>
                <dd>{view.serverTimeLabel}</dd>
              </div>
            ) : null}
            {view.createdAtLabel ? (
              <div>
                <dt>ایجاد</dt>
                <dd>{view.createdAtLabel}</dd>
              </div>
            ) : null}
            {view.updatedAtLabel ? (
              <div>
                <dt>به‌روزرسانی</dt>
                <dd>{view.updatedAtLabel}</dd>
              </div>
            ) : null}
            {view.authorLabel ? (
              <div>
                <dt>ایجادکننده</dt>
                <dd>{view.authorLabel}</dd>
              </div>
            ) : null}
          </dl>
        </Card>

        <Card title="تخفیف">
          <dl className="admin-coupon-detail__meta">
            <div>
              <dt>نوع</dt>
              <dd>{view.discountTypeLabel}</dd>
            </div>
            <div>
              <dt>مقدار</dt>
              <dd className="ltr-value">{view.discountValueLabel}</dd>
            </div>
            {view.restrictions.minimumAmountLabel ? (
              <div>
                <dt>حداقل مبلغ</dt>
                <dd className="ltr-value">{view.restrictions.minimumAmountLabel}</dd>
              </div>
            ) : null}
            {view.restrictions.maximumDiscountLabel ? (
              <div>
                <dt>حداکثر تخفیف</dt>
                <dd className="ltr-value">{view.restrictions.maximumDiscountLabel}</dd>
              </div>
            ) : null}
          </dl>
          {view.ruleSummary ? <p className="admin-coupon-detail__summary">{view.ruleSummary}</p> : null}
        </Card>

        <Card title="اعتبار">
          {view.timezoneLabel ? (
            <p className="admin-coupon-form__timezone">منطقه زمانی: {view.timezoneLabel}</p>
          ) : null}
          <dl className="admin-coupon-detail__meta">
            <div>
              <dt>شروع</dt>
              <dd>{view.startsAtLabel ?? "—"}</dd>
            </div>
            <div>
              <dt>پایان</dt>
              <dd>{view.endsAtLabel ?? "—"}</dd>
            </div>
          </dl>
        </Card>

        <Card title="محدودیت‌ها">
          <dl className="admin-coupon-detail__meta">
            <div>
              <dt>خدمات</dt>
              <dd>
                {view.restrictions.serviceLabels.length
                  ? view.restrictions.serviceLabels.join("، ")
                  : "همه خدمات"}
              </dd>
            </div>
            {view.restrictions.branchLabels.length ? (
              <div>
                <dt>شعب</dt>
                <dd>{view.restrictions.branchLabels.join("، ")}</dd>
              </div>
            ) : null}
            {view.restrictions.customerRestrictionLabel ? (
              <div>
                <dt>مشتری</dt>
                <dd>{view.restrictions.customerRestrictionLabel}</dd>
              </div>
            ) : null}
          </dl>
        </Card>

        <Card title="آمار مصرف">
          <dl className="admin-coupon-detail__meta">
            {usageParts.length ? (
              <div>
                <dt>مصرف</dt>
                <dd>{usageParts.join(" · ")}</dd>
              </div>
            ) : null}
            {view.stats.perCustomerLimit !== undefined ? (
              <div>
                <dt>سقف هر مشتری</dt>
                <dd>{new Intl.NumberFormat("fa-IR").format(view.stats.perCustomerLimit)}</dd>
              </div>
            ) : null}
            {view.stats.uniqueCustomers !== undefined ? (
              <div>
                <dt>مشتریان یکتا</dt>
                <dd>{new Intl.NumberFormat("fa-IR").format(view.stats.uniqueCustomers)}</dd>
              </div>
            ) : null}
            {view.stats.totalDiscountedLabel ? (
              <div>
                <dt>مجموع تخفیف</dt>
                <dd className="ltr-value booking-money">{view.stats.totalDiscountedLabel}</dd>
              </div>
            ) : null}
          </dl>
        </Card>

        {view.capabilities.supportsUsageHistory && view.usageHistory.length ? (
          <Card title="تاریخچه مصرف">
            <ul className="admin-coupon-usage-history">
              {view.usageHistory.map((entry) => (
                <li key={entry.id}>
                  <div className="admin-coupon-usage-history__head">
                    <span>{entry.usedAtLabel ?? "—"}</span>
                    {entry.statusLabel ? <span>{entry.statusLabel}</span> : null}
                  </div>
                  {entry.customerLabel ? <p>{entry.customerLabel}</p> : null}
                  {entry.discountLabel ? (
                    <p className="ltr-value booking-money">{entry.discountLabel}</p>
                  ) : null}
                  {entry.appointmentReference ? (
                    <Link href={routes.admin.appointmentDetail(entry.appointmentReference)}>
                      نوبت {entry.appointmentReference}
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        {canLifecycle ? (
          <div className="admin-coupon-detail__actions">
            {view.allowedActions.pause ? (
              <Button
                variant="secondary"
                loading={impactLoading && impactAction === "pause"}
                onClick={() => void prepareLifecycle("pause")}
              >
                توقف
              </Button>
            ) : null}
            {view.allowedActions.activate ? (
              <Button
                variant="secondary"
                loading={impactLoading && impactAction === "activate"}
                onClick={() => void prepareLifecycle("activate")}
              >
                فعال‌سازی
              </Button>
            ) : null}
            {view.allowedActions.archive ? (
              <Button
                variant="secondary"
                loading={impactLoading && impactAction === "archive"}
                onClick={() => void prepareLifecycle("archive")}
              >
                بایگانی
              </Button>
            ) : null}
          </div>
        ) : null}
      </section>

      <ConfirmDialog
        open={Boolean(impact)}
        title={impact?.title ?? "تأیید"}
        description={
          impact
            ? [
                impact.summary,
                ...(impact.effects ?? []),
                impact.existingBookingsUnchanged ? "رزروهای موجود بدون تغییر می‌مانند." : "",
                impact.blockedReason ?? "",
              ]
                .filter(Boolean)
                .join(" ")
            : ""
        }
        confirmLabel={impact?.confirmLabel ?? "تأیید و ادامه"}
        cancelLabel="انصراف"
        variant={impactAction === "archive" ? "destructive" : "primary"}
        busy={actionBusy}
        onCancel={() => {
          setImpact(null);
          setImpactAction(undefined);
        }}
        onConfirm={() => void confirmLifecycle()}
      />
    </>
  );
}
