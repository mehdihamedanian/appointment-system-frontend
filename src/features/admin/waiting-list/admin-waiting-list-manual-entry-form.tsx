"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/data-display";
import { FormField } from "@/components/ui/form-field";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/feedback/toast";
import { AdminManualBookingCustomerStep } from "@/features/admin/manual-booking/admin-customer-step";
import { ProviderSelectionField } from "@/features/providers/provider-selection-field";
import { useSession } from "@/features/auth/session-provider";
import {
  adminWaitingListDuplicateMessage,
  isDuplicateWaitingListEntryError,
  parseJoinDatePreference,
  validateAdminWaitingListManualEntry,
} from "@/lib/admin/waiting-list-adapter";
import { invalidateAfterAdminWaitingListMutation } from "@/lib/admin/waiting-list-cache";
import { adminWaitingListDetailHref } from "@/lib/admin/waiting-list-filters";
import {
  checkAdminWaitingListDuplicate,
  createAdminWaitingListEntry,
} from "@/lib/api/admin-waiting-list";
import { fetchPublicBusiness, fetchPublicServiceCatalog } from "@/lib/api/public";
import { createIdempotencyKey } from "@/lib/booking/idempotency";
import {
  isForbiddenError,
  isNotFoundError,
  isSessionExpiredError,
  isValidationError,
  toAppApiError,
} from "@/lib/api/errors";
import { isCapabilityVisible, getBusinessCapabilities } from "@/config/capabilities";
import { queryKeys } from "@/lib/query/keys";
import { routes } from "@/constants/routes";
import {
  WAITING_LIST_TIME_PREFERENCE_LABELS,
  type WaitingListTimePreference,
} from "@/types/waiting-list";
import type {
  AdminWaitingListManualEntryErrors,
  AdminWaitingListManualEntryInput,
} from "@/types/admin-waiting-list";
import type { AdminManualBookingCustomerView } from "@/types/admin-manual-booking";
import type { ProviderPreference } from "@/types/provider";

const TIME_OPTIONS = (
  Object.keys(WAITING_LIST_TIME_PREFERENCE_LABELS) as WaitingListTimePreference[]
).map((value) => ({ value, label: WAITING_LIST_TIME_PREFERENCE_LABELS[value] }));

