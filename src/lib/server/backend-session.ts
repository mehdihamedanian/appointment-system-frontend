import { isIP } from "node:net";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/config/env";
import { isRecord, readString } from "@/lib/utilities/records";

/**
 * Server-only session layer between the browser and the bearer-token Backend.
 * The refresh token lives in the long-lived session cookie (the one `proxy.ts`
 * checks), the access token in a short-lived companion cookie. Both are
 * httpOnly, so tokens are never readable by browser JavaScript.
 */
export const SESSION_COOKIE = env.sessionCookieName || "session";
export const ACCESS_COOKIE = `${SESSION_COOKIE}_access`;

const SESSION_MAX_AGE_SECONDS = (() => {
  const parsed = Number.parseInt(process.env.SESSION_MAX_AGE_SECONDS ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30 * 24 * 60 * 60;
})();
const ACCESS_EXPIRY_SKEW_SECONDS = 30;
// Requests already in flight with the pre-rotation refresh token must reuse the
// rotated result: presenting a rotated token again makes the Backend revoke the
// whole session family.
const ROTATION_GRACE_MS = 30_000;

const FORWARDED_REQUEST_HEADERS = [
  "accept",
  "accept-language",
  "content-type",
  "idempotency-key",
  "user-agent",
  "x-request-id",
] as const;

const RELAYED_RESPONSE_HEADERS = [
  "content-disposition",
  "content-type",
  "retry-after",
  "x-request-id",
] as const;

export type TokenSet = {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: string;
  user: unknown;
};

type RefreshOutcome =
  | { kind: "ok"; tokens: TokenSet }
  | { kind: "rejected" }
  | { kind: "unavailable" };

const refreshFlights = new Map<
  string,
  { promise: Promise<RefreshOutcome>; settledAt?: number }
>();

export function backendUrl(path: string, search = ""): string {
  return `${env.apiBaseUrl.replace(/\/+$/, "")}/${path}${search}`;
}

/**
 * `TRUSTED_CLIENT_IP_HEADER` names a single-valued header (e.g. `x-real-ip`) that the ingress in
 * front of this server always overwrites with the connecting client's IP. Unset, no client IP is
 * forwarded and the Backend sees this server's address for every user. Any other header carrying
 * a client IP is client-controlled and is never trusted.
 */
export function trustedClientIp(request: NextRequest): string | undefined {
  const headerName = process.env.TRUSTED_CLIENT_IP_HEADER?.trim().toLowerCase();
  if (!headerName) {
    return undefined;
  }
  const value = request.headers.get(headerName)?.trim();
  return value && isIP(value) ? value : undefined;
}

export function forwardHeaders(request: NextRequest, accessToken?: string): Headers {
  const headers = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) {
      headers.set(name, value);
    }
  }
  const clientIp = trustedClientIp(request);
  if (clientIp) {
    // Honoured by the Backend only when this server's address is in its TRUSTED_PROXY_IPS.
    headers.set("x-forwarded-for", clientIp);
  }
  if (accessToken) {
    headers.set("authorization", `Bearer ${accessToken}`);
  }
  return headers;
}

export function backendFetch(url: string, init: RequestInit): Promise<Response> {
  return fetch(url, {
    ...init,
    cache: "no-store",
    redirect: "manual",
    signal: AbortSignal.timeout(env.requestTimeoutMs),
  });
}

export async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export function readTokenSet(payload: unknown): TokenSet | null {
  const data = isRecord(payload) && isRecord(payload.data) ? payload.data : null;
  if (!data) {
    return null;
  }
  const accessToken = readString(data.access_token);
  const refreshToken = readString(data.refresh_token);
  const accessExpiresAt = readString(data.access_token_expires_at);
  if (!accessToken || !refreshToken || !accessExpiresAt) {
    return null;
  }
  return { accessToken, refreshToken, accessExpiresAt, user: data.user };
}

function cookieBase() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

