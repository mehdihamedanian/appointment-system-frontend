"use client";

import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { SlotPicker } from "@/features/booking/slot-picker";
import { ApiErrorState, EmptyState } from "@/components/feedback/app-states";
import { InlineLoading } from "@/components/feedback/loading-states";
import { Button } from "@/components/ui/button";
import { rescheduleSlotsQueryOptions } from "@/lib/api/appointment-reschedule";
import { toAppApiError } from "@/lib/api/errors";
import type { ProviderPreference, ProviderSelectionMode } from "@/types/provider";

export function RescheduleTimeStep({
  reference,
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
}: {
  reference: string;
  serviceId: string;
  branchId?: string;
  preference: ProviderPreference;
  requiresBranch: boolean;
  providerMode: ProviderSelectionMode;
  date: string | null;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  timezone?: string;
  submitted?: boolean;
  onPickAnotherDate?: () => void;
}) {
  const slotsQuery = useQuery(
    rescheduleSlotsQueryOptions(reference, serviceId, branchId, preference, date ?? "", {
      requiresBranch,
      providerMode,
    }),
  );
  const refreshLock = useRef(false);
  const slots = slotsQuery.data;
  const loading = slotsQuery.fetchStatus === "fetching" && !slotsQuery.data;
  const refreshing = slotsQuery.isFetching && Boolean(slotsQuery.data);
  const liveMessage = loading
    ? "در حال بارگذاری ساعت‌ها"
    : refreshing
      ? "ساعت‌ها در حال به‌روزرسانی است"
      : slots?.available
        ? "ساعت‌های قابل انتخاب به‌روز شد"
        : "برای این تاریخ ساعت خالی اعلام نشده است";

  useEffect(() => {
    if (!date || !selectedId || !slots || slotsQuery.isFetching) {
      return;
    }
    const current = slots.slots.find((slot) => slot.id === selectedId);
    if (!current || current.status !== "available") {
      onSelect(null);
    }
  }, [date, onSelect, selectedId, slots, slotsQuery.isFetching]);

  if (!date) {
    return (
      <EmptyState
        title="ابتدا تاریخ را انتخاب کنید"
        description="ساعت‌های قابل انتخاب بعد از انتخاب تاریخ از سرویس دریافت می‌شوند."
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
      const next = result.data?.slots.find((slot) => slot.id === selectedId);
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
        title="ساعت‌های قابل انتخاب دریافت نشد"
        description={toAppApiError(slotsQuery.error).message}
        requestId={toAppApiError(slotsQuery.error).requestId}
        onRetry={() => void slotsQuery.refetch()}
      />
    );
  }

  if (slots?.unavailableReason === "missing_endpoint") {
    return (
      <EmptyState
        title="ساعت‌های زمان‌بندی مجدد هنوز متصل نشده"
        description="ساعت‌ها باید از سرویس نوبت‌دهی دریافت شوند."
      />
    );
  }

  const actions = (
    <div className="booking-availability-actions">
      <Button variant="secondary" onClick={() => void refresh()} disabled={refreshing || loading} loading={refreshing}>
        به‌روزرسانی
      </Button>
      {onPickAnotherDate ? (
        <Button variant="ghost" onClick={onPickAnotherDate}>
          انتخاب تاریخ دیگر
        </Button>
      ) : null}
    </div>
  );

  if (!loading && slots && !slots.available) {
    return (
      <div className="booking-time-step">
        <p className="visually-hidden" aria-live="polite">
          {liveMessage}
        </p>
        <EmptyState
          title="ساعت خالی نیست"
          description="برای این تاریخ ساعت خالی اعلام نشده است. تاریخ دیگری را امتحان کنید."
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
          تاریخ انتخاب‌شده: <span className="ltr-value">{date}</span>
        </p>
      ) : null}
      <SlotPicker
        slots={slots?.slots ?? []}
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
