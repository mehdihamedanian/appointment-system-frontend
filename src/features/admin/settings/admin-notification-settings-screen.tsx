"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ApiErrorState,
  PermissionDeniedState,
} from "@/components/feedback/app-states";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/selection";
import { useToast } from "@/components/feedback/toast";
import { AdminSettingsSectionSkeleton } from "@/features/admin/settings/admin-settings-skeleton";
import { AdminSettingsShell } from "@/features/admin/settings/admin-settings-shell";
import { useSession } from "@/features/auth/session-provider";
import { useUnsavedChangesWarning } from "@/features/customer/use-unsaved-changes-warning";
import {
  adminSettingsConflictMessage,
  buildNotificationSettingsPayload,
  formFromNotificationSettings,
  isAdminSettingsConflict,
} from "@/lib/admin/settings-adapter";
import { invalidateAfterAdminSettingsMutation } from "@/lib/admin/settings-cache";
import { canAccessSettingsSection, canEditSettingsSection } from "@/lib/admin/settings-filters";
import {
  adminNotificationChannelSettingsQueryOptions,
  updateAdminNotificationChannelSettings,
} from "@/lib/api/admin-settings";
import {
  isForbiddenError,
  isNotFoundError,
  isValidationError,
  toAppApiError,
} from "@/lib/api/errors";
import { createIdempotencyKey } from "@/lib/booking/idempotency";
import { routes } from "@/constants/routes";
import type {
  AdminNotificationSettingsFormErrors,
  AdminNotificationSettingsFormInput,
} from "@/types/admin-settings";

export function AdminNotificationSettingsScreen() {
  const { status, user } = useSession();
  if (status === "loading" || !user?.id) {
    return (
      <AdminSettingsShell section="notifications">
        <AdminSettingsSectionSkeleton />
      </AdminSettingsShell>
    );
  }

  if (!canAccessSettingsSection(user.permissionCodes, "notifications")) {
    return (
      <AdminSettingsShell section="notifications">
        <PermissionDeniedState
          title="دسترسی مجاز نیست"
          description="مجوز مشاهده تنظیمات اعلان را ندارید."
        />
      </AdminSettingsShell>
    );
  }

  return (
    <AdminSettingsShell section="notifications">
      <AdminNotificationSettingsForm
        userId={user.id}
        canEdit={canEditSettingsSection(user.permissionCodes, "notifications")}
      />
    </AdminSettingsShell>
  );
}

function AdminNotificationSettingsForm({
  userId,
  canEdit,
}: {
  userId: string;
  canEdit: boolean;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const query = useQuery(adminNotificationChannelSettingsQueryOptions(userId));
  const view = query.data;

  const [draft, setDraft] = useState<AdminNotificationSettingsFormInput | null>(null);
  const [errors, setErrors] = useState<AdminNotificationSettingsFormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [conflict, setConflict] = useState(false);
  const submitLock = useRef(false);

  const active = draft ?? formFromNotificationSettings(view);
  const dirty = draft !== null;
  const editable = canEdit && view?.allowedActions.edit === true;
  useUnsavedChangesWarning(dirty && !submitting);

  function updateDraft(partial: Partial<AdminNotificationSettingsFormInput>) {
    setDraft((current) => ({
      ...(current ?? formFromNotificationSettings(view)),
      ...partial,
    }));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!editable || submitLock.current) return;

    submitLock.current = true;
    setSubmitting(true);
    setConflict(false);
    setErrors({});
    try {
      await updateAdminNotificationChannelSettings(
        buildNotificationSettingsPayload(active, view?.version),
        createIdempotencyKey(),
      );
      setDraft(null);
      invalidateAfterAdminSettingsMutation(queryClient, userId, "notifications");
      toast.success("تنظیمات اعلان ذخیره شد");
      void query.refetch();
    } catch (err) {
      const appError = toAppApiError(err);
      if (isAdminSettingsConflict(appError)) {
        setConflict(true);
        setDraft(null);
        toast.error(adminSettingsConflictMessage());
        void query.refetch();
        return;
      }
      if (isValidationError(appError)) {
        setErrors({ form: appError.message });
        return;
      }
      toast.error(appError.message);
    } finally {
      setSubmitting(false);
      submitLock.current = false;
    }
  }

  if (query.isPending) return <AdminSettingsSectionSkeleton />;
  if (query.isError) {
    const error = toAppApiError(query.error);
    if (isForbiddenError(error) || isNotFoundError(error)) {
      return (
        <PermissionDeniedState title="دسترسی مجاز نیست" description={error.message} />
      );
    }
    return (
      <ApiErrorState
        title="بارگذاری ناموفق"
        description={error.message}
        onRetry={() => void query.refetch()}
      />
    );
  }
  if (!view) return null;

  return (
    <form className="admin-settings-form" onSubmit={onSubmit} noValidate>
      <Alert
        tone="info"
        title="ترجیحات سطح بالا"
        description="ویرایش قالب‌های پیامک/ایمیل در فاز ۳۸ انجام می‌شود؛ اینجا فقط ترجیحات کانال و رویداد است."
      />
      <p>
        <Link href={view.templatesManageHref || routes.admin.notificationTemplates}>
          مدیریت قالب‌های اعلان
        </Link>
      </p>
      {!editable ? (
        <Alert
          tone="info"
          title="فقط مشاهده"
          description={view.allowedActions.blockedReason ?? "مجوز ویرایش ندارید."}
        />
      ) : null}
      {conflict ? (
        <Alert tone="warning" title="تداخل نسخه" description={adminSettingsConflictMessage()} />
      ) : null}
      {errors.form ? (
        <Alert tone="error" title="خطای اعتبارسنجی" description={errors.form} />
      ) : null}

      <div className="admin-settings-form__switches">
        <Switch
          label="پیامک فعال"
          checked={active.smsEnabled}
          disabled={!editable}
          onCheckedChange={(checked) => updateDraft({ smsEnabled: checked })}
        />
        <Switch
          label="ایمیل فعال"
          checked={active.emailEnabled}
          disabled={!editable}
          onCheckedChange={(checked) => updateDraft({ emailEnabled: checked })}
        />
        <Switch
          label="تأیید رزرو"
          checked={active.bookingConfirmationEnabled}
          disabled={!editable}
          onCheckedChange={(checked) =>
            updateDraft({ bookingConfirmationEnabled: checked })
          }
        />
        <Switch
          label="یادآوری نوبت"
          checked={active.appointmentReminderEnabled}
          disabled={!editable}
          onCheckedChange={(checked) =>
            updateDraft({ appointmentReminderEnabled: checked })
          }
        />
        <Switch
          label="لغو"
          checked={active.cancellationEnabled}
          disabled={!editable}
          onCheckedChange={(checked) => updateDraft({ cancellationEnabled: checked })}
        />
        <Switch
          label="بازمان‌بندی"
          checked={active.rescheduleEnabled}
          disabled={!editable}
          onCheckedChange={(checked) => updateDraft({ rescheduleEnabled: checked })}
        />
        <Switch
          label="پرداخت"
          checked={active.paymentEnabled}
          disabled={!editable}
          onCheckedChange={(checked) => updateDraft({ paymentEnabled: checked })}
        />
        <Switch
          label="پیشنهاد لیست انتظار"
          checked={active.waitingListOfferEnabled}
          disabled={!editable}
          onCheckedChange={(checked) =>
            updateDraft({ waitingListOfferEnabled: checked })
          }
        />
      </div>

      <div className="admin-settings-form__actions">
        <Button type="submit" loading={submitting} disabled={!editable || !dirty}>
          ذخیره
        </Button>
      </div>
    </form>
  );
}
