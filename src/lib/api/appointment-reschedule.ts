import { apiClient } from "@/lib/api/client";
import { ApiError, isNotFoundError, toAppApiError } from "@/lib/api/errors";
import {
  adaptServiceAvailabilityDates,
  adaptServiceAvailabilitySlots,
} from "@/lib/booking/adapters";
import { canQueryAvailability } from "@/lib/availability/context";
import { preferenceKey } from "@/lib/availability/context";
import { calendarMonthBounds, isCalendarMonthKey } from "@/lib/date-time/calendar-adapter";
import { startTimeFromSlotId } from "@/lib/api/backend-contract";
import {
  adaptReschedulePreview,
  adaptRescheduleResult,
  buildRescheduleReview,
} from "@/lib/customer/appointment-reschedule-adapter";
import { bookingProviderId } from "@/lib/public/provider-preference";
import { isSafePublicId } from "@/lib/public/booking-href";
import { queryKeys } from "@/lib/query/keys";
import type {
  ReschedulePreviewView,
  RescheduleQuoteView,
  RescheduleResultView,
} from "@/types/appointment-reschedule";
import type { BookableDatesView, BookableSlotsView } from "@/types/booking";
import type { ProviderPreference } from "@/types/provider";

const AVAILABILITY_STALE_MS = 10_000;

const emptyDates = (reason: BookableDatesView["unavailableReason"]): BookableDatesView => ({
  available: false,
  dates: [],
  days: [],
  unavailableReason: reason,
});

const emptySlots = (reason: BookableSlotsView["unavailableReason"]): BookableSlotsView => ({
  available: false,
  slots: [],
  unavailableReason: reason,
});

export async function fetchReschedulePreview(
  reference: string,
  signal?: AbortSignal,
): Promise<ReschedulePreviewView> {
  const payload = await apiClient<unknown>(
    `/customer/appointments/${encodeURIComponent(reference)}/reschedule-preview`,
    { method: "GET", signal },
  );
  const view = adaptReschedulePreview(payload);
  if (!view) {
    throw new ApiError({
      status: 404,
      code: "RESCHEDULE_PREVIEW_NOT_FOUND",
      message: "پیش‌نمایش زمان‌بندی مجدد در دسترس نیست.",
    });
  }
  return view;
}

export async function fetchRescheduleDates(
  reference: string,
  input: {
    month: string;
    branchId?: string;
    preference: ProviderPreference;
    serviceId?: string;
  },
  signal?: AbortSignal,
): Promise<BookableDatesView> {
  if (!input.branchId) {
    return emptyDates("branch_required");
  }
  const serviceId = input.serviceId;
  if (!serviceId || !isSafePublicId(serviceId)) {
    return emptyDates("missing_endpoint");
  }
  const bounds = calendarMonthBounds(input.month);
  if (!bounds) {
    return emptyDates("error");
  }
  try {
    const payload = await apiClient<unknown>(
      `/services/${encodeURIComponent(serviceId)}/availability`,
      {
        method: "GET",
        signal,
        query: {
          branch_id: input.branchId,
          from: bounds.from,
          to: bounds.to,
          staff_id: bookingProviderId(input.preference),
        },
      },
    );
    return adaptServiceAvailabilityDates(payload);
  } catch (error) {
    const normalized = toAppApiError(error);
    if (isNotFoundError(normalized)) {
      return emptyDates("missing_endpoint");
    }
    throw error;
  }
}

export async function fetchRescheduleSlots(
  reference: string,
  input: {
    date: string;
    branchId?: string;
    preference: ProviderPreference;
    serviceId?: string;
  },
  signal?: AbortSignal,
): Promise<BookableSlotsView> {
  if (!input.branchId) {
    return emptySlots("branch_required");
  }
  const serviceId = input.serviceId;
  if (!serviceId || !isSafePublicId(serviceId)) {
    return emptySlots("missing_endpoint");
  }
  try {
    const payload = await apiClient<unknown>(
      `/services/${encodeURIComponent(serviceId)}/availability`,
      {
        method: "GET",
        signal,
        query: {
          branch_id: input.branchId,
          date: input.date,
          staff_id: bookingProviderId(input.preference),
        },
      },
    );
    return adaptServiceAvailabilitySlots(payload, input.date);
  } catch (error) {
    const normalized = toAppApiError(error);
    if (isNotFoundError(normalized)) {
      return emptySlots("missing_endpoint");
    }
    throw error;
  }
}

