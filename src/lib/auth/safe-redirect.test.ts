import { describe, expect, it } from "vitest";
import { getSafeInternalRedirect, withRedirectParam } from "@/lib/auth/safe-redirect";

describe("safe login redirect", () => {
  it("keeps a same-origin internal path", () => {
    expect(getSafeInternalRedirect("/appointments")).toBe("/appointments");
  });

  it("rejects protocol-relative and external targets", () => {
    expect(getSafeInternalRedirect("//evil.example")).toBe("/dashboard");
    expect(getSafeInternalRedirect("https://evil.example")).toBe("/dashboard");
    expect(getSafeInternalRedirect("javascript:alert(1)")).toBe("/dashboard");
  });

  it("rejects auth destinations to prevent redirect loops", () => {
    expect(getSafeInternalRedirect("/login")).toBe("/dashboard");
    expect(getSafeInternalRedirect("/login?redirect=/dashboard")).toBe(
      "/dashboard",
    );
    expect(getSafeInternalRedirect("/session-expired")).toBe("/dashboard");
  });

  it("attaches a sanitized redirect query to login", () => {
    expect(withRedirectParam("/login", "/profile")).toBe(
      "/login?redirect=%2Fprofile",
    );
    expect(withRedirectParam("/login", "https://evil.example")).toBe(
      "/login?redirect=%2Fdashboard",
    );
  });
});
