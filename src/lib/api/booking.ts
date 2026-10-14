import { apiClient } from "@/lib/api/client";
import { ApiError, isNotFoundError, toAppApiError } from "@/lib/api/errors";
import { canQueryAvailability } from "@/lib/availability/context";
import { calendarMonthBounds, isCalendarMonthKey } from "@/lib/date-time/calendar-adapter";
import {
  adaptBookingConfirm,
  adaptServiceAvailabilityDates,
  adaptServiceAvailabilitySlots,
  adaptBookingQuote,
  emptyBookingQuote,
  pricedAtBookingQuote,
} from "@/lib/booking/adapters";
import { adaptBookingConfirmation } from "@/lib/booking/confirmation-adapter";
import { sanitizedAdditionalData } from "@/lib/booking/idempotency";
import { bookingProviderId } from "@/lib/public/provider-preference";
import { isSafePublicId } from "@/lib/public/booking-href";
import { asSafeText, unwrapPayload } from "@/lib/public/read";
import { queryKeys } from "@/lib/query/keys";
import { isRecord } from "@/lib/utilities/records";
import type {
  BookingDraft,
  BookableDatesView,
  BookableSlotsView,
  BookingConfirmView,
  BookingQuoteView,
  CheckoutPath,
} from "@/types/booking";
import type { BookingConfirmationView } from "@/types/confirmation";
import type { ProviderPreference, ProviderSelectionMode } from "@/types/provider";

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

/** Availability is `GET /services/{id}/availability`; the Backend requires `branch_id`. */
function serviceAvailabilityPath(serviceId: string): string {
  return `/services/${encodeURIComponent(serviceId)}/availability`;
}

export async function fetchBookableDates(
  input: {
    serviceId: string;
    branchId?: string;
    preference: ProviderPreference;
    month: string;
  },
  signal?: AbortSignal,
): Promise<BookableDatesView> {
  if (!input.branchId) {
    return emptyDates("branch_required");
  }
  const bounds = calendarMonthBounds(input.month);
  if (!bounds) {
    return emptyDates("error");
  }
  const payload = await apiClient<unknown>(serviceAvailabilityPath(input.serviceId), {
    method: "GET",
    signal,
    query: {
      branch_id: input.branchId,
      from: bounds.from,
      to: bounds.to,
      staff_id: bookingProviderId(input.preference),
    },
  });
  return adaptServiceAvailabilityDates(payload);
}

export async function fetchBookableSlots(
  input: {
    serviceId: string;
    branchId?: string;
    preference: ProviderPreference;
    date: string;
  },
  signal?: AbortSignal,
): Promise<BookableSlotsView> {
  if (!input.branchId) {
    return emptySlots("branch_required");
  }
  const payload = await apiClient<unknown>(serviceAvailabilityPath(input.serviceId), {
    method: "GET",
    signal,
    query: {
      branch_id: input.branchId,
      date: input.date,
      staff_id: bookingProviderId(input.preference),
    },
  });
  return adaptServiceAvailabilitySlots(payload, input.date);
}

export function quoteRequestBody(draft: BookingDraft, couponCode?: string) {
  const body: Record<string, unknown> = {
    serviceId: draft.serviceId,
    branchId: draft.branchId,
    providerPreference: draft.providerPreference,
    date: draft.date,
    slotId: draft.slotId,
    additionalData: sanitizedAdditionalData(draft.additionalData),
  };
  const code = couponCode?.trim();
  if (code) {
    body.couponCode = code;
  }
  return body;
}

export async function fetchBookingQuote(
  draft: BookingDraft,
  signal?: AbortSignal,
  couponCode?: string,
): Promise<BookingQuoteView> {
  const code = couponCode?.trim();
  if (!draft.serviceId) {
    return emptyBookingQuote();
  }
  if (!code) {
    return pricedAtBookingQuote();
  }
  try {
    const payload = await apiClient<unknown>("/coupons/validate", {
      method: "POST",
      signal,
      body: {
        couponCode: code,
        serviceId: draft.serviceId,
        holdToken: draft.holdId,
      },
    });
    const quote = adaptBookingQuote(payload);
    const root = unwrapPayload(payload);
    if (!quote.coupon && isRecord(root) && typeof root.valid === "boolean") {
      quote.coupon = { code, status: root.valid ? "applied" : "invalid" };
      const message = asSafeText(root.message);
      if (message) quote.coupon.message = message;
    }
    return quote;
  } catch (error) {
    const normalized = toAppApiError(error);
    if (isNotFoundError(normalized)) {
      return emptyBookingQuote();
    }
    throw error;
  }
}

