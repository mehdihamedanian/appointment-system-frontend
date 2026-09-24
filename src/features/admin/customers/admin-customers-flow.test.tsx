import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminCustomerScreen } from "@/features/admin/customers/admin-customer-screen";
import { AdminCustomerCreateScreen } from "@/features/admin/customers/admin-customer-create-screen";
import { AdminCustomerDetailScreen } from "@/features/admin/customers/admin-customer-detail-screen";
import { authenticatedAdmin, createSessionValue, renderWithProviders } from "@/test/render";

/** E2E: Admin Login → Search/Create → Detail → Note/Tag → Block */

const replaceMock = vi.fn();
const pushMock = vi.fn();
let params = { customerReference: "C-1" };

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/customers",
  useRouter: () => ({ replace: replaceMock, push: pushMock }),
  useSearchParams: () => new URLSearchParams(),
  useParams: () => params,
}));

vi.mock("@/lib/api/client", () => ({
  apiClient: vi.fn(),
}));

import { apiClient } from "@/lib/api/client";

const mockedClient = vi.mocked(apiClient);

describe("Phase 34 admin customers E2E flow", () => {
  beforeEach(() => {
    mockedClient.mockReset();
    replaceMock.mockReset();
    pushMock.mockReset();
    params = { customerReference: "C-1" };
  });

  it("walks list → create → detail → note → block with impact", async () => {
    const user = userEvent.setup();
    const session = createSessionValue({ status: "authenticated", user: authenticatedAdmin });

    mockedClient.mockImplementation(async (path: string, init?: { method?: string }) => {
      const url = String(path);
      const method = init?.method ?? "GET";
      if (url.startsWith("/admin/customers?") || url === "/admin/customers") {
        if (method === "POST") {
          return {
            customer: {
              id: "c_1",
              reference: "C-1",
              displayName: "مشتری جدید",
              phone: "09121234567",
            },
          };
        }
        return {
          items: [
            {
              id: "c_1",
              reference: "C-1",
              displayName: "مشتری جدید",
              active: true,
              phoneMasked: "0912***4567",
              metrics: { totalVisits: 2 },
            },
          ],
          totalCount: 1,
          filterOptions: { tags: [{ id: "tag_1", name: "VIP" }] },
        };
      }
      if (url.includes("/admin/appointments")) {
        return { items: [], pageCount: 1, totalCount: 0 };
      }
      if (url.includes("/payments")) {
        return { items: [], emptyHistory: true, hasMore: false };
      }
      if (url.includes("/impact-preview")) {
        return {
          title: "تأیید مسدودسازی",
          summary: "اثر روی نوبت‌های آینده",
          futureAppointmentCount: 1,
          requiresConfirmation: true,
        };
      }
      if (url.includes("/block")) {
        return { reference: "C-1", version: "v2" };
      }
      if (url.includes("/notes") && method === "POST") {
        return { reference: "C-1", version: "v2" };
      }
      if (url.includes("/admin/customers/C-1")) {
        if (method === "PATCH") {
          return {
            id: "c_1",
            reference: "C-1",
            displayName: "مشتری جدید",
            status: "active",
            metrics: { totalVisits: 2 },
            notes: [],
            tags: [],
            allowedActions: { manageNotes: true, block: true },
          };
        }
        return {
          id: "c_1",
          reference: "C-1",
          displayName: "مشتری جدید",
          status: "active",
          metrics: { totalVisits: 2 },
          notes: [],
          tags: [],
          availableTags: [{ id: "tag_1", name: "VIP" }],
          allowedActions: { manageNotes: true, block: true, viewPayments: true },
          version: "v1",
        };
      }
      return {};
    });

    const { unmount: unmountList } = renderWithProviders(<AdminCustomerScreen />, { session });
    expect((await screen.findAllByText("مشتری جدید")).length).toBeGreaterThan(0);
    unmountList();

    const { unmount: unmountCreate } = renderWithProviders(<AdminCustomerCreateScreen />, { session });
    await screen.findByRole("heading", { name: "مشتری جدید" });
    await user.type(screen.getByLabelText(/نام(?! خانوادگی)/), "مشتری");
    await user.type(screen.getByLabelText(/نام خانوادگی/), "جدید");
    await user.type(screen.getByLabelText(/موبایل/), "09121234567");
    await user.click(screen.getByRole("button", { name: "ایجاد مشتری" }));
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/admin/customers/C-1"));
    unmountCreate();

    const { unmount: unmountDetail } = renderWithProviders(<AdminCustomerDetailScreen />, { session });
    await screen.findAllByText("مشتری جدید");
    await user.click(screen.getByRole("tab", { name: "یادداشت داخلی" }));
    await user.type(screen.getByLabelText(/یادداشت جدید/), "یادداشت تست");
    await user.click(screen.getByRole("button", { name: "افزودن یادداشت" }));
    await user.click(screen.getByRole("tab", { name: "نمای کلی" }));
    await user.click(screen.getByRole("button", { name: "مسدودسازی" }));
    await screen.findByRole("heading", { name: "تأیید مسدودسازی" });
    await user.click(screen.getByRole("button", { name: "تأیید و ادامه" }));
    await waitFor(() => expect(mockedClient).toHaveBeenCalledWith(expect.stringContaining("/block"), expect.anything()));
    unmountDetail();
  });
});

describe("internal notes isolation", () => {
  it("does not expose note content in customer profile query keys", async () => {
    const { queryKeys } = await import("@/lib/query/keys");
    expect(JSON.stringify(queryKeys.customer.profile("u1"))).not.toContain("notes");
    expect(JSON.stringify(queryKeys.admin.customerDetail("u1", "C-1"))).not.toContain("internal");
  });
});
