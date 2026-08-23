import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchEligibleProviders } from "@/lib/api/providers";

vi.mock("@/lib/api/client", () => ({
  apiClient: vi.fn(),
}));

import { apiClient } from "@/lib/api/client";

const mockedClient = vi.mocked(apiClient);

describe("eligible providers API", () => {
  beforeEach(() => {
    mockedClient.mockReset();
  });

  it("requests providers for the selected service and branch", async () => {
    mockedClient.mockResolvedValueOnce({
      selectionMode: "required",
      providers: [{ id: "p1", name: "سارا محمدی" }],
    });

    const result = await fetchEligibleProviders("svc_1", "br_2");
    expect(mockedClient).toHaveBeenCalledWith("/public/services/svc_1/providers", {
      method: "GET",
      signal: undefined,
      query: { branchId: "br_2" },
    });
    expect(result.mode).toBe("required");
    expect(result.providers[0]?.id).toBe("p1");
  });

  it("omits unsafe branch ids from the query", async () => {
    mockedClient.mockResolvedValueOnce({ selectionMode: "optional", providers: [] });
    await fetchEligibleProviders("svc_1", "../evil");
    expect(mockedClient).toHaveBeenCalledWith("/public/services/svc_1/providers", {
      method: "GET",
      signal: undefined,
      query: { branchId: undefined },
    });
  });
});
