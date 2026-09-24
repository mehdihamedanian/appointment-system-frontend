import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminBranchScreen } from "@/features/admin/branches/admin-branch-screen";
import { AdminBranchCreateScreen } from "@/features/admin/branches/admin-branch-create-screen";
import { AdminBranchEditScreen } from "@/features/admin/branches/admin-branch-edit-screen";
import { AdminBranchDetailScreen } from "@/features/admin/branches/admin-branch-detail-screen";
import { AdminBranchCalendarRedirect } from "@/features/admin/branches/admin-branch-calendar-redirect";
import { authenticatedAdmin, createSessionValue, renderWithProviders } from "@/test/render";

/** Vitest E2E: Admin Login → Create Branch → Configure → Assign → Calendar → Deactivate */

const replaceMock = vi.fn();
const pushMock = vi.fn();
let params = { branchReference: "BR-1" };

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/branches",
  useRouter: () => ({ replace: replaceMock, push: pushMock }),
  useSearchParams: () => new URLSearchParams(),
  useParams: () => params,
}));

vi.mock("@/lib/api/client", () => ({
  apiClient: vi.fn(),
}));

import { apiClient } from "@/lib/api/client";

const mockedClient = vi.mocked(apiClient);

describe("Phase 33 admin branches E2E flow", () => {
  beforeEach(() => {
    mockedClient.mockReset();
    replaceMock.mockReset();
    pushMock.mockReset();
    params = { branchReference: "BR-1" };
  });

  it("walks list → create → edit → calendar → deactivate with impact", async () => {
    const user = userEvent.setup();
    const session = createSessionValue({ status: "authenticated", user: authenticatedAdmin });

    mockedClient.mockImplementation(async (path: string, init?: { method?: string }) => {
      const url = String(path);
      const method = init?.method ?? "GET";
      if (url.includes("/public/business")) return { branchesEnabled: true };
      if (url.startsWith("/admin/branches?") || url === "/admin/branches") {
        if (method === "POST") {
          return {
            id: "br_1",
            reference: "BR-1",
            name: "شعبه جدید",
            status: "active",
            schedule: { mode: "inherit_business" },
            version: "v1",
            allowedActions: { edit: true, viewCalendar: true, deactivate: true },
          };
        }
        return {
          items: [
            {
              id: "br_1",
              reference: "BR-1",
              name: "شعبه جدید",
              active: true,
              staffCount: 0,
              resourceCount: 0,
              serviceCount: 0,
              schedule: { mode: "inherit_business", summary: "۹–۱۸" },
            },
          ],
          totalCount: 1,
        };
      }
      if (url.includes("/admin/staff")) {
        return { items: [{ id: "st_1", reference: "ST-1", name: "کارمند" }] };
      }
      if (url.includes("/admin/resources")) {
        return { items: [{ id: "res_1", reference: "RES-1", name: "اتاق" }] };
      }
      if (url.includes("/admin/services")) {
        return { items: [{ id: "svc_1", reference: "SVC-1", name: "ویزیت" }] };
      }
      if (url.includes("/impact-preview")) {
        return {
          title: "تأیید غیرفعال‌سازی",
          summary: "اثر روی نوبت‌های آینده",
          futureAppointmentCount: 1,
          requiresConfirmation: true,
        };
      }
      if (url.includes("/deactivate")) {
        return { reference: "BR-1", version: "v2" };
      }
      if (url.includes("/admin/branches/BR-1")) {
        if (method === "PATCH") {
          return {
            id: "br_1",
            reference: "BR-1",
            name: "شعبه ویرایش‌شده",
            status: "active",
            schedule: { mode: "custom" },
            staff: [],
            resources: [],
            services: [],
            version: "v1",
            allowedActions: { edit: true, deactivate: true, viewCalendar: true },
          };
        }
        return {
          id: "br_1",
          reference: "BR-1",
          name: "شعبه ویرایش‌شده",
          status: "active",
          schedule: { mode: "custom", summary: "سفارشی" },
          staff: [],
          resources: [],
          services: [],
          version: "v1",
          allowedActions: { edit: true, deactivate: true, viewCalendar: true },
        };
      }
      return {};
    });

    const { unmount: unmountList } = renderWithProviders(<AdminBranchScreen />, { session });
    expect((await screen.findAllByText("شعبه جدید")).length).toBeGreaterThan(0);
    unmountList();

    const { unmount: unmountCreate } = renderWithProviders(<AdminBranchCreateScreen />, { session });
    await screen.findByRole("heading", { name: "شعبه جدید" });
    await user.type(screen.getByLabelText(/نام شعبه/), "شعبه جدید");
    await user.click(screen.getByRole("button", { name: "ایجاد شعبه" }));
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/admin/branches/BR-1"));
    unmountCreate();

    pushMock.mockReset();
    const { unmount: unmountEdit } = renderWithProviders(<AdminBranchEditScreen />, { session });
    await screen.findByDisplayValue("شعبه ویرایش‌شده");
    await user.click(screen.getByRole("button", { name: "ذخیره تغییرات" }));
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/admin/branches/BR-1"));
    unmountEdit();

    replaceMock.mockReset();
    const { unmount: unmountCal } = renderWithProviders(<AdminBranchCalendarRedirect />, { session });
    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith(
        expect.stringContaining("/admin/calendar?branch=BR-1&group=branch"),
      );
    });
    unmountCal();

    const { unmount: unmountDetail } = renderWithProviders(<AdminBranchDetailScreen />, { session });
    await screen.findAllByText("شعبه ویرایش‌شده");
    await user.click(screen.getByRole("button", { name: "غیرفعال‌سازی" }));
    await screen.findByRole("heading", { name: "تأیید غیرفعال‌سازی" });
    await user.click(screen.getByRole("button", { name: "تأیید و ادامه" }));
    await waitFor(() => expect(mockedClient).toHaveBeenCalledWith(expect.stringContaining("/deactivate"), expect.anything()));
    unmountDetail();
  });

  it("shows single-branch gate when multi-branch disabled", async () => {
    mockedClient.mockImplementation(async (path: string) => {
      if (String(path).includes("/public/business")) return { branchesEnabled: false };
      return { items: [] };
    });
    const session = createSessionValue({ status: "authenticated", user: authenticatedAdmin });
    renderWithProviders(<AdminBranchScreen />, { session });
    expect(await screen.findByRole("heading", { name: "تک‌شعبه" })).toBeInTheDocument();
  });
});
