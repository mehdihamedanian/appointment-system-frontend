"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/data-display";
import { FormField } from "@/components/ui/form-field";
import { Textarea } from "@/components/ui/input";
import { Radio, RadioGroup } from "@/components/ui/selection";
import { AdminBreadcrumb } from "@/components/layout/admin/admin-breadcrumb";
import { AdminPageHeader } from "@/components/layout/admin/admin-page-header";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import {
  ApiErrorState,
  EmptyState,
} from "@/components/feedback/app-states";
import { InlineLoading } from "@/components/feedback/loading-states";
import { useToast } from "@/components/feedback/toast";
import { OfferCountdown } from "@/features/customer/offer-countdown";
import { AdminWaitingListGate } from "@/features/admin/waiting-list/admin-waiting-list-gate";
import { AdminWaitingListDetailSkeleton } from "@/features/admin/waiting-list/admin-waiting-list-skeleton";
import { PermissionGate } from "@/features/admin/permission-gate";
import { useSession } from "@/features/auth/session-provider";
import {
  adminWaitingListConflictMessage,
  isAdminWaitingListConflict,
} from "@/lib/admin/waiting-list-adapter";
import { invalidateAfterAdminWaitingListMutation } from "@/lib/admin/waiting-list-cache";
import {
  adminWaitingListDetailHref,
  adminWaitingListOfferHref,
  waitingListPermission,
} from "@/lib/admin/waiting-list-filters";
import {
  adminWaitingListDetailQueryOptions,
  fetchAdminWaitingListImpactPreview,
  retryAdminWaitingListNotification,
  submitAdminWaitingListLifecycleAction,
} from "@/lib/api/admin-waiting-list";
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
  AdminWaitingListImpactAction,
  AdminWaitingListImpactPreview,
} from "@/types/admin-waiting-list";

function EntryStatusBadge({ status, label }: { status: string; label: string }) {
  return (
    <span className="admin-wl-entry-status" data-status={status}>
      {label}
    </span>
  );
}

function OfferStatusBadge({ status, label }: { status: string; label: string }) {
  return (
    <span className="admin-wl-offer-status" data-status={status}>
      {label}
    </span>
  );
}

export function AdminWaitingListDetailScreen() {
  const { status, user } = useSession();
  const params = useParams<{ entryReference: string }>();
  const reference = decodeURIComponent(params.entryReference ?? "");

  if (status === "loading" || !user?.id) {
    return (
      <>
        <AdminPageHeader title="لیست انتظار" description="جزئیات درخواست" />
        <AdminWaitingListDetailSkeleton />
      </>
    );
  }

  return (
    <PermissionGate permission={waitingListPermission("view")}>
      <AdminWaitingListGate>
        <AdminWaitingListDetailReady userId={user.id} user={user} reference={reference} />
      </AdminWaitingListGate>
    </PermissionGate>
  );
}

