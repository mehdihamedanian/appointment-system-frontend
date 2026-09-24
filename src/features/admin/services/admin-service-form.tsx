"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input, Textarea } from "@/components/ui/input";
import { Select, MultiSelect } from "@/components/ui/select";
import { Switch } from "@/components/ui/selection";
import { Tabs, Tab, TabList, TabPanel } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { InlineLoading } from "@/components/feedback/loading-states";
import { useToast } from "@/components/feedback/toast";
import { AdminServicePreview } from "@/features/admin/services/admin-service-preview";
import { ServiceResourceRequirementsEditor } from "@/features/admin/service-resources/service-resource-requirements-editor";
import { useSession } from "@/features/auth/session-provider";
import { ServiceMedia } from "@/features/services/service-media";
import { createIdempotencyKey } from "@/lib/booking/idempotency";
import {
  adminServiceConflictMessage,
  adminServiceDuplicateMessage,
  formFromAdminServiceDetail,
  isAdminServiceConflict,
  isDuplicateServiceError,
  validateAdminServiceForm,
  type AdminServiceFormErrors,
} from "@/lib/admin/service-adapter";
import { invalidateAfterAdminServiceMutation } from "@/lib/admin/service-cache";
import {
  adminServiceResourceRequirementsQueryOptions,
} from "@/lib/api/admin-service-resources";
import {
  createAdminService,
  fetchAdminServiceFormImpactPreview,
  removeAdminServiceImage,
  updateAdminService,
  uploadAdminServiceImage,
} from "@/lib/api/admin-services";
import {
  isForbiddenError,
  isNotFoundError,
  isSessionExpiredError,
  isValidationError,
  toAppApiError,
} from "@/lib/api/errors";
import { fetchPublicBranches, fetchPublicBusiness, fetchPublicProviders } from "@/lib/api/public";
import { hasPermission } from "@/lib/permissions/access";
import { isCapabilityVisible, getBusinessCapabilities } from "@/config/capabilities";
import { queryKeys } from "@/lib/query/keys";
import { routes } from "@/constants/routes";
import {
  ADMIN_SERVICE_DEPOSIT_MODE_LABELS,
  ADMIN_SERVICE_FORM_TABS,
  ADMIN_SERVICE_PROVIDER_MODE_LABELS,
  type AdminServiceDetailView,
  type AdminServiceFormInput,
  type AdminServiceFormTabId,
  type AdminServiceImpactPreview,
} from "@/types/admin-service";
import type { ServicePriceKind } from "@/types/service";

const IMAGE_MAX_BYTES = 2 * 1024 * 1024;
const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";

const PRICE_MODE_OPTIONS: Array<{ value: ServicePriceKind; label: string }> = [
  { value: "fixed", label: "قیمت ثابت" },
  { value: "startingFrom", label: "شروع از" },
  { value: "free", label: "رایگان" },
  { value: "contact", label: "تماس بگیرید" },
  { value: "hidden", label: "مخفی" },
];

function tabHasError(tab: AdminServiceFormTabId, errors: AdminServiceFormErrors): boolean {
  const map: Record<AdminServiceFormTabId, (keyof AdminServiceFormErrors)[]> = {
    basic: ["name", "slug"],
    presentation: ["shortDescription", "description"],
    scheduling: ["durationMinutes", "bufferBeforeMinutes", "bufferAfterMinutes", "capacity"],
    pricing: ["price", "depositAmount", "depositPercent"],
    assignments: ["branchIds", "providerIds"],
    requirements: [],
    status: ["sortOrder"],
  };
  return map[tab].some((key) => Boolean(errors[key]));
}

