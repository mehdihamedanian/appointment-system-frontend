import { describe, expect, it } from "vitest";
import { canQueryAvailability, preferenceKey } from "@/lib/availability/context";
import { queryKeys } from "@/lib/query/keys";

describe("availability query gating", () => {
  it("does not query until required service, branch and provider dependencies are valid", () => {
    expect(
      canQueryAvailability({
        serviceId: null,
        preference: { type: "not_applicable" },
        requiresBranch: false,
        providerMode: "not_applicable",
      }),
    ).toBe(false);
    expect(
      canQueryAvailability({
        serviceId: "svc_1",
        preference: { type: "not_applicable" },
        requiresBranch: true,
        providerMode: "not_applicable",
      }),
    ).toBe(false);
    expect(
      canQueryAvailability({
        serviceId: "svc_1",
        branchId: "br_1",
        preference: { type: "automatic" },
        requiresBranch: true,
        providerMode: "required",
      }),
    ).toBe(false);
    expect(
      canQueryAvailability({
        serviceId: "svc_1",
        branchId: "br_1",
        preference: { type: "specific", providerId: "p1" },
        requiresBranch: true,
        providerMode: "required",
      }),
    ).toBe(true);
    expect(
      canQueryAvailability({
        serviceId: "svc_1",
        preference: { type: "any" },
        requiresBranch: false,
        providerMode: "optional",
      }),
    ).toBe(true);
  });

  it("includes every availability dependency in query keys so late responses cannot mix contexts", () => {
    const providerA = queryKeys.availability.dates("svc_1", "br_1", { type: "specific", providerId: "pA" }, "2026-08");
    const providerB = queryKeys.availability.dates("svc_1", "br_1", { type: "specific", providerId: "pB" }, "2026-08");
    const otherMonth = queryKeys.availability.dates("svc_1", "br_1", { type: "specific", providerId: "pA" }, "2026-09");
    const otherBranch = queryKeys.availability.dates("svc_1", "br_2", { type: "specific", providerId: "pA" }, "2026-08");
    expect(providerA).not.toEqual(providerB);
    expect(providerA).not.toEqual(otherMonth);
    expect(providerA).not.toEqual(otherBranch);
    expect(queryKeys.availability.slots("svc_1", "br_1", { type: "any" }, "2026-08-22")).not.toEqual(
      queryKeys.availability.slots("svc_1", "br_1", { type: "any" }, "2026-08-23"),
    );
    expect(preferenceKey({ type: "specific", providerId: "pA" })).toBe("specific:pA");
  });
});
