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

  it("loads the Backend service catalog when only the public business endpoint is missing", async () => {
    mockApi.mockImplementation(async (path) => {
      if (path === "/services") {
        return {
          success: true,
          data: {
            items: [
              {
                id: "7d0c6f1e-0000-4000-8000-000000000001",
                title: "ویزیت",
                duration_minutes: 30,
                price: "150000.00",
                deposit: "0.00",
                capacity: 1,
                status: "active",
                sort_order: 0,
              },
            ],
            meta: { page: 1, page_size: 100, total_items: 1, total_pages: 1 },
          },
        };
      }
      throw new ApiError({ status: 404, code: "NOT_FOUND", message: "missing" });
    });

    const { loadPublicHome } = await import("@/lib/api/public");
    const result = await loadPublicHome();

    expect(mockApi).toHaveBeenCalledWith(
      "/services",
      expect.objectContaining({ query: { status: "active", page: 1, page_size: 100 } }),
    );
    expect(result.services?.ok).toBe(true);
    if (result.services?.ok) {
      expect(result.services.data).toEqual([
        expect.objectContaining({ name: "ویزیت", durationMinutes: 30 }),
      ]);
    }
  });

  it("keeps an unauthorized catalog as an error instead of an empty list", async () => {
    mockApi.mockImplementation(async (path) => {
      if (path === "/services") {
        throw new ApiError({ status: 401, code: "AUTHENTICATION_REQUIRED", message: "login" });
      }
      throw new ApiError({ status: 404, code: "NOT_FOUND", message: "missing" });
    });

    const { loadPublicHome } = await import("@/lib/api/public");
    const result = await loadPublicHome();

    expect(result.business.ok).toBe(true);
    expect(result.services).toMatchObject({ ok: false, error: { status: 401 } });
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
