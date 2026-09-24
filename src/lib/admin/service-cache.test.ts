import { describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { invalidateAfterAdminServiceMutation } from "@/lib/admin/service-cache";

describe("service-cache", () => {
  it("invalidates admin and public service queries", () => {
    const client = new QueryClient();
    const spy = vi.spyOn(client, "invalidateQueries");
    invalidateAfterAdminServiceMutation(client, "user_1", "svc_1", {
      affectsAvailability: true,
      affectsPublicCatalog: true,
    });
    expect(spy).toHaveBeenCalled();
  });
});
