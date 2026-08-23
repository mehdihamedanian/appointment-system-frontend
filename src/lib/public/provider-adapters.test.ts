import { describe, expect, it } from "vitest";
import {
  adaptEligibleProviders,
  adaptPublicProviderView,
} from "@/lib/public/provider-adapters";
import { queryKeys } from "@/lib/query/keys";

describe("public provider view adapter", () => {
  it("maps public fields and drops private staff data", () => {
    const view = adaptPublicProviderView({
      id: "p1",
      name: "سارا محمدی",
      publicTitle: "کارشناس",
      specialty: "رنگ مو",
      shortBio: "معرفی کوتاه عمومی",
      phone: "09121234567",
      email: "sara@internal.example",
      internalNotes: "حقوق",
      utilization: 92,
      revenue: 1000000,
      schedule: { monday: "09-17" },
      leave: "مرخصی",
      allocation: "room_1",
      capacity: 4,
    });
    expect(view).toMatchObject({
      id: "p1",
      name: "سارا محمدی",
      publicTitle: "کارشناس",
      specialty: "رنگ مو",
      shortBio: "معرفی کوتاه عمومی",
    });
    expect(JSON.stringify(view)).not.toMatch(/0912|internal|حقوق|revenue|utilization|room_1/);
  });

  it("hides internal operational resources", () => {
    expect(adaptPublicProviderView({ id: "room_1", name: "اتاق ۱", kind: "room" })).toBeNull();
    expect(adaptPublicProviderView({ id: "dev_1", name: "دستگاه", type: "device" })).toBeNull();
    expect(adaptPublicProviderView({ id: "chair_1", name: "صندلی", kind: "chair" })).toBeNull();
    expect(adaptPublicProviderView({ id: "p2", name: "خصوصی", isPublic: false })).toBeNull();
    expect(adaptPublicProviderView({ id: "p3", name: "غیرفعال", active: false })).toBeNull();
  });
});

describe("eligible providers adapter", () => {
  it("does not infer selection mode from provider count", () => {
    const eligible = adaptEligibleProviders([
      { id: "p1", name: "سارا محمدی" },
      { id: "p2", name: "علی رضایی" },
    ]);
    expect(eligible.providers).toHaveLength(2);
    expect(eligible.mode).toBe("not_applicable");
  });

  it("reads an explicit optional contract and allows any-available", () => {
    const eligible = adaptEligibleProviders({
      selectionMode: "optional",
      providers: [{ id: "p1", name: "سارا محمدی", relatedServiceNames: ["رنگ"] }],
    });
    expect(eligible.mode).toBe("optional");
    expect(eligible.anyAvailableAllowed).toBe(true);
  });

  it("keeps required mode without any-available unless the contract allows it", () => {
    const eligible = adaptEligibleProviders({
      providerSelectionMode: "required",
      providers: [{ id: "p1", name: "سارا محمدی" }],
    });
    expect(eligible.mode).toBe("required");
    expect(eligible.anyAvailableAllowed).toBe(false);
  });

  it("maps automatic assignment without treating providers as a customer list", () => {
    const eligible = adaptEligibleProviders({
      mode: "automatic",
      assignmentLabel: "تخصیص توسط مجموعه",
      providers: [{ id: "p1", name: "داخلی" }],
    });
    expect(eligible.mode).toBe("automatic");
    expect(eligible.assignmentLabel).toBe("تخصیص توسط مجموعه");
  });
});

describe("provider query keys", () => {
  it("scopes eligible providers by service and optional branch", () => {
    expect(queryKeys.providers.byService("svc_1")).toEqual([
      "public",
      "providers",
      "eligible",
      "svc_1",
      "",
    ]);
    expect(queryKeys.providers.byService("svc_1", "br_2")).toEqual([
      "public",
      "providers",
      "eligible",
      "svc_1",
      "br_2",
    ]);
  });
});
