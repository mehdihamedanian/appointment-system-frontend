import { apiClient } from "@/lib/api/client";
import {
  isApiError,
  isSessionExpiredError,
  isUnauthorizedError,
} from "@/lib/api/errors";
import { adaptSessionPayload } from "@/lib/api/session-adapter";
import { queryKeys } from "@/lib/query/keys";
import type { QueryClient } from "@tanstack/react-query";
import type { ResolvedSession } from "@/types/session";

const SESSION_PATH = "/auth/session";
const LOGOUT_PATH = "/auth/logout";

export async function fetchSession(
  signal?: AbortSignal,
): Promise<ResolvedSession> {
  try {
    const payload = await apiClient<unknown>(SESSION_PATH, {
      method: "GET",
      signal,
    });
    return adaptSessionPayload(payload);
  } catch (error) {
    if (isApiError(error) && isUnauthorizedError(error)) {
      return {
        status: isSessionExpiredError(error) ? "expired" : "unauthenticated",
        user: null,
        requestId: error.requestId,
        message: error.message,
      };
    }

    return {
      status: "error",
      user: null,
      message: isApiError(error)
        ? error.message
        : "بررسی نشست با خطا روبه‌رو شد.",
    };
  }
}

export async function logoutRemote(): Promise<void> {
  try {
    await apiClient(LOGOUT_PATH, { method: "POST" });
  } catch {
    // Local cache is always cleared even if the Backend logout call fails.
  }
}

export function clearFrontendCaches(queryClient: QueryClient): void {
  queryClient.removeQueries({ queryKey: queryKeys.session });
  queryClient.clear();
}

export const sessionQueryOptions = {
  queryKey: queryKeys.session,
  queryFn: ({ signal }: { signal: AbortSignal }) => fetchSession(signal),
  staleTime: 60_000,
  retry: false,
};
