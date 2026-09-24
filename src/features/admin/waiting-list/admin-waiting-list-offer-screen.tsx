"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/data-display";
import { FormField } from "@/components/ui/form-field";
import { Select } from "@/components/ui/select";
import { AdminBreadcrumb } from "@/components/layout/admin/admin-breadcrumb";
import { AdminPageHeader } from "@/components/layout/admin/admin-page-header";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import {
  ApiErrorState,
  EmptyState,
} from "@/components/feedback/app-states";
import { InlineLoading } from "@/components/feedback/loading-states";
import { useToast } from "@/components/feedback/toast";
import { AdminWaitingListGate } from "@/features/admin/waiting-list/admin-waiting-list-gate";
import { AdminWaitingListFormSkeleton } from "@/features/admin/waiting-list/admin-waiting-list-skeleton";
import { PermissionGate } from "@/features/admin/permission-gate";
import { useSession } from "@/features/auth/session-provider";
import {
  adminWaitingListConflictMessage,
  isAdminWaitingListConflict,
  isSlotTakenWaitingListError,
} from "@/lib/admin/waiting-list-adapter";
import { invalidateAfterAdminWaitingListMutation } from "@/lib/admin/waiting-list-cache";
import {
  adminWaitingListDetailHref,
  adminWaitingListOfferHref,
  waitingListPermission,
} from "@/lib/admin/waiting-list-filters";
import {
  adminWaitingListAvailabilitySlotsQueryOptions,
  adminWaitingListDetailQueryOptions,
  adminWaitingListOfferEligibilityQueryOptions,
  fetchAdminWaitingListAvailabilityDays,
  fetchAdminWaitingListOfferPreview,
  sendAdminWaitingListOffer,
} from "@/lib/api/admin-waiting-list";
import { createIdempotencyKey } from "@/lib/booking/idempotency";
import {
  isNotFoundError,
  isSessionExpiredError,
  toAppApiError,
} from "@/lib/api/errors";
import { routes } from "@/constants/routes";
import type { AdminWaitingListOfferPreview } from "@/types/admin-waiting-list";

export function AdminWaitingListOfferScreen() {
  const { status, user } = useSession();
  const params = useParams<{ entryReference: string }>();
  const reference = decodeURIComponent(params.entryReference ?? "");

  if (status === "loading" || !user?.id) {
    return (
      <>
        <AdminPageHeader title="ارسال پیشنهاد" />
        <AdminWaitingListFormSkeleton />
      </>
    );
  }

  return (
    <PermissionGate permission={waitingListPermission("offer")}>
      <AdminWaitingListGate>
        <AdminWaitingListOfferReady userId={user.id} reference={reference} />
      </AdminWaitingListGate>
    </PermissionGate>
  );
}

