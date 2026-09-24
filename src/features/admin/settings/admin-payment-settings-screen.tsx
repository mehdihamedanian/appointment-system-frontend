"use client";

import { useRef, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ApiErrorState,
  PermissionDeniedState,
} from "@/components/feedback/app-states";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input, Textarea } from "@/components/ui/input";
import { MultiSelect } from "@/components/ui/select";
import { Switch } from "@/components/ui/selection";
import { useToast } from "@/components/feedback/toast";
import { AdminSettingsSectionSkeleton } from "@/features/admin/settings/admin-settings-skeleton";
import { AdminSettingsShell } from "@/features/admin/settings/admin-settings-shell";
import { useSession } from "@/features/auth/session-provider";
import { useUnsavedChangesWarning } from "@/features/customer/use-unsaved-changes-warning";
import {
  adminSettingsConflictMessage,
  buildPaymentSettingsPayload,
  formFromPaymentSettings,
  isAdminSettingsConflict,
  validatePaymentSettingsForm,
} from "@/lib/admin/settings-adapter";
import { invalidateAfterAdminSettingsMutation } from "@/lib/admin/settings-cache";
import { canAccessSettingsSection, canEditSettingsSection } from "@/lib/admin/settings-filters";
import {
  adminPaymentSettingsQueryOptions,
  updateAdminPaymentSettings,
} from "@/lib/api/admin-settings";
import {
  isForbiddenError,
  isNotFoundError,
  isValidationError,
  toAppApiError,
} from "@/lib/api/errors";
import { createIdempotencyKey } from "@/lib/booking/idempotency";
import type {
  AdminPaymentSettingsFormErrors,
  AdminPaymentSettingsFormInput,
} from "@/types/admin-settings";

export function AdminPaymentSettingsScreen() {
  const { status, user } = useSession();
  if (status === "loading" || !user?.id) {
    return (
      <AdminSettingsShell section="payments">
        <AdminSettingsSectionSkeleton />
      </AdminSettingsShell>
    );
  }

  if (!canAccessSettingsSection(user.permissionCodes, "payments")) {
    return (
      <AdminSettingsShell section="payments">
        <PermissionDeniedState
          title="دسترسی مجاز نیست"
          description="مجوز مشاهده تنظیمات پرداخت را ندارید."
        />
      </AdminSettingsShell>
    );
  }

  return (
    <AdminSettingsShell section="payments">
      <AdminPaymentSettingsForm
        userId={user.id}
        canEdit={canEditSettingsSection(user.permissionCodes, "payments")}
      />
    </AdminSettingsShell>
  );
}

function AdminPaymentSettingsForm({
  userId,
  canEdit,
}: {
  userId: string;
  canEdit: boolean;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const query = useQuery(adminPaymentSettingsQueryOptions(userId));
  const view = query.data;

  const [draft, setDraft] = useState<AdminPaymentSettingsFormInput | null>(null);
  const [errors, setErrors] = useState<AdminPaymentSettingsFormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [conflict, setConflict] = useState(false);
  const submitLock = useRef(false);

  const active = draft ?? formFromPaymentSettings(view);
  const dirty = draft !== null;
  const editable = canEdit && view?.allowedActions.edit === true;
  useUnsavedChangesWarning(dirty && !submitting);

  function updateDraft(partial: Partial<AdminPaymentSettingsFormInput>) {
    setDraft((current) => ({
      ...(current ?? formFromPaymentSettings(view)),
      ...partial,
    }));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!editable || submitLock.current) return;
    const nextErrors = validatePaymentSettingsForm(active);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    submitLock.current = true;
    setSubmitting(true);
    setConflict(false);
    try {
      await updateAdminPaymentSettings(
        buildPaymentSettingsPayload(active, view?.version),
        createIdempotencyKey(),
      );
      setDraft(null);
      invalidateAfterAdminSettingsMutation(queryClient, userId, "payments");
      toast.success("تنظیمات پرداخت ذخیره شد");
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
        title="امنیت پرداخت"
        description="کلیدهای محرمانه درگاه، توکن خصوصی و اطلاعات کارت در این صفحه نمایش یا ذخیره نمی‌شوند."
      />
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

      {view.capabilities.supportsGatewayStatus !== false ? (
        <p className="admin-settings-gateway-status" role="status">
          وضعیت اتصال درگاه:{" "}
          <strong className="ltr-value">{view.gatewayStatusLabel}</strong>
          <span className="visually-hidden"> ({view.gatewayStatus})</span>
        </p>
      ) : null}

      <div className="admin-settings-form__switches">
        <Switch
          label="پرداخت کامل"
          checked={active.fullPaymentEnabled}
          disabled={!editable}
          onCheckedChange={(checked) => updateDraft({ fullPaymentEnabled: checked })}
        />
        <Switch
          label="بیعانه"
          checked={active.depositEnabled}
          disabled={!editable}
          onCheckedChange={(checked) => updateDraft({ depositEnabled: checked })}
        />
        <Switch
          label="پرداخت در محل"
          checked={active.payAtLocationEnabled}
          disabled={!editable}
          onCheckedChange={(checked) => updateDraft({ payAtLocationEnabled: checked })}
        />
      </div>

      {view.methodOptions.length > 0 ? (
        <FormField id="settings-payment-methods" label="روش‌های پرداخت فعال">
          <MultiSelect
            id="settings-payment-methods"
            values={active.enabledMethodIds}
            options={view.methodOptions.map((item) => ({
              value: item.value,
              label: item.label,
            }))}
            disabled={!editable}
            onChange={(value) => updateDraft({ enabledMethodIds: value })}
          />
        </FormField>
      ) : null}

      <FormField
        id="settings-payment-timeout"
        label="مهلت پرداخت (دقیقه)"
        error={errors.paymentTimeoutMinutes}
      >
        <Input
          id="settings-payment-timeout"
          className="ltr-value"
          inputMode="numeric"
          value={active.paymentTimeoutMinutes}
          disabled={!editable}
          onChange={(event) => updateDraft({ paymentTimeoutMinutes: event.target.value })}
        />
      </FormField>

      <FormField id="settings-payment-text" label="متن قابل‌نمایش برای مشتری" optional>
        <Textarea
          id="settings-payment-text"
          rows={3}
          value={active.customerFacingPaymentText}
          disabled={!editable}
          onChange={(event) =>
            updateDraft({ customerFacingPaymentText: event.target.value })
          }
        />
      </FormField>

      <div className="admin-settings-form__actions">
        <Button type="submit" loading={submitting} disabled={!editable || !dirty}>
          ذخیره
        </Button>
      </div>
    </form>
  );
}
