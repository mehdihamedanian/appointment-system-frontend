// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { env } from "@/config/env";
import { DELETE, GET, POST } from "@/app/api/backend/[...path]/route";
import { ACCESS_COOKIE, SESSION_COOKIE } from "@/lib/server/backend-session";

const APP = "http://app.test";
const fetchMock = vi.fn<typeof fetch>();

type RequestOptions = {
  method?: string;
  headers?: Record<string, string>;
  cookies?: Record<string, string>;
  body?: string;
};

function call(
  handler: typeof GET,
  segments: string[],
  { method = "GET", headers = {}, cookies, body }: RequestOptions = {},
) {
  const requestHeaders = new Headers({ host: "app.test", ...headers });
  if (cookies) {
    requestHeaders.set(
      "cookie",
      Object.entries(cookies)
        .map(([name, value]) => `${name}=${value}`)
        .join("; "),
    );
  }
  const url = `${APP}/api/backend/${segments.map(encodeURIComponent).join("/")}`;
  const request = new NextRequest(url, { method, headers: requestHeaders, body });
  return handler(request, { params: Promise.resolve({ path: segments }) });
}

function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    ...init,
    headers: { "content-type": "application/json", ...(init.headers as Record<string, string>) },
  });
}

function upstreamUrl(index = 0): string {
  return String(fetchMock.mock.calls[index]?.[0]);
}

function upstreamHeaders(index = 0): Headers {
  return new Headers(fetchMock.mock.calls[index]?.[1]?.headers);
}

const sameOrigin = { origin: APP, "sec-fetch-site": "same-origin" };

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("backend proxy path handling", () => {
  it.each([
    ["auth/refresh"],
    ["auth/login"],
    ["auth\\refresh"],
    ["auth%2Frefresh"],
    ["admin\u0000users"],
  ])("rejects the encoded segment %j without contacting the Backend", async (segment) => {
    const response = await call(POST, [segment], { method: "POST", headers: sameOrigin, body: "{}" });
    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps token rotation out of browser reach", async () => {
    const response = await call(POST, ["auth", "refresh"], {
      method: "POST",
      headers: sameOrigin,
      body: JSON.stringify({ refresh_token: "x" }),
    });
    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards only to the configured upstream with allow-listed headers", async () => {
    fetchMock.mockResolvedValue(json({ success: true, data: [] }));
    await call(GET, ["appointments"], {
      headers: {
        authorization: "Bearer attacker-token",
        "x-forwarded-host": "evil.example",
        "x-request-id": "req-1",
      },
      cookies: { [ACCESS_COOKIE]: "access-1", [SESSION_COOKIE]: "refresh-1" },
    });

    expect(upstreamUrl()).toBe(`${env.apiBaseUrl.replace(/\/+$/, "")}/appointments`);
    const headers = upstreamHeaders();
    expect(headers.get("authorization")).toBe("Bearer access-1");
    expect(headers.get("cookie")).toBeNull();
    expect(headers.get("x-forwarded-host")).toBeNull();
    expect(headers.get("x-request-id")).toBe("req-1");
  });

  it("never forwards a client-supplied client IP when no trusted ingress header is configured", async () => {
    fetchMock.mockResolvedValue(json({ success: true, data: [] }));
    await call(GET, ["appointments"], {
      headers: { "x-forwarded-for": "203.0.113.9", "x-real-ip": "203.0.113.9" },
    });
    expect(upstreamHeaders().get("x-forwarded-for")).toBeNull();
  });

  describe("with TRUSTED_CLIENT_IP_HEADER", () => {
    beforeEach(() => vi.stubEnv("TRUSTED_CLIENT_IP_HEADER", "X-Real-IP"));
    afterEach(() => vi.unstubAllEnvs());

    it("forwards only the ingress-set client IP", async () => {
      fetchMock.mockResolvedValue(json({ success: true, data: [] }));
      await call(GET, ["appointments"], {
        headers: { "x-forwarded-for": "198.51.100.1", "x-real-ip": "203.0.113.9" },
      });
      expect(upstreamHeaders().get("x-forwarded-for")).toBe("203.0.113.9");
    });

    it("drops a value that is not a single IP address", async () => {
      fetchMock.mockResolvedValue(json({ success: true, data: [] }));
      await call(GET, ["appointments"], { headers: { "x-real-ip": "203.0.113.9, 10.0.0.1" } });
      expect(upstreamHeaders().get("x-forwarded-for")).toBeNull();
    });
  });
});

