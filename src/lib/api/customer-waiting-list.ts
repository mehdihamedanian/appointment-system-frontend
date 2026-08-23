import { apiClient } from "@/lib/api/client";
import { ApiError, isNotFoundError } from "@/lib/api/errors";
import {
  adaptWaitingListAcceptOutcome,
  adaptWaitingListEligibility,
  adaptWaitingListEntry,
  adaptWaitingListList,
  adaptWaitingListOffer,
} from "@/lib/customer/waiting-list-adapter";
import { isSafePublicId } from "@/lib/public/booking-href";
import { queryKeys } from "@/lib/query/keys";
import type { QueryClient } from "@tanstack/react-query";
import type { ProviderPreference } from "@/types/provider";
import {
  WAITING_LIST_LIST_LIMIT,
  type WaitingListAcceptOutcome,
  type WaitingListEligibilityView,
  type WaitingListEntryView,
  type WaitingListJoinInput,
  type WaitingListListView,
  type WaitingListOfferView,
} from "@/types/waiting-list";
import { invalidateAfterBookingResult } from "@/lib/booking/confirmation-cache";

function missingEntryError(): ApiError {
  return new ApiError({
    status: 404,
    code: "WAITING_LIST_NOT_FOUND",
    message: "درخواست لیست انتظار پیدا نشد.",
  });
}

function missingOfferError(): ApiError {
  return new ApiError({
    status: 404,
    code: "WAITING_LIST_OFFER_NOT_FOUND",
    message: "پیشنهاد زمان پیدا نشد.",
  });
}

function preferenceBody(preference: ProviderPreference) {
  if (preference.type === "specific") {
    return { type: "specific", providerId: preference.providerId };
  }
  return { type: preference.type };
}

export async function fetchWaitingListEligibility(
  input: {
    serviceId: string;
    branchId?: string;
    preference?: ProviderPreference;
    date?: string;
  },
  signal?: AbortSignal,
): Promise<WaitingListEligibilityView> {
  const params = new URLSearchParams();
  params.set("serviceId", input.serviceId);
  if (input.branchId) params.set("branchId", input.branchId);
  if (input.date) params.set("date", input.date);
  if (input.preference?.type === "specific") {
    params.set("providerId", input.preference.providerId);
  } else if (input.preference) {
    params.set("providerPreference", input.preference.type);
  }
  try {
    const payload = await apiClient<unknown>(
      `/customer/waiting-list/eligibility?${params.toString()}`,
      { method: "GET", signal },
    );
    return adaptWaitingListEligibility(payload);
  } catch (error) {
    if (error instanceof ApiError && isNotFoundError(error)) {
      return { eligible: false, reason: "قابلیت لیست انتظار هنوز متصل نیست." };
    }
    throw error;
  }
}

export function waitingListEligibilityQueryOptions(
  userId: string,
  input: {
    serviceId: string;
    branchId?: string;
    preference?: ProviderPreference;
    date?: string;
  },
) {
  return {
    queryKey: queryKeys.customer.waitingListEligibility(userId, input),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      fetchWaitingListEligibility(input, signal),
    enabled: Boolean(userId) && isSafePublicId(input.serviceId),
    staleTime: 15_000,
    retry: false,
  };
}

export async function fetchWaitingListEntries(
  input: { page?: number; cursor?: string } = {},
  signal?: AbortSignal,
): Promise<WaitingListListView> {
  const params = new URLSearchParams();
  params.set("page", String(input.page && input.page > 0 ? input.page : 1));
  params.set("limit", String(WAITING_LIST_LIST_LIMIT));
  if (input.cursor) params.set("cursor", input.cursor);
  const payload = await apiClient<unknown>(`/customer/waiting-list?${params.toString()}`, {
    method: "GET",
    signal,
  });
  return adaptWaitingListList(payload, input.page ?? 1);
}

export function waitingListEntriesQueryOptions(
  userId: string,
  pagination: { page: number } = { page: 1 },
) {
  return {
    queryKey: queryKeys.customer.waitingListEntries(userId, pagination),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      fetchWaitingListEntries(pagination, signal),
    staleTime: 15_000,
    refetchOnMount: "always" as const,
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
    retry: false,
  };
}

export async function fetchWaitingListEntry(
  reference: string,
  signal?: AbortSignal,
): Promise<WaitingListEntryView> {
  if (!isSafePublicId(reference)) throw missingEntryError();
  const payload = await apiClient<unknown>(
    `/customer/waiting-list/${encodeURIComponent(reference)}`,
    { method: "GET", signal },
  );
  const view = adaptWaitingListEntry(payload);
  if (!view) throw missingEntryError();
  return view;
}

