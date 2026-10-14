import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/config/env";
import {
  applyTokenCookies,
  backendFetch,
  backendUrl,
  callWithSession,
  clearSessionCookies,
  errorJson,
  forwardHeaders,
  readJson,
  readTokenSet,
  relayResponse,
  SESSION_COOKIE,
  type SessionCallResult,
} from "@/lib/server/backend-session";
import { isRecord } from "@/lib/utilities/records";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ path: string[] }> };

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
// Token rotation is owned by this layer; the browser never handles tokens.
const BLOCKED_PATHS = new Set(["auth/refresh"]);
// Segments arrive decoded; the Backend decodes "%2F" again when routing, so a
// segment like "auth%2Frefresh" would otherwise reach a blocked or intercepted route.
const UNSAFE_SEGMENT = /[/\\%\u0000-\u001f\u007f]/;

function hostOf(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  try {
    return new URL(value).host;
  } catch {
    return null;
  }
}

function isSameOrigin(request: NextRequest): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") {
    return false;
  }
  const origin = request.headers.get("origin");
  if (!origin) {
    return true;
  }
  const originHost = hostOf(origin);
  return (
    originHost !== null &&
    (originHost === request.headers.get("host") || originHost === hostOf(env.siteUrl))
  );
}

function backendUnavailable(): NextResponse {
  return errorJson(503, "BACKEND_UNAVAILABLE", "سرویس در دسترس نیست. لطفاً دوباره تلاش کنید.");
}

async function login(request: NextRequest): Promise<NextResponse> {
  let upstream: Response;
  try {
    upstream = await backendFetch(backendUrl("auth/login"), {
      method: "POST",
      headers: forwardHeaders(request),
      body: await request.text(),
    });
  } catch {
    return backendUnavailable();
  }
  if (!upstream.ok) {
    return relayResponse(upstream);
  }

  const tokens = readTokenSet(await readJson(upstream));
  if (!tokens) {
    return backendUnavailable();
  }
  const response = NextResponse.json({ success: true, data: { user: tokens.user } });
  applyTokenCookies(response, tokens);
  return response;
}

async function logout(request: NextRequest): Promise<NextResponse> {
  const refreshToken = request.cookies.get(SESSION_COOKIE)?.value;
  if (refreshToken) {
    const headers = forwardHeaders(request);
    headers.set("content-type", "application/json");
    try {
      await backendFetch(backendUrl("auth/logout"), {
        method: "POST",
        headers,
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
    } catch {
      // Cookies are cleared regardless; the Backend session expires on its own.
    }
  }
  const response = NextResponse.json({
    success: true,
    data: { message: "Logged out successfully." },
  });
  clearSessionCookies(response);
  return response;
}

function finalize(result: SessionCallResult, response: NextResponse): NextResponse {
  if (result.upstream?.status === 401 && result.hadSession) {
    clearSessionCookies(response);
  } else if (result.rotated) {
    applyTokenCookies(response, result.rotated);
  }
  return response;
}

async function session(request: NextRequest): Promise<NextResponse> {
  let result: SessionCallResult;
  try {
    result = await callWithSession(request, async (accessToken) =>
      accessToken
        ? backendFetch(backendUrl("auth/me"), {
            method: "GET",
            headers: forwardHeaders(request, accessToken),
          })
        : null,
    );
  } catch {
    return backendUnavailable();
  }

  if (result.unavailable) {
    return backendUnavailable();
  }
  if (!result.upstream) {
    const response = result.hadSession
      ? errorJson(401, "SESSION_EXPIRED", "نشست شما منقضی شده است.")
      : errorJson(401, "AUTHENTICATION_REQUIRED", "Authentication required.");
    if (result.hadSession) {
      clearSessionCookies(response);
    }
    return response;
  }
  if (result.upstream.status === 401) {
    return finalize(
      result,
      result.hadSession
        ? errorJson(401, "SESSION_EXPIRED", "نشست شما منقضی شده است.")
        : errorJson(401, "AUTHENTICATION_REQUIRED", "Authentication required."),
    );
  }
  if (!result.upstream.ok) {
    return finalize(result, await relayResponse(result.upstream));
  }

  const payload = await readJson(result.upstream);
  const user = isRecord(payload) ? payload.data : null;
  return finalize(result, NextResponse.json({ success: true, data: { user } }));
}

async function passthrough(request: NextRequest, path: string): Promise<NextResponse> {
  const method = request.method;
  const body = SAFE_METHODS.has(method) ? undefined : await request.arrayBuffer();
  const url = backendUrl(path, request.nextUrl.search);

  let result: SessionCallResult;
  try {
    result = await callWithSession(request, (accessToken) =>
      backendFetch(url, {
        method,
        headers: forwardHeaders(request, accessToken),
        body,
      }),
    );
  } catch {
    return backendUnavailable();
  }
  if (result.unavailable || !result.upstream) {
    return backendUnavailable();
  }
  return finalize(result, await relayResponse(result.upstream));
}

async function dispatch(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const { path: segments } = await context.params;
  if (
    segments.some(
      (segment) => segment === "." || segment === ".." || segment === "" || UNSAFE_SEGMENT.test(segment),
    )
  ) {
    return errorJson(404, "NOT_FOUND", "Not found.");
  }
  const path = segments.map(encodeURIComponent).join("/");
  const method = request.method;

  if (!SAFE_METHODS.has(method) && !isSameOrigin(request)) {
    return errorJson(403, "ORIGIN_NOT_ALLOWED", "Cross-origin request rejected.");
  }
  if (path === "auth/login" && method === "POST") {
    return login(request);
  }
  if (path === "auth/session" && method === "GET") {
    return session(request);
  }
  if (path === "auth/logout" && method === "POST") {
    return logout(request);
  }
  if (BLOCKED_PATHS.has(path)) {
    return errorJson(404, "NOT_FOUND", "Not found.");
  }
  return passthrough(request, path);
}

async function handle(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const response = await dispatch(request, context);
  // Responses are per-session; no browser or intermediary cache may store them.
  response.headers.set("cache-control", "private, no-store");
  return response;
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