describe("backend proxy CSRF checks", () => {
  it.each([
    [{ "sec-fetch-site": "cross-site", origin: APP }],
    [{ "sec-fetch-site": "same-site", origin: APP }],
    [{ origin: "https://evil.example" }],
    [{ origin: "null" }],
  ])("rejects unsafe requests from %j", async (headers) => {
    const response = await call(DELETE, ["appointments", "APT-1"], {
      method: "DELETE",
      headers,
      cookies: { [ACCESS_COOKIE]: "access-1" },
    });
    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("allows same-origin mutations", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    const response = await call(DELETE, ["appointments", "APT-1"], {
      method: "DELETE",
      headers: sameOrigin,
      cookies: { [ACCESS_COOKIE]: "access-1" },
    });
    expect(response.status).toBe(204);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});

describe("backend proxy response handling", () => {
  it("marks responses private/no-store and never relays Backend cookies", async () => {
    fetchMock.mockResolvedValue(
      json(
        { success: true, data: { id: "APT-1" } },
        { headers: { "cache-control": "public, max-age=600", "set-cookie": "tracking=1" } },
      ),
    );
    const response = await call(GET, ["appointments", "APT-1"], {
      cookies: { [ACCESS_COOKIE]: "access-1" },
    });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("marks locally generated errors private/no-store too", async () => {
    const response = await call(GET, ["auth%2Fme"]);
    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("keeps login tokens in httpOnly cookies and out of the response body", async () => {
    fetchMock.mockResolvedValue(
      json({
        success: true,
        data: {
          access_token: "access-secret",
          refresh_token: "refresh-secret",
          access_token_expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
          user: { id: "u1", accountType: "customer" },
        },
      }),
    );
    const response = await call(POST, ["auth", "login"], {
      method: "POST",
      headers: { ...sameOrigin, "content-type": "application/json" },
      body: JSON.stringify({ identifier: "+989121234567", password: "pw" }),
    });

    const body = await response.text();
    expect(body).not.toContain("access-secret");
    expect(body).not.toContain("refresh-secret");
    const cookies = response.headers.getSetCookie();
    expect(cookies).toHaveLength(2);
    for (const cookie of cookies) {
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=lax/i);
      expect(cookie).toMatch(/Path=\//);
    }
  });
});

describe("backend proxy session lifecycle", () => {
  it("does not treat cookie presence as a session: a rejected token clears both cookies", async () => {
    fetchMock.mockImplementation(async () => json({ success: false }, { status: 401 }));
    const response = await call(GET, ["auth", "session"], {
      cookies: { [ACCESS_COOKIE]: "forged-access", [SESSION_COOKIE]: "forged-refresh-1" },
    });
    expect(response.status).toBe(401);
    expect((await response.json()).code).toBe("SESSION_EXPIRED");
    const cleared = response.headers.getSetCookie();
    expect(cleared.some((c) => c.startsWith(`${ACCESS_COOKIE}=;`) && /Max-Age=0/i.test(c))).toBe(true);
    expect(cleared.some((c) => c.startsWith(`${SESSION_COOKIE}=;`) && /Max-Age=0/i.test(c))).toBe(true);
  });

  it("refreshes once on an expired access token and rotates both cookies", async () => {
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/auth/refresh")) {
        return json({
          success: true,
          data: {
            access_token: "access-2",
            refresh_token: "refresh-2",
            access_token_expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
            user: { id: "u1" },
          },
        });
      }
      const auth = new Headers(init?.headers).get("authorization");
      return auth === "Bearer access-2"
        ? json({ success: true, data: { id: "u1" } })
        : json({ success: false }, { status: 401 });
    });
    const response = await call(GET, ["auth", "session"], {
      cookies: { [ACCESS_COOKIE]: "stale-access", [SESSION_COOKIE]: "refresh-rotate-1" },
    });
    expect(response.status).toBe(200);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/auth/refresh"))).toHaveLength(1);
    const cookies = response.headers.getSetCookie().join("\n");
    expect(cookies).toContain(`${ACCESS_COOKIE}=access-2`);
    expect(cookies).toContain(`${SESSION_COOKIE}=refresh-2`);
    expect(await response.text()).not.toContain("refresh-2");
  });

  it("logout clears cookies even when the Backend is unreachable", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    const response = await call(POST, ["auth", "logout"], {
      method: "POST",
      headers: sameOrigin,
      cookies: { [ACCESS_COOKIE]: "access-1", [SESSION_COOKIE]: "refresh-logout-1" },
    });
    expect(response.status).toBe(200);
    const cleared = response.headers.getSetCookie();
    expect(cleared.filter((c) => /Max-Age=0/i.test(c))).toHaveLength(2);
  });

  it("rejects cross-site logout so a third party cannot end the session", async () => {
    const response = await call(POST, ["auth", "logout"], {
      method: "POST",
      headers: { origin: "https://evil.example", "sec-fetch-site": "cross-site" },
      cookies: { [SESSION_COOKIE]: "refresh-logout-2" },
    });
    expect(response.status).toBe(403);
    expect(response.headers.getSetCookie()).toHaveLength(0);
  });
});
