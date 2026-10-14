"use client";

import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { ApiErrorState, EmptyState } from "@/components/feedback/app-states";
import { InlineLoading } from "@/components/feedback/loading-states";
import { bookableDatesQueryOptions } from "@/lib/api/booking";
import type { BookableDatesView } from "@/types/booking";
import {
  availabilityTodayIso,
  dayStatusMap,
  hasDistinctUnavailableStates,
  resolveCalendarDayState,
} from "@/lib/availability/days";
import { todayIsoInTimeZone } from "@/lib/date-time/format";
import { calendarMonthKeyFor, isIsoDateInMonthKey } from "@/lib/date-time/calendar-adapter";
import { toAppApiError } from "@/lib/api/errors";
import type { ProviderPreference, ProviderSelectionMode } from "@/types/provider";
import type { CalendarDayVisualState } from "@/types/availability";

export function DateStep({
  serviceId,
  branchId,
  preference,
  requiresBranch,
  providerMode,
  selected,
  onSelect,
  timezone,
  submitted,
  buildDatesQueryOptions,
}: {
  serviceId?: string | null;
  branchId?: string | null;
  preference: ProviderPreference;
  requiresBranch: boolean;
  providerMode: ProviderSelectionMode;
  selected: string | null;
  onSelect: (iso: string | null) => void;
  timezone?: string;
  submitted?: boolean;
  buildDatesQueryOptions?: (month: string) => {
    queryKey: readonly unknown[];
    queryFn: (context: { signal: AbortSignal }) => Promise<BookableDatesView>;
    enabled?: boolean;
    staleTime?: number;
    gcTime?: number;
    refetchOnMount?: "always";
    refetchOnReconnect?: boolean;
    refetchOnWindowFocus?: boolean;
    retry?: boolean;
  };
}) {
  const todayFallback = todayIsoInTimeZone(timezone);
  const [month, setMonth] = useState(
    () => calendarMonthKeyFor(selected ?? todayFallback) ?? calendarMonthKeyFor(todayFallback) ?? "",
  );
  const [syncedSelected, setSyncedSelected] = useState(selected);
  if (selected !== syncedSelected) {
    setSyncedSelected(selected);
    const selectedMonth = selected ? calendarMonthKeyFor(selected) : null;
    if (selectedMonth) {
      setMonth(selectedMonth);
    }
  }

  const datesQuery = useQuery(
    buildDatesQueryOptions
      ? buildDatesQueryOptions(month)
      : bookableDatesQueryOptions(serviceId ?? "", branchId ?? undefined, preference, month, {
          requiresBranch,
          providerMode,
        }),
  );

  const dates = datesQuery.data;
  const today = availabilityTodayIso(dates, timezone);
  const statusByDate = useMemo(() => dayStatusMap(dates?.days ?? []), [dates?.days]);
  const loading = datesQuery.fetchStatus === "fetching" && !datesQuery.data;
  const refreshing = datesQuery.isFetching && Boolean(datesQuery.data);
  const refreshLock = useRef(false);

  async function refresh() {
    if (refreshLock.current) {
      return;
    }
    refreshLock.current = true;
    try {
      const result = await datesQuery.refetch();
      if (
        selected &&
        result.data &&
        isIsoDateInMonthKey(selected, month) &&
        !result.data.dates.includes(selected)
      ) {
        onSelect(null);
      }
    } finally {
      refreshLock.current = false;
    }
  }

  if (datesQuery.isError) {
    return (
      <ApiErrorState
        title="تقویم نوبت در دسترس نیست"
        description={toAppApiError(datesQuery.error).message}
        requestId={toAppApiError(datesQuery.error).requestId}
        onRetry={() => void datesQuery.refetch()}
      />
    );
  }

  if (dates?.unavailableReason === "missing_endpoint") {
    return (
      <EmptyState
        title="تقویم نوبت هنوز متصل نشده"
        description="تاریخ‌های قابل رزرو باید از سرویس نوبت‌دهی دریافت شود. تاریخ‌ها در این صفحه ساخته نمی‌شوند."
      />
    );
  }

  if (dates?.unavailableReason === "branch_required") {
    return (
      <EmptyState
        title="شعبه انتخاب نشده است"
        description="سرویس نوبت‌دهی تاریخ‌های آزاد را فقط برای یک شعبهٔ مشخص اعلام می‌کند."
      />
    );
  }

  if (dates?.unavailableReason === "not_configured") {
    return (
      <EmptyState
        title="برنامهٔ این خدمت کامل نیست"
        description="تنظیمات زمان‌بندی این خدمت در سرویس نوبت‌دهی معتبر نیست؛ تاریخی برای رزرو اعلام نشده است."
      />
    );
  }

  const distinct = hasDistinctUnavailableStates(dates?.days ?? []);

  function dayState(iso: string, inCurrentMonth: boolean): CalendarDayVisualState {
    return resolveCalendarDayState({
      iso,
      inCurrentMonth,
      today,
      selected: selected ?? undefined,
      minDate: dates?.minDate,
      maxDate: dates?.maxDate,
      statusByDate,
      loading,
    }).state;
  }

  return (
    <div className="booking-date-step">
      {submitted && !selected ? (
        <p className="ds-error" role="alert">
          لطفاً یک تاریخ را انتخاب کنید.
        </p>
      ) : null}
      <p className="visually-hidden" aria-live="polite">
        {loading
          ? "در حال بارگذاری تقویم نوبت"
          : refreshing
            ? "تقویم در حال به‌روزرسانی است"
            : dates?.available
              ? "روزهای قابل رزرو این ماه به‌روز شد"
              : "در این ماه روز قابل رزروی اعلام نشده است"}
      </p>
      <Calendar
        value={selected ?? undefined}
        min={dates?.minDate && dates.minDate > today ? dates.minDate : today}
        max={dates?.maxDate}
        today={today}
        month={month}
        onMonthChange={setMonth}
        loading={loading}
        dayState={dayState}
        isDateDisabled={(iso) =>
          resolveCalendarDayState({
            iso,
            inCurrentMonth: true,
            today,
            selected: selected ?? undefined,
            minDate: dates?.minDate,
            maxDate: dates?.maxDate,
            statusByDate,
            loading,
          }).disabled
        }
        onChange={(iso) => {
          const next = resolveCalendarDayState({
            iso,
            inCurrentMonth: true,
            today,
            selected: selected ?? undefined,
            minDate: dates?.minDate,
            maxDate: dates?.maxDate,
            statusByDate,
            loading,
          });
          if (next.selectable) {
            onSelect(iso);
          }
        }}
      />
      {refreshing ? <InlineLoading label="در حال به‌روزرسانی تقویم" /> : null}
      {!loading && dates && !dates.available ? (
        <p className="ds-help" role="status">
          برای این انتخاب در این ماه روز قابل رزروی اعلام نشده است. ماه دیگری را امتحان کنید.
        </p>
      ) : null}
      <ul className="booking-calendar-legend">
        <li data-availability="available">قابل رزرو</li>
        <li data-availability="selected">انتخاب‌شده</li>
        {distinct ? <li data-availability="closed">تعطیل</li> : null}
        {distinct ? <li data-availability="no_capacity">ظرفیت تکمیل</li> : null}
        {!distinct ? <li data-availability="unavailable">غیرفعال</li> : null}
      </ul>
      <Button
        variant="secondary"
        onClick={() => void refresh()}
        disabled={refreshing || loading}
        loading={refreshing}
      >
        به‌روزرسانی
      </Button>
    </div>
  );
}
