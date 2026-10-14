"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input, Textarea } from "@/components/ui/input";
import { MultiSelect, Select } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { ApiErrorState } from "@/components/feedback/app-states";
import { InlineLoading } from "@/components/feedback/loading-states";
import { useToast } from "@/components/feedback/toast";
import { AdminStaffAvatar } from "@/features/admin/staff/admin-staff-avatar";
import { pickFieldError } from "@/lib/auth/form";
import { createIdempotencyKey } from "@/lib/booking/idempotency";
import {
  adminStaffConflictMessage,
  isAdminStaffConflict,
  isDuplicateStaffError,
} from "@/lib/admin/staff-adapter";
import { invalidateAfterAdminStaffMutation } from "@/lib/admin/staff-cache";
import { adminResourceTypesQueryOptions } from "@/lib/api/admin-resources";
import {
  createAdminStaff,
  removeAdminStaffAvatar,
  updateAdminStaff,
  uploadAdminStaffAvatar,
} from "@/lib/api/admin-staff";
import {
  isForbiddenError,
  isNotFoundError,
  isSessionExpiredError,
  isValidationError,
  toAppApiError,
} from "@/lib/api/errors";
import { fetchPublicBranches, fetchPublicBusiness } from "@/lib/api/public";
import { isCapabilityVisible, getBusinessCapabilities } from "@/config/capabilities";
import { queryKeys } from "@/lib/query/keys";
import { routes } from "@/constants/routes";
import type { AdminStaffDetailView, AdminStaffFormInput } from "@/types/admin-staff";

const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const AVATAR_ACCEPT = "image/jpeg,image/png,image/webp";

function formFromDetail(detail?: AdminStaffDetailView | null): AdminStaffFormInput {
  return {
    firstName: detail?.firstName ?? "",
    lastName: detail?.lastName ?? "",
    jobTitle: detail?.jobTitle ?? "",
    specialty: detail?.specialty ?? "",
    publicDescription: detail?.publicDescription ?? "",
    branchIds: detail?.branches.map((b) => b.id) ?? [],
    version: detail?.version,
  };
}

