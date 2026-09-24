import { describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { invalidateAfterAdminResourceMutation } from "@/lib/admin/resource-cache";

vi.mock("@/lib/api/admin-dashboard", () => ({
  invalidateAdminDashboard: vi.fn(),
}));

describe("admin resource cache", () => {
  it("invalidates resource, calendar, manual booking, and availability queries", () => {
    const queryClient = new QueryClient();
    const spy = vi.spyOn(queryClient, "invalidateQueries");
    invalidateAfterAdminResourceMutation(queryClient, "user_1", "ROOM-1");
    const keys = spy.mock.calls.map((call) => call[0]?.queryKey);
    expect(keys).toEqual(
      expect.arrayContaining([
        ["admin", "resources", "user_1"],
        ["admin", "resources", "user_1", "detail", "ROOM-1"],
        ["admin", "calendar"],
        ["admin", "manual-booking", "user_1"],
        ["availability"],
      ]),
    );
  });

  it("invalidates public providers only when customer-visible staff is affected", () => {
    const queryClient = new QueryClient();
    const spy = vi.spyOn(queryClient, "invalidateQueries");
    invalidateAfterAdminResourceMutation(queryClient, "user_1", "ST-1", {
      affectsCustomerVisibleProvider: false,
    });
    expect(spy.mock.calls.some((call) => call[0]?.queryKey?.[0] === "public")).toBe(false);

    spy.mockClear();
    invalidateAfterAdminResourceMutation(queryClient, "user_1", "ST-1", {
      affectsCustomerVisibleProvider: true,
    });
    expect(spy.mock.calls.some((call) => call[0]?.queryKey?.[0] === "public")).toBe(true);
  });
});