function AdminWaitingListDetailReady({
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
  const [impact, setImpact] = useState<AdminWaitingListImpactPreview | null>(null);
  const [impactAction, setImpactAction] = useState<AdminWaitingListImpactAction>();
  const [impactLoading, setImpactLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [conflict, setConflict] = useState<string>();
  const [reason, setReason] = useState("");

  const detailQuery = useQuery(adminWaitingListDetailQueryOptions(userId, reference));
  const view = detailQuery.data;
  const [fallbackReceivedAt] = useState(() => Date.now());
  const offerReceivedAt = detailQuery.dataUpdatedAt || fallbackReceivedAt;

  const canContact =
    view?.allowedActions.viewContact === true &&
    (hasPermission(user, waitingListPermission("contact")) || user.permissionCodes.length === 0);
  const canOffer =
    view?.allowedActions.sendOffer === true &&
    (hasPermission(user, waitingListPermission("offer")) || user.permissionCodes.length === 0);
  const canLifecycle =
    hasPermission(user, waitingListPermission("lifecycle")) || user.permissionCodes.length === 0;
  const canRetryNotification =
    view?.allowedActions.retryNotification === true &&
    (hasPermission(user, waitingListPermission("notifications")) || user.permissionCodes.length === 0);

  async function prepareLifecycle(action: AdminWaitingListImpactAction) {
    if (!view || actionLock.current) return;
    setImpactLoading(true);
    setConflict(undefined);
    setImpactAction(action);
    try {
      const preview = await fetchAdminWaitingListImpactPreview(view.reference, action);
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
    if (impact.requiresReason && !reason.trim()) {
      toast.error("دلیل عملیات الزامی است.");
      return;
    }
    actionLock.current = true;
    setActionBusy(true);
    try {
      await submitAdminWaitingListLifecycleAction(
        view.reference,
        impactAction,
        createIdempotencyKey(),
        {
          reason: reason.trim() || undefined,
          previewVersion: impact.previewVersion,
          version: view.version,
        },
      );
      invalidateAfterAdminWaitingListMutation(queryClient, userId, view.reference, {
        affectsCustomerWaitingList: true,
        affectsAppointments: impactAction === "close",
      });
      toast.success("عملیات با موفقیت انجام شد.");
      setImpact(null);
      setImpactAction(undefined);
      setReason("");
      await detailQuery.refetch();
    } catch (error) {
      const apiError = toAppApiError(error);
      if (isAdminWaitingListConflict(apiError)) {
        setConflict(adminWaitingListConflictMessage());
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

  async function onRetryNotification() {
    if (!view || actionLock.current || !canRetryNotification) return;
    actionLock.current = true;
    try {
      await retryAdminWaitingListNotification(view.reference, createIdempotencyKey());
      invalidateAfterAdminWaitingListMutation(queryClient, userId, view.reference);
      toast.success("درخواست ارسال مجدد ثبت شد.");
      await detailQuery.refetch();
    } catch (error) {
      toast.error(toAppApiError(error).message);
    } finally {
      actionLock.current = false;
    }
  }

  if (detailQuery.isPending) {
    return (
      <>
        <AdminPageHeader title="لیست انتظار" description="در حال بارگذاری" />
        <InlineLoading label="بارگذاری درخواست" />
        <AdminWaitingListDetailSkeleton />
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
          title="درخواست پیدا نشد"
          description="شناسه نامعتبر است یا حذف شده."
          action={
            <Button asChild variant="secondary">
              <Link href={routes.admin.waitingList}>بازگشت به فهرست</Link>
            </Button>
          }
        />
      );
    }
    return (
      <ApiErrorState
        title="جزئیات دریافت نشد"
        description={error.message}
        onRetry={() => void detailQuery.refetch()}
      />
    );
  }

  return (
    <>
      <AdminPageHeader
        title={view.customer.displayName}
        description={view.serviceName}
        breadcrumb={
          <AdminBreadcrumb
            pathname={adminWaitingListDetailHref(view.reference)}
            items={[
              { href: routes.admin.home, label: "پنل مدیریت" },
              { href: routes.admin.waitingList, label: "لیست انتظار" },
              { label: view.reference },
            ]}
          />
        }
        secondaryActions={
          <>
            {canOffer ? (
              <Button asChild>
                <Link href={adminWaitingListOfferHref(view.reference)}>ارسال پیشنهاد</Link>
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

      <section className="admin-waiting-list-detail">
        <Card title="درخواست">
          <dl className="admin-waiting-list-detail__meta">
            <div>
              <dt>شناسه</dt>
              <dd className="ltr-value">{view.reference}</dd>
            </div>
            <div>
              <dt>وضعیت درخواست</dt>
              <dd>
                <EntryStatusBadge status={view.entryStatus} label={view.entryStatusLabel} />
              </dd>
            </div>
            <div>
              <dt>مشتری</dt>
              <dd>
                {view.customer.href ? (
                  <Link href={view.customer.href}>{view.customer.displayName}</Link>
                ) : (
                  view.customer.displayName
                )}
              </dd>
            </div>
            {canContact && view.contactPhone ? (
              <div>
                <dt>تماس</dt>
                <dd className="ltr-value">{view.contactPhone}</dd>
              </div>
            ) : null}
            {canContact && view.contactEmail ? (
              <div>
                <dt>ایمیل</dt>
                <dd className="ltr-value">{view.contactEmail}</dd>
              </div>
            ) : !canContact && view.customer.phoneMasked ? (
              <div>
                <dt>تماس</dt>
                <dd>{view.customer.phoneMasked}</dd>
              </div>
            ) : null}
            <div>
              <dt>خدمت</dt>
              <dd>{view.serviceName}</dd>
            </div>
            {view.providerLabel ? (
              <div>
                <dt>ارائه‌دهنده ترجیحی</dt>
                <dd>{view.providerLabel}</dd>
              </div>
            ) : null}
            {view.branchName ? (
              <div>
                <dt>شعبه</dt>
                <dd>{view.branchName}</dd>
              </div>
            ) : null}
            {view.datePreferenceLabel ? (
              <div>
                <dt>ترجیح تاریخ</dt>
                <dd>{view.datePreferenceLabel}</dd>
              </div>
            ) : null}
            {view.timePreferenceLabel ? (
              <div>
                <dt>ترجیح ساعت</dt>
                <dd>{view.timePreferenceLabel}</dd>
              </div>
            ) : null}
            {view.customerNote ? (
              <div>
                <dt>یادداشت مشتری</dt>
                <dd>{view.customerNote}</dd>
              </div>
            ) : null}
            {view.createdAtLabel ? (
              <div>
                <dt>ثبت</dt>
                <dd>{view.createdAtLabel}</dd>
              </div>
            ) : null}
            {view.updatedAtLabel ? (
              <div>
                <dt>به‌روزرسانی</dt>
                <dd>{view.updatedAtLabel}</dd>
              </div>
            ) : null}
          </dl>
        </Card>

        {view.activeOffer ? (
          <Card title="پیشنهاد فعال">
            <dl className="admin-waiting-list-detail__meta">
              <div>
                <dt>وضعیت پیشنهاد</dt>
                <dd>
                  <OfferStatusBadge
                    status={view.activeOffer.status}
                    label={view.activeOffer.statusLabel}
                  />
                </dd>
              </div>
              {view.activeOffer.whenLabel ? (
                <div>
                  <dt>زمان پیشنهادی</dt>
                  <dd>{view.activeOffer.whenLabel}</dd>
                </div>
              ) : null}
              {view.activeOffer.priceLabel ? (
                <div>
                  <dt>مبلغ</dt>
                  <dd className="ltr-value booking-money">{view.activeOffer.priceLabel}</dd>
                </div>
              ) : null}
              {view.activeOffer.depositLabel ? (
                <div>
                  <dt>بیعانه</dt>
                  <dd className="ltr-value booking-money">{view.activeOffer.depositLabel}</dd>
                </div>
              ) : null}
              {view.activeOffer.expiresAt && view.activeOffer.status === "pending" ? (
                <div>
                  <dt>مهلت پاسخ</dt>
                  <dd>
                    <OfferCountdown
                      expiresAt={view.activeOffer.expiresAt}
                      serverNow={view.activeOffer.serverNow}
                      receivedAt={offerReceivedAt}
                      onExpired={() => void detailQuery.refetch()}
                    />
                  </dd>
                </div>
              ) : null}
            </dl>
          </Card>
        ) : null}

        {view.offerHistory.length ? (
          <Card title="تاریخچه پیشنهادها">
            <ul className="admin-waiting-list-offer-history">
              {view.offerHistory.map((entry) => (
                <li key={entry.id}>
                  <div className="admin-waiting-list-offer-history__head">
                    <OfferStatusBadge status={entry.status} label={entry.statusLabel} />
                    {entry.whenLabel ? <span>{entry.whenLabel}</span> : null}
                  </div>
                  {entry.sentByLabel ? <p>ارسال‌کننده: {entry.sentByLabel}</p> : null}
                  {entry.createdAtLabel ? (
                    <p className="text-caption">{entry.createdAtLabel}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        {view.notification ? (
          <Card title="اعلان">
            <dl className="admin-waiting-list-detail__meta">
              <div>
                <dt>وضعیت</dt>
                <dd>{view.notification.stateLabel}</dd>
              </div>
              {view.notification.channelLabel ? (
                <div>
                  <dt>کانال</dt>
                  <dd>{view.notification.channelLabel}</dd>
                </div>
              ) : null}
              {view.notification.lastAttemptLabel ? (
                <div>
                  <dt>آخرین تلاش</dt>
                  <dd>{view.notification.lastAttemptLabel}</dd>
                </div>
              ) : null}
              {view.notification.failureReason ? (
                <div>
                  <dt>خطا</dt>
                  <dd>{view.notification.failureReason}</dd>
                </div>
              ) : null}
            </dl>
            {canRetryNotification && view.notification.canRetry ? (
              <Button variant="secondary" size="sm" onClick={() => void onRetryNotification()}>
                تلاش مجدد ارسال
              </Button>
            ) : null}
          </Card>
        ) : null}

        {view.appointmentHref ? (
          <Card title="نوبت مرتبط">
            <Link href={view.appointmentHref}>مشاهده نوبت {view.appointmentReference}</Link>
          </Card>
        ) : null}

        {view.internalNotes.length ? (
          <Card title="یادداشت‌های داخلی">
            <ul className="admin-waiting-list-notes">
              {view.internalNotes.map((note) => (
                <li key={note.id}>
                  <p>{note.body}</p>
                  {note.authorLabel || note.createdAtLabel ? (
                    <p className="text-caption">
                      {[note.authorLabel, note.createdAtLabel].filter(Boolean).join(" · ")}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        {canLifecycle ? (
          <div className="admin-waiting-list-detail__actions">
            {view.allowedActions.cancel ? (
              <Button
                variant="secondary"
                loading={impactLoading && impactAction === "cancel"}
                onClick={() => void prepareLifecycle("cancel")}
              >
                لغو درخواست
              </Button>
            ) : null}
            {view.allowedActions.close ? (
              <Button
                variant="secondary"
                loading={impactLoading && impactAction === "close"}
                onClick={() => void prepareLifecycle("close")}
              >
                بستن بدون نوبت
              </Button>
            ) : null}
            {view.allowedActions.remove ? (
              <Button
                variant="secondary"
                loading={impactLoading && impactAction === "remove"}
                onClick={() => void prepareLifecycle("remove")}
              >
                حذف/بایگانی
              </Button>
            ) : null}
          </div>
        ) : null}
      </section>

      {impact && impact.requiresReason ? (
        <Card title="دلیل عملیات">
          {impact.reasonOptions && impact.reasonOptions.length > 0 ? (
            <RadioGroup legend="دلیل">
              {impact.reasonOptions.map((option) => (
                <Radio
                  key={option.id}
                  name={`wl-lifecycle-reason-${reference}`}
                  value={option.id}
                  label={option.label}
                  checked={reason === option.id}
                  onChange={() => setReason(option.id)}
                />
              ))}
            </RadioGroup>
          ) : (
            <FormField id="wl-lifecycle-reason-text" label="دلیل" required>
              <Textarea
                id="wl-lifecycle-reason-text"
                value={reason}
                rows={3}
                maxLength={500}
                onChange={(event) => setReason(event.target.value)}
              />
            </FormField>
          )}
        </Card>
      ) : null}

      <ConfirmDialog
        open={Boolean(impact)}
        title={impact?.title ?? "تأیید"}
        description={
          impact
            ? [
                impact.summary,
                ...(impact.effects ?? []),
                impact.activeOfferAffected ? "پیشنهاد فعال تحت تأثیر قرار می‌گیرد." : "",
                impact.notificationAffected ? "اعلان مشتری تحت تأثیر قرار می‌گیرد." : "",
                impact.blockedReason ?? "",
              ]
                .filter(Boolean)
                .join(" ")
            : ""
        }
        confirmLabel={impact?.confirmLabel ?? "تأیید و ادامه"}
        cancelLabel="انصراف"
        variant={impactAction === "remove" ? "destructive" : "primary"}
        busy={actionBusy}
        onCancel={() => {
          setImpact(null);
          setImpactAction(undefined);
          setReason("");
        }}
        onConfirm={() => void confirmLifecycle()}
      />
    </>
  );
}
