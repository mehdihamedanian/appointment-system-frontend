"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminBreadcrumb } from "@/components/layout/admin/admin-breadcrumb";
import { AdminPageHeader } from "@/components/layout/admin/admin-page-header";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import {
  ApiErrorState,
  EmptyState,
} from "@/components/feedback/app-states";
import { InlineLoading, Skeleton } from "@/components/feedback/loading-states";
import { StatusBadge } from "@/components/ui/data-display";
import { Tabs, TabList, Tab, TabPanel } from "@/components/ui/tabs";
import { useToast } from "@/components/feedback/toast";
import { AdminCustomerAppointmentHistory } from "@/features/admin/customers/admin-customer-appointment-history";
import { AdminCustomerContactDisplay } from "@/features/admin/customers/admin-customer-contact-display";
import { AdminCustomerNotesPanel } from "@/features/admin/customers/admin-customer-notes-panel";
import { AdminCustomerPaymentHistory } from "@/features/admin/customers/admin-customer-payment-history";
import { AdminCustomerTagsPanel } from "@/features/admin/customers/admin-customer-tags-panel";
import { PermissionGate } from "@/features/admin/permission-gate";
import { useSession } from "@/features/auth/session-provider";
import {
  adminCustomerDetailQueryOptions,
  fetchAdminCustomerImpactPreview,
  submitAdminCustomerLifecycleAction,
} from "@/lib/api/admin-customers";
import {
  adminCustomerConflictMessage,
  formatAdminCustomerMetric,
  isAdminCustomerConflict,
} from "@/lib/admin/customer-adapter";
import { invalidateAfterAdminCustomerMutation } from "@/lib/admin/customer-cache";
import { customerPermission } from "@/lib/admin/customer-filters";
import { formatAppointmentParts } from "@/lib/date-time/format";
import { createIdempotencyKey } from "@/lib/booking/idempotency";
import {
  isForbiddenError,
  isNotFoundError,
  isSessionExpiredError,
  toAppApiError,
} from "@/lib/api/errors";
import { hasPermission } from "@/lib/permissions/access";
import { routes } from "@/constants/routes";
import type { AdminCustomerImpactAction, AdminCustomerImpactPreview } from "@/types/admin-customer";

export function AdminCustomerDetailScreen() {
  const { status, user } = useSession();
  const params = useParams<{ customerReference: string }>();
  const reference = decodeURIComponent(params.customerReference ?? "");

  if (status === "loading" || !user?.id) {
    return (
      <>
        <AdminPageHeader title="مشتری" description="جزئیات مشتری" />
        <Skeleton variant="card" />
      </>
    );
  }

  return (
    <PermissionGate permission={customerPermission("view")}>
      <AdminCustomerDetailReady userId={user.id} user={user} reference={reference} />
    </PermissionGate>
  );
}

