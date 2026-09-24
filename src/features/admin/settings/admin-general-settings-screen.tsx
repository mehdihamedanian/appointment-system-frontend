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
import { useToast } from "@/components/feedback/toast";
import { AdminSettingsSectionSkeleton } from "@/features/admin/settings/admin-settings-skeleton";
import { AdminSettingsShell } from "@/features/admin/settings/admin-settings-shell";
import { useSession } from "@/features/auth/session-provider";
import { useUnsavedChangesWarning } from "@/features/customer/use-unsaved-changes-warning";
import {
  adminSettingsConflictMessage,
  buildGeneralSettingsPayload,
  formFromGeneralSettings,
  isAdminSettingsConflict,
  isValidLogoFile,
  validateGeneralSettingsForm,
} from "@/lib/admin/settings-adapter";
import {
  invalidateAfterAdminSettingsMutation,
  invalidateAfterLogoMutation,
} from "@/lib/admin/settings-cache";
import { canAccessSettingsSection, canEditSettingsSection } from "@/lib/admin/settings-filters";
import {
  adminGeneralSettingsQueryOptions,
  removeAdminBusinessLogo,
  updateAdminGeneralSettings,
  uploadAdminBusinessLogo,
} from "@/lib/api/admin-settings";
import {
  isForbiddenError,
  isNotFoundError,
  isValidationError,
  toAppApiError,
} from "@/lib/api/errors";
import { createIdempotencyKey } from "@/lib/booking/idempotency";
import { resolveMediaUrl } from "@/lib/public/media";
import {
  LOGO_ACCEPT,
  LOGO_MAX_BYTES,
  type AdminGeneralSettingsFormErrors,
  type AdminGeneralSettingsFormInput,
} from "@/types/admin-settings";

export function AdminGeneralSettingsScreen() {
  const { status, user } = useSession();
  if (status === "loading" || !user?.id) {
    return (
      <AdminSettingsShell section="general">
        <AdminSettingsSectionSkeleton />
      </AdminSettingsShell>
    );
  }

  if (!canAccessSettingsSection(user.permissionCodes, "general")) {
    return (
      <AdminSettingsShell section="general">
        <PermissionDeniedState
          title="دسترسی مجاز نیست"
          description="مجوز مشاهده تنظیمات عمومی را ندارید."
        />
      </AdminSettingsShell>
    );
  }

  return (
    <AdminSettingsShell section="general">
      <AdminGeneralSettingsForm
        userId={user.id}
        canEdit={canEditSettingsSection(user.permissionCodes, "general")}
      />
    </AdminSettingsShell>
  );
}

