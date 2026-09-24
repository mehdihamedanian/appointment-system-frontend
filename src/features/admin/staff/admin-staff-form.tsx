"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/select";
import { Switch } from "@/components/ui/selection";
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
import {
  ADMIN_STAFF_SCHEDULE_MODE_LABELS,
  type AdminStaffDetailView,
  type AdminStaffFormInput,
  type AdminStaffScheduleMode,
} from "@/types/admin-staff";

const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const AVATAR_ACCEPT = "image/jpeg,image/png,image/webp";

function formFromDetail(detail?: AdminStaffDetailView | null): AdminStaffFormInput {
  const primary = detail?.branches.find((b) => b.primary)?.id ?? detail?.branches[0]?.id;
  return {
    firstName: detail?.firstName ?? "",
    lastName: detail?.lastName ?? "",
    name: detail?.name ?? "",
    jobTitle: detail?.jobTitle ?? "",
    specialty: detail?.specialty ?? "",
    publicDescription: detail?.publicDescription ?? "",
    phone: detail?.privateContact?.masked ? "" : detail?.privateContact?.phone ?? "",
    email: detail?.privateContact?.masked ? "" : detail?.privateContact?.email ?? "",
    branchIds: detail?.branches.map((b) => b.id) ?? [],
    primaryBranchId: primary,
    serviceIds: detail?.services.map((s) => s.id) ?? [],
    customerVisible: detail?.customerVisible ?? false,
    bookable: detail?.bookable ?? true,
    scheduleMode:
      detail?.schedule?.mode && detail.schedule.mode !== "unknown"
        ? detail.schedule.mode
        : "inherit_business",
    version: detail?.version,
  };
}

