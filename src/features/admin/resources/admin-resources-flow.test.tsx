import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminResourcesScreen } from "@/features/admin/resources/admin-resources-screen";
import { AdminResourceCreateScreen } from "@/features/admin/resources/admin-resource-create-screen";
import { AdminResourceEditScreen } from "@/features/admin/resources/admin-resource-edit-screen";
import { AdminResourceDetailScreen } from "@/features/admin/resources/admin-resource-detail-screen";
import { AdminResourceCalendarRedirect } from "@/features/admin/resources/admin-resource-calendar-redirect";
import { authenticatedAdmin, createSessionValue, renderWithProviders } from "@/test/render";

/**
 * E2E-style flow (Vitest): Admin Login → Resources → Create → Edit → Calendar → Deactivate with impact.
 * Playwright is not configured in this repo.
 */

const replaceMock = vi.fn();
const pushMock = vi.fn();
let search = new URLSearchParams();
let params = { resourceReference: "ROOM-1" };

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/resources",
  useRouter: () => ({ replace: replaceMock, push: pushMock }),
  useSearchParams: () => search,
  useParams: () => params,
}));

vi.mock("@/lib/api/client", () => ({
  apiClient: vi.fn(),
}));

import { apiClient } from "@/lib/api/client";

const mockedClient = vi.mocked(apiClient);

describe("Phase 28 admin resources E2E flow", () => {
  beforeEach(() => {
    mockedClient.mockReset();
    replaceMock.mockReset();
    pushMock.mockReset();
    search = new URLSearchParams();
    params = { resourceReference: "ROOM-1" };
  });

  it("walks create → edit → calendar → deactivate with impact confirmation", async () => {
    const user = userEvent.setup();
    const session = createSessionValue({ status: "authenticated", user: authenticatedAdmin });

    mockedClient.mockImplementation(async (path: string, init?: { method?: string }) => {
      const url = String(path);
      const method = init?.method ?? "GET";
      if (url.includes("/public/business")) return { branchesEnabled: false };
      if (url === "/admin/resources/types") {
        return [{ id: "rt_room", code: "room", display_name: "Room", is_system: true }];
      }
      if (url.startsWith("/admin/resources?") || url === "/admin/resources") {
        if (method === "POST") {
          return {
            id: "res_1",
            reference: "ROOM-1",
            name: "اتاق جدید",
            type: "room",
            status: "active",
            schedule: { mode: "inherit_business" },
            version: "v1",
          };
        }
        return {
          items: [
            {
              id: "res_1",
              reference: "ROOM-1",
              name: "اتاق جدید",
              type: "room",
              active: true,
              allowedActions: { edit: true, viewCalendar: true },
            },
          ],
          pageCount: 1,
        };
      }
      if (url.includes("/impact-preview")) {
        return {
          title: "تأیید غیرفعال‌سازی",
          summary: "اثر روی نوبت‌های آینده",
          futureAppointmentCount: 1,
          effects: ["یک نوبت آینده"],
        };
      }
      if (url.includes("/deactivate")) {
        return { reference: "ROOM-1", lifecycle: "inactive", version: "v2" };
      }
      if (url.includes("/admin/resources/ROOM-1")) {
        if (method === "PATCH") {
          return {
            id: "res_1",
            reference: "ROOM-1",
            name: "اتاق ویرایش‌شده",
            type: "room",
            status: "active",
            schedule: { mode: "custom", summary: "اختصاصی" },
            version: "v1",
            allowedActions: { edit: true, deactivate: true, viewCalendar: true },
          };
        }
        return {
          id: "res_1",
          reference: "ROOM-1",
          name: "اتاق ویرایش‌شده",
          type: "room",
          status: "active",
          schedule: { mode: "custom", summary: "اختصاصی" },
          version: "v1",
          allowedActions: { edit: true, deactivate: true, viewCalendar: true },
        };
      }
      return {};
    });

    // List
    const { unmount: unmountList } = renderWithProviders(<AdminResourcesScreen />, { session });
    expect((await screen.findAllByText("اتاق جدید")).length).toBeGreaterThan(0);
    unmountList();

    // Create
    const { unmount: unmountCreate } = renderWithProviders(<AdminResourceCreateScreen />, {
      session,
    });
    await screen.findByText("منبع جدید");
    await waitFor(() => expect(screen.getByRole("button", { name: "ایجاد منبع" })).toBeEnabled());
    await user.type(screen.getByLabelText(/نام/), "اتاق جدید");
    await user.click(screen.getByRole("button", { name: "ایجاد منبع" }));
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/admin/resources/ROOM-1");
    });
    const createCall = mockedClient.mock.calls.find(
      ([path, init]) => path === "/admin/resources" && (init as { method?: string })?.method === "POST",
    );
    expect((createCall?.[1] as { body?: unknown })?.body).toEqual({
      name: "اتاق جدید",
      resourceTypeId: "rt_room",
    });
    unmountCreate();

    // Edit
    pushMock.mockReset();
    const { unmount: unmountEdit } = renderWithProviders(<AdminResourceEditScreen />, { session });
    await screen.findByDisplayValue("اتاق ویرایش‌شده");
    const nameInput = screen.getByLabelText(/نام/);
    await user.clear(nameInput);
    await user.type(nameInput, "اتاق ویرایش‌شده");
    await user.click(screen.getByRole("button", { name: "ذخیره تغییرات" }));
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/admin/resources/ROOM-1");
    });
    unmountEdit();

    // Calendar redirect reuses Phase 27
    replaceMock.mockReset();
    const { unmount: unmountCal } = renderWithProviders(<AdminResourceCalendarRedirect />, {
      session,
    });
    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith(
        expect.stringContaining("/admin/calendar?group=resource&resource=ROOM-1"),
      );
    });
    unmountCal();

    // Deactivate with impact confirmation
    const { unmount: unmountDetail } = renderWithProviders(<AdminResourceDetailScreen />, {
      session,
    });
    await screen.findAllByText("اتاق ویرایش‌شده");
    await user.click(screen.getByRole("button", { name: "غیرفعال‌سازی" }));
    expect(await screen.findByText(/اثر روی نوبت‌های آینده/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "تأیید و ادامه" }));
    await waitFor(() => {
      expect(
        mockedClient.mock.calls.some((call) => String(call[0]).includes("/deactivate")),
      ).toBe(true);
    });
    unmountDetail();
  });
});