export function AdminWaitingListManualEntryForm({
  userId,
  user,
}: {
  userId: string;
  user: NonNullable<ReturnType<typeof useSession>["user"]>;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const submitLock = useRef(false);
  const [customer, setCustomer] = useState<AdminManualBookingCustomerView | null>(null);
  const [serviceId, setServiceId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [preference, setPreference] = useState<ProviderPreference>({ type: "any" });
  const [dateMode, setDateMode] = useState<"any" | "specific" | "range">("any");
  const [date, setDate] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [timePreference, setTimePreference] = useState<WaitingListTimePreference>("any");
  const [timeFrom, setTimeFrom] = useState("");
  const [timeTo, setTimeTo] = useState("");
  const [customerNote, setCustomerNote] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [errors, setErrors] = useState<AdminWaitingListManualEntryErrors>({});
  const [formError, setFormError] = useState<string>();
  const [duplicateHref, setDuplicateHref] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  const businessQuery = useQuery({
    queryKey: queryKeys.publicBusiness,
    queryFn: ({ signal }) => fetchPublicBusiness(signal),
    staleTime: 60_000,
  });
  const multiBranch =
    isCapabilityVisible(getBusinessCapabilities(), "multipleBranches") &&
    businessQuery.data?.branchesEnabled === true;

  const servicesQuery = useQuery({
    queryKey: queryKeys.publicServices,
    queryFn: ({ signal }) => fetchPublicServiceCatalog(undefined, {}, signal),
    staleTime: 60_000,
  });

  const serviceOptions =
    servicesQuery.data?.items.map((item) => ({ value: item.id, label: item.name })) ?? [];

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitLock.current || submitting) return;

    const datePreference = parseJoinDatePreference({
      mode: dateMode,
      date,
      from: dateFrom,
      to: dateTo,
    });
    if (!datePreference) {
      setErrors({ date: "ترجیح تاریخ معتبر نیست." });
      return;
    }

    const input: AdminWaitingListManualEntryInput = {
      customerReference: customer?.reference ?? "",
      serviceId,
      branchId: branchId || undefined,
      providerPreference: preference,
      datePreference,
      timePreference,
      timeFrom: timeFrom || undefined,
      timeTo: timeTo || undefined,
      customerNote: customerNote || undefined,
      internalNote: internalNote || undefined,
    };

    const validation = validateAdminWaitingListManualEntry(input);
    setErrors(validation);
    if (Object.keys(validation).length) {
      setFormError("لطفاً خطاهای فرم را برطرف کنید.");
      return;
    }

    submitLock.current = true;
    setSubmitting(true);
    setFormError(undefined);
    setDuplicateHref(undefined);

    try {
      const duplicate = await checkAdminWaitingListDuplicate({
        customerReference: input.customerReference,
        serviceId: input.serviceId,
        branchId: input.branchId,
      });
      if (duplicate.duplicate) {
        setFormError(duplicate.message ?? adminWaitingListDuplicateMessage());
        if (duplicate.existingHref) setDuplicateHref(duplicate.existingHref);
        return;
      }

      const created = await createAdminWaitingListEntry(input, createIdempotencyKey());
      invalidateAfterAdminWaitingListMutation(queryClient, userId, created.reference, {
        affectsCustomerWaitingList: true,
      });
      toast.success("درخواست لیست انتظار ثبت شد.");
      router.push(adminWaitingListDetailHref(created.reference));
    } catch (error) {
      const apiError = toAppApiError(error);
      if (isSessionExpiredError(apiError)) {
        router.push(routes.auth.sessionExpired);
        return;
      }
      if (isForbiddenError(apiError)) {
        setFormError("دسترسی کافی برای ثبت ندارید.");
        return;
      }
      if (isDuplicateWaitingListEntryError(apiError)) {
        setFormError(adminWaitingListDuplicateMessage());
        return;
      }
      if (isValidationError(apiError)) {
        setFormError(apiError.message);
        return;
      }
      if (isNotFoundError(apiError)) {
        setFormError("سرویس لیست انتظار هنوز به Backend متصل نشده است.");
        return;
      }
      setFormError(apiError.message);
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  }

  return (
    <form className="admin-waiting-list-form" onSubmit={(event) => void onSubmit(event)} noValidate>
      {formError ? <Alert tone="error" title="خطا" description={formError} /> : null}
      {duplicateHref ? (
        <p className="ds-help">
          <a href={duplicateHref}>مشاهده درخواست موجود</a>
        </p>
      ) : null}

      <Card title="مشتری">
        <AdminManualBookingCustomerStep
          userId={userId}
          user={user}
          selected={customer}
          onSelect={setCustomer}
        />
        {errors.customerReference ? (
          <p className="ds-field-error">{errors.customerReference}</p>
        ) : null}
      </Card>

      <Card title="خدمت و ترجیحات">
        <div className="admin-waiting-list-form__grid">
          <FormField id="wl-service" label="خدمت" error={errors.serviceId} required>
            <Select
              id="wl-service"
              value={serviceId}
              options={[{ value: "", label: "انتخاب خدمت" }, ...serviceOptions]}
              onChange={(value) => setServiceId(value ?? "")}
              disabled={submitting}
            />
          </FormField>
          <FormField id="wl-date-mode" label="ترجیح تاریخ">
            <Select
              id="wl-date-mode"
              value={dateMode}
              options={[
                { value: "any", label: "هر تاریخی" },
                { value: "specific", label: "تاریخ مشخص" },
                { value: "range", label: "بازه تاریخ" },
              ]}
              onChange={(value) =>
                setDateMode(value === "specific" ? "specific" : value === "range" ? "range" : "any")
              }
            />
          </FormField>
          {dateMode === "specific" ? (
            <FormField id="wl-date" label="تاریخ" error={errors.date}>
              <Input id="wl-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </FormField>
          ) : null}
          {dateMode === "range" ? (
            <>
              <FormField id="wl-date-from" label="از" error={errors.date}>
                <Input
                  id="wl-date-from"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </FormField>
              <FormField id="wl-date-to" label="تا">
                <Input
                  id="wl-date-to"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </FormField>
            </>
          ) : null}
          <FormField id="wl-time-pref" label="ترجیح ساعت">
            <Select
              id="wl-time-pref"
              value={timePreference}
              options={TIME_OPTIONS}
              onChange={(value) =>
                setTimePreference((value as WaitingListTimePreference) ?? "any")
              }
            />
          </FormField>
          {timePreference === "exact" ? (
            <>
              <FormField id="wl-time-from" label="از ساعت" error={errors.time}>
                <Input
                  id="wl-time-from"
                  type="time"
                  value={timeFrom}
                  onChange={(e) => setTimeFrom(e.target.value)}
                />
              </FormField>
              <FormField id="wl-time-to" label="تا ساعت">
                <Input
                  id="wl-time-to"
                  type="time"
                  value={timeTo}
                  onChange={(e) => setTimeTo(e.target.value)}
                />
              </FormField>
            </>
          ) : null}
        </div>
        <ProviderSelectionField
          serviceId={serviceId}
          branchId={branchId || undefined}
          value={preference}
          onChange={(value) => value && setPreference(value)}
          disabled={!serviceId || submitting}
        />
        {multiBranch ? (
          <FormField id="wl-branch" label="شعبه" optional error={errors.branchId}>
            <Input
              id="wl-branch"
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              placeholder="شناسه شعبه"
            />
          </FormField>
        ) : null}
      </Card>

      <Card title="یادداشت‌ها">
        <FormField id="wl-customer-note" label="یادداشت مشتری" optional>
          <Textarea
            id="wl-customer-note"
            value={customerNote}
            onChange={(e) => setCustomerNote(e.target.value)}
          />
        </FormField>
        <FormField id="wl-internal-note" label="یادداشت داخلی" optional>
          <Textarea
            id="wl-internal-note"
            value={internalNote}
            onChange={(e) => setInternalNote(e.target.value)}
          />
        </FormField>
      </Card>

      <div className="admin-waiting-list-form__actions">
        <Button type="submit" loading={submitting}>
          ثبت درخواست
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.push(routes.admin.waitingList)}>
          انصراف
        </Button>
      </div>
    </form>
  );
}
