import { describe, expect, it } from "vitest";
import { validateProductionEnv } from "@/config/production-env";

const valid = {
  NEXT_PUBLIC_API_BASE_URL: "https://api.example.com/api/v1",
  NEXT_PUBLIC_SITE_URL: "https://booking.example.com",
  NEXT_PUBLIC_PAYMENT_GATEWAY_ORIGINS: "https://pay.example.com",
  NEXT_PUBLIC_BUSINESS_TIMEZONE: "Asia/Tehran",
  NEXT_PUBLIC_CALENDAR_SYSTEM: "persian",
  NEXT_PUBLIC_REQUEST_TIMEOUT_MS: "15000",
  SESSION_COOKIE_NAME: "session",
  TRUSTED_CLIENT_IP_HEADER: "x-real-ip",
};

describe("validateProductionEnv", () => {
  it("accepts a complete production configuration", () => {
    expect(validateProductionEnv(valid)).toEqual({ errors: [], warnings: [] });
  });

  it("requires an absolute Backend API URL", () => {
    expect(validateProductionEnv({ ...valid, NEXT_PUBLIC_API_BASE_URL: "" }).errors[0]).toMatch(
      /NEXT_PUBLIC_API_BASE_URL is required/,
    );
    expect(validateProductionEnv({ ...valid, NEXT_PUBLIC_API_BASE_URL: "/api/v1" }).errors[0]).toMatch(
      /absolute http\(s\) URL/,
    );
  });

  it("requires https except for local production checks", () => {
    expect(
      validateProductionEnv({ ...valid, NEXT_PUBLIC_API_BASE_URL: "http://api.example.com/api/v1" }).errors,
    ).toEqual(["NEXT_PUBLIC_API_BASE_URL must use https outside localhost."]);
    expect(
      validateProductionEnv({ ...valid, NEXT_PUBLIC_API_BASE_URL: "http://127.0.0.1:8100/api/v1" }).errors,
    ).toEqual([]);
    expect(
      validateProductionEnv({ ...valid, NEXT_PUBLIC_PAYMENT_GATEWAY_ORIGINS: "http://pay.example.com" }).errors,
    ).toEqual(['NEXT_PUBLIC_PAYMENT_GATEWAY_ORIGINS must use https: "http://pay.example.com".']);
  });

  it("rejects values the runtime would otherwise silently replace", () => {
    const { errors } = validateProductionEnv({
      ...valid,
      NEXT_PUBLIC_BUSINESS_TIMEZONE: "Tehran",
      NEXT_PUBLIC_CALENDAR_SYSTEM: "jalali",
      NEXT_PUBLIC_PAYMENT_GATEWAY_ORIGINS: "https://pay.example.com,not a url",
      NEXT_PUBLIC_REQUEST_TIMEOUT_MS: "15s",
      SESSION_MAX_AGE_SECONDS: "-1",
      SESSION_COOKIE_NAME: "my session",
    });
    expect(errors).toHaveLength(6);
  });

  it("warns about optional settings that disable features", () => {
    const { errors, warnings } = validateProductionEnv({
      NEXT_PUBLIC_API_BASE_URL: "https://api.example.com/api/v1",
    });
    expect(errors).toEqual([]);
    expect(warnings.join("\n")).toMatch(/NEXT_PUBLIC_SITE_URL is empty/);
    expect(warnings.join("\n")).toMatch(/online-payment redirect will be refused/);
    expect(warnings.join("\n")).toMatch(/NEXT_PUBLIC_BUSINESS_TIMEZONE is not set/);
    expect(warnings.join("\n")).toMatch(/TRUSTED_CLIENT_IP_HEADER is not set/);
  });

  it("refuses client-extendable forwarding headers as the trusted client IP source", () => {
    for (const header of ["X-Forwarded-For", "forwarded", "x real ip"]) {
      expect(validateProductionEnv({ ...valid, TRUSTED_CLIENT_IP_HEADER: header }).errors).toHaveLength(1);
    }
  });
});
