"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormError, Label } from "@/components/ui/form-field";
import { Select } from "@/components/ui/select";
import { ApiErrorState, FeatureDisabledState } from "@/components/feedback/app-states";
import { useToast } from "@/components/feedback/toast";
import { ProviderSelectionField } from "@/features/providers/provider-selection-field";
import { useSession } from "@/features/auth/session-provider";
import {
  invalidateWaitingListCaches,
  joinWaitingList,
  waitingListEligibilityQueryOptions,
} from "@/lib/api/customer-waiting-list";
import { ApiError, isConflictError, toAppApiError } from "@/lib/api/errors";
import { fetchPublicServiceCatalog } from "@/lib/api/public";
import { defaultCapabilities, isCapabilityVisible } from "@/config/capabilities";
import {
  waitingListIdempotencyKey,
  waitingListJoinFingerprint,
} from "@/lib/customer/waiting-list-idempotency";
import { parseJoinDatePreference } from "@/lib/customer/waiting-list-adapter";
import { isSafePublicId } from "@/lib/public/booking-href";
import { queryKeys } from "@/lib/query/keys";
import { routes } from "@/constants/routes";
import type { ProviderPreference } from "@/types/provider";
import {
  WAITING_LIST_TIME_PREFERENCE_LABELS,
  type WaitingListTimePreference,
} from "@/types/waiting-list";

const TIME_OPTIONS = (Object.keys(WAITING_LIST_TIME_PREFERENCE_LABELS) as WaitingListTimePreference[]).map(
  (value) => ({ value, label: WAITING_LIST_TIME_PREFERENCE_LABELS[value] }),
);