function AdminWaitingListOfferReady({ userId, reference }: { userId: string; reference: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const submitLock = useRef(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlotId, setSelectedSlotId] = useState("");
  const [expirationOptionId, setExpirationOptionId] = useState("");
  const [confirmPreview, setConfirmPreview] = useState<AdminWaitingListOfferPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [slotError, setSlotError] = useState<string>();
  const [conflict, setConflict] = useState<string>();

  const detailQuery = useQuery(adminWaitingListDetailQueryOptions(userId, reference));
  const eligibilityQuery = useQuery(adminWaitingListOfferEligibilityQueryOptions(userId, reference));
  const daysQuery = useQuery({
    queryKey: ["admin", "waiting-list", userId, "availability-days", reference],
    queryFn: ({ signal }) => fetchAdminWaitingListAvailabilityDays(reference, signal),
    enabled: Boolean(reference) && eligibilityQuery.data?.eligible === true,
    staleTime: 30_000,
    retry: false,
  });
  const slotsQuery = useQuery({
    ...adminWaitingListAvailabilitySlotsQueryOptions(userId, reference, selectedDate),
  });
  const slotPreviewQuery = useQuery({
    queryKey: ["admin", "waiting-list", userId, "slot-preview", reference, selectedSlotId],
    queryFn: ({ signal }) =>
      fetchAdminWaitingListOfferPreview(reference, { slotId: selectedSlotId }, signal),
    enabled: Boolean(userId) && Boolean(reference) && Boolean(selectedSlotId),
    staleTime: 0,
    retry: false,
  });

  const view = detailQuery.data;
  const slotPreview = slotPreviewQuery.data ?? null;
  const slotPreviewError =
    slotPreviewQuery.isError && isSlotTakenWaitingListError(toAppApiError(slotPreviewQuery.error))
      ? "این زمان دیگر در دسترس نیست. لطفاً زمان دیگری انتخاب کنید."
      : undefined;
  const effectiveExpirationId =
    expirationOptionId ||
    slotPreview?.defaultExpirationId ||
    slotPreview?.expirationOptions[0]?.id ||
    "";
  const dayOptions = (daysQuery.data ?? []).map((day) => ({
    value: day.date,
    label: day.label ?? day.date,
  }));
  const slotOptions = (slotsQuery.data ?? [])
    .filter((slot) => slot.available !== false)
    .map((slot) => ({ value: slot.id, label: slot.label }));

  async function loadConfirmPreview() {
    if (!selectedSlotId || !effectiveExpirationId) {
      setSlotError("زمان و مدت انقضا را انتخاب کنید.");
      return;
    }
    setPreviewLoading(true);
    setSlotError(undefined);
    setConflict(undefined);
    try {
      const next = await fetchAdminWaitingListOfferPreview(reference, {
        slotId: selectedSlotId,
        expirationOptionId: effectiveExpirationId,
        previewVersion: slotPreview?.previewVersion,
      });
      setConfirmPreview(next);
      setConfirmOpen(true);
    } catch (error) {
      const apiError = toAppApiError(error);
      if (isSlotTakenWaitingListError(apiError)) {
        setSelectedSlotId("");
        setConfirmPreview(null);
        setSlotError("این زمان دیگر در دسترس نیست. لطفاً زمان دیگری انتخاب کنید.");
        void slotsQuery.refetch();
        void slotPreviewQuery.refetch();
        return;
      }
      toast.error(apiError.message);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function confirmSend() {
    const preview = confirmPreview;
    if (!view || !preview || submitLock.current || preview.blocked) return;
    submitLock.current = true;
    setSubmitting(true);
    try {
      const result = await sendAdminWaitingListOffer(
        reference,
        {
          slotId: selectedSlotId,
          expirationOptionId: effectiveExpirationId,
          previewVersion: preview.previewVersion,
          version: view.version,
        },
        createIdempotencyKey(),
      );
      invalidateAfterAdminWaitingListMutation(queryClient, userId, reference, {
        affectsCustomerWaitingList: true,
        affectsAvailability: true,
        availabilityScope: {
          serviceId: view.serviceId,
          branchId: view.branchId,
          date: selectedDate,
        },
      });
      toast.success(result.message ?? "پیشنهاد با موفقیت ارسال شد.");
      setConfirmOpen(false);
      router.push(adminWaitingListDetailHref(reference));
    } catch (error) {
      const apiError = toAppApiError(error);
      if (isSessionExpiredError(apiError)) {
        router.push(routes.auth.sessionExpired);
        return;
      }
      if (isAdminWaitingListConflict(apiError)) {
        setConflict(adminWaitingListConflictMessage());
        setConfirmOpen(false);
        await detailQuery.refetch();
        return;
      }
      if (isSlotTakenWaitingListError(apiError)) {
        setSelectedSlotId("");
        setConfirmPreview(null);
        setConfirmOpen(false);
        setSlotError("زمان قبل از ارسال گرفته شد. availability به‌روزرسانی شد.");
        void slotsQuery.refetch();
        void slotPreviewQuery.refetch();
        return;
      }
      toast.error(apiError.message);
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  }

  if (detailQuery.isPending || eligibilityQuery.isPending) {
    return (
      <>
        <AdminPageHeader title="ارسال پیشنهاد" description="در حال بارگذاری" />
        <AdminWaitingListFormSkeleton />
      </>
    );
  }

  if (detailQuery.isError || !view) {
    const error = toAppApiError(detailQuery.error);
    if (isNotFoundError(error)) {
      return (
        <EmptyState
          title="درخواست پیدا نشد"
          action={
            <Button asChild variant="secondary">
              <Link href={routes.admin.waitingList}>بازگشت</Link>
            </Button>
          }
        />
      );
    }
    return <ApiErrorState title="بارگذاری ناموفق" description={error.message} />;
  }

  if (eligibilityQuery.data && !eligibilityQuery.data.eligible) {
    return (
      <>
        <AdminPageHeader title="ارسال پیشنهاد" description={view.customer.displayName} />
        <EmptyState
          title="ارسال پیشنهاد ممکن نیست"
          description={
            eligibilityQuery.data.reason ??
            "این درخواست در وضعیت فعلی قابل پیشنهاد نیست."
          }
          action={
            <Button asChild variant="secondary">
              <Link href={adminWaitingListDetailHref(reference)}>بازگشت به جزئیات</Link>
            </Button>
          }
        />
      </>
    );
  }

  const expirationOptions =
    slotPreview?.expirationOptions.map((item) => ({ value: item.id, label: item.label })) ?? [];
  const preview = confirmPreview;

  return (
    <>
      <AdminPageHeader
        title="ارسال پیشنهاد زمان"
        description={`${view.customer.displayName} · ${view.serviceName}`}
        breadcrumb={
          <AdminBreadcrumb
            pathname={adminWaitingListOfferHref(reference)}
            items={[
              { href: routes.admin.home, label: "پنل مدیریت" },
              { href: routes.admin.waitingList, label: "لیست انتظار" },
              { href: adminWaitingListDetailHref(reference), label: view.reference },
              { label: "ارسال پیشنهاد" },
            ]}
          />
        }
        secondaryActions={
          <Button asChild variant="secondary">
            <Link href={adminWaitingListDetailHref(reference)}>انصراف</Link>
          </Button>
        }
      />

      {conflict ? <Alert tone="warning" title="تداخل" description={conflict} /> : null}
      {(slotError || slotPreviewError) ? (
        <Alert tone="error" title="زمان" description={slotError ?? slotPreviewError} />
      ) : null}

      <section className="admin-waiting-list-offer">
        <Card title="۱. انتخاب تاریخ">
          {daysQuery.isLoading ? <InlineLoading label="بارگذاری تاریخ‌ها" /> : null}
          {daysQuery.isError ? (
            <Alert
              tone="warning"
              title="دسترسی‌پذیری در دسترس نیست"
              description="Backend باید availability مخصوص لیست انتظار را فراهم کند."
            />
          ) : null}
          {dayOptions.length ? (
            <FormField id="wl-offer-date" label="تاریخ">
              <Select
                id="wl-offer-date"
                value={selectedDate}
                options={[{ value: "", label: "انتخاب تاریخ" }, ...dayOptions]}
                onChange={(value) => {
                  setSelectedDate(value ?? "");
                  setSelectedSlotId("");
                  setExpirationOptionId("");
                  setConfirmPreview(null);
                }}
              />
            </FormField>
          ) : !daysQuery.isLoading && !daysQuery.isError ? (
            <EmptyState title="تاریخی یافت نشد" description="برای این درخواست زمان آزاد وجود ندارد." />
          ) : null}
        </Card>

        {selectedDate ? (
          <Card title="۲. انتخاب زمان">
            {slotsQuery.isLoading ? <InlineLoading label="بارگذاری زمان‌ها" /> : null}
            {slotOptions.length ? (
              <FormField id="wl-offer-slot" label="زمان">
                <Select
                  id="wl-offer-slot"
                  value={selectedSlotId}
                  options={[{ value: "", label: "انتخاب زمان" }, ...slotOptions]}
                  onChange={(value) => {
                    setSelectedSlotId(value ?? "");
                    setExpirationOptionId("");
                    setConfirmPreview(null);
                  }}
                />
              </FormField>
            ) : !slotsQuery.isLoading ? (
              <EmptyState title="زمانی یافت نشد" description="برای این تاریخ slot آزاد نیست." />
            ) : null}
          </Card>
        ) : null}

        {selectedSlotId ? (
          <Card title="۳. مدت انقضای پیشنهاد">
            <p className="ds-help">گزینه‌های انقضا فقط از Backend خوانده می‌شوند.</p>
            {slotPreviewQuery.isLoading ? <InlineLoading label="بارگذاری گزینه‌های انقضا" /> : null}
            {expirationOptions.length ? (
              <FormField id="wl-offer-expiry" label="مهلت پاسخ">
                <Select
                  id="wl-offer-expiry"
                  value={effectiveExpirationId}
                  options={[{ value: "", label: "انتخاب مدت" }, ...expirationOptions]}
                  onChange={(value) => setExpirationOptionId(value ?? "")}
                />
              </FormField>
            ) : !slotPreviewQuery.isLoading && !slotPreviewQuery.isError ? (
              <Alert tone="warning" title="گزینه انقضا" description="Backend گزینه انقضا برنگرداند." />
            ) : null}
          </Card>
        ) : null}

        <div className="admin-waiting-list-form__actions">
          <Button
            loading={previewLoading || submitting}
            disabled={!selectedSlotId || !effectiveExpirationId || slotPreviewQuery.isLoading}
            onClick={() => void loadConfirmPreview()}
          >
            پیش‌نمایش و ارسال
          </Button>
        </div>
      </section>

      <ConfirmDialog
        open={confirmOpen}
        title={preview?.title ?? "تأیید ارسال پیشنهاد"}
        description={
          preview
            ? [
                preview.summary,
                preview.serviceName ? `خدمت: ${preview.serviceName}` : "",
                preview.slotLabel ? `زمان: ${preview.slotLabel}` : "",
                preview.priceLabel ? `مبلغ: ${preview.priceLabel}` : "",
                preview.depositLabel ? `بیعانه: ${preview.depositLabel}` : "",
                preview.policySummary ?? "",
                preview.nextStepLabel ?? "",
                preview.blockedReason ?? "",
              ]
                .filter(Boolean)
                .join(" ")
            : ""
        }
        confirmLabel={preview?.blocked ? "غیرفعال" : "ارسال پیشنهاد"}
        cancelLabel="انصراف"
        variant={preview?.blocked ? "destructive" : "primary"}
        busy={submitting}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          if (preview?.blocked) {
            setConfirmOpen(false);
            return;
          }
          void confirmSend();
        }}
      />
    </>
  );
}