export async function previewBookingCheckout(
  draft: BookingDraft,
  signal?: AbortSignal,
): Promise<{ checkoutPath: CheckoutPath; quote?: BookingQuoteView }> {
  const quote = await fetchBookingQuote(draft, signal);
  return { checkoutPath: quote.checkoutPath, quote };
}

export async function confirmBooking(
  draft: BookingDraft,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<BookingConfirmView> {
  try {
    const payload = await apiClient<unknown>("/customer/bookings", {
      method: "POST",
      signal,
      headers: { "Idempotency-Key": idempotencyKey },
      body: {
        ...quoteRequestBody(draft),
        quoteId: draft.quoteId,
      },
    });
    return adaptBookingConfirm(payload);
  } catch (error) {
    if (error instanceof ApiError && isNotFoundError(error)) {
      return { outcome: "missing_endpoint" };
    }
    throw error;
  }
}

export async function fetchBookingConfirmation(
  reference: string,
  signal?: AbortSignal,
): Promise<BookingConfirmationView> {
  if (!isSafePublicId(reference)) {
    throw new ApiError({
      status: 404,
      code: "BOOKING_NOT_FOUND",
      message: "رزرو پیدا نشد.",
    });
  }
  const payload = await apiClient<unknown>(`/customer/bookings/${reference}`, {
    method: "GET",
    signal,
  });
  const view = adaptBookingConfirmation(payload);
  if (!view) {
    throw new ApiError({
      status: 404,
      code: "BOOKING_NOT_FOUND",
      message: "رزرو پیدا نشد.",
    });
  }
  return view;
}

export function bookingConfirmationQueryOptions(reference: string) {
  return {
    queryKey: queryKeys.booking.confirmation(reference),
    queryFn: ({ signal }: { signal: AbortSignal }) => fetchBookingConfirmation(reference, signal),
    enabled: isSafePublicId(reference),
    staleTime: 0,
    gcTime: 30_000,
    refetchOnMount: "always" as const,
    refetchOnReconnect: true,
    refetchOnWindowFocus: false,
    retry: false,
  };
}

export function bookingQuoteQueryOptions(draft: BookingDraft, fingerprint: string, enabled: boolean) {
  return {
    queryKey: queryKeys.booking.quote(fingerprint),
    queryFn: ({ signal }: { signal: AbortSignal }) => fetchBookingQuote(draft, signal),
    enabled:
      enabled &&
      isSafePublicId(draft.serviceId) &&
      isSafePublicId(draft.slotId) &&
      Boolean(draft.date),
    staleTime: 10_000,
    gcTime: 60_000,
    refetchOnMount: "always" as const,
    refetchOnReconnect: true,
    refetchOnWindowFocus: false,
    retry: false,
  };
}

const availabilityQueryBase = {
  staleTime: AVAILABILITY_STALE_MS,
  gcTime: 60_000,
  refetchOnMount: "always" as const,
  refetchOnReconnect: true,
  refetchOnWindowFocus: false,
  retry: false,
};

export function bookableDatesQueryOptions(
  serviceId: string,
  branchId: string | undefined,
  preference: ProviderPreference,
  month: string,
  gates: { requiresBranch: boolean; providerMode: ProviderSelectionMode } = {
    requiresBranch: false,
    providerMode: "not_applicable",
  },
) {
  return {
    queryKey: queryKeys.availability.dates(serviceId, branchId, preference, month),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      fetchBookableDates({ serviceId, branchId, preference, month }, signal),
    enabled:
      canQueryAvailability({
        serviceId,
        branchId,
        preference,
        requiresBranch: gates.requiresBranch,
        providerMode: gates.providerMode,
      }) && isCalendarMonthKey(month),
    ...availabilityQueryBase,
  };
}

export function bookableSlotsQueryOptions(
  serviceId: string,
  branchId: string | undefined,
  preference: ProviderPreference,
  date: string,
  gates: { requiresBranch: boolean; providerMode: ProviderSelectionMode } = {
    requiresBranch: false,
    providerMode: "not_applicable",
  },
) {
  return {
    queryKey: queryKeys.availability.slots(serviceId, branchId, preference, date),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      fetchBookableSlots({ serviceId, branchId, preference, date }, signal),
    enabled:
      canQueryAvailability({
        serviceId,
        branchId,
        preference,
        requiresBranch: gates.requiresBranch,
        providerMode: gates.providerMode,
      }) &&
      isSafePublicId(serviceId) &&
      /^\d{4}-\d{2}-\d{2}$/.test(date),
    ...availabilityQueryBase,
  };
}