export function WaitingListJoinScreen() {
  const { status, user } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const featureVisible = isCapabilityVisible(defaultCapabilities, "waitingList");
  const sessionReady = status === "authenticated" && Boolean(user?.id);

  const initialService = searchParams.get("service");
  const initialBranch = searchParams.get("branch");
  const initialDate = searchParams.get("date");
  const initialProvider = searchParams.get("provider");

  const [serviceId, setServiceId] = useState(
    initialService && isSafePublicId(initialService) ? initialService : "",
  );
  const [branchId, setBranchId] = useState(
    initialBranch && isSafePublicId(initialBranch) ? initialBranch : "",
  );
  const [preference, setPreference] = useState<ProviderPreference>(
    initialProvider && isSafePublicId(initialProvider)
      ? { type: "specific", providerId: initialProvider }
      : { type: "any" },
  );
  const [dateMode, setDateMode] = useState<"any" | "specific" | "range">(
    initialDate ? "specific" : "any",
  );
  const [date, setDate] = useState(initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate) ? initialDate : "");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [timePreference, setTimePreference] = useState<WaitingListTimePreference>("any");
  const [timeFrom, setTimeFrom] = useState("");
  const [timeTo, setTimeTo] = useState("");
  const [note, setNote] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submitLock = useRef(false);
  const idempotencyStore = useRef<{ fingerprint: string; key: string } | null>(null);

  const servicesQuery = useQuery({
    queryKey: queryKeys.services.list(),
    queryFn: ({ signal }) => fetchPublicServiceCatalog(undefined, {}, signal),
    enabled: sessionReady && featureVisible,
    staleTime: 60_000,
    retry: false,
  });

  const eligibilityQuery = useQuery({
    ...waitingListEligibilityQueryOptions(user?.id ?? "anonymous", {
      serviceId,
      branchId: branchId || undefined,
      preference,
      date: date || initialDate || undefined,
    }),
    enabled: sessionReady && featureVisible && Boolean(serviceId),
  });

  if (!featureVisible) {
    return (
      <div className="waiting-list-page">
        <PageHeader title="پیوستن به لیست انتظار" />
        <FeatureDisabledState
          title="لیست انتظار فعال نیست"
          description="این قابلیت برای مجموعه در حال حاضر غیرفعال است."
        />
      </div>
    );
  }

  if (!sessionReady) {
    return (
      <div className="waiting-list-page">
        <PageHeader title="پیوستن به لیست انتظار" description="برای ثبت درخواست ابتدا وارد شوید." />
      </div>
    );
  }

  const serviceOptions =
    servicesQuery.data?.items.map((item) => ({
      value: item.id,
      label: item.name,
    })) ?? [];

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitLock.current) return;
    const errors: Record<string, string> = {};
    if (!serviceId) errors.serviceId = "خدمت را انتخاب کنید.";
    const datePreference = parseJoinDatePreference({
      mode: dateMode,
      date,
      from: dateFrom,
      to: dateTo,
    });
    if (!datePreference) errors.date = "ترجیح تاریخ معتبر نیست.";
    if (timePreference === "exact" && (!timeFrom || !timeTo)) {
      errors.time = "بازه ساعت را کامل وارد کنید.";
    }
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      return;
    }
    if (eligibilityQuery.data && !eligibilityQuery.data.eligible) {
      setFormError(
        eligibilityQuery.data.reason ??
          "برای این انتخاب امکان پیوستن به لیست انتظار وجود ندارد.",
      );
      return;
    }

    submitLock.current = true;
    setSubmitting(true);
    setFormError(null);
    setFieldErrors({});
    const input = {
      serviceId,
      branchId: branchId || undefined,
      providerPreference: preference,
      datePreference: datePreference!,
      timePreference,
      timeFrom: timePreference === "exact" ? timeFrom : undefined,
      timeTo: timePreference === "exact" ? timeTo : undefined,
      note: note.trim() || undefined,
      contextDate: initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate) ? initialDate : undefined,
    };
    const key = waitingListIdempotencyKey(
      idempotencyStore,
      waitingListJoinFingerprint(input),
    );
    try {
      const entry = await joinWaitingList(input, key);
      invalidateWaitingListCaches(queryClient, user!.id);
      toast.success("درخواست لیست انتظار ثبت شد. این درخواست نوبت قطعی نیست.");
      router.replace(routes.customer.waitingListEntry(entry.publicReference));
    } catch (error) {
      const normalized = toAppApiError(error);
      if (isConflictError(normalized) || normalized.code?.includes("DUPLICATE")) {
        setFormError(normalized.message || "درخواست مشابهی از قبل وجود دارد.");
      } else if (error instanceof ApiError && error.fieldErrors) {
        const next: Record<string, string> = {};
        for (const [field, messages] of Object.entries(error.fieldErrors)) {
          if (messages?.[0]) next[field] = messages[0];
        }
        setFieldErrors(next);
        setFormError(normalized.message);
      } else {
        setFormError(normalized.message);
      }
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  }

  return (
    <div className="waiting-list-page">
      <PageHeader
        title="پیوستن به لیست انتظار"
        description="پیوستن به لیست انتظار نوبت ایجاد نمی‌کند و زمان خالی را تضمین نمی‌کند."
        breadcrumb={
          <nav aria-label="مسیر صفحه">
            <ol className="ds-breadcrumb">
              <li>
                <Link href={routes.customer.waitingList}>لیست انتظار</Link>
                <span aria-hidden="true">/</span>
              </li>
              <li>
                <span aria-current="page">پیوستن</span>
              </li>
            </ol>
          </nav>
        }
      />

      <Alert tone="info" title="توجه" description="ثبت در لیست انتظار فقط یک درخواست ترجیحی است. نوبت قطعی فقط پس از پیشنهاد زمان و پذیرش شما ایجاد می‌شود." />

      {servicesQuery.isError ? (
        <ApiErrorState
          title="خدمات بارگذاری نشد"
          description={toAppApiError(servicesQuery.error).message}
          onRetry={() => {
            void servicesQuery.refetch();
          }}
        />
      ) : null}

      <form className="waiting-list-form" onSubmit={(event) => void onSubmit(event)} noValidate>
        <div className="ds-field">
          <Label htmlFor="wl-service" required>
            خدمت
          </Label>
          <Select
            id="wl-service"
            value={serviceId || undefined}
            options={serviceOptions}
            placeholder="انتخاب خدمت"
            loading={servicesQuery.isPending}
            onChange={(value) => setServiceId(value ?? "")}
          />
          {fieldErrors.serviceId ? <FormError>{fieldErrors.serviceId}</FormError> : null}
        </div>

        <div className="ds-field">
          <Label htmlFor="wl-branch" optional>
            شعبه
          </Label>
          <input
            id="wl-branch"
            className="ds-control ltr-value"
            value={branchId}
            onChange={(event) => setBranchId(event.target.value)}
            placeholder="شناسه شعبه در صورت نیاز"
          />
        </div>

        {serviceId ? (
          <ProviderSelectionField
            serviceId={serviceId}
            branchId={branchId || undefined}
            value={preference}
            onChange={(value) => setPreference(value ?? { type: "any" })}
          />
        ) : null}

        <fieldset className="waiting-list-fieldset">
          <legend>ترجیح تاریخ</legend>
          <Select
            id="wl-date-mode"
            value={dateMode}
            options={[
              { value: "any", label: "هر تاریخی" },
              { value: "specific", label: "یک تاریخ مشخص" },
              { value: "range", label: "بازه تاریخ" },
            ]}
            onChange={(value) => setDateMode((value as typeof dateMode) ?? "any")}
          />
          {dateMode === "specific" ? (
            <input
              className="ds-control ltr-value"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              aria-label="تاریخ ترجیحی"
            />
          ) : null}
          {dateMode === "range" ? (
            <div className="waiting-list-form__row">
              <input
                className="ds-control ltr-value"
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
                aria-label="از تاریخ"
              />
              <input
                className="ds-control ltr-value"
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
                aria-label="تا تاریخ"
              />
            </div>
          ) : null}
          {fieldErrors.date ? <FormError>{fieldErrors.date}</FormError> : null}
        </fieldset>

        <fieldset className="waiting-list-fieldset">
          <legend>ترجیح ساعت</legend>
          <Select
            id="wl-time"
            value={timePreference}
            options={TIME_OPTIONS}
            onChange={(value) =>
              setTimePreference((value as WaitingListTimePreference) ?? "any")
            }
          />
          {timePreference === "exact" ? (
            <div className="waiting-list-form__row">
              <input
                className="ds-control ltr-value"
                type="time"
                value={timeFrom}
                onChange={(event) => setTimeFrom(event.target.value)}
                aria-label="از ساعت"
              />
              <input
                className="ds-control ltr-value"
                type="time"
                value={timeTo}
                onChange={(event) => setTimeTo(event.target.value)}
                aria-label="تا ساعت"
              />
            </div>
          ) : null}
          {fieldErrors.time ? <FormError>{fieldErrors.time}</FormError> : null}
        </fieldset>

        <div className="ds-field">
          <Label htmlFor="wl-note" optional>
            یادداشت
          </Label>
          <textarea
            id="wl-note"
            className="ds-control"
            rows={3}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={500}
          />
        </div>

        {eligibilityQuery.data && !eligibilityQuery.data.eligible ? (
          <Alert
            tone="warning"
            title="امکان پیوستن نیست"
            description={
              eligibilityQuery.data.reason ??
              "برای این انتخاب، Backend امکان لیست انتظار را اعلام نکرده است."
            }
          />
        ) : null}

        {formError ? <Alert tone="error" title="ثبت انجام نشد" description={formError} /> : null}

        <div className="waiting-list-form__footer">
          <Button asChild variant="secondary">
            <Link href={routes.customer.waitingList}>انصراف</Link>
          </Button>
          <Button
            type="submit"
            loading={submitting}
            disabled={eligibilityQuery.data?.eligible === false}
          >
            ثبت درخواست لیست انتظار
          </Button>
        </div>
      </form>
    </div>
  );
}
