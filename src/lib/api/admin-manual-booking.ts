import { apiClient } from "@/lib/api/client";
import { isNotFoundError, toAppApiError } from "@/lib/api/errors";
import {
  adaptAdminCreateCustomerResult,
  adaptAdminCustomerSearch,
  adaptAdminManualBookingConfirm,
  adaptAdminManualBookingOptions,
  adaptAdminManualBookingQuote,
  adaptAdminResourceAllocation,
} from "@/lib/admin/manual-booking-adapter";
import { adminManualBookingIntentFingerprint } from "@/lib/admin/manual-booking-draft";
import { adaptBookableDates, adaptBookableSlots } from "@/lib/booking/adapters";
import { bookingProviderId } from "@/lib/public/provider-preference";
import { isSafePublicId } from "@/lib/public/booking-href";
import { queryKeys } from "@/lib/query/keys";
import { canQueryAvailability } from "@/lib/availability/context";
import type {
  AdminManualBookingConfirmView,
  AdminManualBookingCreateCustomerInput,
  AdminManualBookingCreateCustomerResult,
  AdminManualBookingCustomerSearchView,
  AdminManualBookingDraft,
  AdminManualBookingOptionsView,
  AdminManualBookingQuoteView,
  AdminResourceAllocationView,
} from "@/types/admin-manual-booking";
import type { BookableDatesView, BookableSlotsView } from "@/types/booking";
import type { ProviderPreference, ProviderSelectionMode } from "@/types/provider";

const AVAILABILITY_STALE_MS = 10_000;
const SEARCH_MIN_LENGTH = 2;

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

function quoteRequestBody(draft: AdminManualBookingDraft) {
  const body: Record<string, unknown> = {
    customerId: draft.customerId,
    serviceId: draft.serviceId,
    branchId: draft.branchId,
    providerPreference: draft.providerPreference,
    date: draft.date,
    slotId: draft.slotId,
    allocationMode: draft.allocationMode,
    resourceSelections: draft.resourceSelections,
    paymentMethod: draft.paymentMethod,
    bookingSource: draft.bookingSource,
    customerNote: draft.customerNote?.trim() || undefined,
    internalNote: draft.internalNote?.trim() || undefined,
    quoteId: draft.quoteId,
  };
  return body;
}

export function adminCustomerSearchQueryOptions(userId: string, query: string) {
  const trimmed = query.trim();
  return {
    queryKey: queryKeys.admin.manualBookingCustomerSearch(userId, trimmed),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      searchAdminCustomers(trimmed, signal),
    enabled: trimmed.length >= SEARCH_MIN_LENGTH,
    staleTime: 0,
    gcTime: 30_000,
    retry: false,
  };
}

export async function searchAdminCustomers(
  query: string,
  signal?: AbortSignal,
): Promise<AdminManualBookingCustomerSearchView> {
  const payload = await apiClient<unknown>("/admin/customers/search", {
    method: "GET",
    signal,
    query: { q: query.trim() },
  });
  return adaptAdminCustomerSearch(payload, query.trim());
}