export function AdminStaffForm({
  userId,
  mode,
  reference,
  initial,
}: {
  userId: string;
  mode: "create" | "edit";
  reference?: string;
  initial?: AdminStaffDetailView | null;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const submitLock = useRef(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);
  const [form, setForm] = useState<AdminStaffFormInput>(() => formFromDetail(initial));
  const [baseline, setBaseline] = useState(() => JSON.stringify(formFromDetail(initial)));
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof AdminStaffFormInput, string>>
  >({});
  const [formError, setFormError] = useState<string>();
  const [conflict, setConflict] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [pendingHref, setPendingHref] = useState<string>();
  const [avatarPreview, setAvatarPreview] = useState<string | undefined>(
    initial?.avatar?.imageUrl,
  );
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string>();

  const dirty = JSON.stringify(form) !== baseline;
  const displayName = [form.firstName.trim(), form.lastName.trim()].filter(Boolean).join(" ");
  const canUploadAvatar =
    mode === "edit" &&
    Boolean(reference) &&
    initial?.capabilities.hasAvatarUpload !== false &&
    initial?.allowedActions.uploadAvatar !== false;

  const businessQuery = useQuery({
    queryKey: queryKeys.publicBusiness,
    queryFn: ({ signal }) => fetchPublicBusiness(signal),
    staleTime: 60_000,
  });
  const multiBranch =
    isCapabilityVisible(getBusinessCapabilities(), "multipleBranches") &&
    businessQuery.data?.branchesEnabled === true;
  const branchesQuery = useQuery({
    queryKey: queryKeys.publicBranches,
    queryFn: ({ signal }) => fetchPublicBranches(signal),
    enabled: multiBranch,
    staleTime: 60_000,
  });
  const typesQuery = useQuery({
    ...adminResourceTypesQueryOptions(userId),
    enabled: mode === "create" && Boolean(userId),
  });

  /** A StaffProfile can only sit on a human resource type (Backend: staff or specialist). */
  const typeOptions = (typesQuery.data ?? []).filter((option) => option.human);
  const selectedType =
    typeOptions.find((option) => option.id === form.resourceTypeId) ??
    typeOptions.find((option) => option.code === "staff") ??
    typeOptions[0];

  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  function validate(): boolean {
    const next: typeof fieldErrors = {};
    if (!form.firstName.trim()) next.firstName = "نام را وارد کنید.";
    if (!form.lastName.trim()) next.lastName = "نام خانوادگی را وارد کنید.";
    if (mode === "create" && !selectedType) next.resourceTypeId = "نوع کارمند را انتخاب کنید.";
    if (multiBranch && form.branchIds.length === 0) {
      next.branchIds = "حداقل یک شعبه انتخاب کنید.";
    }
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitLock.current || submitting) return;
    if (!validate()) return;
    submitLock.current = true;
    setSubmitting(true);
    setFormError(undefined);
    setConflict(undefined);
    const key = createIdempotencyKey();
    try {
      const payload: AdminStaffFormInput = {
        ...form,
        resourceTypeId: mode === "create" ? selectedType?.id : undefined,
      };
      const result =
        mode === "create"
          ? await createAdminStaff(payload, key)
          : await updateAdminStaff(reference!, payload, key);
      invalidateAfterAdminStaffMutation(queryClient, userId, result.reference, {
        affectsCustomerVisibleProvider: result.customerVisible,
        affectsBookableProvider: result.bookable,
        affectsServiceAssignment: true,
      });
      setBaseline(JSON.stringify(formFromDetail(result)));
      toast.success(mode === "create" ? "کارمند ایجاد شد." : "کارمند ذخیره شد.");
      router.push(routes.admin.staffDetail(result.reference));
    } catch (error) {
      const apiError = toAppApiError(error);
      if (isSessionExpiredError(apiError)) {
        router.push(routes.auth.sessionExpired);
        return;
      }
      if (isAdminStaffConflict(apiError) || isDuplicateStaffError(apiError)) {
        if (isDuplicateStaffError(apiError)) {
          setFormError(apiError.message || "کارمند تکراری است.");
        } else {
          setConflict(adminStaffConflictMessage());
        }
        return;
      }
      if (isForbiddenError(apiError)) {
        setFormError("مجوز این عملیات را ندارید.");
        return;
      }
      if (isNotFoundError(apiError)) {
        setFormError(apiError.message);
        return;
      }
      if (isValidationError(apiError)) {
        setFieldErrors({
          resourceTypeId: pickFieldError(apiError.fieldErrors, ["resource_type_id", "resourceTypeId"]),
          firstName: pickFieldError(apiError.fieldErrors, ["first_name", "firstName"]),
          lastName: pickFieldError(apiError.fieldErrors, ["last_name", "lastName"]),
          jobTitle: pickFieldError(apiError.fieldErrors, ["job_title", "jobTitle"]),
          specialty: pickFieldError(apiError.fieldErrors, ["specialty"]),
          publicDescription: pickFieldError(apiError.fieldErrors, ["description"]),
          branchIds: pickFieldError(apiError.fieldErrors, ["branch_ids", "branchIds"]),
        });
        setFormError(apiError.fieldErrors ? undefined : apiError.message);
        return;
      }
      setFormError(apiError.message);
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  }

  async function onAvatarSelected(file: File | undefined) {
    if (!file || !reference || !canUploadAvatar) return;
    setAvatarError(undefined);
    if (!AVATAR_ACCEPT.split(",").includes(file.type)) {
      setAvatarError("فقط تصویر JPEG، PNG یا WebP مجاز است.");
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      setAvatarError("حداکثر حجم تصویر ۲ مگابایت است.");
      return;
    }
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const preview = URL.createObjectURL(file);
    previewUrlRef.current = preview;
    setAvatarPreview(preview);
    setAvatarUploading(true);
    try {
      const result = await uploadAdminStaffAvatar(reference, file, createIdempotencyKey());
      invalidateAfterAdminStaffMutation(queryClient, userId, reference, {
        affectsCustomerVisibleProvider: result.customerVisible,
      });
      setAvatarPreview(result.avatar?.imageUrl ?? preview);
      toast.success("تصویر پروفایل به‌روزرسانی شد.");
    } catch (error) {
      const apiError = toAppApiError(error);
      setAvatarError(apiError.message);
      setAvatarPreview(initial?.avatar?.imageUrl);
    } finally {
      setAvatarUploading(false);
    }
  }

  async function onRemoveAvatar() {
    if (!reference || !canUploadAvatar) return;
    setAvatarUploading(true);
    setAvatarError(undefined);
    try {
      await removeAdminStaffAvatar(reference, createIdempotencyKey());
      setAvatarPreview(undefined);
      invalidateAfterAdminStaffMutation(queryClient, userId, reference, {
        affectsCustomerVisibleProvider: initial?.customerVisible,
      });
      toast.success("تصویر پروفایل حذف شد.");
    } catch (error) {
      setAvatarError(toAppApiError(error).message);
    } finally {
      setAvatarUploading(false);
    }
  }

  function requestLeave(href: string) {
    if (!dirty) {
      router.push(href);
      return;
    }
    setPendingHref(href);
    setLeaveOpen(true);
  }

  if (businessQuery.isError && !isNotFoundError(toAppApiError(businessQuery.error))) {
    return (
      <ApiErrorState
        title="اطلاعات کسب‌وکار دریافت نشد"
        onRetry={() => void businessQuery.refetch()}
      />
    );
  }
  if (mode === "create" && typesQuery.isError) {
    const error = toAppApiError(typesQuery.error);
    return (
      <ApiErrorState
        title="انواع کارمند دریافت نشد"
        description={error.message}
        requestId={error.requestId}
        onRetry={() => void typesQuery.refetch()}
      />
    );
  }

  return (
    <>
      <form className="admin-staff-form" onSubmit={onSubmit} noValidate>
        {formError ? <Alert tone="error" title="ذخیره انجام نشد" description={formError} /> : null}
        {conflict ? <Alert tone="warning" title="تداخل نسخه" description={conflict} /> : null}

        <Alert
          tone="info"
          title="مرز مفاهیم"
          description="کارمند ≠ حساب مدیریت. ایجاد کارمند حساب ورود به پنل نمی‌سازد."
        />

        {canUploadAvatar ? (
          <section aria-labelledby="staff-avatar-title">
            <h3 id="staff-avatar-title" className="text-card-title">
              تصویر پروفایل
            </h3>
            <div className="admin-staff-avatar-upload">
              <AdminStaffAvatar
                avatar={{ imageUrl: avatarPreview, initials: displayName.slice(0, 2) }}
                name={displayName || "?"}
                size="lg"
              />
              <div className="admin-staff-avatar-upload__actions">
                <Button
                  type="button"
                  variant="secondary"
                  loading={avatarUploading}
                  onClick={() => avatarInputRef.current?.click()}
                >
                  {avatarPreview ? "تعویض تصویر" : "بارگذاری تصویر"}
                </Button>
                {avatarPreview ? (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={avatarUploading}
                    onClick={() => void onRemoveAvatar()}
                  >
                    حذف
                  </Button>
                ) : null}
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept={AVATAR_ACCEPT}
                  className="visually-hidden"
                  onChange={(event) => {
                    void onAvatarSelected(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
              </div>
            </div>
            {avatarError ? <p className="ds-error">{avatarError}</p> : null}
            <p className="ds-help">حداکثر ۲ مگابایت — JPEG، PNG یا WebP</p>
          </section>
        ) : null}

        {mode === "create" ? (
          <FormField id="staffResourceType" label="نوع کارمند" required error={fieldErrors.resourceTypeId}>
            {typesQuery.isPending ? <InlineLoading label="بارگذاری انواع کارمند" /> : null}
            <Select
              id="staffResourceType"
              value={selectedType?.id}
              disabled={submitting || typesQuery.isPending}
              options={typeOptions.map((option) => ({ value: option.id, label: option.label }))}
              onChange={(value) => setForm((current) => ({ ...current, resourceTypeId: value }))}
            />
          </FormField>
        ) : null}

        <div className="admin-staff-form__grid">
          <FormField id="staffFirstName" label="نام" required error={fieldErrors.firstName}>
            <Input
              id="staffFirstName"
              value={form.firstName}
              disabled={submitting}
              invalid={Boolean(fieldErrors.firstName)}
              onChange={(event) =>
                setForm((current) => ({ ...current, firstName: event.target.value }))
              }
            />
          </FormField>
          <FormField id="staffLastName" label="نام خانوادگی" required error={fieldErrors.lastName}>
            <Input
              id="staffLastName"
              value={form.lastName}
              disabled={submitting}
              invalid={Boolean(fieldErrors.lastName)}
              onChange={(event) =>
                setForm((current) => ({ ...current, lastName: event.target.value }))
              }
            />
          </FormField>
        </div>

        <div className="admin-staff-form__grid">
          <FormField id="staffJobTitle" label="سمت شغلی" error={fieldErrors.jobTitle}>
            <Input
              id="staffJobTitle"
              value={form.jobTitle ?? ""}
              disabled={submitting}
              onChange={(event) =>
                setForm((current) => ({ ...current, jobTitle: event.target.value }))
              }
            />
          </FormField>
          <FormField id="staffSpecialty" label="تخصص" error={fieldErrors.specialty}>
            <Input
              id="staffSpecialty"
              value={form.specialty ?? ""}
              disabled={submitting}
              onChange={(event) =>
                setForm((current) => ({ ...current, specialty: event.target.value }))
              }
            />
          </FormField>
        </div>

        <FormField id="staffPublicDescription" label="توضیحات" error={fieldErrors.publicDescription}>
          <Textarea
            id="staffPublicDescription"
            rows={3}
            value={form.publicDescription ?? ""}
            disabled={submitting}
            onChange={(event) =>
              setForm((current) => ({ ...current, publicDescription: event.target.value }))
            }
          />
        </FormField>

        {multiBranch ? (
          <FormField id="staffBranches" label="شعب" required error={fieldErrors.branchIds}>
            {branchesQuery.isPending ? <InlineLoading label="بارگذاری شعب" /> : null}
            <MultiSelect
              id="staffBranches"
              values={form.branchIds}
              disabled={submitting || branchesQuery.isPending}
              options={(branchesQuery.data ?? []).map((branch) => ({
                value: branch.id,
                label: branch.name,
              }))}
              onChange={(values) => setForm((current) => ({ ...current, branchIds: values }))}
            />
          </FormField>
        ) : null}

        <div className="booking-wizard__nav">
          <Button
            type="button"
            variant="ghost"
            disabled={submitting}
            onClick={() =>
              requestLeave(
                mode === "edit" && reference
                  ? routes.admin.staffDetail(reference)
                  : routes.admin.staff,
              )
            }
          >
            انصراف
          </Button>
          <Button
            type="submit"
            loading={submitting}
            disabled={mode === "create" && typesQuery.isPending}
          >
            {mode === "create" ? "ایجاد کارمند" : "ذخیره تغییرات"}
          </Button>
        </div>
      </form>

      <ConfirmDialog
        open={leaveOpen}
        title="تغییرات ذخیره نشده"
        description="با ترک صفحه، تغییرات ذخیره‌نشده از بین می‌روند."
        confirmLabel="ترک صفحه"
        cancelLabel="ماندن"
        onCancel={() => {
          setLeaveOpen(false);
          setPendingHref(undefined);
        }}
        onConfirm={() => {
          const href = pendingHref ?? routes.admin.staff;
          setLeaveOpen(false);
          router.push(href);
        }}
      />
    </>
  );
}
