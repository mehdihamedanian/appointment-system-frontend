import { describe, expect, it } from "vitest";
import { getSafeGatewayRedirect } from "@/lib/payment/safe-gateway-url";

const allowed = ["https://pay.example"];

describe("safe gateway redirect", () => {
  it("accepts an allowlisted https URL from the backend", () => {
    expect(getSafeGatewayRedirect("https://pay.example/start?x=1", allowed)).toBe(
      "https://pay.example/start?x=1",
    );
  });

  it("rejects user-controlled or off-allowlist URLs", () => {
    expect(getSafeGatewayRedirect("https://evil.example/phish", allowed)).toBeUndefined();
    expect(getSafeGatewayRedirect("javascript:alert(1)", allowed)).toBeUndefined();
    expect(getSafeGatewayRedirect("//pay.example", allowed)).toBeUndefined();
    expect(getSafeGatewayRedirect("/booking/payment?status=success", allowed)).toBeUndefined();
  });

  it("rejects all external URLs when the allowlist is empty", () => {
    expect(getSafeGatewayRedirect("https://pay.example/start", [])).toBeUndefined();
  });
});
