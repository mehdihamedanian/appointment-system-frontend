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
import { AdminServicePreview } from "@/features/admin/services/admin-service-preview";
import { PermissionGate } from "@/features/admin/permission-gate";
import { useSession } from "@/features/auth/session-provider";
import { formatDurationMinutes } from "@/lib/date-time/format";
import {
  adminServiceConflictMessage,
  isAdminServiceConflict,
} from "@/lib/admin/service-adapter";
import { invalidateAfterAdminServiceMutation } from "@/lib/admin/service-cache";
import {
  adminServiceDetailQueryOptions,
  fetchAdminServiceImpactPreview,
  submitAdminServiceLifecycleAction,
} from "@/lib/api/admin-services";
import { createIdempotencyKey } from "@/lib/booking/idempotency";
import {
  isForbiddenError,
  isNotFoundError,
  isSessionExpiredError,
  toAppApiError,
} from "@/lib/api/errors";
import { hasPermission } from "@/lib/permissions/access";
import { routes } from "@/constants/routes";
import type { AdminServiceImpactAction, AdminServiceImpactPreview } from "@/types/admin-service";

export function AdminServiceDetailScreen() {
  const { status, user } = useSession();
  const params = useParams<{ serviceReference: string }>();
  const reference = decodeURIComponent(params.serviceReference ?? "");

  if (status === "loading" || !user?.id) {
    return (
      <>
        <AdminPageHeader title="خدمت" />
        <Skeleton variant="card" />
      </>
    );
  }

  return (
    <PermissionGate permission="admin.services.view">
      <AdminServiceDetailReady userId={user.id} user={user} reference={reference} />
    </PermissionGate>
  );
}

