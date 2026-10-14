import { describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/errors";
import {
  MAX_QUERY_RETRIES,
  boundedPollInterval,
  keepPreviousPage,
  queryRetryDelay,
  shouldRetryQuery,
} from "@/lib/query/policies";
import { createQueryClient } from "@/lib/query/client";

function apiError(status: number, code?: string) {
  return new ApiError({ status, code, message: "x" });
}

describe("bounded polling", () => {
  const interval = boundedPollInterval<{ status: string }>((data) => data.status === "pending", {
    intervalMs: 3_000,
    maxPolls: 3,
  });
  const state = (data: { status: string } | undefined, dataUpdateCount: number, status = "success") => ({
    state: { data, status, dataUpdateCount },
  });

  it("polls only while the Backend reports a non-terminal state", () => {
    expect(interval(state({ status: "pending" }, 1))).toBe(3_000);
    expect(interval(state({ status: "paid" }, 1))).toBe(false);
    expect(interval(state(undefined, 0))).toBe(false);
  });

  it("stops after the poll budget and on errors", () => {
    expect(interval(state({ status: "pending" }, 3))).toBe(false);
    expect(interval(state({ status: "pending" }, 1, "error"))).toBe(false);
  });
});

describe("query retry policy", () => {
  it("retries transport and gateway failures a bounded number of times", () => {
    for (const status of [0, 408, 502, 503, 504]) {
      expect(shouldRetryQuery(0, apiError(status))).toBe(true);
      expect(shouldRetryQuery(MAX_QUERY_RETRIES, apiError(status))).toBe(false);
    }
  });

  it("never retries client errors, conflicts, rate limits, or deterministic server errors", () => {
    for (const status of [400, 401, 403, 404, 409, 410, 422, 429, 500]) {
      expect(shouldRetryQuery(0, apiError(status))).toBe(false);
    }
  });

  it("does not retry missing configuration or non-transport errors", () => {
    expect(shouldRetryQuery(0, apiError(0, "MISSING_API_BASE_URL"))).toBe(false);
    expect(shouldRetryQuery(0, new TypeError("adapter bug"))).toBe(false);
  });

  it("backs off with a cap", () => {
    expect(queryRetryDelay(0)).toBe(1_000);
    expect(queryRetryDelay(1)).toBe(2_000);
    expect(queryRetryDelay(10)).toBe(8_000);
  });

  it("is the app default and mutations never retry", () => {
    const client = createQueryClient();
    const defaults = client.getDefaultOptions();
    expect(defaults.queries?.retry).toBe(shouldRetryQuery);
    expect(defaults.mutations?.retry).toBe(false);
  });
});

describe("keepPreviousPage", () => {
  it("keeps the previous page only when the key differs by page", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const page1 = ["admin", "appointments", "u1", "list", "confirmed", 1] as const;
    await client.prefetchQuery({ queryKey: page1, queryFn: () => ({ rows: ["a"] }) });
    const previous = client.getQueryCache().find({ queryKey: page1 });

    const page2 = ["admin", "appointments", "u1", "list", "confirmed", 2] as const;
    const otherFilter = ["admin", "appointments", "u1", "list", "cancelled", 1] as const;

    expect(keepPreviousPage(page2, [5])({ rows: ["a"] }, previous as never)).toEqual({
      rows: ["a"],
    });
    expect(keepPreviousPage(otherFilter, [5])({ rows: ["a"] }, previous as never)).toBeUndefined();
    expect(keepPreviousPage(page2, [5])(undefined, undefined)).toBeUndefined();
  });
});
