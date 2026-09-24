"use client";

import { useRef, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ApiErrorState,
  PermissionDeniedState,
} from "@/components/feedback/app-states";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/feedback/toast";
import { AdminSettingsSectionSkeleton } from "@/features/admin/settings/admin-settings-skeleton";
import { AdminSettingsShell } from "@/features/admin/settings/admin-settings-shell";
import { useSession } from "@/features/auth/session-provider";
import { useUnsavedChangesWarning } from "@/features/customer/use-unsaved-changes-warning";
import {
  adminSettingsConflictMessage,
  buildLocalCurrencyTimezoneImpact,
  buildLocalizationSettingsPayload,
  formFromLocalizationSettings,
  isAdminSettingsConflict,
  localizationChangeIsHighImpact,
  validateLocalizationSettingsForm,
} from "@/lib/admin/settings-adapter";
import { invalidateAfterAdminSettingsMutation } from "@/lib/admin/settings-cache";
import { canAccessSettingsSection, canEditSettingsSection } from "@/lib/admin/settings-filters";
import {
  adminLocalizationSettingsQueryOptions,
  fetchAdminLocalizationImpactPreview,
  updateAdminLocalizationSettings,
} from "@/lib/api/admin-settings";
import {
  isForbiddenError,
  isNotFoundError,
  isValidationError,
  toAppApiError,
} from "@/lib/api/errors";
import { createIdempotencyKey } from "@/lib/booking/idempotency";
import type {
  AdminLocalizationSettingsFormErrors,
  AdminLocalizationSettingsFormInput,
  AdminSettingsImpactPreview,
} from "@/types/admin-settings";

export function AdminLocalizationSettingsScreen() {
  const { status, user } = useSession();
  if (status === "loading" || !user?.id) {
    return (
      <AdminSettingsShell section="localization">
        <AdminSettingsSectionSkeleton />
      </AdminSettingsShell>
    );
  }

  if (!canAccessSettingsSection(user.permissionCodes, "localization")) {
    return (
      <AdminSettingsShell section="localization">
        <PermissionDeniedState
          title="دسترسی مجاز نیست"
          description="مجوز مشاهده تنظیمات زبان و منطقه را ندارید."
        />
      </AdminSettingsShell>
    );
  }

  return (
    <AdminSettingsShell section="localization">
      <AdminLocalizationSettingsForm
        userId={user.id}
        canEdit={canEditSettingsSection(user.permissionCodes, "localization")}
      />
    </AdminSettingsShell>
  );
}

