import { describe, expect, it } from "vitest";
import { remainingSeconds, formatCountdown } from "@/lib/auth/otp-countdown";
import {
  isValidIranMobile,
  maskPhone,
  normalizeIranMobile,
  toE164IranMobile,
} from "@/lib/auth/phone";
import { clearFrontendCaches } from "@/lib/auth/session";
import { QueryClient } from "@tanstack/react-query";
import { isAdminRoute } from "@/lib/auth/route-access";

describe("phone normalization", () => {
  it("normalizes Persian digits and local prefixes", () => {
    expect(normalizeIranMobile("۰۹۱۲۱۲۳۴۵۶۷")).toBe("09121234567");
    expect(normalizeIranMobile("9121234567")).toBe("09121234567");
    expect(normalizeIranMobile("+989121234567")).toBe("09121234567");
    expect(isValidIranMobile("۰۹۱۲۱۲۳۴۵۶۷")).toBe(true);
    expect(isValidIranMobile("123")).toBe(false);
    expect(maskPhone("09121234567")).toContain("***");
    expect(toE164IranMobile("09121234567")).toBe("+989121234567");
    expect(toE164IranMobile("۰۹۱۲۱۲۳۴۵۶۷")).toBe("+989121234567");
  });
});

describe("otp countdown from timestamps", () => {
  it("computes remaining seconds from a target timestamp", () => {
    const now = Date.parse("2026-08-21T10:00:00.000Z");
    expect(remainingSeconds("2026-08-21T10:00:30.000Z", now)).toBe(30);
    expect(remainingSeconds("2026-08-21T09:59:00.000Z", now)).toBe(0);
    expect(formatCountdown(75)).toBe("01:15");
  });
});

describe("admin login route access", () => {
  it("does not treat /admin/login as a protected admin route", () => {
    expect(isAdminRoute("/admin/login")).toBe(false);
    expect(isAdminRoute("/admin/appointments")).toBe(true);
  });
});

describe("logout cache cleanup", () => {
  it("clears sensitive query cache", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["session"], { status: "authenticated" });
    queryClient.setQueryData(["appointments"], [{ id: "secret" }]);
    queryClient.setQueryData(["customer", "dashboard", "user_1"], { secret: true });
    queryClient.setQueryData(["public", "providers", "eligible", "svc_1", "br_1"], [{ id: "p1" }]);
    clearFrontendCaches(queryClient);
    expect(queryClient.getQueryData(["session"])).toBeUndefined();
    expect(queryClient.getQueryData(["appointments"])).toBeUndefined();
    expect(queryClient.getQueryData(["customer", "dashboard", "user_1"])).toBeUndefined();
    expect(queryClient.getQueryData(["public", "providers", "eligible", "svc_1", "br_1"])).toBeUndefined();
  });

  it("clears hold reference from session storage", () => {
    window.sessionStorage.setItem(
      "appointment.booking.hold.v1",
      JSON.stringify({ version: 1, publicReference: "hold_1" }),
    );
    clearFrontendCaches(new QueryClient());
    expect(window.sessionStorage.getItem("appointment.booking.hold.v1")).toBeNull();
  });

  it("clears the pending payment reference so the next account cannot resume it", () => {
    window.sessionStorage.setItem(
      "appointment.booking.payment.v1",
      JSON.stringify({ version: 1, paymentReference: "pay_1" }),
    );
    clearFrontendCaches(new QueryClient());
    expect(window.sessionStorage.getItem("appointment.booking.payment.v1")).toBeNull();
  });
});
