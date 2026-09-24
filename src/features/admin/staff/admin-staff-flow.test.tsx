import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminStaffScreen } from "@/features/admin/staff/admin-staff-screen";
import { AdminStaffCreateScreen } from "@/features/admin/staff/admin-staff-create-screen";
import { AdminStaffEditScreen } from "@/features/admin/staff/admin-staff-edit-screen";
import { AdminStaffDetailScreen } from "@/features/admin/staff/admin-staff-detail-screen";
import { AdminStaffCalendarRedirect } from "@/features/admin/staff/admin-staff-calendar-redirect";
import { authenticatedAdmin, createSessionValue, renderWithProviders } from "@/test/render";

/** Vitest E2E: Admin Login → Staff List → Create → Edit → Calendar → Deactivate with impact */

const replaceMock = vi.fn();
const pushMock = vi.fn();
let params = { staffReference: "ST-1" };

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/staff",
  useRouter: () => ({ replace: replaceMock, push: pushMock }),
  useSearchParams: () => new URLSearchParams(),
  useParams: () => params,
}));

vi.mock("@/lib/api/client", () => ({
  apiClient: vi.fn(),
}));

import { apiClient } from "@/lib/api/client";

const mockedClient = vi.mocked(apiClient);

describe("Phase 29 admin staff E2E flow", () => {
  beforeEach(() => {
    mockedClient.mockReset();
    replaceMock.mockReset();
    pushMock.mockReset();
    params = { staffReference: "ST-1" };
  });

  it("walks create → edit → calendar → deactivate with impact confirmation", async () => {
    const user = userEvent.setup();
    const session = createSessionValue({ status: "authenticated", user: authenticatedAdmin });

    mockedClient.mockImplementation(async (path: string, init?: { method?: string }) => {
      const url = String(path);
      const method = init?.method ?? "GET";
      if (url.includes("/public/business")) return { branchesEnabled: false };
      if (url.startsWith("/admin/staff?") || url === "/admin/staff") {
        if (method === "POST") {
          return {
            id: "st_1",
            reference: "ST-1",
            name: "کارمند جدید",
            status: "active",
            bookable: true,
            customerVisible: false,
            schedule: { mode: "inherit_business" },
            branchIds: [],
            serviceIds: ["svc_1"],
            version: "v1",
          };
        }
        return {
          items: [
            {
              id: "st_1",
              reference: "ST-1",
              name: "کارمند جدید",
              active: true,
              bookable: true,
              allowedActions: { edit: true, viewCalendar: true },
            },
          ],
          pageCount: 1,
          filterOptions: {
            services: [{ id: "svc_1", name: "ویزیت" }],
            branches: [],
          },
        };
      }
      if (url.includes("/impact-preview")) {
        return {
          title: "تأیید غیرفعال‌سازی",
          summary: "اثر روی نوبت‌های آینده",
          futureAppointmentCount: 2,
        };
      }
      if (url.includes("/deactivate")) {
        return { reference: "ST-1", lifecycle: "inactive", version: "v2" };
      }
      if (url.includes("/admin/staff/ST-1")) {
        if (method === "PATCH") {
          return {
            id: "st_1",
            reference: "ST-1",
            name: "کارمند ویرایش‌شده",
            status: "active",
            bookable: true,
            customerVisible: false,
            serviceIds: ["svc_1"],
            schedule: { mode: "custom" },
            version: "v1",
            allowedActions: { edit: true, deactivate: true, viewCalendar: true },
          };
        }
        return {
          id: "st_1",
          reference: "ST-1",
          name: "کارمند ویرایش‌شده",
          status: "active",
          bookable: true,
          customerVisible: false,
          services: [{ id: "svc_1", name: "ویزیت" }],
          schedule: { mode: "custom" },
          version: "v1",
          allowedActions: { edit: true, deactivate: true, viewCalendar: true },
        };
      }
      return {};
    });

    const { unmount: unmountList } = renderWithProviders(<AdminStaffScreen />, { session });
    expect((await screen.findAllByText("کارمند جدید")).length).toBeGreaterThan(0);
    unmountList();

    const { unmount: unmountCreate } = renderWithProviders(<AdminStaffCreateScreen />, { session });
    await screen.findByText("کارمند جدید");
    await user.type(screen.getByLabelText(/نام نمایشی/), "کارمند جدید");
    await user.click(screen.getByRole("button", { name: "ایجاد کارمند" }));
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/admin/staff/ST-1"));
    unmountCreate();

    pushMock.mockReset();
    const { unmount: unmountEdit } = renderWithProviders(<AdminStaffEditScreen />, { session });
    await screen.findByDisplayValue("کارمند ویرایش‌شده");
    await user.click(screen.getByRole("button", { name: "ذخیره تغییرات" }));
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/admin/staff/ST-1"));
    unmountEdit();

    replaceMock.mockReset();
    const { unmount: unmountCal } = renderWithProviders(<AdminStaffCalendarRedirect />, { session });
    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith(
        expect.stringContaining("/admin/calendar?group=staff&staff=ST-1"),
      );
    });
    unmountCal();

    const { unmount: unmountDetail } = renderWithProviders(<AdminStaffDetailScreen />, { session });
    await screen.findAllByText("کارمند ویرایش‌شده");
    await user.click(screen.getByRole("button", { name: "غیرفعال‌سازی" }));
    expect(await screen.findByText(/اثر روی نوبت‌های آینده/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "تأیید و ادامه" }));
    await waitFor(() => {
      expect(mockedClient.mock.calls.some((call) => String(call[0]).includes("/deactivate"))).toBe(
        true,
      );
    });
    unmountDetail();
  });
});
