import { apiClient } from "@/lib/api/client";
import { ApiError, isNotFoundError, toAppApiError } from "@/lib/api/errors";
import {
  adaptCancellationPreview,
  adaptCancellationResult,
} from "@/lib/customer/appointment-cancellation-adapter";
import { isSafePublicId } from "@/lib/public/booking-href";
import { queryKeys } from "@/lib/query/keys";
import type {
  CancellationPreviewView,
  CancellationResultView,
} from "@/types/appointment-cancellation";

export async function fetchCancellationPreview(
  reference: string,
  signal?: AbortSignal,
): Promise<CancellationPreviewView> {
  const payload = await apiClient<unknown>(
    `/customer/appointments/${encodeURIComponent(reference)}/cancellation-preview`,
    {
      method: "GET",
      signal,
    },
  );
  const view = adaptCancellationPreview(payload);
  if (!view) {
    throw new ApiError({
      status: 404,
      code: "CANCELLATION_PREVIEW_NOT_FOUND",
      message: "پیش‌نمایش لغو در دسترس نیست.",
    });
  }
  return view;
}

export async function submitAppointmentCancellation(
  reference: string,
  input: {
    reasonCode?: string;
    reasonText?: string;
    previewVersion?: string;
  },
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<CancellationResultView> {
  const payload = await apiClient<unknown>(
    `/customer/appointments/${encodeURIComponent(reference)}/cancellation`,
    {
      method: "POST",
      signal,
      headers: { "Idempotency-Key": idempotencyKey },
      body: {
        reasonCode: input.reasonCode,
        reasonText: input.reasonText,
        previewVersion: input.previewVersion,
      },
    },
  );
  const result = adaptCancellationResult(payload);
  if (!result) {
    throw new ApiError({
      status: 422,
      code: "CANCELLATION_RESULT_INVALID",
      message: "پاسخ لغو نوبت معتبر نیست.",
    });
  }
  return result;
}

export function cancellationPreviewQueryOptions(userId: string, reference: string) {
  return {
    queryKey: queryKeys.customer.appointmentCancellationPreview(userId, reference),
    queryFn: ({ signal }: { signal: AbortSignal }) => fetchCancellationPreview(reference, signal),
    enabled: Boolean(userId) && isSafePublicId(reference),
    staleTime: 0,
    gcTime: 30_000,
    refetchOnMount: "always" as const,
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
    retry: false,
  };
}

export function isCancellationPreviewDisconnected(error: unknown): boolean {
  const normalized = toAppApiError(error);
  return isNotFoundError(normalized) || normalized.status === 0;
}
