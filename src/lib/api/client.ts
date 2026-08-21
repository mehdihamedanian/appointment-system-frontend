import { env } from "@/config/env";
import {
  ApiError,
  isUnauthorizedError,
  normalizeHttpError,
  normalizeNetworkError,
} from "@/lib/api/errors";
import { notifyUnauthorized } from "@/lib/api/unauthorized";
import type { ApiQueryValue, ApiRequestOptions } from "@/types/api";

const DEFAULT_ACCEPT = "application/json";
const DEFAULT_CONTENT_TYPE = "application/json";

function joinUrl(baseUrl: string, path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl.replace(/\/+$/, "")}${normalizedPath}`;
}

function appendQuery(url: string, query?: Record<string, ApiQueryValue>): string {
  if (!query) {
    return url;
  }

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined || value === "") {
      continue;
    }
    params.set(key, String(value));
  }

  const serialized = params.toString();
  return serialized ? `${url}?${serialized}` : url;
}

function mergeSignals(timeoutMs: number, userSignal?: AbortSignal): AbortSignal {
  const timeoutSignal =
    typeof AbortSignal.timeout === "function"
      ? AbortSignal.timeout(timeoutMs)
      : createTimeoutSignal(timeoutMs);

  if (!userSignal) {
    return timeoutSignal;
  }

  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any([timeoutSignal, userSignal]);
  }

  return combineSignals(timeoutSignal, userSignal);
}

function createTimeoutSignal(timeoutMs: number): AbortSignal {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(new DOMException("The operation timed out.", "TimeoutError"));
  }, timeoutMs);

  controller.signal.addEventListener(
    "abort",
    () => {
      clearTimeout(timeoutId);
    },
    { once: true },
  );

  return controller.signal;
}

function combineSignals(left: AbortSignal, right: AbortSignal): AbortSignal {
  const controller = new AbortController();
  const abort = () => {
    controller.abort(left.reason ?? right.reason);
  };

  if (left.aborted || right.aborted) {
    abort();
    return controller.signal;
  }

  left.addEventListener("abort", abort, { once: true });
  right.addEventListener("abort", abort, { once: true });
  return controller.signal;
}

async function getCookieHeader(): Promise<string | undefined> {
  if (typeof window !== "undefined") {
    return undefined;
  }

  try {
    const { cookies } = await import("next/headers");
    const store = await cookies();
    const serialized = store.toString();
    return serialized.length > 0 ? serialized : undefined;
  } catch {
    return undefined;
  }
}

async function parseResponseBody(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get("content-type") ?? "";
  const raw = await response.text();

  if (!raw) {
    return null;
  }

  if (contentType.includes("application/json") || raw.startsWith("{") || raw.startsWith("[")) {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  return raw;
}

function buildHeaders(
  options: ApiRequestOptions,
  cookieHeader?: string,
): Headers {
  const headers = new Headers(options.headers);
  headers.set("Accept", headers.get("Accept") ?? DEFAULT_ACCEPT);

  const hasBody = options.body !== undefined && options.method !== "GET";
  if (hasBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", DEFAULT_CONTENT_TYPE);
  }

  if (cookieHeader && !headers.has("Cookie")) {
    headers.set("Cookie", cookieHeader);
  }

  return headers;
}

export async function apiClient<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  if (!env.apiBaseUrl) {
    throw new ApiError({
      status: 0,
      code: "MISSING_API_BASE_URL",
      message: "آدرس سرویس عمومی پیکربندی نشده است.",
    });
  }

  const method = options.method ?? (options.body !== undefined ? "POST" : "GET");
  const url = appendQuery(joinUrl(env.apiBaseUrl, path), options.query);
  const cookieHeader = await getCookieHeader();
  const headers = buildHeaders({ ...options, method }, cookieHeader);
  const timeoutMs = options.timeoutMs ?? env.requestTimeoutMs;
  const signal = mergeSignals(timeoutMs, options.signal);

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body:
        options.body === undefined || method === "GET"
          ? undefined
          : JSON.stringify(options.body),
      credentials: options.credentials ?? "include",
      signal,
      cache: "no-store",
    });
  } catch (error) {
    throw new ApiError(normalizeNetworkError(error));
  }

  const body = await parseResponseBody(response);

  if (!response.ok) {
    const error = new ApiError(
      normalizeHttpError(response.status, body, response.headers),
    );
    if (isUnauthorizedError(error)) {
      notifyUnauthorized(error);
    }
    throw error;
  }

  return body as T;
}