function AdminLocalizationSettingsForm({
  userId,
  canEdit,
}: {
  userId: string;
  canEdit: boolean;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const query = useQuery(adminLocalizationSettingsQueryOptions(userId));
  const view = query.data;

  const [draft, setDraft] = useState<AdminLocalizationSettingsFormInput | null>(null);
  const [errors, setErrors] = useState<AdminLocalizationSettingsFormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [impact, setImpact] = useState<AdminSettingsImpactPreview | null>(null);
  const submitLock = useRef(false);

  const baseline = formFromLocalizationSettings(view);
  const active = draft ?? baseline;
  const dirty = draft !== null;
  const editable = canEdit && view?.allowedActions.edit === true;
  useUnsavedChangesWarning(dirty && !submitting);

  function updateDraft(partial: Partial<AdminLocalizationSettingsFormInput>) {
    setDraft((current) => ({ ...(current ?? baseline), ...partial }));
  }

  async function prepareSave() {
    if (!editable || submitLock.current) return;
    const nextErrors = validateLocalizationSettingsForm(active, view);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const high = localizationChangeIsHighImpact(baseline, active);
    if (high.currencyChanged && view?.allowedActions.changeCurrency === false) {
      setErrors({
        currency: view.allowedActions.blockedReason ?? "تغییر واحد پول مجاز نیست.",
      });
      return;
    }
    if (high.timezoneChanged && view?.allowedActions.changeTimezone === false) {
      setErrors({
        timezone: view.allowedActions.blockedReason ?? "تغییر منطقه زمانی مجاز نیست.",
      });
      return;
    }

    const payload = buildLocalizationSettingsPayload(active, view?.version);
    if (high.highImpact || view?.capabilities.supportsImpactPreview) {
      try {
        const preview = await fetchAdminLocalizationImpactPreview(payload);
        setImpact(preview);
      } catch {
        setImpact(buildLocalCurrencyTimezoneImpact(high));
      }
      setConfirmOpen(true);
      return;
    }
    await submitSave();
  }

  async function submitSave() {
    if (impact?.blocked) return;
    submitLock.current = true;
    setSubmitting(true);
    setConflict(false);
    try {
      const body = {
        ...buildLocalizationSettingsPayload(active, view?.version),
        previewVersion: impact?.previewVersion,
      };
      await updateAdminLocalizationSettings(body, createIdempotencyKey());
      setDraft(null);
      setConfirmOpen(false);
      setImpact(null);
      invalidateAfterAdminSettingsMutation(queryClient, userId, "localization");
      toast.success("تنظیمات زبان و منطقه ذخیره شد");
      void query.refetch();
    } catch (err) {
      const appError = toAppApiError(err);
      if (isAdminSettingsConflict(appError)) {
        setConflict(true);
        setConfirmOpen(false);
        setDraft(null);
        toast.error(adminSettingsConflictMessage());
        void query.refetch();
        return;
      }
      if (isValidationError(appError)) {
        setErrors({ form: appError.message });
        setConfirmOpen(false);
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

  const toOptions = (items: { value: string; label: string; disabled?: boolean }[]) =>
    items.map((item) => ({ value: item.value, label: item.label, disabled: item.disabled }));

  return (
    <>
      <form
        className="admin-settings-form"
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          void prepareSave();
        }}
        noValidate
      >
        <Alert
          tone="info"
          title="جداسازی مفاهیم"
          description="زبان پیش‌فرض کسب‌وکار، زبان فعلی رابط مدیریت، نوع تقویم نمایشی و جهت RTL/LTR مفاهیم جدا هستند. تاریخ‌ها با API به‌صورت ISO رد و بدل می‌شوند."
        />
        {!editable ? (
          <Alert
            tone="info"
            title="فقط مشاهده"
            description={view.allowedActions.blockedReason ?? "مجوز ویرایش ندارید."}
          />
        ) : null}
        {conflict ? (
          <Alert
            tone="warning"
            title="تداخل نسخه"
            description={adminSettingsConflictMessage()}
          />
        ) : null}
        {errors.form ? (
          <Alert tone="error" title="خطای اعتبارسنجی" description={errors.form} />
        ) : null}

        <div className="admin-settings-form__grid">
          <FormField id="settings-language" label="زبان پیش‌فرض کسب‌وکار">
            {view.languageOptions.length > 0 ? (
              <Select
                id="settings-language"
                value={active.defaultLanguage || undefined}
                options={toOptions(view.languageOptions)}
                disabled={!editable}
                onChange={(value) => updateDraft({ defaultLanguage: value ?? "" })}
                allowClear
              />
            ) : (
              <Input
                id="settings-language"
                className="ltr-value"
                value={active.defaultLanguage}
                disabled={!editable}
                onChange={(event) => updateDraft({ defaultLanguage: event.target.value })}
              />
            )}
          </FormField>
          <FormField id="settings-locale" label="Locale">
            {view.localeOptions.length > 0 ? (
              <Select
                id="settings-locale"
                value={active.locale || undefined}
                options={toOptions(view.localeOptions)}
                disabled={!editable}
                onChange={(value) => updateDraft({ locale: value ?? "" })}
                allowClear
              />
            ) : (
              <Input
                id="settings-locale"
                className="ltr-value"
                value={active.locale}
                disabled={!editable}
                onChange={(event) => updateDraft({ locale: event.target.value })}
              />
            )}
          </FormField>
          <FormField id="settings-currency" label="واحد پول" required error={errors.currency}>
            {view.currencyOptions.length > 0 ? (
              <Select
                id="settings-currency"
                value={active.currency || undefined}
                options={toOptions(view.currencyOptions)}
                disabled={!editable}
                onChange={(value) => updateDraft({ currency: value ?? "" })}
                allowClear={false}
              />
            ) : (
              <Input
                id="settings-currency"
                className="ltr-value"
                value={active.currency}
                disabled={!editable}
                onChange={(event) => updateDraft({ currency: event.target.value })}
              />
            )}
          </FormField>
          <FormField
            id="settings-timezone"
            label="منطقه زمانی (IANA)"
            required
            error={errors.timezone}
            description={
              [view.timezoneOffsetLabel, view.sampleBusinessTimeLabel]
                .filter(Boolean)
                .join(" — ") || undefined
            }
          >
            {view.timezoneOptions.length > 0 ? (
              <Select
                id="settings-timezone"
                value={active.timezone || undefined}
                options={toOptions(view.timezoneOptions)}
                disabled={!editable}
                onChange={(value) => updateDraft({ timezone: value ?? "" })}
                allowClear={false}
              />
            ) : (
              <Input
                id="settings-timezone"
                className="ltr-value"
                value={active.timezone}
                disabled={!editable}
                placeholder="Asia/Tehran"
                onChange={(event) => updateDraft({ timezone: event.target.value })}
              />
            )}
          </FormField>
          <FormField id="settings-calendar" label="نوع تقویم نمایشی">
            {view.calendarTypeOptions.length > 0 ? (
              <Select
                id="settings-calendar"
                value={active.calendarType || undefined}
                options={toOptions(view.calendarTypeOptions)}
                disabled={!editable}
                onChange={(value) => updateDraft({ calendarType: value ?? "" })}
                allowClear
              />
            ) : (
              <Input
                id="settings-calendar"
                className="ltr-value"
                value={active.calendarType}
                disabled={!editable}
                onChange={(event) => updateDraft({ calendarType: event.target.value })}
              />
            )}
          </FormField>
          <FormField id="settings-number-format" label="قالب اعداد">
            {view.numberFormatOptions.length > 0 ? (
              <Select
                id="settings-number-format"
                value={active.numberFormat || undefined}
                options={toOptions(view.numberFormatOptions)}
                disabled={!editable}
                onChange={(value) => updateDraft({ numberFormat: value ?? "" })}
                allowClear
              />
            ) : (
              <Input
                id="settings-number-format"
                className="ltr-value"
                value={active.numberFormat}
                disabled={!editable}
                onChange={(event) => updateDraft({ numberFormat: event.target.value })}
              />
            )}
          </FormField>
        </div>

        <div className="admin-settings-form__actions">
          <Button type="submit" loading={submitting} disabled={!editable || !dirty}>
            ذخیره
          </Button>
        </div>
      </form>

      <ConfirmDialog
        open={confirmOpen}
        title={impact?.title ?? "تأیید تغییرات"}
        description={
          impact?.blocked
            ? (impact.blockedReason ?? "این تغییر مجاز نیست.")
            : [impact?.summary, ...(impact?.effects ?? [])].filter(Boolean).join(" ")
        }
        confirmLabel={impact?.confirmLabel ?? "ذخیره"}
        variant="primary"
        busy={submitting}
        onCancel={() => {
          setConfirmOpen(false);
          setImpact(null);
        }}
        onConfirm={() => {
          if (impact?.blocked) return;
          void submitSave();
        }}
      />
    </>
  );
}