function AdminCustomerDetailReady({
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
  const [impact, setImpact] = useState<AdminCustomerImpactPreview | null>(null);
  const [impactLoading, setImpactLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [conflict, setConflict] = useState<string>();
  const [reason, setReason] = useState("");

  const detailQuery = useQuery(adminCustomerDetailQueryOptions(userId, reference));
  const view = detailQuery.data;

  const canEdit =
    view?.allowedActions.edit !== false &&
    (hasPermission(user, customerPermission("edit")) || user.permissionCodes.length === 0);
  const canViewPayments =
    view?.allowedActions.viewPayments !== false &&
    (hasPermission(user, customerPermission("payments")) || user.permissionCodes.length === 0);

  async function prepareLifecycle(action: AdminCustomerImpactAction) {
    if (!view || actionLock.current) return;
    setImpactLoading(true);
    setConflict(undefined);
    setReason("");
    try {
      const preview = await fetchAdminCustomerImpactPreview(view.reference, action, {
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
        toast.error("پیش‌نمایش اثر هنوز متصل نیست.");
        return;
      }
      toast.error(apiError.message);
    } finally {
      setImpactLoading(false);
    }
  }

  async function confirmLifecycle() {
    if (!view || !impact || actionLock.current || impact.blocked) return;
    if (impact.requiresReason && !reason.trim()) {
      toast.error("دلیل الزامی است.");
      return;
    }
    actionLock.current = true;
    setActionBusy(true);
    try {
      await submitAdminCustomerLifecycleAction(
        view.reference,
        impact.action,
        {
          previewVersion: impact.previewVersion,
          version: view.version,
          reason: reason.trim() || undefined,
        },
        createIdempotencyKey(),
      );
      invalidateAfterAdminCustomerMutation(queryClient, userId, view.reference, {
        affectsLifecycle: true,
      });
      toast.success("عملیات با موفقیت انجام شد.");
      setImpact(null);
      setReason("");
      await detailQuery.refetch();
    } catch (error) {
      const apiError = toAppApiError(error);
      if (isAdminCustomerConflict(apiError)) {
        setConflict(adminCustomerConflictMessage());
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
        <AdminPageHeader title="مشتری" description="در حال بارگذاری" />
        <InlineLoading label="بارگذاری مشتری" />
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
          title="مشتری پیدا نشد"
          description="شناسه نامعتبر است یا حذف شده."
          action={
            <Button asChild variant="secondary">
              <Link href={routes.admin.customers}>بازگشت به فهرست</Link>
            </Button>
          }
        />
      );
    }
    return (
      <ApiErrorState
        title="جزئیات مشتری دریافت نشد"
        description={error.message}
        onRetry={() => void detailQuery.refetch()}
      />
    );
  }

  const upcomingParts = view.upcomingAppointment
    ? formatAppointmentParts(view.upcomingAppointment.startsAt, view.upcomingAppointment.timezone)
    : undefined;

  return (
    <>
      <AdminPageHeader
        title={view.displayName}
        description={`${view.lifecycleLabel} · ${view.reference}`}
        breadcrumb={
          <AdminBreadcrumb
            pathname={routes.admin.customerDetail(reference)}
            items={[
              { href: routes.admin.home, label: "پنل مدیریت" },
              { href: routes.admin.customers, label: "مشتریان" },
              { label: view.displayName },
            ]}
          />
        }
        secondaryActions={
          canEdit ? (
            <Button asChild variant="secondary">
              <Link href={routes.admin.customerEdit(view.reference)}>ویرایش</Link>
            </Button>
          ) : null
        }
      />

      {conflict ? <Alert tone="warning" title="تداخل نسخه" description={conflict} /> : null}

      {view.duplicateMatches.length > 0 ? (
        <Alert
          tone="warning"
          title="احتمال تکراری"
          description="مشتریان مشابه شناسایی شدند — جزئیات را در فهرست زیر ببینید."
        />
      ) : null}
      {view.duplicateMatches.length > 0 ? (
        <ul className="admin-customer-duplicate-list">
          {view.duplicateMatches.map((match) => (
            <li key={match.id}>
              <Link href={match.detailHref}>{match.displayName}</Link>
              {match.phoneMasked ? ` · ${match.phoneMasked}` : ""}
            </li>
          ))}
        </ul>
      ) : null}

      <Tabs defaultValue="overview">
        <TabList aria-label="بخش‌های پروفایل مشتری">
          <Tab value="overview">نمای کلی</Tab>
          <Tab value="appointments">نوبت‌ها</Tab>
          {canViewPayments ? <Tab value="payments">پرداخت‌ها</Tab> : null}
          <Tab value="notes">یادداشت داخلی</Tab>
        </TabList>

        <TabPanel value="overview">
          <div className="admin-customer-detail">
            <div className="admin-customer-detail__head">
              <span className="admin-customer-lifecycle" data-lifecycle={view.lifecycle}>
                {view.lifecycleLabel}
              </span>
              {view.blockedReason ? (
                <span className="text-caption">دلیل مسدودیت: {view.blockedReason}</span>
              ) : null}
            </div>

            <section aria-labelledby="customer-metrics-title">
              <h3 id="customer-metrics-title" className="text-card-title">
                آمار مراجعه
                {view.metrics.periodLabel ? (
                  <span className="text-caption"> ({view.metrics.periodLabel})</span>
                ) : null}
              </h3>
              <dl className="admin-customer-metrics">
                <div>
                  <dt>کل مراجعات</dt>
                  <dd>{formatAdminCustomerMetric(view.metrics.totalVisits, view.metrics.unavailable)}</dd>
                </div>
                <div>
                  <dt>لغوها</dt>
                  <dd>
                    {formatAdminCustomerMetric(view.metrics.cancellationCount, view.metrics.unavailable)}
                  </dd>
                </div>
                <div>
                  <dt>عدم حضور</dt>
                  <dd>{formatAdminCustomerMetric(view.metrics.noShowCount, view.metrics.unavailable)}</dd>
                </div>
              </dl>
            </section>

            <section aria-labelledby="customer-contact-title">
              <h3 id="customer-contact-title" className="text-card-title">
                اطلاعات تماس
              </h3>
              <AdminCustomerContactDisplay contact={view.contact} user={user} />
            </section>

            <section aria-labelledby="customer-upcoming-title">
              <h3 id="customer-upcoming-title" className="text-card-title">
                نوبت آینده
              </h3>
              {view.upcomingAppointment === null ? (
                <p className="ds-help">نوبت آینده‌ای ثبت نشده است.</p>
              ) : view.upcomingAppointment ? (
                <div className="admin-customer-upcoming ds-card">
                  <StatusBadge status={view.upcomingAppointment.status} />
                  <p>{upcomingParts?.label ?? view.upcomingAppointment.startsAt}</p>
                  {view.upcomingAppointment.serviceName ? (
                    <p className="text-caption">{view.upcomingAppointment.serviceName}</p>
                  ) : null}
                  <Button asChild variant="secondary" size="sm">
                    <Link href={view.upcomingAppointment.detailHref}>جزئیات نوبت</Link>
                  </Button>
                </div>
              ) : (
                <p className="ds-help">—</p>
              )}
            </section>

            <AdminCustomerTagsPanel
              userId={userId}
              view={view}
              tags={view.tags}
              tagCatalog={view.tagCatalog}
              onRefetch={() => void detailQuery.refetch()}
            />

            <div className="admin-customer-lifecycle-actions">
              {view.allowedActions.block ? (
                <Button variant="secondary" loading={impactLoading} onClick={() => void prepareLifecycle("block")}>
                  مسدودسازی
                </Button>
              ) : null}
              {view.allowedActions.unblock ? (
                <Button variant="secondary" loading={impactLoading} onClick={() => void prepareLifecycle("unblock")}>
                  رفع مسدودیت
                </Button>
              ) : null}
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
                <Button variant="secondary" loading={impactLoading} onClick={() => void prepareLifecycle("activate")}>
                  فعال‌سازی
                </Button>
              ) : null}
            </div>
          </div>
        </TabPanel>

        <TabPanel value="appointments">
          <AdminCustomerAppointmentHistory userId={userId} view={view} />
        </TabPanel>

        {canViewPayments ? (
          <TabPanel value="payments">
            <AdminCustomerPaymentHistory userId={userId} view={view} />
          </TabPanel>
        ) : null}

        <TabPanel value="notes">
          <AdminCustomerNotesPanel
            userId={userId}
            view={view}
            notes={view.notes}
            onRefetch={() => void detailQuery.refetch()}
          />
        </TabPanel>
      </Tabs>

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
                typeof impact.pendingPaymentCount === "number"
                  ? `پرداخت‌های معلق: ${impact.pendingPaymentCount}`
                  : "",
                impact.blockedReason ?? "",
                impact.requiresReason ? "لطفاً دلیل را در فیلد زیر وارد کنید." : "",
              ]
                .filter(Boolean)
                .join(" ")
            : ""
        }
        confirmLabel={impact?.confirmLabel ?? "تأیید و ادامه"}
        cancelLabel="انصراف"
        variant={impact?.action === "block" || impact?.action === "deactivate" ? "destructive" : "primary"}
        busy={actionBusy}
        onCancel={() => {
          setImpact(null);
          setReason("");
        }}
        onConfirm={() => {
          if (impact?.blocked) return;
          void confirmLifecycle();
        }}
      />

      {impact?.requiresReason ? (
        <div className="admin-customer-reason-field">
          <label htmlFor="customer-lifecycle-reason">دلیل</label>
          <Input
            id="customer-lifecycle-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </div>
      ) : null}
    </>
  );
}
