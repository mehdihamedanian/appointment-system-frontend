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
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/selection";
import { useToast } from "@/components/feedback/toast";
import { AdminSettingsSectionSkeleton } from "@/features/admin/settings/admin-settings-skeleton";
import { AdminSettingsShell } from "@/features/admin/settings/admin-settings-shell";
import { useSession } from "@/features/auth/session-provider";
import { useUnsavedChangesWarning } from "@/features/customer/use-unsaved-changes-warning";
import {
  adminSettingsConflictMessage,
  buildBookingSettingsPayload,
  formFromBookingSettings,
  isAdminSettingsConflict,
  validateBookingSettingsForm,
} from "@/lib/admin/settings-adapter";
import { invalidateAfterAdminSettingsMutation } from "@/lib/admin/settings-cache";
import { canAccessSettingsSection, canEditSettingsSection } from "@/lib/admin/settings-filters";
import {
  adminBookingSettingsQueryOptions,
  fetchAdminBookingImpactPreview,
  updateAdminBookingSettings,
} from "@/lib/api/admin-settings";
import {
  isForbiddenError,
  isNotFoundError,
  isValidationError,
  toAppApiError,
} from "@/lib/api/errors";
import { createIdempotencyKey } from "@/lib/booking/idempotency";
import type {
  AdminBookingSettingsFormErrors,
  AdminBookingSettingsFormInput,
  AdminSettingsImpactPreview,
} from "@/types/admin-settings";

export function AdminBookingSettingsScreen() {
  const { status, user } = useSession();
  if (status === "loading" || !user?.id) {
    return (
      <AdminSettingsShell section="booking">
        <AdminSettingsSectionSkeleton />
      </AdminSettingsShell>
    );
  }

  if (!canAccessSettingsSection(user.permissionCodes, "booking")) {
    return (
      <AdminSettingsShell section="booking">
        <PermissionDeniedState
          title="دسترسی مجاز نیست"
          description="مجوز مشاهده تنظیمات نوبت‌دهی را ندارید."
        />
      </AdminSettingsShell>
    );
  }

  return (
    <AdminSettingsShell section="booking">
      <AdminBookingSettingsForm
        userId={user.id}
        canEdit={canEditSettingsSection(user.permissionCodes, "booking")}
      />
    </AdminSettingsShell>
  );
}