export async function createAdminCustomer(
  input: AdminManualBookingCreateCustomerInput,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<AdminManualBookingCreateCustomerResult> {
  try {
    const payload = await apiClient<unknown>("/admin/customers", {
      method: "POST",
      signal,
      headers: { "Idempotency-Key": idempotencyKey },
      body: input,
    });
    return adaptAdminCreateCustomerResult(payload);
  } catch (error) {
    const normalized = toAppApiError(error);
    if (isNotFoundError(normalized)) {
      return { outcome: "missing_endpoint" };
    }
    throw error;
  }
}

export async function fetchAdminManualBookingOptions(
  signal?: AbortSignal,
): Promise<AdminManualBookingOptionsView> {
  try {
    const payload = await apiClient<unknown>("/admin/bookings/options", {
      method: "GET",
      signal,
    });
    return adaptAdminManualBookingOptions(payload);
  } catch (error) {
    if (isNotFoundError(toAppApiError(error))) {
      return { bookingSources: [] };
    }
    throw error;
  }
}

export async function fetchAdminBookableDates(
  input: {
    customerId: string;
    serviceId: string;
    branchId?: string;
    preference: ProviderPreference;
    month: string;
  },
  signal?: AbortSignal,
): Promise<BookableDatesView> {
  try {
    const payload = await apiClient<unknown>("/admin/bookings/availability/dates", {
      method: "GET",
      signal,
      query: {
        customerId: input.customerId,
        serviceId: input.serviceId,
        branchId: input.branchId,
        providerId: bookingProviderId(input.preference),
        preference: input.preference.type,
        month: input.month,
      },
    });
    return adaptBookableDates(payload);
  } catch (error) {
    if (isNotFoundError(toAppApiError(error))) {
      return emptyDates("missing_endpoint");
    }
    throw error;
  }
}

export async function fetchAdminBookableSlots(
  input: {
    customerId: string;
    serviceId: string;
    branchId?: string;
    preference: ProviderPreference;
    date: string;
  },
  signal?: AbortSignal,
): Promise<BookableSlotsView> {
  try {
    const payload = await apiClient<unknown>("/admin/bookings/availability/slots", {
      method: "GET",
      signal,
      query: {
        customerId: input.customerId,
        serviceId: input.serviceId,
        branchId: input.branchId,
        providerId: bookingProviderId(input.preference),
        preference: input.preference.type,
        date: input.date,
      },
    });
    return adaptBookableSlots(payload);
  } catch (error) {
    if (isNotFoundError(toAppApiError(error))) {
      return emptySlots("missing_endpoint");
    }
    throw error;
  }
}

export async function fetchAdminResourceAllocation(
  draft: AdminManualBookingDraft,
  signal?: AbortSignal,
): Promise<AdminResourceAllocationView> {
  try {
    const payload = await apiClient<unknown>("/admin/bookings/allocation", {
      method: "POST",
      signal,
      body: {
        customerId: draft.customerId,
        serviceId: draft.serviceId,
        branchId: draft.branchId,
        providerPreference: draft.providerPreference,
        date: draft.date,
        slotId: draft.slotId,
        allocationMode: draft.allocationMode,
        resourceSelections: draft.resourceSelections,
      },
    });
    return adaptAdminResourceAllocation(payload);
  } catch (error) {
    if (isNotFoundError(toAppApiError(error))) {
      return adaptAdminResourceAllocation(undefined);
    }
    throw error;
  }
}

export async function fetchAdminManualBookingQuote(
  draft: AdminManualBookingDraft,
  signal?: AbortSignal,
): Promise<AdminManualBookingQuoteView> {
  const payload = await apiClient<unknown>("/admin/bookings/quote", {
    method: "POST",
    signal,
    body: quoteRequestBody(draft),
  });
  return adaptAdminManualBookingQuote(payload);
}

export async function confirmAdminManualBooking(
  draft: AdminManualBookingDraft,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<AdminManualBookingConfirmView> {
  try {
    const payload = await apiClient<unknown>("/admin/bookings", {
      method: "POST",
      signal,
      headers: { "Idempotency-Key": idempotencyKey },
      body: quoteRequestBody(draft),
    });
    return adaptAdminManualBookingConfirm(payload);
  } catch (error) {
    if (isNotFoundError(toAppApiError(error))) {
      return { outcome: "missing_endpoint" };
    }
    throw error;
  }
}

const availabilityQueryBase = {
  staleTime: AVAILABILITY_STALE_MS,
  gcTime: 60_000,
  refetchOnMount: "always" as const,
  refetchOnReconnect: true,
  refetchOnWindowFocus: false,
  retry: false,
};

export function adminBookableDatesQueryOptions(
  customerId: string,
  serviceId: string,
  branchId: string | undefined,
  preference: ProviderPreference,
  month: string,
  gates: { requiresBranch: boolean; providerMode: ProviderSelectionMode },
) {
  return {
    queryKey: queryKeys.admin.manualBookingDates(
      customerId,
      serviceId,
      branchId,
      preference,
      month,
    ),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      fetchAdminBookableDates({ customerId, serviceId, branchId, preference, month }, signal),
    enabled:
      isSafePublicId(customerId) &&
      canQueryAvailability({
        serviceId,
        branchId,
        preference,
        requiresBranch: gates.requiresBranch,
        providerMode: gates.providerMode,
      }) &&
      /^\d{4}-\d{2}$/.test(month),
    ...availabilityQueryBase,
  };
}

export function adminBookableSlotsQueryOptions(
  customerId: string,
  serviceId: string,
  branchId: string | undefined,
  preference: ProviderPreference,
  date: string,
  gates: { requiresBranch: boolean; providerMode: ProviderSelectionMode },
) {
  return {
    queryKey: queryKeys.admin.manualBookingSlots(
      customerId,
      serviceId,
      branchId,
      preference,
      date,
    ),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      fetchAdminBookableSlots({ customerId, serviceId, branchId, preference, date }, signal),
    enabled:
      isSafePublicId(customerId) &&
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

export function adminManualBookingQuoteQueryOptions(
  userId: string,
  draft: AdminManualBookingDraft,
  enabled: boolean,
) {
  const fingerprint = adminManualBookingIntentFingerprint(draft);
  return {
    queryKey: queryKeys.admin.manualBookingQuote(userId, fingerprint),
    queryFn: ({ signal }: { signal: AbortSignal }) => fetchAdminManualBookingQuote(draft, signal),
    enabled:
      enabled &&
      isSafePublicId(draft.customerId) &&
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

export function adminManualBookingOptionsQueryOptions(userId: string) {
  return {
    queryKey: queryKeys.admin.manualBookingOptions(userId),
    queryFn: ({ signal }: { signal: AbortSignal }) => fetchAdminManualBookingOptions(signal),
    staleTime: 60_000,
    retry: false,
  };
}

export { SEARCH_MIN_LENGTH, quoteRequestBody };
