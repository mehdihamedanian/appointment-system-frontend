import { env } from "@/config/env";
import { rewriteBackendRequest } from "@/lib/api/backend-contract";
import {
  ApiError,
  isUnauthorizedError,
  normalizeHttpError,
  normalizeNetworkError,
} from "@/lib/api/errors";
import { notifyUnauthorized } from "@/lib/api/unauthorized";
import { recordServerDateHeader } from "@/lib/date-time/server-clock";
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

// Browser requests go through the same-origin session layer
// (src/app/api/backend), which holds the httpOnly session cookies.
const BROWSER_API_BASE_PATH = "/api/backend";

function resolveApiBaseUrl(): string {
  return typeof window === "undefined" ? env.apiBaseUrl : BROWSER_API_BASE_PATH;
}

async function getServerAuthorization(): Promise<string | undefined> {
  if (typeof window !== "undefined") {
    return undefined;
  }

  try {
    const { cookies } = await import("next/headers");
    const store = await cookies();
    const accessToken = store.get(`${env.sessionCookieName || "session"}_access`)?.value;
    return accessToken ? `Bearer ${accessToken}` : undefined;
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
  authorization?: string,
): Headers {
  const headers = new Headers(options.headers);
  headers.set("Accept", headers.get("Accept") ?? DEFAULT_ACCEPT);

  const hasBody = options.body !== undefined && options.method !== "GET";
  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;
  if (hasBody && !headers.has("Content-Type") && !isFormData) {
    headers.set("Content-Type", DEFAULT_CONTENT_TYPE);
  }

  if (authorization && !headers.has("Authorization")) {
    headers.set("Authorization", authorization);
  }

  return headers;
}

export async function apiClient<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const baseUrl = resolveApiBaseUrl();
  if (!baseUrl) {
    throw new ApiError({
      status: 0,
      code: "MISSING_API_BASE_URL",
      message: "آدرس سرویس عمومی پیکربندی نشده است.",
    });
  }

  const method = options.method ?? (options.body !== undefined ? "POST" : "GET");
  const rewritten = rewriteBackendRequest({
    path,
    query: options.query,
    method,
    body: options.body,
  });
  const url = appendQuery(joinUrl(baseUrl, rewritten.path), rewritten.query);
  const authorization = await getServerAuthorization();
  const headers = buildHeaders({ ...options, method }, authorization);
  const timeoutMs = options.timeoutMs ?? env.requestTimeoutMs;
  const signal = mergeSignals(timeoutMs, options.signal);

  const outgoingBody = rewritten.body;
  const requestBody =
    outgoingBody === undefined || method === "GET"
      ? undefined
      : typeof FormData !== "undefined" && outgoingBody instanceof FormData
        ? outgoingBody
        : JSON.stringify(outgoingBody);

  let response: Response;
  const sentAt = Date.now();
  try {
    response = await fetch(url, {
      method,
      headers,
      body: requestBody,
      credentials: options.credentials ?? "include",
      signal,
      cache: "no-store",
    });
  } catch (error) {
    throw new ApiError(normalizeNetworkError(error));
  }
  if (typeof window !== "undefined") {
    recordServerDateHeader(response.headers?.get("date"), sentAt, Date.now());
  }

  const body = await parseResponseBody(response);

  if (!response.ok) {
    const error = new ApiError(
      normalizeHttpError(response.status, body, response.headers),
    );
    if (isUnauthorizedError(error) && options.notifyUnauthorized !== false) {
      notifyUnauthorized(error);
    }
    throw error;
  }

  return body as T;
}
