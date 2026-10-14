"use client";

import { useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { SlotPicker } from "@/features/booking/slot-picker";
import { ApiErrorState, EmptyState } from "@/components/feedback/app-states";
import { InlineLoading } from "@/components/feedback/loading-states";
import { Button } from "@/components/ui/button";
import { bookableSlotsQueryOptions } from "@/lib/api/booking";
import type { BookableSlotsView } from "@/types/booking";
import { toAppApiError } from "@/lib/api/errors";
import { defaultCapabilities, isCapabilityVisible } from "@/config/capabilities";
import { routes } from "@/constants/routes";
import { isSafePublicId } from "@/lib/public/booking-href";
import { markElapsedSlots } from "@/lib/availability/elapsed";
import { formatIsoDateLabel } from "@/lib/date-time/format";
import { serverNowMs } from "@/lib/date-time/server-clock";
import { useServerNow } from "@/lib/date-time/use-server-now";
import type { ProviderPreference, ProviderSelectionMode } from "@/types/provider";

export function TimeStep({
  serviceId,
  branchId,
  preference,
  requiresBranch,
  providerMode,
  date,
  selectedId,
  onSelect,
  timezone,
  submitted,
  onPickAnotherDate,
  onBackToProvider,
  onBackToBranch,
  buildSlotsQueryOptions,
  showWaitingListActions = true,
}: {
  serviceId?: string | null;
  branchId?: string | null;
  preference: ProviderPreference;
  requiresBranch: boolean;
  providerMode: ProviderSelectionMode;
  date: string | null;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  timezone?: string;
  submitted?: boolean;
  onPickAnotherDate?: () => void;
  onBackToProvider?: () => void;
  onBackToBranch?: () => void;
  buildSlotsQueryOptions?: (date: string) => {
    queryKey: readonly unknown[];
    queryFn: (context: { signal: AbortSignal }) => Promise<BookableSlotsView>;
    enabled?: boolean;
    staleTime?: number;
    gcTime?: number;
    refetchOnMount?: "always";
    refetchOnReconnect?: boolean;
    refetchOnWindowFocus?: boolean;
    retry?: boolean;
  };
  showWaitingListActions?: boolean;
}) {
  const slotsQuery = useQuery(
    buildSlotsQueryOptions && date
      ? buildSlotsQueryOptions(date)
      : bookableSlotsQueryOptions(serviceId ?? "", branchId ?? undefined, preference, date ?? "", {
          requiresBranch,
          providerMode,
        }),
  );
  const refreshLock = useRef(false);
  const slots = slotsQuery.data;
  const now = useServerNow();
  const visibleSlots = useMemo(() => markElapsedSlots(slots?.slots ?? [], now), [slots?.slots, now]);
  const anyAvailable = visibleSlots.some((slot) => slot.status === "available");
  const loading = slotsQuery.fetchStatus === "fetching" && !slotsQuery.data;
  const refreshing = slotsQuery.isFetching && Boolean(slotsQuery.data);
  const liveMessage = loading
    ? "در حال بارگذاری ساعت‌ها"
    : refreshing
      ? "ساعت‌ها در حال به‌روزرسانی است"
      : anyAvailable
        ? "ساعت‌های قابل رزرو به‌روز شد"
        : "برای این تاریخ ساعت خالی اعلام نشده است";

  useEffect(() => {
    if (!date || !selectedId || !slots || slotsQuery.isFetching) {
      return;
    }
    const current = visibleSlots.find((slot) => slot.id === selectedId);
    if (!current || current.status !== "available") {
      onSelect(null);
    }
  }, [date, onSelect, selectedId, slots, slotsQuery.isFetching, visibleSlots]);

  if (!date) {
    return (
      <EmptyState
        title="ابتدا تاریخ را انتخاب کنید"
        description="ساعت‌های قابل رزرو بعد از انتخاب تاریخ از سرویس نوبت‌دهی دریافت می‌شوند."
      />
    );
  }

  async function refresh() {
    if (refreshLock.current) {
      return;
    }
    refreshLock.current = true;
    try {
      const result = await slotsQuery.refetch();
      const next = markElapsedSlots(result.data?.slots ?? [], serverNowMs()).find(
        (slot) => slot.id === selectedId,
      );
      if (selectedId && (!next || next.status !== "available")) {
        onSelect(null);
      }
    } finally {
      refreshLock.current = false;
    }
  }

  if (slotsQuery.isError) {
    return (
      <ApiErrorState
        title="ساعت‌های قابل رزرو دریافت نشد"
        description={toAppApiError(slotsQuery.error).message}
        requestId={toAppApiError(slotsQuery.error).requestId}
        onRetry={() => void slotsQuery.refetch()}
      />
    );
  }

  if (slots?.unavailableReason === "missing_endpoint") {
    return (
      <EmptyState
        title="ساعت نوبت هنوز متصل نشده"
        description="شناسه نوبت باید از سرویس نوبت‌دهی بیاید. ساعت‌ها در مرورگر ساخته نمی‌شوند."
      />
    );
  }

  if (slots?.unavailableReason === "branch_required") {
    return (
      <EmptyState
        title="شعبه انتخاب نشده است"
        description="سرویس نوبت‌دهی ساعت‌های آزاد را فقط برای یک شعبهٔ مشخص اعلام می‌کند."
      />
    );
  }

  if (slots?.unavailableReason === "not_configured") {
    return (
      <EmptyState
        title="برنامهٔ این خدمت کامل نیست"
        description="تنظیمات زمان‌بندی این خدمت در سرویس نوبت‌دهی معتبر نیست؛ ساعتی برای رزرو اعلام نشده است."
      />
    );
  }

  const waitingListVisible = showWaitingListActions && isCapabilityVisible(defaultCapabilities, "waitingList");
  const showWaitingListJoin =
    waitingListVisible &&
    slots?.waitingListJoinAllowed === true &&
    Boolean(serviceId && isSafePublicId(serviceId));

  const waitingListHref = (() => {
    if (!showWaitingListJoin || !serviceId) return null;
    const params = new URLSearchParams();
    params.set("service", serviceId);
    if (branchId && isSafePublicId(branchId)) params.set("branch", branchId);
    if (date) params.set("date", date);
    if (preference.type === "specific") params.set("provider", preference.providerId);
    return `${routes.customer.waitingListJoin}?${params.toString()}`;
  })();

  const actions = (
    <div className="booking-availability-actions">
      <Button variant="secondary" onClick={() => void refresh()} disabled={refreshing || loading} loading={refreshing}>
        به‌روزرسانی
      </Button>
      {waitingListHref ? (
        <Button asChild>
          <Link href={waitingListHref}>پیوستن به لیست انتظار</Link>
        </Button>
      ) : null}
      {onPickAnotherDate ? (
        <Button variant="ghost" onClick={onPickAnotherDate}>
          انتخاب تاریخ دیگر
        </Button>
      ) : null}
      {onBackToProvider ? (
        <Button variant="ghost" onClick={onBackToProvider}>
          بازگشت به متخصص
        </Button>
      ) : null}
      {onBackToBranch ? (
        <Button variant="ghost" onClick={onBackToBranch}>
          بازگشت به شعبه
        </Button>
      ) : null}
    </div>
  );

  if (!loading && slots && !anyAvailable) {
    return (
      <div className="booking-time-step">
        <p className="visually-hidden" aria-live="polite">
          {liveMessage}
        </p>
        <EmptyState
          title="ساعت خالی نیست"
          description={
            showWaitingListJoin
              ? "برای این تاریخ نوبت خالی اعلام نشده است. می‌توانید تاریخ دیگری انتخاب کنید یا در صورت فعال بودن، به لیست انتظار بپیوندید. پیوستن به لیست انتظار نوبت قطعی ایجاد نمی‌کند."
              : "برای این تاریخ نوبت خالی اعلام نشده است. تاریخ دیگری را امتحان کنید."
          }
          action={actions}
        />
      </div>
    );
  }

  return (
    <div className="booking-time-step">
      <p className="visually-hidden" aria-live="polite">
        {liveMessage}
      </p>
      {date ? (
        <p className="text-caption">
          تاریخ انتخاب‌شده: <time dateTime={date}>{formatIsoDateLabel(date, { weekday: true }) ?? date}</time>
        </p>
      ) : null}
      <SlotPicker
        slots={visibleSlots}
        selectedId={selectedId}
        onSelect={onSelect}
        timezone={slots?.timezone ?? timezone}
        submitted={submitted}
        refreshing={refreshing}
        loading={loading}
      />
      {refreshing ? <InlineLoading label="در حال به‌روزرسانی ساعت‌ها" /> : null}
      {actions}
    </div>
  );
}
