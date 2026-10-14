import type { Query, QueryKey } from "@tanstack/react-query";
import { isApiError, toAppApiError } from "@/lib/api/errors";
import { isRecord } from "@/lib/utilities/records";

/** Bounded so a down backend never produces an endless retry loop. */
export const MAX_QUERY_RETRIES = 2;

const RETRYABLE_STATUSES = new Set([0, 408, 502, 503, 504]);
const NON_RETRYABLE_CODES = new Set(["MISSING_API_BASE_URL", "PUBLIC_BUSINESS_UNAVAILABLE"]);

/**
 * Reads only: network loss, timeouts, and transient gateway failures.
 * Never 4xx (including 401/403/404/409/422/429) and never 500, which is a deterministic Backend failure.
 */
export function isRetryableQueryError(error: unknown): boolean {
  // Adapter or programming errors are not transport failures.
  if (!isApiError(error) && !(isRecord(error) && typeof error.status === "number")) {
    return false;
  }
  const normalized = toAppApiError(error);
  const code = normalized.code?.toUpperCase() ?? "";
  if (NON_RETRYABLE_CODES.has(code)) {
    return false;
  }
  return RETRYABLE_STATUSES.has(normalized.status);
}

export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  return failureCount < MAX_QUERY_RETRIES && isRetryableQueryError(error);
}

export function queryRetryDelay(attempt: number): number {
  return Math.min(1_000 * 2 ** attempt, 8_000);
}

/**
 * Cache presets by data volatility. `retry: false` keeps a failed read visible as an error
 * instead of silently re-firing; callers that want transient retries omit `retry`.
 */
export const cachePolicy = {
  /** Holds, payment intents, confirmations: always read the Backend's latest state. */
  live: {
    staleTime: 0,
    gcTime: 30_000,
    refetchOnMount: "always" as const,
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
    retry: false,
  },
  /** Bookable dates and slots go stale quickly; never reused across screens for long. */
  availability: {
    staleTime: 10_000,
    gcTime: 60_000,
    refetchOnMount: "always" as const,
    refetchOnReconnect: true,
    refetchOnWindowFocus: false,
    retry: false,
  },
  /** Single records the user may act on. */
  detail: {
    staleTime: 0,
    gcTime: 30_000,
    refetchOnMount: "always" as const,
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
    retry: false,
  },
  /** Paginated or filtered collections. */
  list: {
    staleTime: 15_000,
    gcTime: 5 * 60_000,
    refetchOnMount: "always" as const,
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
    retry: false,
  },
  /** Catalog, settings, and other slowly changing reference data. */
  reference: {
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnReconnect: true,
    refetchOnWindowFocus: false,
  },
} as const;

export type BoundedPollOptions = {
  intervalMs: number;
  /** Total successful fetches (initial load included) after which polling stops. */
  maxPolls: number;
};

/** Pending payment results: ~1 minute of checks; the manual "check again" action remains after. */
export const PAYMENT_STATUS_POLL: BoundedPollOptions = { intervalMs: 3_000, maxPolls: 20 };
/** Unread in-app notification badge: ~30 minutes of foreground checks; focus refetch continues after. */
export const UNREAD_COUNT_POLL: BoundedPollOptions = { intervalMs: 60_000, maxPolls: 30 };
/** Admin calendar: bookings made elsewhere appear within a minute for ~30 foreground minutes. */
export const OPERATIONAL_VIEW_POLL: BoundedPollOptions = { intervalMs: 60_000, maxPolls: 30 };
/** Server-side export jobs: ~5 minutes of checks. */
export const EXPORT_JOB_POLL: BoundedPollOptions = { intervalMs: 2_000, maxPolls: 150 };

type PollableQuery<TData> = {
  state: { data?: TData; status: string; dataUpdateCount: number };
};

/**
 * `refetchInterval` that polls only while the Backend reports a non-terminal state, stops after a
 * fixed number of fetches or on any error, and (TanStack default) pauses in background tabs.
 */
export function boundedPollInterval<TData>(
  isPending: (data: TData) => boolean,
  { intervalMs, maxPolls }: BoundedPollOptions,
) {
  return (query: PollableQuery<TData>): number | false => {
    const { data, status, dataUpdateCount } = query.state;
    if (status === "error" || data === undefined || dataUpdateCount >= maxPolls) {
      return false;
    }
    return isPending(data) ? intervalMs : false;
  };
}

function sameKeyExcept(a: QueryKey, b: QueryKey, ignored: ReadonlySet<number>): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return a.every(
    (part, index) => ignored.has(index) || JSON.stringify(part) === JSON.stringify(b[index]),
  );
}

/**
 * `placeholderData` for paginated lists: keeps the previous page on screen while the next page
 * loads, but only when the key differs by the page parts. Changing a filter or category shows
 * a loading state rather than rows from a different result set.
 */
export function keepPreviousPage<TData>(queryKey: QueryKey, pageIndexes: readonly number[]) {
  const ignored = new Set(pageIndexes);
  return (
    previousData: TData | undefined,
    previousQuery: Query<TData, Error, TData, QueryKey> | undefined,
  ): TData | undefined =>
    previousQuery && sameKeyExcept(previousQuery.queryKey, queryKey, ignored)
      ? previousData
      : undefined;
}