export function waitingListEntryQueryOptions(userId: string, reference: string) {
  return {
    queryKey: queryKeys.customer.waitingListEntry(userId, reference),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      fetchWaitingListEntry(reference, signal),
    enabled: Boolean(userId) && isSafePublicId(reference),
    staleTime: 0,
    refetchOnMount: "always" as const,
    refetchOnWindowFocus: true,
    retry: false,
  };
}

export async function joinWaitingList(
  input: WaitingListJoinInput,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<WaitingListEntryView> {
  const payload = await apiClient<unknown>("/customer/waiting-list", {
    method: "POST",
    signal,
    headers: { "Idempotency-Key": idempotencyKey },
    body: {
      serviceId: input.serviceId,
      branchId: input.branchId,
      providerPreference: preferenceBody(input.providerPreference),
      datePreference: input.datePreference,
      timePreference: input.timePreference,
      timeFrom: input.timeFrom,
      timeTo: input.timeTo,
      note: input.note,
      contextDate: input.contextDate,
    },
  });
  const view = adaptWaitingListEntry(payload);
  if (!view) {
    throw new ApiError({
      status: 422,
      code: "WAITING_LIST_INVALID_RESPONSE",
      message: "پاسخ ثبت لیست انتظار قابل استفاده نبود.",
    });
  }
  return view;
}

export async function leaveWaitingList(
  reference: string,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<void> {
  if (!isSafePublicId(reference)) throw missingEntryError();
  await apiClient(`/customer/waiting-list/${encodeURIComponent(reference)}/leave`, {
    method: "POST",
    signal,
    headers: { "Idempotency-Key": idempotencyKey },
    body: {},
  });
}

export async function fetchWaitingListOffer(
  reference: string,
  signal?: AbortSignal,
): Promise<WaitingListOfferView> {
  if (!isSafePublicId(reference)) throw missingOfferError();
  const payload = await apiClient<unknown>(
    `/customer/waiting-list/offers/${encodeURIComponent(reference)}`,
    { method: "GET", signal },
  );
  const view = adaptWaitingListOffer(payload);
  if (!view) throw missingOfferError();
  return view;
}

export function waitingListOfferQueryOptions(userId: string, reference: string) {
  return {
    queryKey: queryKeys.customer.waitingListOffer(userId, reference),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      fetchWaitingListOffer(reference, signal),
    enabled: Boolean(userId) && isSafePublicId(reference),
    staleTime: 0,
    refetchOnMount: "always" as const,
    refetchOnWindowFocus: true,
    retry: false,
  };
}

export async function acceptWaitingListOffer(
  reference: string,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<WaitingListAcceptOutcome> {
  if (!isSafePublicId(reference)) throw missingOfferError();
  const payload = await apiClient<unknown>(
    `/customer/waiting-list/offers/${encodeURIComponent(reference)}/accept`,
    {
      method: "POST",
      signal,
      headers: { "Idempotency-Key": idempotencyKey },
      body: {},
    },
  );
  return adaptWaitingListAcceptOutcome(payload);
}

export async function rejectWaitingListOffer(
  reference: string,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<WaitingListOfferView | WaitingListEntryView | null> {
  if (!isSafePublicId(reference)) throw missingOfferError();
  const payload = await apiClient<unknown>(
    `/customer/waiting-list/offers/${encodeURIComponent(reference)}/reject`,
    {
      method: "POST",
      signal,
      headers: { "Idempotency-Key": idempotencyKey },
      body: {},
    },
  );
  return adaptWaitingListOffer(payload) ?? adaptWaitingListEntry(payload);
}

export function invalidateWaitingListCaches(queryClient: QueryClient, userId?: string) {
  if (!userId) return;
  void queryClient.invalidateQueries({ queryKey: queryKeys.customer.waitingList(userId) });
  void queryClient.invalidateQueries({
    queryKey: queryKeys.customer.notificationUnreadCount(userId),
  });
  void queryClient.invalidateQueries({
    queryKey: queryKeys.customer.notifications(userId),
  });
}

export function invalidateAfterWaitingListAccept(
  queryClient: QueryClient,
  userId: string | undefined,
  outcome: WaitingListAcceptOutcome,
) {
  invalidateWaitingListCaches(queryClient, userId);
  // Appointments, dashboard, payments, and availability via booking confirmation cache.
  invalidateAfterBookingResult(queryClient, userId);
  if (outcome.outcome === "payment_required" && userId) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.customer.payments(userId) });
  }
}
