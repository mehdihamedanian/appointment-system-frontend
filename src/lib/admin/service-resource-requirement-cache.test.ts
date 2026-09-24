import { describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { invalidateAfterServiceResourceRequirementsMutation } from "@/lib/admin/service-resource-requirement-cache";

vi.mock("@/lib/api/admin-dashboard", () => ({
  invalidateAdminDashboard: vi.fn(),
}));

describe("service resource requirement cache", () => {
  it("invalidates service requirements and booking-related queries", () => {
    const queryClient = new QueryClient();
    const spy = vi.spyOn(queryClient, "invalidateQueries");
    invalidateAfterServiceResourceRequirementsMutation(queryClient, "user_1", "svc_1");
    const keys = spy.mock.calls.map((call) => call[0]?.queryKey);
    expect(keys).toEqual(
      expect.arrayContaining([
        ["admin", "services", "user_1", "resource-requirements", "svc_1"],
        ["availability"],
        ["admin", "manual-booking", "user_1"],
        ["admin", "calendar"],
      ]),
    );
  });

  it("invalidates public services when availability may change", () => {
    const queryClient = new QueryClient();
    const spy = vi.spyOn(queryClient, "invalidateQueries");
    invalidateAfterServiceResourceRequirementsMutation(queryClient, "user_1", "svc_1", {
      affectsPublicAvailability: true,
    });
    expect(spy.mock.calls.some((call) => call[0]?.queryKey?.[0] === "public")).toBe(true);
  });
});
