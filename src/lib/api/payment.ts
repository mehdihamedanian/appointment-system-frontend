import { apiClient } from "@/lib/api/client";
import { ApiError, isNotFoundError } from "@/lib/api/errors";
import { adaptPaymentSession } from "@/lib/payment/adapter";
import { isSafePublicId } from "@/lib/public/booking-href";
import { queryKeys } from "@/lib/query/keys";
import type { PaymentMethodType, PaymentSessionView } from "@/types/payment";

export type CreatePaymentSessionInput = {
  method: PaymentMethodType;
  holdReference?: string;
  quoteId?: string;
  couponCode?: string;
  bookingReference?: string;
};

export type CreatePaymentSessionResult =
  | { outcome: "created"; session: PaymentSessionView }
  | { outcome: "missing_endpoint" };

function missingPaymentError(): ApiError {
  return new ApiError({
    status: 404,
    code: "PAYMENT_NOT_FOUND",
    message: "پرداخت پیدا نشد.",
  });
}

export async function createPaymentSession(
  input: CreatePaymentSessionInput,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<CreatePaymentSessionResult> {
  try {
    const payload = await apiClient<unknown>("/customer/payments/sessions", {
      method: "POST",
      signal,
      headers: { "Idempotency-Key": idempotencyKey },
      body: {
        method: input.method,
        holdReference: input.holdReference,
        quoteId: input.quoteId,
        couponCode: input.couponCode,
        bookingReference: input.bookingReference,
      },
    });
    const session = adaptPaymentSession(payload);
    if (!session) {
      throw new ApiError({
        status: 422,
        code: "PAYMENT_INVALID_RESPONSE",
        message: "پاسخ پرداخت قابل استفاده نبود.",
      });
    }
    return { outcome: "created", session };
  } catch (error) {
    if (error instanceof ApiError && isNotFoundError(error)) {
      return { outcome: "missing_endpoint" };
    }
    throw error;
  }
}

/** The Backend verifies with the gateway on its signed callback; clients only read the intent. */
export async function fetchPaymentStatus(
  reference: string,
  signal?: AbortSignal,
): Promise<PaymentSessionView> {
  if (!isSafePublicId(reference)) {
    throw missingPaymentError();
  }
  const payload = await apiClient<unknown>(`/customer/payments/${reference}`, {
    method: "GET",
    signal,
  });
  const view = adaptPaymentSession(payload);
  if (!view) {
    throw missingPaymentError();
  }
  return view;
}

export function paymentStatusQueryOptions(reference: string) {
  return {
    queryKey: queryKeys.booking.payment(reference),
    queryFn: ({ signal }: { signal: AbortSignal }) => fetchPaymentStatus(reference, signal),
    enabled: isSafePublicId(reference),
    staleTime: 0,
    gcTime: 30_000,
    refetchOnMount: "always" as const,
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
    retry: false,
  };
}

export const paymentNavigation = {
  assign(url: string) {
    window.location.assign(url);
  },
};