export async function fetchRescheduleQuote(
  reference: string,
  input: {
    slotId: string;
    date: string;
    branchId?: string;
    providerId?: string;
    previewVersion?: string;
  },
  signal?: AbortSignal,
): Promise<RescheduleQuoteView> {
  const startsAt = startTimeFromSlotId(input.slotId);
  if (!startsAt) {
    throw new ApiError({
      status: 422,
      code: "RESCHEDULE_QUOTE_INVALID",
      message: "پیش‌نمایش زمان‌بندی مجدد معتبر نیست.",
    });
  }
  const preview = await fetchReschedulePreview(reference, signal);
  if (!preview.canReschedule) {
    throw new ApiError({
      status: 409,
      code: "RESCHEDULE_NOT_ALLOWED",
      message: preview.blockedReason ?? "این نوبت دیگر قابل زمان‌بندی مجدد نیست.",
    });
  }
  return buildRescheduleReview(preview, { slotId: input.slotId, date: input.date, startsAt });
}

export async function submitAppointmentReschedule(
  reference: string,
  input: {
    slotId: string;
    date: string;
    branchId?: string;
    providerId?: string;
    previewVersion?: string;
    acknowledged?: boolean;
  },
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<RescheduleResultView> {
  const payload = await apiClient<unknown>(
    `/customer/appointments/${encodeURIComponent(reference)}/reschedule`,
    {
      method: "POST",
      signal,
      headers: { "Idempotency-Key": idempotencyKey },
      body: {
        slotId: input.slotId,
        date: input.date,
        branchId: input.branchId,
        providerId: input.providerId,
        previewVersion: input.previewVersion,
        acknowledged: input.acknowledged,
      },
    },
  );
  const result = adaptRescheduleResult(payload);
  if (!result) {
    throw new ApiError({
      status: 422,
      code: "RESCHEDULE_RESULT_INVALID",
      message: "پاسخ زمان‌بندی مجدد معتبر نیست.",
    });
  }
  return result;
}

export function reschedulePreviewQueryOptions(userId: string, reference: string) {
  return {
    queryKey: queryKeys.customer.appointmentReschedulePreview(userId, reference),
    queryFn: ({ signal }: { signal: AbortSignal }) => fetchReschedulePreview(reference, signal),
    enabled: Boolean(userId) && isSafePublicId(reference),
    staleTime: 0,
    gcTime: 30_000,
    refetchOnMount: "always" as const,
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
    retry: false,
  };
}

export function rescheduleDatesQueryOptions(
  reference: string,
  serviceId: string,
  branchId: string | undefined,
  preference: ProviderPreference,
  month: string,
  input: { requiresBranch: boolean; providerMode: import("@/types/provider").ProviderSelectionMode },
) {
  const enabled = isSafePublicId(reference) && canQueryAvailability({
    serviceId,
    branchId,
    preference,
    requiresBranch: input.requiresBranch,
    providerMode: input.providerMode,
  });
  return {
    queryKey: queryKeys.reschedule.dates(reference, branchId, preference, month),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      fetchRescheduleDates(reference, { month, branchId, preference, serviceId }, signal),
    enabled: enabled && isCalendarMonthKey(month),
    staleTime: AVAILABILITY_STALE_MS,
    gcTime: 60_000,
    refetchOnMount: true,
    refetchOnReconnect: true,
    retry: false,
  };
}

export function rescheduleSlotsQueryOptions(
  reference: string,
  serviceId: string,
  branchId: string | undefined,
  preference: ProviderPreference,
  date: string,
  input: { requiresBranch: boolean; providerMode: import("@/types/provider").ProviderSelectionMode },
) {
  const enabled = isSafePublicId(reference) && canQueryAvailability({
    serviceId,
    branchId,
    preference,
    requiresBranch: input.requiresBranch,
    providerMode: input.providerMode,
  });
  return {
    queryKey: queryKeys.reschedule.slots(reference, branchId, preference, date),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      fetchRescheduleSlots(reference, { date, branchId, preference, serviceId }, signal),
    enabled: enabled && Boolean(date),
    staleTime: AVAILABILITY_STALE_MS,
    gcTime: 60_000,
    refetchOnMount: true,
    refetchOnReconnect: true,
    retry: false,
  };
}

export function rescheduleQuoteQueryOptions(
  userId: string,
  reference: string,
  input: {
    slotId: string;
    date: string;
    branchId?: string;
    providerId?: string;
    previewVersion?: string;
  } | null,
) {
  return {
    queryKey: queryKeys.customer.appointmentRescheduleQuote(userId, reference, input),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      fetchRescheduleQuote(reference, input!, signal),
    enabled:
      Boolean(userId) &&
      isSafePublicId(reference) &&
      Boolean(input?.slotId && input.date),
    staleTime: 0,
    gcTime: 30_000,
    retry: false,
  };
}

export function isReschedulePreviewDisconnected(error: unknown): boolean {
  const normalized = toAppApiError(error);
  return isNotFoundError(normalized) || normalized.status === 0;
}

export { preferenceKey };