export function applyTokenCookies(response: NextResponse, tokens: TokenSet): void {
  const expiresMs = Date.parse(tokens.accessExpiresAt);
  const accessMaxAge = Number.isNaN(expiresMs)
    ? 60
    : Math.max(0, Math.floor((expiresMs - Date.now()) / 1000) - ACCESS_EXPIRY_SKEW_SECONDS);
  response.cookies.set(ACCESS_COOKIE, tokens.accessToken, {
    ...cookieBase(),
    maxAge: accessMaxAge,
  });
  response.cookies.set(SESSION_COOKIE, tokens.refreshToken, {
    ...cookieBase(),
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export function clearSessionCookies(response: NextResponse): void {
  response.cookies.set(ACCESS_COOKIE, "", { ...cookieBase(), maxAge: 0 });
  response.cookies.set(SESSION_COOKIE, "", { ...cookieBase(), maxAge: 0 });
}

export function errorJson(status: number, code: string, message: string): NextResponse {
  return NextResponse.json(
    { success: false, code, message, error: { code, message, details: [] } },
    { status },
  );
}

export async function relayResponse(upstream: Response): Promise<NextResponse> {
  const headers = new Headers();
  for (const name of RELAYED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) {
      headers.set(name, value);
    }
  }
  const body = upstream.status === 204 ? null : await upstream.arrayBuffer();
  return new NextResponse(body, { status: upstream.status, headers });
}

async function performRefresh(request: NextRequest, refreshToken: string): Promise<RefreshOutcome> {
  try {
    const headers = forwardHeaders(request);
    headers.set("content-type", "application/json");
    const upstream = await backendFetch(backendUrl("auth/refresh"), {
      method: "POST",
      headers,
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (upstream.status >= 500) {
      return { kind: "unavailable" };
    }
    if (!upstream.ok) {
      return { kind: "rejected" };
    }
    const tokens = readTokenSet(await readJson(upstream));
    return tokens ? { kind: "ok", tokens } : { kind: "unavailable" };
  } catch {
    return { kind: "unavailable" };
  }
}

export function refreshSession(request: NextRequest, refreshToken: string): Promise<RefreshOutcome> {
  const now = Date.now();
  for (const [key, flight] of refreshFlights) {
    if (flight.settledAt !== undefined && now - flight.settledAt > ROTATION_GRACE_MS) {
      refreshFlights.delete(key);
    }
  }

  const existing = refreshFlights.get(refreshToken);
  if (existing) {
    return existing.promise;
  }

  const flight: { promise: Promise<RefreshOutcome>; settledAt?: number } = {
    promise: performRefresh(request, refreshToken).then((outcome) => {
      if (outcome.kind === "unavailable") {
        refreshFlights.delete(refreshToken);
      } else {
        flight.settledAt = Date.now();
      }
      return outcome;
    }),
  };
  refreshFlights.set(refreshToken, flight);
  return flight.promise;
}

export type SessionCallResult = {
  upstream: Response | null;
  rotated: TokenSet | null;
  hadSession: boolean;
  unavailable: boolean;
};

/**
 * Runs `call` with the current access token, refreshing at most once when the
 * access cookie has lapsed or the Backend rejects it.
 */
export async function callWithSession(
  request: NextRequest,
  call: (accessToken: string | undefined) => Promise<Response | null>,
): Promise<SessionCallResult> {
  const refreshToken = request.cookies.get(SESSION_COOKIE)?.value;
  let accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  const hadSession = Boolean(refreshToken || accessToken);
  let rotated: TokenSet | null = null;
  let refreshAttempted = false;

  const tryRefresh = async (): Promise<"ok" | "rejected" | "unavailable"> => {
    refreshAttempted = true;
    if (!refreshToken) {
      return "rejected";
    }
    const outcome = await refreshSession(request, refreshToken);
    if (outcome.kind === "ok") {
      rotated = outcome.tokens;
      accessToken = outcome.tokens.accessToken;
    }
    return outcome.kind;
  };

  if (!accessToken && refreshToken) {
    if ((await tryRefresh()) === "unavailable") {
      return { upstream: null, rotated, hadSession, unavailable: true };
    }
  }

  let upstream = await call(accessToken);
  if (upstream?.status === 401 && refreshToken && !refreshAttempted) {
    const outcome = await tryRefresh();
    if (outcome === "unavailable") {
      return { upstream: null, rotated, hadSession, unavailable: true };
    }
    if (outcome === "ok") {
      upstream = await call(accessToken);
    }
  }

  return { upstream, rotated, hadSession, unavailable: false };
}
