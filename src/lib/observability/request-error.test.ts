import { describe, expect, it } from "vitest";
import { toRequestErrorLog } from "@/lib/observability/request-error";

const now = new Date("2026-08-20T08:00:00Z");

describe("toRequestErrorLog", () => {
  it("keeps the digest and route but drops the query string", () => {
    const error = Object.assign(new Error("boom"), { digest: "123456" });
    const log = toRequestErrorLog(
      error,
      { path: "/reset-password?token=secret-reset-token", method: "GET" },
      { routePath: "/(auth)/reset-password", routeType: "render", renderSource: "server-rendering" },
      now,
    );

    expect(log).toEqual({
      level: "error",
      event: "request_error",
      timestamp: "2026-08-20T08:00:00.000Z",
      digest: "123456",
      name: "Error",
      message: "boom",
      method: "GET",
      path: "/reset-password",
      routePath: "/(auth)/reset-password",
      routeType: "render",
      renderSource: "server-rendering",
    });
    expect(JSON.stringify(log)).not.toContain("secret-reset-token");
  });

  it("handles non-Error values and bounds long messages", () => {
    const log = toRequestErrorLog("x".repeat(1000), { path: "/api/backend/x", method: "POST" }, {}, now);
    expect(log.name).toBe("NonError");
    expect(log.message).toHaveLength(300);
    expect(log.digest).toBeUndefined();
  });
});
