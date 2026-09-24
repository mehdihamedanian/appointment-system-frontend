import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminServiceCreateScreen } from "@/features/admin/services/admin-service-create-screen";
import { AdminServiceScreen } from "@/features/admin/services/admin-service-screen";
import { authenticatedAdmin, createSessionValue, renderWithProviders } from "@/test/render";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/services",
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

vi.mock("@/lib/api/client", () => ({
  apiClient: vi.fn(),
}));

import { apiClient } from "@/lib/api/client";

const mockedClient = vi.mocked(apiClient);

function serviceDetailPayload(reference = "svc_new") {
  return {
    id: reference,
    reference,
    serviceReference: reference,
    name: "خدمت جدید",
    durationMinutes: 30,
    priceType: "fixed",
    price: 200000,
    currency: "IRR",
    depositType: "none",
    lifecycle: "active",
    bookingEnabled: true,
    capabilities: { hasImpactPreview: true },
  };
}

describe("AdminServiceScreen", () => {
  beforeEach(() => mockedClient.mockReset());

  it("shows empty catalog state", async () => {
    mockedClient.mockResolvedValue({ items: [], emptyCatalog: true });
    renderWithProviders(<AdminServiceScreen />);
    expect(await screen.findByText("هنوز خدمتی ثبت نشده")).toBeInTheDocument();
  });

  it("renders service list items", async () => {
    mockedClient.mockResolvedValue({
      items: [
        {
          id: "svc_1",
          reference: "svc_1",
          name: "MRI مغز",
          durationMinutes: 45,
          priceLabel: "۵۰۰٬۰۰۰ ریال",
          lifecycle: "active",
        },
      ],
    });
    renderWithProviders(<AdminServiceScreen />);
    expect((await screen.findAllByText("MRI مغز")).length).toBeGreaterThan(0);
  });
});

describe("Phase 31 service E2E flow", () => {
  beforeEach(() => mockedClient.mockReset());

  it("creates service through form", async () => {
    const user = userEvent.setup();
    mockedClient.mockImplementation(async (path: string, init?: { method?: string }) => {
      const url = String(path);
      if (url.includes("/admin/services") && init?.method === "POST") {
        return serviceDetailPayload("svc_new");
      }
      if (url.includes("/public/business")) {
        return { currency: "IRR", branchesEnabled: false };
      }
      if (url.includes("/public/providers")) {
        return { items: [] };
      }
      return {};
    });
    renderWithProviders(<AdminServiceCreateScreen />);
    await user.type(await screen.findByLabelText(/نام خدمت/), "خدمت جدید");
    await user.click(screen.getByRole("button", { name: "ایجاد خدمت" }));
    await waitFor(() => {
      expect(
        mockedClient.mock.calls.some(
          (call) => String(call[0]).includes("/admin/services") && call[1]?.method === "POST",
        ),
      ).toBe(true);
    });
  });
});

describe("AdminServiceScreen permissions", () => {
  beforeEach(() => mockedClient.mockReset());

  it("denies without admin.services.view when codes are granular", async () => {
    mockedClient.mockResolvedValue({ items: [] });
    renderWithProviders(<AdminServiceScreen />, {
      session: createSessionValue({
        status: "authenticated",
        user: { ...authenticatedAdmin, permissionCodes: ["admin.dashboard.view"] },
      }),
    });
    expect(
      await screen.findByText("مجوز لازم برای مشاهده این بخش را ندارید."),
    ).toBeInTheDocument();
  });
});
