import { apiClient } from "@/lib/api/client";
import { ApiError, isNotFoundError } from "@/lib/api/errors";
import { quoteRequestBody } from "@/lib/api/booking";
import { adaptSlotHold } from "@/lib/booking/hold-adapter";
import { isSafePublicId } from "@/lib/public/booking-href";
import { queryKeys } from "@/lib/query/keys";
import type { BookingDraft } from "@/types/booking";
import type { SlotHoldView } from "@/types/hold";

export type CreateSlotHoldResult =
  | { outcome: "created"; hold: SlotHoldView }
  | { outcome: "missing_endpoint" }
  | { outcome: "missing_expires_at"; hold: SlotHoldView };

export type StartHoldPaymentResult =
  | { outcome: "started"; paymentContextId?: string }
  | { outcome: "missing_endpoint" };

function missingHoldError(): ApiError {
  return new ApiError({
    status: 404,
    code: "HOLD_NOT_FOUND",
    message: "رزرو موقت پیدا نشد.",
  });
}

export async function createSlotHold(
  draft: BookingDraft,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<CreateSlotHoldResult> {
  try {
    const payload = await apiClient<unknown>("/customer/bookings/holds", {
      method: "POST",
      signal,
      headers: { "Idempotency-Key": idempotencyKey },
      body: {
        ...quoteRequestBody(draft),
        quoteId: draft.quoteId,
      },
    });
    const hold = adaptSlotHold(payload);
    if (!hold) {
      throw new ApiError({
        status: 422,
        code: "HOLD_INVALID_RESPONSE",
        message: "پاسخ رزرو موقت قابل استفاده نبود.",
      });
    }
    if (!hold.expiresAt) {
      return { outcome: "missing_expires_at", hold };
    }
    return { outcome: "created", hold };
  } catch (error) {
    if (error instanceof ApiError && isNotFoundError(error)) {
      return { outcome: "missing_endpoint" };
    }
    throw error;
  }
}

export async function fetchSlotHold(reference: string, signal?: AbortSignal): Promise<SlotHoldView> {
  if (!isSafePublicId(reference)) {
    throw missingHoldError();
  }
  const payload = await apiClient<unknown>(`/customer/bookings/holds/${reference}`, {
    method: "GET",
    signal,
  });
  const hold = adaptSlotHold(payload);
  if (!hold) {
    throw missingHoldError();
  }
  return hold;
}

export async function startHoldPayment(
  holdReference: string,
  signal?: AbortSignal,
): Promise<StartHoldPaymentResult> {
  if (!isSafePublicId(holdReference)) {
    throw missingHoldError();
  }
  try {
    const payload = await apiClient<unknown>("/customer/payments/sessions", {
      method: "POST",
      signal,
      headers: { "Idempotency-Key": `pay_${holdReference}` },
      body: { holdReference },
    });
    const hold = adaptSlotHold(payload);
    return { outcome: "started", paymentContextId: hold?.paymentContextId };
  } catch (error) {
    if (error instanceof ApiError && isNotFoundError(error)) {
      return { outcome: "missing_endpoint" };
    }
    throw error;
  }
}

export function slotHoldQueryOptions(reference: string) {
  return {
    queryKey: queryKeys.booking.hold(reference),
    queryFn: ({ signal }: { signal: AbortSignal }) => fetchSlotHold(reference, signal),
    enabled: isSafePublicId(reference),
    staleTime: 0,
    gcTime: 30_000,
    refetchOnMount: "always" as const,
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
    retry: false,
  };
}
