import { apiClient } from "@/lib/api/client";
import { ApiError, isNotFoundError, toAppApiError } from "@/lib/api/errors";
import { canQueryAvailability } from "@/lib/availability/context";
import {
  adaptBookableDates,
  adaptBookableSlots,
  adaptBookingConfirm,
  adaptBookingQuote,
  emptyBookingQuote,
} from "@/lib/booking/adapters";
import { adaptBookingConfirmation } from "@/lib/booking/confirmation-adapter";
import { sanitizedAdditionalData } from "@/lib/booking/idempotency";
import { bookingProviderId } from "@/lib/public/provider-preference";
import { isSafePublicId } from "@/lib/public/booking-href";
import { queryKeys } from "@/lib/query/keys";
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

export async function fetchBookableDates(
  input: {
    serviceId: string;
    branchId?: string;
    preference: ProviderPreference;
    month: string;
  },
  signal?: AbortSignal,
): Promise<BookableDatesView> {
  try {
    const payload = await apiClient<unknown>("/public/booking/availability/dates", {
      method: "GET",
      signal,
      query: {
        serviceId: input.serviceId,
        branchId: input.branchId,
        providerId: bookingProviderId(input.preference),
        preference: input.preference.type,
        month: input.month,
      },
    });
    return adaptBookableDates(payload);
  } catch (error) {
    const normalized = toAppApiError(error);
    if (isNotFoundError(normalized)) {
      return emptyDates("missing_endpoint");
    }
    throw error;
  }
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
  try {
    const payload = await apiClient<unknown>("/public/booking/availability/slots", {
      method: "GET",
      signal,
      query: {
        serviceId: input.serviceId,
        branchId: input.branchId,
        providerId: bookingProviderId(input.preference),
        preference: input.preference.type,
        date: input.date,
      },
    });
    return adaptBookableSlots(payload);
  } catch (error) {
    const normalized = toAppApiError(error);
    if (isNotFoundError(normalized)) {
      return emptySlots("missing_endpoint");
    }
    throw error;
  }
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
  try {
    const payload = await apiClient<unknown>("/public/booking/quote", {
      method: "POST",
      signal,
      body: quoteRequestBody(draft, couponCode),
    });
    return adaptBookingQuote(payload);
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
  try {
    const payload = await apiClient<unknown>("/customer/bookings/preview", {
      method: "POST",
      signal,
      body: {
        ...quoteRequestBody(draft),
        quoteId: draft.quoteId,
      },
    });
    const quote = adaptBookingQuote(payload);
    return { checkoutPath: quote.checkoutPath, quote };
  } catch (error) {
    if (error instanceof ApiError && isNotFoundError(error)) {
      return { checkoutPath: "unknown" };
    }
    throw error;
  }
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
      }) && /^\d{4}-\d{2}$/.test(month),
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
