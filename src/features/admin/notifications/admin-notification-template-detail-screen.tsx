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
import { AdminNotificationPreviewPanel } from "@/features/admin/notifications/admin-notification-preview-panel";
import { AdminNotificationTemplateEditor } from "@/features/admin/notifications/admin-notification-template-editor";
import { AdminNotificationVariablesPanel } from "@/features/admin/notifications/admin-notification-variables-panel";
import { PermissionGate } from "@/features/admin/permission-gate";
import { useSession } from "@/features/auth/session-provider";
import {
  adminNotificationConflictMessage,
  isAdminNotificationConflict,
  validateAdminNotificationTemplateSave,
} from "@/lib/admin/notification-adapter";
import { invalidateAfterAdminNotificationTemplateMutation } from "@/lib/admin/notification-cache";
import { insertTokenAtCursor } from "@/lib/admin/notification-sms";
import {
  adminNotificationTemplatesHref,
  notificationPermission,
} from "@/lib/admin/notification-filters";
import {
  adminNotificationTemplateDetailQueryOptions,
  fetchAdminNotificationPreview,
  fetchAdminNotificationToggleImpactPreview,
  saveAdminNotificationTemplate,
  submitAdminNotificationToggle,
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
import type {
  AdminNotificationPreviewResult,
  AdminNotificationTemplateContent,
  AdminNotificationTemplateSaveErrors,
  AdminNotificationToggleAction,
  AdminNotificationToggleImpactPreview,
} from "@/types/admin-notification";

export function AdminNotificationTemplateDetailScreen() {
  const { status, user } = useSession();
  const params = useParams<{ templateReference: string }>();
  const reference = decodeURIComponent(params.templateReference ?? "");

  if (status === "loading" || !user?.id) {
    return (
      <>
        <AdminPageHeader title="قالب اعلان" />
        <AdminNotificationDetailSkeleton />
      </>
    );
  }

  return (
    <PermissionGate permission={notificationPermission("templatesView")}>
      <AdminNotificationsGate>
        <AdminNotificationTemplateDetailReady userId={user.id} user={user} reference={reference} />
      </AdminNotificationsGate>
    </PermissionGate>
  );
}

function AdminNotificationTemplateDetailReady({
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
  const saveLock = useRef(false);
  const toggleLock = useRef(false);

  const detailQuery = useQuery(adminNotificationTemplateDetailQueryOptions(userId, reference));
  const view = detailQuery.data;

  const [draft, setDraft] = useState<AdminNotificationTemplateContent | null>(null);
  const [errors, setErrors] = useState<AdminNotificationTemplateSaveErrors>({});
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<AdminNotificationPreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string>();
  const [toggleImpact, setToggleImpact] = useState<AdminNotificationToggleImpactPreview | null>(null);
  const [toggleAction, setToggleAction] = useState<AdminNotificationToggleAction>();
  const [toggleBusy, setToggleBusy] = useState(false);
  const [conflict, setConflict] = useState<string>();

  const canEdit =
    view?.allowedActions.edit === true &&
    (hasPermission(user, notificationPermission("templatesEdit")) || user.permissionCodes.length === 0);
  const canToggle =
    hasPermission(user, notificationPermission("templatesToggle")) || user.permissionCodes.length === 0;

  const activeContent = draft ?? view?.content ?? {};
  const dirty = draft !== null;

  async function onPreview() {
    if (!view) return;
    setPreviewLoading(true);
    setPreviewError(undefined);
    try {
      const result = await fetchAdminNotificationPreview(reference, {
        content: activeContent,
        eventType: view.eventType,
        channel: view.channel,
        language: view.language,
      });
      setPreview(result);
    } catch (error) {
      setPreviewError(toAppApiError(error).message);
      setPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function onSave() {
    if (!view || !canEdit || saveLock.current) return;
    const validation = validateAdminNotificationTemplateSave(
      { content: activeContent, version: view.version },
      view.channel,
      view.variables,
    );
    if (Object.keys(validation).length) {
      setErrors(validation);
      toast.error("لطفاً خطاهای فرم را برطرف کنید.");
      return;
    }
    saveLock.current = true;
    setSaving(true);
    setConflict(undefined);
    try {
      await saveAdminNotificationTemplate(
        reference,
        { content: activeContent, version: view.version },
        view.channel,
        createIdempotencyKey(),
      );
      invalidateAfterAdminNotificationTemplateMutation(queryClient, userId, reference);
      toast.success("قالب ذخیره شد.");
      setDraft(null);
      setErrors({});
      await detailQuery.refetch();
    } catch (error) {
      const apiError = toAppApiError(error);
      if (isSessionExpiredError(apiError)) {
        router.push(routes.auth.sessionExpired);
        return;
      }
      if (isAdminNotificationConflict(apiError)) {
        setConflict(adminNotificationConflictMessage());
        await detailQuery.refetch();
        return;
      }
      toast.error(apiError.message);
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  }

  async function prepareToggle(action: AdminNotificationToggleAction) {
    if (!view || toggleLock.current) return;
    setToggleAction(action);
    try {
      const impact = await fetchAdminNotificationToggleImpactPreview(reference, action);
      setToggleImpact(impact);
    } catch (error) {
      toast.error(toAppApiError(error).message);
    }
  }

  async function confirmToggle() {
    if (!view || !toggleImpact || !toggleAction || toggleLock.current || toggleImpact.blocked) return;
    toggleLock.current = true;
    setToggleBusy(true);
    try {
      await submitAdminNotificationToggle(reference, toggleAction, createIdempotencyKey(), {
        previewVersion: toggleImpact.previewVersion,
        version: view.version,
      });
      invalidateAfterAdminNotificationTemplateMutation(queryClient, userId, reference);
      toast.success("وضعیت قالب به‌روزرسانی شد.");
      setToggleImpact(null);
      setToggleAction(undefined);
      await detailQuery.refetch();
      setDraft(null);
    } catch (error) {
      const apiError = toAppApiError(error);
      if (isAdminNotificationConflict(apiError)) {
        setConflict(adminNotificationConflictMessage());
        setToggleImpact(null);
        await detailQuery.refetch();
        return;
      }
      toast.error(apiError.message);
    } finally {
      toggleLock.current = false;
      setToggleBusy(false);
    }
  }

  function onInsertToken(token: string) {
    if (!view) return;
    const smsEl = document.getElementById("nt-sms-body") as HTMLTextAreaElement | null;
    const emailEl = document.getElementById("nt-email-body") as HTMLTextAreaElement | null;
    if (view.channel === "sms" && smsEl) {
      setDraft({ ...activeContent, smsBody: insertTokenAtCursor(smsEl, token) });
    } else if (emailEl) {
      setDraft({ ...activeContent, emailBody: insertTokenAtCursor(emailEl, token) });
    }
  }

  if (detailQuery.isPending) {
    return (
      <>
        <AdminPageHeader title="قالب اعلان" />
        <InlineLoading label="بارگذاری قالب" />
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
          title="قالب پیدا نشد"
          action={
            <Button asChild variant="secondary">
              <Link href={adminNotificationTemplatesHref()}>بازگشت</Link>
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
        title={`${view.eventTypeLabel} · ${view.channelLabel}`}
        description={`${view.languageLabel}${view.branchName ? ` · ${view.branchName}` : ""}`}
        breadcrumb={
          <AdminBreadcrumb
            pathname={routes.admin.notificationTemplateDetail(reference)}
            items={[
              { href: routes.admin.home, label: "پنل مدیریت" },
              { href: routes.admin.notifications, label: "اعلان‌ها" },
              { href: adminNotificationTemplatesHref(), label: "قالب‌ها" },
              { label: reference },
            ]}
          />
        }
        secondaryActions={
          <>
            {canToggle && view.allowedActions.disable && view.enabled ? (
              <Button variant="secondary" onClick={() => void prepareToggle("disable")}>
                غیرفعال‌سازی
              </Button>
            ) : null}
            {canToggle && view.allowedActions.enable && !view.enabled ? (
              <Button variant="secondary" onClick={() => void prepareToggle("enable")}>
                فعال‌سازی
              </Button>
            ) : null}
            <Button variant="secondary" onClick={() => void detailQuery.refetch()}>
              به‌روزرسانی
            </Button>
          </>
        }
      />

      {conflict ? <Alert tone="warning" title="تداخل" description={conflict} /> : null}
      {view.required ? (
        <Alert tone="info" title="قالب الزامی" description="این قالب تراکنشی است و غیرفعال‌سازی ممکن نیست." />
      ) : null}
      {view.allowedActions.blockedReason ? (
        <Alert tone="warning" title="محدودیت" description={view.allowedActions.blockedReason} />
      ) : null}
      {dirty ? (
        <Alert tone="warning" title="تغییرات ذخیره نشده" description="قبل از خروج، تغییرات را ذخیره کنید." />
      ) : null}

      <section className="admin-notification-detail">
        <Card title="مشخصات">
          <div className="admin-notification-status-badges">
            <Badge tone={view.enabled ? "success" : "neutral"}>{view.enabled ? "فعال" : "غیرفعال"}</Badge>
            {view.required ? <Badge tone="warning">الزامی</Badge> : null}
            {view.system ? <Badge tone="neutral">سیستمی</Badge> : null}
          </div>
          {view.updatedAtLabel ? <p className="text-caption">آخرین به‌روزرسانی: {view.updatedAtLabel}</p> : null}
          {view.languageVersions?.length ? (
            <ul className="admin-notification-languages">
              {view.languageVersions.map((version) => (
                <li key={version.language}>
                  <Link href={version.href}>
                    {version.languageLabel}
                    {!version.complete ? " (ناقص)" : ""}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </Card>

        <div className="admin-notification-detail__grid">
          <div className="admin-notification-detail__editor">
            <Card title="ویرایش محتوا">
              <AdminNotificationTemplateEditor
                channel={view.channel}
                content={activeContent}
                errors={errors}
                disabled={!canEdit || saving}
                onChange={(next) => {
                  setDraft(next);
                  setErrors({});
                }}
              />
              <div className="admin-notification-detail__actions">
                <Button
                  variant="secondary"
                  loading={previewLoading}
                  disabled={!view.allowedActions.preview}
                  onClick={() => void onPreview()}
                >
                  پیش‌نمایش
                </Button>
                {canEdit ? (
                  <Button loading={saving} onClick={() => void onSave()}>
                    ذخیره
                  </Button>
                ) : null}
              </div>
            </Card>
            <AdminNotificationVariablesPanel
              variables={view.variables}
              disabled={!canEdit || saving}
              onInsert={onInsertToken}
            />
          </div>
          <AdminNotificationPreviewPanel
            channel={view.channel}
            preview={preview}
            loading={previewLoading}
            error={previewError}
          />
        </div>
      </section>

      <ConfirmDialog
        open={Boolean(toggleImpact)}
        title={toggleImpact?.title ?? "تأیید تغییر وضعیت"}
        description={
          toggleImpact
            ? [
                toggleImpact.summary,
                ...toggleImpact.effects,
                toggleImpact.fallbackChannelLabel
                  ? `کانال جایگزین: ${toggleImpact.fallbackChannelLabel}`
                  : "",
                toggleImpact.blockedReason ?? "",
              ]
                .filter(Boolean)
                .join(" ")
            : ""
        }
        confirmLabel={toggleImpact?.confirmLabel ?? "تأیید"}
        cancelLabel="انصراف"
        variant={toggleAction === "disable" ? "destructive" : "primary"}
        busy={toggleBusy}
        onCancel={() => {
          setToggleImpact(null);
          setToggleAction(undefined);
        }}
        onConfirm={() => {
          if (toggleImpact?.blocked) {
            setToggleImpact(null);
            return;
          }
          void confirmToggle();
        }}
      />
    </>
  );
}