export function AdminServiceForm({
  userId,
  user,
  mode,
  reference,
  initial,
}: {
  userId: string;
  user: NonNullable<ReturnType<typeof useSession>["user"]>;
  mode: "create" | "edit";
  reference?: string;
  initial?: AdminServiceDetailView | null;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const submitLock = useRef(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);
  const [form, setForm] = useState<AdminServiceFormInput>(() => formFromAdminServiceDetail(initial));
  const [baseline, setBaseline] = useState(() => JSON.stringify(formFromAdminServiceDetail(initial)));
  const [errors, setErrors] = useState<AdminServiceFormErrors>({});
  const [activeTab, setActiveTab] = useState<AdminServiceFormTabId>("basic");
  const [formError, setFormError] = useState<string>();
  const [conflict, setConflict] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [impact, setImpact] = useState<AdminServiceImpactPreview | null>(null);
  const [impactLoading, setImpactLoading] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | undefined>(initial?.image?.imageUrl);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageError, setImageError] = useState<string>();

  const dirty = JSON.stringify(form) !== baseline;
  const caps = initial?.capabilities;

  const canEditContent =
    hasPermission(user, "admin.services.edit") ||
    hasPermission(user, "admin.services.edit_content") ||
    user.permissionCodes.length === 0;
  const canManagePricing =
    hasPermission(user, "admin.services.manage_pricing") ||
    hasPermission(user, "admin.services.edit") ||
    user.permissionCodes.length === 0;
  const canManageAssignments =
    hasPermission(user, "admin.services.manage_providers") ||
    hasPermission(user, "admin.services.manage_branches") ||
    hasPermission(user, "admin.services.edit") ||
    user.permissionCodes.length === 0;

  const businessQuery = useQuery({
    queryKey: queryKeys.publicBusiness,
    queryFn: ({ signal }) => fetchPublicBusiness(signal),
    staleTime: 60_000,
  });
  const currency = businessQuery.data?.currency ?? "IRR";
  const multiBranch =
    isCapabilityVisible(getBusinessCapabilities(), "multipleBranches") &&
    businessQuery.data?.branchesEnabled === true &&
    caps?.hasMultiBranch !== false;

  const branchesQuery = useQuery({
    queryKey: queryKeys.publicBranches,
    queryFn: ({ signal }) => fetchPublicBranches(signal),
    enabled: multiBranch,
    staleTime: 60_000,
  });
  const providersQuery = useQuery({
    queryKey: queryKeys.publicProviders,
    queryFn: ({ signal }) => fetchPublicProviders(signal),
    enabled: caps?.hasProviderAssignment !== false,
    staleTime: 60_000,
  });

  const requirementsQuery = useQuery({
    ...adminServiceResourceRequirementsQueryOptions(userId, reference ?? ""),
    enabled: mode === "edit" && Boolean(reference),
  });

  function patch(patch: Partial<AdminServiceFormInput>) {
    setForm((current) => ({ ...current, ...patch }));
    setErrors((current) => {
      const next = { ...current };
      for (const key of Object.keys(patch) as (keyof AdminServiceFormInput)[]) {
        delete next[key];
      }
      return next;
    });
  }

  function schedulingFieldsChanged(next: AdminServiceFormInput, base: AdminServiceFormInput): boolean {
    return (
      next.durationMinutes !== base.durationMinutes ||
      next.bufferBeforeMinutes !== base.bufferBeforeMinutes ||
      next.bufferAfterMinutes !== base.bufferAfterMinutes ||
      next.capacity !== base.capacity ||
      JSON.stringify(next.branchIds) !== JSON.stringify(base.branchIds) ||
      JSON.stringify(next.providerIds) !== JSON.stringify(base.providerIds)
    );
  }

  async function prepareSave(event: FormEvent) {
    event.preventDefault();
    if (submitLock.current || submitting) return;

    const validation = validateAdminServiceForm(form, { requirePricing: canManagePricing });
    setErrors(validation);
    if (Object.keys(validation).length) {
      setFormError("لطفاً خطاهای فرم را برطرف کنید.");
      const firstTab = ADMIN_SERVICE_FORM_TABS.find((tab) => tabHasError(tab.id, validation));
      if (firstTab) setActiveTab(firstTab.id);
      return;
    }

    setFormError(undefined);
    setConflict(undefined);

    const baselineForm = JSON.parse(baseline) as AdminServiceFormInput;
    const needsImpact =
      mode === "edit" &&
      reference &&
      caps?.hasImpactPreview !== false &&
      schedulingFieldsChanged(form, baselineForm);

    if (needsImpact) {
      setImpactLoading(true);
      try {
        const preview = await fetchAdminServiceFormImpactPreview(reference, form);
        if (preview.requiresConfirmation) {
          setImpact(preview);
          return;
        }
      } catch (error) {
        const apiError = toAppApiError(error);
        if (!isNotFoundError(apiError)) {
          setFormError(apiError.message);
          setImpactLoading(false);
          return;
        }
      } finally {
        setImpactLoading(false);
      }
    }

    await executeSave();
  }

  async function executeSave() {
    if (submitLock.current) return;
    submitLock.current = true;
    setSubmitting(true);
    setFormError(undefined);
    const key = createIdempotencyKey();
    try {
      const payload: AdminServiceFormInput = {
        ...form,
        name: form.name.trim(),
        shortDescription: form.shortDescription?.trim() || undefined,
        description: form.description?.trim() || undefined,
      };
      const result =
        mode === "create"
          ? await createAdminService(payload, key)
          : await updateAdminService(reference!, payload, key);

      const baselineForm = JSON.parse(baseline) as AdminServiceFormInput;
      invalidateAfterAdminServiceMutation(queryClient, userId, result.reference, {
        affectsPublicCatalog: true,
        affectsAvailability: schedulingFieldsChanged(form, baselineForm),
        affectsProviders: JSON.stringify(form.providerIds) !== JSON.stringify(baselineForm.providerIds),
        changedFields: schedulingFieldsChanged(form, baselineForm)
          ? ["duration", "buffers", "capacity", "branches", "providers"]
          : ["status"],
      });

      setBaseline(JSON.stringify(formFromAdminServiceDetail(result)));
      setImpact(null);
      toast.success(mode === "create" ? "خدمت ایجاد شد." : "خدمت ذخیره شد.");
      router.push(routes.admin.serviceDetail(result.reference));
    } catch (error) {
      const apiError = toAppApiError(error);
      if (isSessionExpiredError(apiError)) {
        router.push(routes.auth.sessionExpired);
        return;
      }
      if (isAdminServiceConflict(apiError)) {
        setConflict(adminServiceConflictMessage());
        return;
      }
      if (isDuplicateServiceError(apiError)) {
        setErrors({ name: adminServiceDuplicateMessage() });
        setActiveTab("basic");
        return;
      }
      if (isValidationError(apiError)) {
        setFormError(apiError.message);
        return;
      }
      if (isForbiddenError(apiError)) {
        setFormError("مجوز ذخیره خدمت را ندارید.");
        return;
      }
      setFormError(apiError.message);
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  }

  async function onImageSelected(file: File | undefined) {
    if (!file || !reference) return;
    if (!file.type.startsWith("image/")) {
      setImageError("فقط فایل تصویری مجاز است.");
      return;
    }
    if (file.size > IMAGE_MAX_BYTES) {
      setImageError("حداکثر حجم تصویر ۲ مگابایت است.");
      return;
    }
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const local = URL.createObjectURL(file);
    previewUrlRef.current = local;
    setImagePreview(local);
    setImageError(undefined);
    setImageUploading(true);
    try {
      const updated = await uploadAdminServiceImage(reference, file, createIdempotencyKey());
      invalidateAfterAdminServiceMutation(queryClient, userId, reference, {
        affectsPublicCatalog: true,
        affectsAvailability: false,
      });
      setImagePreview(updated.image?.imageUrl ?? local);
      toast.success("تصویر ذخیره شد.");
    } catch (error) {
      setImageError(toAppApiError(error).message);
    } finally {
      setImageUploading(false);
    }
  }

  async function onRemoveImage() {
    if (!reference) return;
    setImageUploading(true);
    try {
      await removeAdminServiceImage(reference, createIdempotencyKey());
      setImagePreview(undefined);
      invalidateAfterAdminServiceMutation(queryClient, userId, reference, {
        affectsPublicCatalog: true,
        affectsAvailability: false,
      });
      toast.success("تصویر حذف شد.");
    } catch (error) {
      setImageError(toAppApiError(error).message);
    } finally {
      setImageUploading(false);
    }
  }

  const providerOptions = (providersQuery.data ?? []).map((p) => ({
    value: p.id,
    label: p.name,
  }));
  const branchOptions = (branchesQuery.data ?? []).map((b) => ({
    value: b.id,
    label: b.name,
  }));

  return (
    <form className="admin-service-form" onSubmit={(event) => void prepareSave(event)} noValidate>
      {formError ? <Alert tone="error" title="ذخیره انجام نشد" description={formError} /> : null}
      {conflict ? <Alert tone="warning" title="تداخل نسخه" description={conflict} /> : null}

      <Tabs value={activeTab} defaultValue="basic" onValueChange={(v) => setActiveTab(v as AdminServiceFormTabId)}>
        <TabList>
          {ADMIN_SERVICE_FORM_TABS.map((tab) => (
            <Tab key={tab.id} value={tab.id}>
              {tab.label}
              {tabHasError(tab.id, errors) ? " *" : ""}
            </Tab>
          ))}
        </TabList>

        <TabPanel value="basic">
          <FormField id="svc-name" label="نام خدمت" required error={errors.name}>
            <Input
              id="svc-name"
              value={form.name}
              disabled={!canEditContent}
              invalid={Boolean(errors.name)}
              onChange={(e) => patch({ name: e.target.value })}
            />
          </FormField>
          <FormField id="svc-slug" label="نشانی (slug)" description="اختیاری — برای URL عمومی">
            <Input
              id="svc-slug"
              className="ltr-value"
              dir="ltr"
              value={form.slug ?? ""}
              disabled={!canEditContent}
              onChange={(e) => patch({ slug: e.target.value })}
            />
          </FormField>
        </TabPanel>

        <TabPanel value="presentation">
          <FormField id="svc-short" label="توضیح کوتاه" error={errors.shortDescription}>
            <Textarea
              id="svc-short"
              value={form.shortDescription ?? ""}
              disabled={!canEditContent}
              onChange={(e) => patch({ shortDescription: e.target.value })}
            />
          </FormField>
          <FormField id="svc-desc" label="توضیح کامل" error={errors.description}>
            <Textarea
              id="svc-desc"
              rows={6}
              value={form.description ?? ""}
              disabled={!canEditContent}
              onChange={(e) => patch({ description: e.target.value })}
            />
          </FormField>
          {mode === "edit" && caps?.hasImageUpload !== false ? (
            <FormField id="svc-image" label="تصویر خدمت" error={imageError}>
              <div className="admin-service-image-field">
                <ServiceMedia src={imagePreview} alt={form.name || "تصویر خدمت"} className="admin-service-image-preview" />
                <input
                  ref={imageInputRef}
                  type="file"
                  accept={IMAGE_ACCEPT}
                  className="visually-hidden"
                  onChange={(e) => void onImageSelected(e.target.files?.[0])}
                />
                <div className="ds-inline">
                  <Button
                    type="button"
                    variant="secondary"
                    loading={imageUploading}
                    disabled={!canEditContent || !reference}
                    onClick={() => imageInputRef.current?.click()}
                  >
                    {imagePreview ? "جایگزینی تصویر" : "آپلود تصویر"}
                  </Button>
                  {imagePreview ? (
                    <Button type="button" variant="ghost" disabled={imageUploading} onClick={() => void onRemoveImage()}>
                      حذف
                    </Button>
                  ) : null}
                </div>
                <p className="ds-help">JPEG/PNG/WebP — حداکثر ۲MB — نسبت پیشنهادی ۱۶:۹</p>
              </div>
            </FormField>
          ) : mode === "create" ? (
            <p className="ds-help">پس از ایجاد خدمت می‌توانید تصویر آپلود کنید.</p>
          ) : null}
          <AdminServicePreview form={form} currency={currency} />
        </TabPanel>

        <TabPanel value="scheduling">
          <FormField id="svc-duration" label="مدت خدمت (دقیقه)" required error={errors.durationMinutes}>
            <Input
              id="svc-duration"
              type="number"
              min={1}
              className="ltr-value"
              dir="ltr"
              value={form.durationMinutes ?? ""}
              onChange={(e) => patch({ durationMinutes: Number(e.target.value) || undefined })}
            />
          </FormField>
          {caps?.hasBuffers !== false ? (
            <>
              <FormField id="svc-buffer-before" label="بافر قبل (دقیقه)" error={errors.bufferBeforeMinutes} description="زمان آماده‌سازی قبل از Slot — در UI مشتری نمایش داده نمی‌شود.">
                <Input
                  id="svc-buffer-before"
                  type="number"
                  min={0}
                  className="ltr-value"
                  dir="ltr"
                  value={form.bufferBeforeMinutes ?? ""}
                  onChange={(e) => patch({ bufferBeforeMinutes: Number(e.target.value) || 0 })}
                />
              </FormField>
              <FormField id="svc-buffer-after" label="بافر بعد (دقیقه)" error={errors.bufferAfterMinutes}>
                <Input
                  id="svc-buffer-after"
                  type="number"
                  min={0}
                  className="ltr-value"
                  dir="ltr"
                  value={form.bufferAfterMinutes ?? ""}
                  onChange={(e) => patch({ bufferAfterMinutes: Number(e.target.value) || 0 })}
                />
              </FormField>
            </>
          ) : null}
          {caps?.hasCapacity !== false ? (
            <FormField id="svc-capacity" label="ظرفیت خدمت" error={errors.capacity} description={initial?.capacityHelp ?? "تعداد مشتری/واحد هم‌زمان — جدا از ظرفیت منابع و تعداد نیازمندی‌ها."}>
              <Input
                id="svc-capacity"
                type="number"
                min={1}
                className="ltr-value"
                dir="ltr"
                value={form.capacity ?? ""}
                onChange={(e) => patch({ capacity: Number(e.target.value) || undefined })}
              />
            </FormField>
          ) : null}
        </TabPanel>

        <TabPanel value="pricing">
          {!canManagePricing ? (
            <Alert tone="info" title="بدون مجوز قیمت‌گذاری" description="بخش قیمت و بیعانه برای شما مخفی است." />
          ) : (
            <>
              <FormField id="svc-price-mode" label="نوع قیمت">
                <Select
                  id="svc-price-mode"
                  value={form.priceMode}
                  options={PRICE_MODE_OPTIONS}
                  onChange={(value) => patch({ priceMode: (value as ServicePriceKind) ?? "hidden" })}
                />
              </FormField>
              {form.priceMode === "fixed" || form.priceMode === "startingFrom" ? (
                <FormField id="svc-price" label="قیمت (واحد پولی)" error={errors.price}>
                  <Input
                    id="svc-price"
                    type="number"
                    min={0}
                    className="ltr-value"
                    dir="ltr"
                    value={form.price ?? ""}
                    onChange={(e) => patch({ price: Number(e.target.value), currency })}
                  />
                  <p className="ds-help">مبلغ صحیح — Backend مسئول محاسبات نهایی است.</p>
                </FormField>
              ) : null}
              <FormField id="svc-deposit-mode" label="بیعانه">
                <Select
                  id="svc-deposit-mode"
                  value={form.depositMode}
                  options={Object.entries(ADMIN_SERVICE_DEPOSIT_MODE_LABELS).map(([value, label]) => ({
                    value,
                    label,
                  }))}
                  onChange={(value) =>
                    patch({
                      depositMode: (value as AdminServiceFormInput["depositMode"]) ?? "none",
                    })
                  }
                />
              </FormField>
              {form.depositMode === "fixed" ? (
                <FormField id="svc-deposit-amount" label="مبلغ بیعانه" error={errors.depositAmount}>
                  <Input
                    id="svc-deposit-amount"
                    type="number"
                    min={0}
                    className="ltr-value"
                    dir="ltr"
                    value={form.depositAmount ?? ""}
                    onChange={(e) => patch({ depositAmount: Number(e.target.value) })}
                  />
                </FormField>
              ) : null}
              {form.depositMode === "percentage" ? (
                <FormField id="svc-deposit-percent" label="درصد بیعانه" error={errors.depositPercent}>
                  <Input
                    id="svc-deposit-percent"
                    type="number"
                    min={1}
                    max={100}
                    className="ltr-value"
                    dir="ltr"
                    value={form.depositPercent ?? ""}
                    onChange={(e) => patch({ depositPercent: Number(e.target.value) })}
                  />
                  <p className="ds-help">UI درصد را محاسبه نمی‌کند — Backend برچسب نهایی را برمی‌گرداند.</p>
                </FormField>
              ) : null}
            </>
          )}
        </TabPanel>

        <TabPanel value="assignments">
          {caps?.hasProviderAssignment !== false && canManageAssignments ? (
            <>
              <FormField id="svc-provider-mode" label="رفتار Provider">
                <Select
                  id="svc-provider-mode"
                  value={form.providerMode}
                  options={Object.entries(ADMIN_SERVICE_PROVIDER_MODE_LABELS).map(([value, label]) => ({
                    value,
                    label,
                  }))}
                  onChange={(value) =>
                    patch({ providerMode: (value as AdminServiceFormInput["providerMode"]) ?? "auto" })
                  }
                />
                <p className="ds-help">تخصیص Staff به‌عنوان نیازمندی، به‌تنهایی Provider عمومی نمی‌سازد.</p>
              </FormField>
              <FormField id="svc-providers" label="Providerهای مجاز">
                {providersQuery.isPending ? <InlineLoading label="بارگذاری Provider" /> : null}
                <MultiSelect
                  id="svc-providers"
                  values={form.providerIds}
                  options={providerOptions}
                  emptyLabel="Provider فعالی نیست"
                  onChange={(values) => patch({ providerIds: values })}
                />
              </FormField>
            </>
          ) : null}
          {multiBranch && canManageAssignments ? (
            <FormField id="svc-branches" label="شعب">
              {branchesQuery.isPending ? <InlineLoading label="بارگذاری شعب" /> : null}
              <MultiSelect
                id="svc-branches"
                values={form.branchIds}
                options={branchOptions}
                emptyLabel="شعبه‌ای نیست"
                onChange={(values) => patch({ branchIds: values, providerIds: [] })}
              />
              <p className="ds-help">تغییر شعبه ممکن است Provider/منبع نامعتبر را reset کند — اعتبار با Backend است.</p>
            </FormField>
          ) : !multiBranch ? (
            <p className="ds-help">این کسب‌وکار تک‌شعبه است — کنترل شعبه نمایش داده نمی‌شود.</p>
          ) : null}
        </TabPanel>

        <TabPanel value="requirements">
          {mode === "create" || !reference ? (
            <Alert
              tone="info"
              title="پس از ایجاد"
              description="نیازمندی‌های منبع پس از ذخیره اولیه خدمت در همین بخش یا صفحه منابع قابل تنظیم است."
            />
          ) : requirementsQuery.isPending ? (
            <InlineLoading label="بارگذاری نیازمندی‌ها" />
          ) : requirementsQuery.isError || !requirementsQuery.data ? (
            <Alert
              tone="warning"
              title="نیازمندی‌ها"
              description="برای مدیریت کامل به صفحه منابع بروید."
              action={
                <Button asChild variant="secondary">
                  <Link href={routes.admin.serviceResources(reference)}>مدیریت منابع</Link>
                </Button>
              }
            />
          ) : (
            <ServiceResourceRequirementsEditor
              key={`${requirementsQuery.data.version ?? "v0"}-${requirementsQuery.data.requirements.length}`}
              userId={userId}
              serviceReference={reference}
              view={requirementsQuery.data}
              canEdit={
                hasPermission(user, "admin.services.manage_resources") ||
                hasPermission(user, "admin.services.edit") ||
                user.permissionCodes.length === 0
              }
              onSaved={() => void requirementsQuery.refetch()}
            />
          )}
        </TabPanel>

        <TabPanel value="status">
          <Switch
            label="رزرو آنلاین فعال"
            description="غیرفعال کردن مانع CTA رزرو می‌شود؛ وضعیت lifecycle جداگانه در جزئیات مدیریت می‌شود."
            checked={form.bookingEnabled}
            onCheckedChange={(checked) => patch({ bookingEnabled: checked })}
          />
          {caps?.hasSortOrder !== false ? (
            <FormField id="svc-sort" label="ترتیب نمایش" error={errors.sortOrder}>
              <Input
                id="svc-sort"
                type="number"
                min={0}
                className="ltr-value"
                dir="ltr"
                value={form.sortOrder ?? ""}
                onChange={(e) => patch({ sortOrder: Number(e.target.value) || undefined })}
              />
            </FormField>
          ) : null}
        </TabPanel>
      </Tabs>

      <div className="booking-wizard__nav">
        <Button
          type="button"
          variant="ghost"
          disabled={submitting || impactLoading}
          onClick={() => {
            if (dirty) setLeaveOpen(true);
            else router.push(routes.admin.services);
          }}
        >
          انصراف
        </Button>
        <Button type="submit" loading={submitting || impactLoading}>
          {mode === "create" ? "ایجاد خدمت" : "ذخیره تغییرات"}
        </Button>
      </div>

      <ConfirmDialog
        open={Boolean(impact)}
        title={impact?.title ?? "تأیید ذخیره"}
        description={
          impact
            ? [
                impact.summary,
                ...impact.effects,
                ...(impact.branchWarnings ?? []),
                typeof impact.futureAppointmentCount === "number"
                  ? `نوبت‌های آینده: ${impact.futureAppointmentCount}`
                  : "",
                impact.blockedReason ?? "",
              ]
                .filter(Boolean)
                .join(" ")
            : ""
        }
        confirmLabel={impact?.confirmLabel ?? "تأیید و ذخیره"}
        cancelLabel="انصراف"
        busy={submitting}
        onCancel={() => setImpact(null)}
        onConfirm={() => {
          if (impact?.blocked) return;
          void executeSave();
        }}
      />

      <ConfirmDialog
        open={leaveOpen}
        title="خروج بدون ذخیره"
        description="تغییرات ذخیره‌نشده از بین می‌روند."
        confirmLabel="خروج"
        cancelLabel="ماندن"
        onCancel={() => setLeaveOpen(false)}
        onConfirm={() => {
          setLeaveOpen(false);
          router.push(routes.admin.services);
        }}
      />
    </form>
  );
}
