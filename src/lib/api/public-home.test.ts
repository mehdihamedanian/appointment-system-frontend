import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/errors";
import { env } from "@/config/env";

vi.mock("@/lib/api/client", () => ({
  apiClient: vi.fn(),
}));

import { apiClient } from "@/lib/api/client";

const mockApi = vi.mocked(apiClient);

describe("loadPublicHome", () => {
  beforeEach(() => {
    mockApi.mockReset();
    vi.resetModules();
  });

  it("renders configured identity when the public business API is not connected", async () => {
    mockApi.mockRejectedValue(
      new ApiError({
        status: 0,
        code: "MISSING_API_BASE_URL",
        message: "آدرس سرویس عمومی پیکربندی نشده است.",
      }),
    );

    const { loadPublicHome } = await import("@/lib/api/public");
    const result = await loadPublicHome();

    expect(result.business.ok).toBe(true);
    if (!result.business.ok) {
      throw new Error("expected configured business");
    }
    expect(result.business.data.name).toBe(env.appName);
    expect(result.services).toEqual({ ok: true, data: [] });
    expect(result.providers).toEqual({ ok: true, data: [] });
    expect(result.branches).toEqual({ ok: true, data: [] });
  });

  it("keeps a hard error when the public business API fails unexpectedly", async () => {
    mockApi.mockRejectedValue(
      new ApiError({
        status: 500,
        message: "اختلالی در سرویس رخ داده است. لطفاً دوباره تلاش کنید.",
      }),
    );

    const { loadPublicHome } = await import("@/lib/api/public");
    const result = await loadPublicHome();
    expect(result.business.ok).toBe(false);
    if (result.business.ok) {
      throw new Error("expected hard error");
    }
    expect(result.business.error.status).toBe(500);
  });
});
