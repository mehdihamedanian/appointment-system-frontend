import { apiClient } from "@/lib/api/client";
import { ApiError, isNotFoundError, toAppApiError } from "@/lib/api/errors";
import {
  adaptReviewEligibility,
  adaptReviewSubmitResult,
} from "@/lib/customer/appointment-review-adapter";
import { isSafePublicId } from "@/lib/public/booking-href";
import { queryKeys } from "@/lib/query/keys";
import type {
  AppointmentReviewEligibilityView,
  AppointmentReviewSubmitInput,
  AppointmentReviewSubmitResult,
} from "@/types/appointment-review";

function missingReviewError(): ApiError {
  return new ApiError({
    status: 404,
    code: "REVIEW_NOT_AVAILABLE",
    message: "امکان ثبت نظر برای این نوبت در دسترس نیست.",
  });
}

export async function fetchAppointmentReviewEligibility(
  reference: string,
  signal?: AbortSignal,
): Promise<AppointmentReviewEligibilityView> {
  if (!isSafePublicId(reference)) throw missingReviewError();
  const payload = await apiClient<unknown>(
    `/customer/appointments/${encodeURIComponent(reference)}/review`,
    { method: "GET", signal },
  );
  const view = adaptReviewEligibility(payload);
  if (!view) throw missingReviewError();
  return view;
}

export function appointmentReviewQueryOptions(userId: string, reference: string) {
  return {
    queryKey: queryKeys.customer.appointmentReview(userId, reference),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      fetchAppointmentReviewEligibility(reference, signal),
    enabled: Boolean(userId) && isSafePublicId(reference),
    staleTime: 0,
    gcTime: 30_000,
    refetchOnMount: "always" as const,
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
    retry: false,
  };
}

export async function submitAppointmentReview(
  reference: string,
  input: AppointmentReviewSubmitInput,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<AppointmentReviewSubmitResult> {
  if (!isSafePublicId(reference)) throw missingReviewError();
  const payload = await apiClient<unknown>(
    `/customer/appointments/${encodeURIComponent(reference)}/review`,
    {
      method: "POST",
      signal,
      headers: { "Idempotency-Key": idempotencyKey },
      body: {
        rating: input.rating,
        comment: input.comment,
      },
    },
  );
  const result = adaptReviewSubmitResult(payload);
  if (!result) {
    throw new ApiError({
      status: 422,
      code: "REVIEW_RESULT_INVALID",
      message: "پاسخ ثبت نظر معتبر نیست.",
    });
  }
  return result;
}

export function isReviewEndpointDisconnected(error: unknown): boolean {
  const normalized = toAppApiError(error);
  return isNotFoundError(normalized) || normalized.status === 0;
}