function AdminBookingSettingsForm({
  userId,
  canEdit,
}: {
  userId: string;
  canEdit: boolean;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const query = useQuery(adminBookingSettingsQueryOptions(userId));
  const view = query.data;

  const [draft, setDraft] = useState<AdminBookingSettingsFormInput | null>(null);
  const [errors, setErrors] = useState<AdminBookingSettingsFormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [impact, setImpact] = useState<AdminSettingsImpactPreview | null>(null);
  const submitLock = useRef(false);

  const active = draft ?? formFromBookingSettings(view);
  const dirty = draft !== null;
  const editable = canEdit && view?.allowedActions.edit === true;
  useUnsavedChangesWarning(dirty && !submitting);

  function updateDraft(partial: Partial<AdminBookingSettingsFormInput>) {
    setDraft((current) => ({
      ...(current ?? formFromBookingSettings(view)),
      ...partial,
    }));
  }

  async function prepareSave() {
    if (!editable || submitLock.current) return;
    const nextErrors = validateBookingSettingsForm(active);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const payload = buildBookingSettingsPayload(active, view?.version);
    if (view?.capabilities.supportsImpactPreview !== false) {
      try {
        const preview = await fetchAdminBookingImpactPreview(payload);
        setImpact(preview);
        if (preview.requiresConfirmation || preview.highImpact || preview.blocked) {
          setConfirmOpen(true);
          return;
        }
      } catch {
        setImpact({
          title: "تأیید تنظیمات نوبت‌دهی",
          summary:
            "تأثیر روی موجودی اسلات و سیاست‌ها فقط توسط Backend محاسبه می‌شود. پس از تأیید ذخیره کنید.",
          effects: [],
          blocked: false,
          requiresConfirmation: true,
          highImpact: false,
          confirmLabel: "ذخیره",
        });
        setConfirmOpen(true);
        return;
      }
    }
    await submitSave();
  }

  async function submitSave() {
    if (impact?.blocked) return;
    submitLock.current = true;
    setSubmitting(true);
    setConflict(false);
    try {
      await updateAdminBookingSettings(
        {
          ...buildBookingSettingsPayload(active, view?.version),
          previewVersion: impact?.previewVersion,
        },
        createIdempotencyKey(),
      );
      setDraft(null);
      setConfirmOpen(false);
      setImpact(null);
      invalidateAfterAdminSettingsMutation(queryClient, userId, "booking");
      toast.success("تنظیمات نوبت‌دهی ذخیره شد");
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
          title="بازه اسلات ≠ مدت خدمت"
          description="بازه اسلات فاصله زمانی بین شروع اسلات‌هاست و با مدت خدمت اشتباه گرفته نشود. موجودی و واجد شرایط بودن لغو/باززمان‌بندی فقط از Backend است."
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
          <FormField
            id="settings-min-advance"
            label={`حداقل زمان رزرو از قبل (${view.fieldUnits.minAdvanceBookingMinutes ?? "دقیقه"})`}
            error={errors.minAdvanceBookingMinutes}
          >
            <Input
              id="settings-min-advance"
              className="ltr-value"
              inputMode="numeric"
              value={active.minAdvanceBookingMinutes}
              disabled={!editable}
              onChange={(event) =>
                updateDraft({ minAdvanceBookingMinutes: event.target.value })
              }
            />
          </FormField>
          <FormField
            id="settings-max-advance"
            label={`حداکثر بازه رزرو از قبل (${view.fieldUnits.maxAdvanceBookingDays ?? "روز"})`}
            error={errors.maxAdvanceBookingDays}
          >
            <Input
              id="settings-max-advance"
              className="ltr-value"
              inputMode="numeric"
              value={active.maxAdvanceBookingDays}
              disabled={!editable}
              onChange={(event) =>
                updateDraft({ maxAdvanceBookingDays: event.target.value })
              }
            />
          </FormField>
          <FormField
            id="settings-slot-interval"
            label={`بازه اسلات (${view.fieldUnits.slotIntervalMinutes ?? "دقیقه"})`}
            error={errors.slotIntervalMinutes}
          >
            <Input
              id="settings-slot-interval"
              className="ltr-value"
              inputMode="numeric"
              value={active.slotIntervalMinutes}
              disabled={!editable}
              onChange={(event) => updateDraft({ slotIntervalMinutes: event.target.value })}
            />
          </FormField>
          <FormField
            id="settings-hold"
            label={`مدت نگهداری اسلات (${view.fieldUnits.slotHoldDurationMinutes ?? "دقیقه"})`}
            error={errors.slotHoldDurationMinutes}
          >
            <Input
              id="settings-hold"
              className="ltr-value"
              inputMode="numeric"
              value={active.slotHoldDurationMinutes}
              disabled={!editable}
              onChange={(event) =>
                updateDraft({ slotHoldDurationMinutes: event.target.value })
              }
            />
          </FormField>
          <FormField id="settings-confirmation-mode" label="حالت تأیید رزرو">
            {view.confirmationModeOptions.length > 0 ? (
              <Select
                id="settings-confirmation-mode"
                value={active.confirmationMode || undefined}
                options={view.confirmationModeOptions.map((item) => ({
                  value: item.value,
                  label: item.label,
                }))}
                disabled={!editable}
                onChange={(value) => updateDraft({ confirmationMode: value ?? "" })}
                allowClear
              />
            ) : (
              <Input
                id="settings-confirmation-mode"
                className="ltr-value"
                value={active.confirmationMode}
                disabled={!editable}
                onChange={(event) => updateDraft({ confirmationMode: event.target.value })}
              />
            )}
          </FormField>
        </div>

        <div className="admin-settings-form__switches">
          <Switch
            label="انتخاب ارائه‌دهنده"
            checked={active.providerSelectionEnabled}
            disabled={!editable}
            onCheckedChange={(checked) =>
              updateDraft({ providerSelectionEnabled: checked })
            }
          />
          <Switch
            label="گزینه «هر ارائه‌دهنده»"
            checked={active.anyProviderEnabled}
            disabled={!editable}
            onCheckedChange={(checked) => updateDraft({ anyProviderEnabled: checked })}
          />
          <Switch
            label="پرداخت در محل"
            checked={active.payAtLocationEnabled}
            disabled={!editable}
            onCheckedChange={(checked) => updateDraft({ payAtLocationEnabled: checked })}
          />
        </div>

        <FormField id="settings-cancel-policy" label="سیاست لغو" optional>
          <Textarea
            id="settings-cancel-policy"
            rows={3}
            value={active.cancellationPolicyText}
            disabled={!editable}
            onChange={(event) =>
              updateDraft({ cancellationPolicyText: event.target.value })
            }
          />
        </FormField>
        <FormField id="settings-reschedule-policy" label="سیاست باززمان‌بندی" optional>
          <Textarea
            id="settings-reschedule-policy"
            rows={3}
            value={active.reschedulePolicyText}
            disabled={!editable}
            onChange={(event) => updateDraft({ reschedulePolicyText: event.target.value })}
          />
        </FormField>

        <div className="admin-settings-form__actions">
          <Button type="submit" loading={submitting} disabled={!editable || !dirty}>
            ذخیره
          </Button>
        </div>
      </form>

      <ConfirmDialog
        open={confirmOpen}
        title={impact?.title ?? "تأثیر تنظیمات نوبت‌دهی"}
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
