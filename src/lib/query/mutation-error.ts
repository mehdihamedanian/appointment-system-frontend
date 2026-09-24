import {
  classifyApiError,
  isNonIdempotentMutationPath,
} from "@/lib/api/error-ui";
import { isUnauthorizedError, toAppApiError } from "@/lib/api/errors";
import { toast } from "@/components/feedback/toast";

/**
 * Mutation toast helper: skips unauthorized (session flow handles it),
 * never suggests retry for non-idempotent paths, soft-dedupes via toast id.
 */
export function handleMutationError(
  error: unknown,
  options?: { path?: string; toastId?: string },
): void {
  const normalized = toAppApiError(error);

  if (isUnauthorizedError(normalized)) {
    return;
  }

  const classified = classifyApiError(normalized);
  const path = options?.path ?? "";
  const financialOrBooking = path ? isNonIdempotentMutationPath(path) : false;
  const message =
    financialOrBooking && classified.kind === "network"
      ? "نتیجه درخواست مشخص نیست. لطفاً وضعیت را بررسی کنید و دوباره ارسال نکنید مگر با اطمینان."
      : classified.description || normalized.message;

  toast.error(message, {
    id: options?.toastId ?? `mutation-error:${classified.kind}:${message}`,
  });
}