function AdminServiceDetailReady({
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
  const [impact, setImpact] = useState<AdminServiceImpactPreview | null>(null);
  const [impactLoading, setImpactLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [conflict, setConflict] = useState<string>();

  const detailQuery = useQuery(adminServiceDetailQueryOptions(userId, reference));
  const view = detailQuery.data;

  const canEdit =
    view?.allowedActions.edit !== false &&
    (hasPermission(user, "admin.services.edit") || user.permissionCodes.length === 0);

  async function prepareAction(action: AdminServiceImpactAction) {
    if (!view || actionLock.current) return;
    setImpactLoading(true);
    setConflict(undefined);
    try {
      const preview = await fetchAdminServiceImpactPreview(view.reference, action, {
        version: view.version,
      });
      setImpact({ ...preview, action });
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

  async function confirmImpact() {
    if (!view || !impact?.action || actionLock.current || impact.blocked) return;
    actionLock.current = true;
    setActionBusy(true);
    try {
      await submitAdminServiceLifecycleAction(
        view.reference,
        impact.action,
        { previewVersion: impact.previewVersion, version: view.version },
        createIdempotencyKey(),
      );
      invalidateAfterAdminServiceMutation(queryClient, userId, view.reference, {
        affectsPublicCatalog: true,
        affectsAvailability: true,
        changedFields: ["status"],
      });
      toast.success("عملیات با موفقیت انجام شد.");
      setImpact(null);
      await detailQuery.refetch();
    } catch (error) {
      const apiError = toAppApiError(error);
      if (isAdminServiceConflict(apiError)) {
        setConflict(adminServiceConflictMessage());
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
        <AdminPageHeader title="خدمت" description="در حال بارگذاری" />
        <InlineLoading label="بارگذاری خدمت" />
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
          title="خدمت پیدا نشد"
          description="شناسه نامعتبر است یا حذف شده."
          action={
            <Button asChild variant="secondary">
              <Link href={routes.admin.services}>بازگشت به فهرست</Link>
            </Button>
          }
        />
      );
    }
    return (
      <ApiErrorState
        title="خدمت بارگذاری نشد"
        description={error.message}
        onRetry={() => void detailQuery.refetch()}
      />
    );
  }

  return (
    <>
      <AdminPageHeader
        title={view.name}
        description={`وضعیت: ${view.lifecycleLabel}`}
        breadcrumb={
          <AdminBreadcrumb
            pathname={routes.admin.serviceDetail(reference)}
            items={[
              { href: routes.admin.home, label: "پنل مدیریت" },
              { href: routes.admin.services, label: "خدمات" },
              { label: view.name },
            ]}
          />
        }
        secondaryActions={
          <div className="ds-inline">
            {canEdit ? (
              <Button asChild variant="secondary">
                <Link href={view.editHref}>ویرایش</Link>
              </Button>
            ) : null}
            <Button asChild variant="secondary">
              <Link href={view.resourcesHref}>منابع</Link>
            </Button>
          </div>
        }
      />

      {conflict ? <Alert tone="warning" title="تداخل نسخه" description={conflict} /> : null}

      <div className="admin-service-detail">
        <section className="card admin-service-detail__meta">
          <dl className="admin-service-detail__dl">
            <div>
              <dt>مدت</dt>
              <dd>{view.durationMinutes ? formatDurationMinutes(view.durationMinutes) : "—"}</dd>
            </div>
            <div>
              <dt>قیمت</dt>
              <dd>{view.pricing.priceLabel}</dd>
            </div>
            <div>
              <dt>بیعانه</dt>
              <dd>{view.pricing.depositLabel ?? "—"}</dd>
            </div>
            <div>
              <dt>ظرفیت</dt>
              <dd>{view.capacity ?? "—"}</dd>
            </div>
            <div>
              <dt>Provider</dt>
              <dd>
                {view.providerModeLabel ?? "—"}
                {view.providers.length
                  ? ` (${view.providers.map((p) => p.name).join("، ")})`
                  : ""}
              </dd>
            </div>
            <div>
              <dt>شعب</dt>
              <dd>
                {view.branches.length ? view.branches.map((b) => b.name).join("، ") : "—"}
              </dd>
            </div>
            <div>
              <dt>ترتیب</dt>
              <dd>{view.sortOrder ?? "—"}</dd>
            </div>
          </dl>
          {view.requirementSummary?.length ? (
            <div>
              <h3 className="text-card-title">خلاصه نیازمندی‌ها (داخلی)</h3>
              <ul>
                {view.requirementSummary.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        <AdminServicePreview detail={view} />

        <div className="admin-service-detail__actions">
          {view.allowedActions.deactivate ? (
            <Button
              type="button"
              variant="secondary"
              loading={impactLoading}
              onClick={() => void prepareAction("deactivate")}
            >
              غیرفعال‌سازی
            </Button>
          ) : null}
          {view.allowedActions.activate ? (
            <Button
              type="button"
              variant="secondary"
              loading={impactLoading}
              onClick={() => void prepareAction("activate")}
            >
              فعال‌سازی
            </Button>
          ) : null}
          {view.allowedActions.archive ? (
            <Button
              type="button"
              variant="ghost"
              loading={impactLoading}
              onClick={() => void prepareAction("archive")}
            >
              بایگانی
            </Button>
          ) : null}
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(impact)}
        title={impact?.title ?? "تأیید عملیات"}
        description={
          impact
            ? [
                impact.summary,
                ...impact.effects,
                ...(impact.branchWarnings ?? []),
                typeof impact.futureAppointmentCount === "number"
                  ? `نوبت‌های آینده: ${impact.futureAppointmentCount}`
                  : "",
                typeof impact.waitingListCount === "number"
                  ? `لیست انتظار: ${impact.waitingListCount}`
                  : "",
                impact.blockedReason ?? "",
              ]
                .filter(Boolean)
                .join(" ")
            : ""
        }
        confirmLabel={impact?.confirmLabel ?? "تأیید"}
        cancelLabel="انصراف"
        busy={actionBusy}
        onCancel={() => setImpact(null)}
        onConfirm={() => void confirmImpact()}
      />
    </>
  );
}
