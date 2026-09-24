import { describe, expect, it } from "vitest";
import { classifyApiError, isNonIdempotentMutationPath } from "@/lib/api/error-ui";

describe("classifyApiError (Phase 44)", () => {
  it("classifies network, timeout, forbidden, not found, conflict, rate limit", () => {
    expect(classifyApiError({ status: 0, code: "NETWORK_ERROR", message: "x" }).kind).toBe(
      "network",
    );
    expect(classifyApiError({ status: 0, code: "REQUEST_TIMEOUT", message: "x" }).kind).toBe(
      "timeout",
    );
    expect(classifyApiError({ status: 403, message: "no" }).kind).toBe("forbidden");
    expect(classifyApiError({ status: 404, message: "missing" }).kind).toBe("not_found");
    expect(classifyApiError({ status: 409, message: "taken" }).kind).toBe("conflict");
    expect(classifyApiError({ status: 429, message: "slow" }).kind).toBe("rate_limit");
    expect(classifyApiError({ status: 500, message: "boom" }).kind).toBe("server");
  });

  it("separates session expiry from ordinary unauthorized", () => {
    expect(
      classifyApiError({ status: 401, code: "SESSION_EXPIRED", message: "منقضی" }).kind,
    ).toBe("session_expired");
    expect(classifyApiError({ status: 401, message: "login" }).kind).toBe("unauthorized");
  });

  it("marks backend dependency and feature disabled distinctly from empty data", () => {
    expect(
      classifyApiError({ status: 0, code: "MISSING_API_BASE_URL", message: "missing" }).kind,
    ).toBe("backend_dependency");
    expect(
      classifyApiError({ status: 403, code: "FEATURE_DISABLED", message: "off" }).kind,
    ).toBe("feature_disabled");
  });

  it("only allows safe retry for idempotent fetch-style failures", () => {
    expect(classifyApiError({ status: 0, code: "NETWORK_ERROR", message: "x" }).safeToRetry).toBe(
      true,
    );
    expect(classifyApiError({ status: 409, message: "x" }).safeToRetry).toBe(false);
    expect(classifyApiError({ status: 422, message: "x", fieldErrors: { a: ["b"] } }).safeToRetry).toBe(
      false,
    );
  });

  it("detects non-idempotent mutation paths", () => {
    expect(isNonIdempotentMutationPath("/api/bookings/confirm")).toBe(true);
    expect(isNonIdempotentMutationPath("/api/payments/refund")).toBe(true);
    expect(isNonIdempotentMutationPath("/api/appointments/cancel")).toBe(true);
    expect(isNonIdempotentMutationPath("/api/admin/customers")).toBe(false);
  });
});
