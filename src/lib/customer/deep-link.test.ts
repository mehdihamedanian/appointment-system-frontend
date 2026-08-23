import { describe, expect, it } from "vitest";
import { getSafeCustomerDeepLink } from "@/lib/customer/deep-link";

describe("customer deep links", () => {
  it("accepts internal customer routes", () => {
    expect(getSafeCustomerDeepLink("/appointments/apt_1")).toBe("/appointments/apt_1");
    expect(getSafeCustomerDeepLink("/payments?appointment=apt_1")).toBe(
      "/payments?appointment=apt_1",
    );
  });

  it("rejects external and unsafe targets", () => {
    expect(getSafeCustomerDeepLink("https://evil.example/pay")).toBeUndefined();
    expect(getSafeCustomerDeepLink("//evil.example")).toBeUndefined();
    expect(getSafeCustomerDeepLink("javascript:alert(1)")).toBeUndefined();
    expect(getSafeCustomerDeepLink("/admin/appointments")).toBeUndefined();
    expect(getSafeCustomerDeepLink("/login")).toBeUndefined();
  });
});
