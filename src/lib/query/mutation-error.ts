import { isUnauthorizedError, toAppApiError } from "@/lib/api/errors";
import { toast } from "@/components/feedback/toast";

export function handleMutationError(error: unknown): void {
  const normalized = toAppApiError(error);

  if (isUnauthorizedError(normalized)) {
    return;
  }

  toast.error(normalized.message);
}
