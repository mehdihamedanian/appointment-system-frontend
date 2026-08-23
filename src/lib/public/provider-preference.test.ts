import { describe, expect, it } from "vitest";
import {
  bookingProviderId,
  preferenceToRadioValue,
  radioValueToPreference,
  reconcileProviderPreference,
  validateProviderPreference,
} from "@/lib/public/provider-preference";
import type { EligibleProvidersView, ProviderPreference } from "@/types/provider";

const provider = {
  id: "p1",
  name: "سارا محمدی",
  relatedServiceNames: [] as string[],
  branchNames: [] as string[],
};

function eligible(overrides: Partial<EligibleProvidersView> = {}): EligibleProvidersView {
  return {
    mode: "optional",
    anyAvailableAllowed: true,
    providers: [provider],
    ...overrides,
  };
}

describe("provider preference model", () => {
  it("does not use empty string or zero as any-available", () => {
    expect(radioValueToPreference("")).toBeUndefined();
    expect(radioValueToPreference("0")).toEqual({ type: "specific", providerId: "0" });
    expect(radioValueToPreference("pref:any")).toEqual({ type: "any" });
    expect(preferenceToRadioValue({ type: "any" })).toBe("pref:any");
    expect(bookingProviderId({ type: "any" })).toBeUndefined();
    expect(bookingProviderId({ type: "specific", providerId: "p1" })).toBe("p1");
  });

  it("validates required selection", () => {
    const required = eligible({ mode: "required", anyAvailableAllowed: false });
    expect(validateProviderPreference("required", undefined, required)).toMatch(/انتخاب/);
    expect(
      validateProviderPreference("required", { type: "any" }, required),
    ).toMatch(/انتخاب/);
    expect(
      validateProviderPreference("required", { type: "specific", providerId: "p1" }, required),
    ).toBeUndefined();
  });

  it("accepts explicit any in optional mode", () => {
    expect(
      validateProviderPreference("optional", { type: "any" }, eligible()),
    ).toBeUndefined();
    expect(validateProviderPreference("optional", undefined, eligible())).toMatch(/فرقی ندارد/);
  });

  it("does not require a choice for automatic or not_applicable", () => {
    expect(
      validateProviderPreference("automatic", { type: "automatic" }, eligible({ mode: "automatic" })),
    ).toBeUndefined();
    expect(
      validateProviderPreference(
        "not_applicable",
        { type: "not_applicable" },
        eligible({ mode: "not_applicable", providers: [] }),
      ),
    ).toBeUndefined();
  });

  it("blocks required mode when no eligible provider exists", () => {
    const empty = eligible({ mode: "required", anyAvailableAllowed: false, providers: [] });
    expect(validateProviderPreference("required", undefined, empty)).toMatch(/واجد شرایط/);
  });

  it("clears a provider that is invalid for a new service", () => {
    const preference: ProviderPreference = { type: "specific", providerId: "p1" };
    const next = reconcileProviderPreference(
      preference,
      eligible({ providers: [{ ...provider, id: "p2", name: "دیگر" }] }),
      "service",
    );
    expect(next.preference).toBeUndefined();
    expect(next.notice).toBe("unavailable_service");
  });

  it("clears a provider that is invalid for a new branch", () => {
    const next = reconcileProviderPreference(
      { type: "specific", providerId: "p1" },
      eligible({ providers: [] }),
      "branch",
    );
    expect(next.preference).toBeUndefined();
    expect(next.notice).toBe("unavailable_branch");
  });

  it("keeps explicit any across context changes in optional mode", () => {
    const next = reconcileProviderPreference({ type: "any" }, eligible({ providers: [] }), "branch");
    expect(next.preference).toEqual({ type: "any" });
  });
});
