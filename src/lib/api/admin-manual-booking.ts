import { apiClient } from "@/lib/api/client";
import { isNotFoundError, toAppApiError } from "@/lib/api/errors";
import {
  adaptAdminCreateCustomerResult,
  adaptAdminCustomerSearch,
  adaptAdminManualBookingConfirm,
  adaptAdminManualBookingOptions,
  adaptAdminResourceAllocation,
  adaptBackendResourceAllocation,
} from "@/lib/admin/manual-booking-adapter";
import { adminManualBookingIntentFingerprint } from "@/lib/admin/manual-booking-draft";
import {
  adaptServiceAvailabilityDates,
  adaptServiceAvailabilitySlots,
  pricedAtBookingQuote,
} from "@/lib/booking/adapters";
import { bookingProviderId } from "@/lib/public/provider-preference";
import { isSafePublicId } from "@/lib/public/booking-href";
import { queryKeys } from "@/lib/query/keys";
import { canQueryAvailability } from "@/lib/availability/context";
import { calendarMonthBounds, isCalendarMonthKey } from "@/lib/date-time/calendar-adapter";
import { toE164IranMobile } from "@/lib/auth/phone";
import { asList, asSafeText, readBoolean, unwrapPayload } from "@/lib/public/read";
import { isRecord, readString } from "@/lib/utilities/records";
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
import type { PublicBranch } from "@/types/public";
import type { ProviderPreference, ProviderSelectionMode } from "@/types/provider";

const AVAILABILITY_STALE_MS = 10_000;
const SEARCH_MIN_LENGTH = 2;
/** Qualified staff read per service when deriving branches; one detail request each. */
const BRANCH_SOURCE_STAFF_LIMIT = 50;

/**
 * The Backend has no branch list. For staff, `GET /staff?service_id=` lists the staff
 * qualified for the service and each `StaffRead.branches` names their branches, so the
 * union of active ones is where the service can be staffed. Availability still decides
 * whether a branch has slots.
 */
export async function fetchAdminServiceBranches(
  serviceId: string,
  signal?: AbortSignal,
): Promise<PublicBranch[]> {
  const listed = await apiClient<unknown>("/staff", {
    method: "GET",
    signal,
    query: { service_id: serviceId, is_active: "true", page_size: BRANCH_SOURCE_STAFF_LIMIT },
  });
  const staffIds = asList(unwrapPayload(listed), ["items"])
    .map((item) => (isRecord(item) ? readString(item.id) : undefined))
    .filter((id): id is string => Boolean(id && isSafePublicId(id)));
  const details = await Promise.all(
    staffIds.map((id) =>
      apiClient<unknown>(`/staff/${encodeURIComponent(id)}`, { method: "GET", signal }),
    ),
  );
  const branches = new Map<string, PublicBranch>();
  for (const detail of details) {
    const root = unwrapPayload(detail);
    for (const branch of isRecord(root) ? asList(root.branches, []) : []) {
      if (!isRecord(branch) || readBoolean(branch.is_active) === false) continue;
      const id = readString(branch.id);
      const name = asSafeText(branch.name);
      if (id && name && isSafePublicId(id) && !branches.has(id)) {
        branches.set(id, { id, name, workingHours: [] });
      }
    }
  }
  return [...branches.values()];
}

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
    query: { search: query.trim() },
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
      body: {
        first_name: input.firstName,
        last_name: input.lastName,
        mobile: toE164IranMobile(input.phone),
        ...(input.email ? { email: input.email } : {}),
      },
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
  if (!input.branchId) {
    return emptyDates("branch_required");
  }
  const bounds = calendarMonthBounds(input.month);
  if (!bounds) {
    return emptyDates("error");
  }
  try {
    const payload = await apiClient<unknown>(
      `/services/${encodeURIComponent(input.serviceId)}/availability`,
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
  if (!input.branchId) {
    return emptySlots("branch_required");
  }
  try {
    const payload = await apiClient<unknown>(
      `/services/${encodeURIComponent(input.serviceId)}/availability`,
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
    if (isNotFoundError(toAppApiError(error))) {
      return emptySlots("missing_endpoint");
    }
    throw error;
  }
}

/** Staff requirements are filled by the provider step (`staff_id`), not chosen here. */
export async function fetchAdminResourceAllocation(
  { serviceId, branchId }: Pick<AdminManualBookingDraft, "serviceId" | "branchId">,
  signal?: AbortSignal,
): Promise<AdminResourceAllocationView> {
  if (!serviceId) return adaptAdminResourceAllocation(undefined);
  const base = `/admin/services/${encodeURIComponent(serviceId)}/resource-requirements`;
  try {
    const payload = await apiClient<unknown>(base, { method: "GET", signal });
    const requirements = asList(unwrapPayload(payload), ["requirements", "items"]).filter(
      (item) => isRecord(item) && readString(item.resource_type_code) !== "staff" && readString(item.id),
    ) as Record<string, unknown>[];
    const entries = await Promise.all(
      requirements.map(async (requirement) => {
        const eligible = await apiClient<unknown>(
          `${base}/${encodeURIComponent(String(requirement.id))}/eligible-resources`,
          {
            method: "GET",
            signal,
            query: { active_only: "true", ...(branchId ? { branch_id: branchId } : {}) },
          },
        );
        return { requirement, resources: asList(unwrapPayload(eligible), ["resources", "items"]) };
      }),
    );
    return adaptBackendResourceAllocation(entries);
  } catch (error) {
    if (isNotFoundError(toAppApiError(error))) {
      return adaptAdminResourceAllocation(undefined);
    }
    throw error;
  }
}

/**
 * The Backend has no manual-booking quote route: `POST /admin/appointments` prices the
 * appointment itself, so nothing is requested or calculated here.
 */
export async function fetchAdminManualBookingQuote(): Promise<AdminManualBookingQuoteView> {
  return { ...pricedAtBookingQuote(), paymentOptions: [] };
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
      isCalendarMonthKey(month),
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
    queryFn: () => fetchAdminManualBookingQuote(),
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