function AdminGeneralSettingsForm({
  userId,
  canEdit,
}: {
  userId: string;
  canEdit: boolean;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const query = useQuery(adminGeneralSettingsQueryOptions(userId));
  const view = query.data;

  const [draft, setDraft] = useState<AdminGeneralSettingsFormInput | null>(null);
  const [errors, setErrors] = useState<AdminGeneralSettingsFormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [uploadError, setUploadError] = useState<string>();
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>();
  const submitLock = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const active = draft ?? formFromGeneralSettings(view);
  const dirty = draft !== null;
  const editable = canEdit && view?.allowedActions.edit === true;
  useUnsavedChangesWarning(dirty && !submitting);

  function updateDraft(partial: Partial<AdminGeneralSettingsFormInput>) {
    setDraft((current) => ({
      ...(current ?? formFromGeneralSettings(view)),
      ...partial,
    }));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!editable || submitLock.current) return;
    const nextErrors = validateGeneralSettingsForm(active);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    submitLock.current = true;
    setSubmitting(true);
    setConflict(false);
    try {
      await updateAdminGeneralSettings(
        buildGeneralSettingsPayload(active, view?.version),
        createIdempotencyKey(),
      );
      setDraft(null);
      invalidateAfterAdminSettingsMutation(queryClient, userId, "general");
      toast.success("تنظیمات عمومی ذخیره شد");
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

  async function onLogoSelected(file: File | undefined) {
    if (!file || !view?.logoUploadSupported) return;
    setUploadError(undefined);
    const validation = isValidLogoFile(file, LOGO_MAX_BYTES);
    if (validation) {
      setUploadError(validation);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setUploading(true);
    try {
      await uploadAdminBusinessLogo(file, createIdempotencyKey());
      invalidateAfterLogoMutation(queryClient, userId);
      toast.success("لوگو بارگذاری شد");
      void query.refetch();
    } catch (err) {
      setUploadError(toAppApiError(err).message);
    } finally {
      setUploading(false);
      setPreviewUrl(undefined);
      URL.revokeObjectURL(objectUrl);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function onRemoveLogo() {
    setUploadError(undefined);
    setUploading(true);
    try {
      await removeAdminBusinessLogo(createIdempotencyKey());
      invalidateAfterLogoMutation(queryClient, userId);
      toast.success("لوگو حذف شد");
      void query.refetch();
    } catch (err) {
      setUploadError(toAppApiError(err).message);
    } finally {
      setUploading(false);
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

  const logoSrc = previewUrl ?? resolveMediaUrl(view.logoUrl);

  return (
    <form className="admin-settings-form" onSubmit={onSubmit} noValidate>
      {!editable ? (
        <Alert
          tone="info"
          title="فقط مشاهده"
          description={
            view.allowedActions.blockedReason ?? "مجوز ویرایش تنظیمات عمومی را ندارید."
          }
        />
      ) : null}
      {conflict ? (
        <Alert tone="warning" title="تداخل نسخه" description={adminSettingsConflictMessage()} />
      ) : null}
      {errors.form ? (
        <Alert tone="error" title="خطای اعتبارسنجی" description={errors.form} />
      ) : null}

      <div className="admin-settings-form__grid">
        <FormField
          id="settings-business-name"
          label="نام کسب‌وکار"
          required
          error={errors.businessName}
        >
          <Input
            id="settings-business-name"
            value={active.businessName}
            disabled={!editable}
            onChange={(event) => updateDraft({ businessName: event.target.value })}
          />
        </FormField>
        <FormField id="settings-page-title" label="عنوان صفحه عمومی" optional>
          <Input
            id="settings-page-title"
            value={active.publicPageTitle}
            disabled={!editable}
            onChange={(event) => updateDraft({ publicPageTitle: event.target.value })}
          />
        </FormField>
        <FormField id="settings-description" label="توضیح کوتاه" optional>
          <Textarea
            id="settings-description"
            rows={3}
            value={active.shortDescription}
            disabled={!editable}
            onChange={(event) => updateDraft({ shortDescription: event.target.value })}
          />
        </FormField>
        <FormField id="settings-phone" label="تلفن تماس" optional>
          <Input
            id="settings-phone"
            className="ltr-value"
            value={active.contactPhone}
            disabled={!editable}
            onChange={(event) => updateDraft({ contactPhone: event.target.value })}
          />
        </FormField>
        <FormField
          id="settings-email"
          label="ایمیل تماس"
          optional
          error={errors.contactEmail}
        >
          <Input
            id="settings-email"
            className="ltr-value"
            type="email"
            value={active.contactEmail}
            disabled={!editable}
            onChange={(event) => updateDraft({ contactEmail: event.target.value })}
          />
        </FormField>
        <FormField id="settings-address" label="آدرس" optional>
          <Textarea
            id="settings-address"
            rows={2}
            value={active.address}
            disabled={!editable}
            onChange={(event) => updateDraft({ address: event.target.value })}
          />
        </FormField>
        <FormField id="settings-public-contact" label="اطلاعات تماس عمومی" optional>
          <Textarea
            id="settings-public-contact"
            rows={2}
            value={active.publicContactDetails}
            disabled={!editable}
            onChange={(event) => updateDraft({ publicContactDetails: event.target.value })}
          />
        </FormField>
      </div>

      {view.logoUploadSupported ? (
        <section className="admin-settings-logo" aria-labelledby="settings-logo-title">
          <h2 id="settings-logo-title" className="text-card-title">
            لوگو
          </h2>
          {logoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoSrc}
              alt="پیش‌نمایش لوگو"
              className="admin-settings-logo__preview"
            />
          ) : (
            <p className="ds-help">هنوز لوگویی تنظیم نشده است.</p>
          )}
          {uploadError ? (
            <Alert tone="error" title="خطای بارگذاری لوگو" description={uploadError} />
          ) : null}
          <div className="admin-settings-logo__actions">
            <input
              ref={fileRef}
              type="file"
              accept={LOGO_ACCEPT}
              hidden
              onChange={(event) => void onLogoSelected(event.target.files?.[0])}
            />
            <Button
              type="button"
              variant="secondary"
              loading={uploading}
              disabled={!editable || view.allowedActions.uploadLogo === false}
              onClick={() => fileRef.current?.click()}
            >
              بارگذاری لوگو
            </Button>
            {view.logoUrl ? (
              <Button
                type="button"
                variant="secondary"
                loading={uploading}
                disabled={!editable || view.allowedActions.removeLogo === false}
                onClick={() => void onRemoveLogo()}
              >
                حذف لوگو
              </Button>
            ) : null}
          </div>
          <p className="ds-help">حداکثر ۲ مگابایت — JPEG، PNG یا WebP. جدا از ذخیره فرم.</p>
        </section>
      ) : null}

      <div className="admin-settings-form__actions">
        <Button type="submit" loading={submitting} disabled={!editable || !dirty}>
          ذخیره
        </Button>
      </div>
    </form>
  );
}