export function AdminStaffForm({
  userId,
  mode,
  reference,
  initial,
  serviceOptions = [],
}: {
  userId: string;
  mode: "create" | "edit";
  reference?: string;
  initial?: AdminStaffDetailView | null;
  serviceOptions?: Array<{ value: string; label: string }>;
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
    if (!form.name.trim()) next.name = "نام کارمند را وارد کنید.";
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
        name: form.name.trim(),
        firstName: form.firstName?.trim() || undefined,
        lastName: form.lastName?.trim() || undefined,
        jobTitle: form.jobTitle?.trim() || undefined,
        specialty: form.specialty?.trim() || undefined,
        publicDescription: form.publicDescription?.trim() || undefined,
        phone: form.phone?.trim() || undefined,
        email: form.email?.trim() || undefined,
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
          name: pickFieldError(apiError.fieldErrors, ["name", "fullName"]),
          firstName: pickFieldError(apiError.fieldErrors, ["firstName"]),
          lastName: pickFieldError(apiError.fieldErrors, ["lastName"]),
          jobTitle: pickFieldError(apiError.fieldErrors, ["jobTitle", "title"]),
          specialty: pickFieldError(apiError.fieldErrors, ["specialty"]),
          phone: pickFieldError(apiError.fieldErrors, ["phone", "mobile"]),
          email: pickFieldError(apiError.fieldErrors, ["email"]),
          branchIds: pickFieldError(apiError.fieldErrors, ["branchIds", "branches"]),
          serviceIds: pickFieldError(apiError.fieldErrors, ["serviceIds", "services"]),
          publicDescription: pickFieldError(apiError.fieldErrors, ["publicDescription"]),
          scheduleMode: pickFieldError(apiError.fieldErrors, ["scheduleMode"]),
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
    if (!file.type.startsWith("image/")) {
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

  if (businessQuery.isError) {
    return (
      <ApiErrorState
        title="اطلاعات کسب‌وکار دریافت نشد"
        onRetry={() => void businessQuery.refetch()}
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
          description="کارمند ≠ حساب مدیریت. نمایش مشتری و قابلیت رزرو مستقل از هم و از تخصیص خدمت هستند."
        />

        {canUploadAvatar ? (
          <section aria-labelledby="staff-avatar-title">
            <h3 id="staff-avatar-title" className="text-card-title">
              تصویر پروفایل
            </h3>
            <div className="admin-staff-avatar-upload">
              <AdminStaffAvatar
                avatar={{ imageUrl: avatarPreview, initials: form.name.slice(0, 2) }}
                name={form.name || "?"}
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
        ) : mode === "create" ? (
          <p className="ds-help">پس از ایجاد کارمند می‌توانید تصویر پروفایل اضافه کنید.</p>
        ) : null}

        <div className="admin-staff-form__grid">
          <FormField id="staffFirstName" label="نام" error={fieldErrors.firstName}>
            <Input
              id="staffFirstName"
              value={form.firstName ?? ""}
              disabled={submitting}
              onChange={(event) =>
                setForm((current) => {
                  const firstName = event.target.value;
                  const name = [firstName, current.lastName].filter(Boolean).join(" ");
                  return { ...current, firstName, name: name || current.name };
                })
              }
            />
          </FormField>
          <FormField id="staffLastName" label="نام خانوادگی" error={fieldErrors.lastName}>
            <Input
              id="staffLastName"
              value={form.lastName ?? ""}
              disabled={submitting}
              onChange={(event) =>
                setForm((current) => {
                  const lastName = event.target.value;
                  const name = [current.firstName, lastName].filter(Boolean).join(" ");
                  return { ...current, lastName, name: name || current.name };
                })
              }
            />
          </FormField>
        </div>

        <FormField id="staffName" label="نام نمایشی" required error={fieldErrors.name}>
          <Input
            id="staffName"
            value={form.name}
            disabled={submitting}
            invalid={Boolean(fieldErrors.name)}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          />
        </FormField>

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

        <FormField
          id="staffPublicDescription"
          label="توضیحات برای مشتری"
          error={fieldErrors.publicDescription}
        >
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

        {initial?.capabilities.hasPrivateContact !== false ? (
          <div className="admin-staff-form__grid">
            <FormField id="staffPhone" label="تلفن (خصوصی)" error={fieldErrors.phone}>
              <Input
                id="staffPhone"
                type="tel"
                className="ltr-value"
                dir="ltr"
                value={form.phone ?? ""}
                disabled={submitting || initial?.privateContact?.masked === true}
                onChange={(event) =>
                  setForm((current) => ({ ...current, phone: event.target.value }))
                }
              />
            </FormField>
            <FormField id="staffEmail" label="ایمیل (خصوصی)" error={fieldErrors.email}>
              <Input
                id="staffEmail"
                type="email"
                className="ltr-value"
                dir="ltr"
                value={form.email ?? ""}
                disabled={submitting || initial?.privateContact?.masked === true}
                onChange={(event) =>
                  setForm((current) => ({ ...current, email: event.target.value }))
                }
              />
            </FormField>
          </div>
        ) : null}
        {initial?.privateContact?.masked ? (
          <p className="ds-help">اطلاعات تماس خصوصی بدون مجوز `admin.staff.view_private_contact` نمایش داده نمی‌شود.</p>
        ) : null}

        {multiBranch ? (
          <>
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
                onChange={(values) =>
                  setForm((current) => ({
                    ...current,
                    branchIds: values,
                    primaryBranchId: values.includes(current.primaryBranchId ?? "")
                      ? current.primaryBranchId
                      : values[0],
                  }))
                }
              />
            </FormField>
            {form.branchIds.length > 1 ? (
              <FormField id="staffPrimaryBranch" label="شعبه اصلی">
                <Select
                  id="staffPrimaryBranch"
                  value={form.primaryBranchId}
                  disabled={submitting}
                  options={form.branchIds.map((id) => {
                    const branch = (branchesQuery.data ?? []).find((b) => b.id === id);
                    return { value: id, label: branch?.name ?? id };
                  })}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, primaryBranchId: value }))
                  }
                />
              </FormField>
            ) : null}
          </>
        ) : (
          <p className="ds-help">شعبه به‌صورت خودکار از پیکربندی تک‌شعبه‌ای کسب‌وکار اعمال می‌شود.</p>
        )}

        {initial?.capabilities.hasServiceAssignment !== false && serviceOptions.length > 0 ? (
          <FormField id="staffServices" label="خدمات" error={fieldErrors.serviceIds}>
            <MultiSelect
              id="staffServices"
              values={form.serviceIds}
              disabled={submitting}
              options={serviceOptions}
              onChange={(values) => setForm((current) => ({ ...current, serviceIds: values }))}
            />
            <p className="ds-help">
              تخصیص خدمت به‌تنهایی باعث نمایش عمومی برای مشتری نمی‌شود.
            </p>
          </FormField>
        ) : null}

        <FormField id="staffScheduleMode" label="حالت زمان‌بندی" error={fieldErrors.scheduleMode}>
          <Select
            id="staffScheduleMode"
            value={form.scheduleMode ?? "inherit_business"}
            disabled={submitting}
            options={(["inherit_business", "inherit_branch", "custom"] as AdminStaffScheduleMode[]).map(
              (modeValue) => ({
                value: modeValue,
                label: ADMIN_STAFF_SCHEDULE_MODE_LABELS[modeValue],
              }),
            )}
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                scheduleMode: (value as AdminStaffScheduleMode) ?? "inherit_business",
              }))
            }
          />
          <p className="ds-help">
            ویرایش کامل ساعات کاری در فاز ۳۲ انجام می‌شود. اینجا فقط حالت وراثت ثبت می‌شود.
          </p>
        </FormField>

        <Switch
          label="فعال برای رزرو (Bookable)"
          description="کارمند می‌تواند در نوبت‌ها تخصیص یابد؛ حتی اگر برای مشتری مخفی باشد."
          checked={form.bookable}
          disabled={submitting}
          onCheckedChange={(checked) => setForm((current) => ({ ...current, bookable: checked }))}
        />

        <Switch
          label="نمایش برای مشتری (Customer-visible Provider)"
          description="فقط فیلدهای تأییدشده Backend در UI مشتری نمایش داده می‌شوند."
          checked={form.customerVisible}
          disabled={submitting}
          onCheckedChange={(checked) =>
            setForm((current) => ({ ...current, customerVisible: checked }))
          }
        />

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
          <Button type="submit" loading={submitting}>
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
