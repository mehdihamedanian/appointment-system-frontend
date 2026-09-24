import { describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { invalidateAfterAdminStaffMutation } from "@/lib/admin/staff-cache";

vi.mock("@/lib/api/admin-dashboard", () => ({
  invalidateAdminDashboard: vi.fn(),
}));

describe("admin staff cache", () => {
  it("invalidates staff, calendar, resources, and availability", () => {
    const queryClient = new QueryClient();
    const spy = vi.spyOn(queryClient, "invalidateQueries");
    invalidateAfterAdminStaffMutation(queryClient, "user_1", "ST-1");
    const keys = spy.mock.calls.map((call) => call[0]?.queryKey);
    expect(keys).toEqual(
      expect.arrayContaining([
        ["admin", "staff", "user_1"],
        ["admin", "staff", "user_1", "detail", "ST-1"],
        ["admin", "calendar"],
        ["admin", "resources", "user_1"],
        ["availability"],
      ]),
    );
  });

  it("invalidates public providers only when customer-visible changed", () => {
    const queryClient = new QueryClient();
    const spy = vi.spyOn(queryClient, "invalidateQueries");
    invalidateAfterAdminStaffMutation(queryClient, "user_1", "ST-1", {
      affectsCustomerVisibleProvider: false,
    });
    expect(spy.mock.calls.some((call) => call[0]?.queryKey?.[0] === "public")).toBe(false);

    spy.mockClear();
    invalidateAfterAdminStaffMutation(queryClient, "user_1", "ST-1", {
      affectsCustomerVisibleProvider: true,
    });
    expect(spy.mock.calls.some((call) => call[0]?.queryKey?.[0] === "public")).toBe(true);
  });
});
