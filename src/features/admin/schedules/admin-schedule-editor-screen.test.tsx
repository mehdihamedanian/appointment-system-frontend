import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminScheduleStaffScreen } from "@/features/admin/schedules/admin-schedule-editor-screen";
import { authenticatedAdmin, createSessionValue, renderWithProviders } from "@/test/render";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/schedules/staff/st_1",
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

vi.mock("@/lib/api/client", () => ({
  apiClient: vi.fn(),
}));

import { apiClient } from "@/lib/api/client";

const mockedClient = vi.mocked(apiClient);

function schedulePayload() {
  return {
    scopeName: "دکتر رضایی",
    inheritanceMode: "custom",
    timezone: "Asia/Tehran",
    weekly: {
      items: [
        {
          weekday: 1,
          closed: false,
          intervals: [{ id: "i1", start: "09:00", end: "17:00" }],
          breaks: [{ id: "b1", start: "12:00", end: "13:00" }],
        },
      ],
    },
    effective: { inheritanceMode: "custom", weeklySummary: ["دوشنبه ۹–۱۷"] },
    timeOff: [],
    blocks: [],
    holidays: [],
    specialDays: [],
    capabilities: {
      supportsBreaks: true,
      supportsCopyDay: true,
      supportsImpactPreview: true,
      atomicSave: true,
    },
    allowedActions: {
      edit: true,
      manageWeekly: true,
      manageTimeOff: true,
      manageBlocks: true,
      viewCalendar: true,
    },
    version: "v1",
  };
}

describe("AdminScheduleStaffScreen", () => {
  beforeEach(() => {
    mockedClient.mockImplementation(async (path: string, init?: { method?: string }) => {
      const url = String(path);
      if (url.includes("/impact-preview")) {
        return {
          title: "پیش‌نمایش تأثیر",
          summary: "۱ نوبت تحت تأثیر",
          effects: ["دسترس‌پذیری تغییر می‌کند"],
          futureAppointmentCount: 1,
          requiresConfirmation: true,
          previewVersion: "pv1",
        };
      }
      if (url.includes("/admin/schedules/staff/st_1") && init?.method === "PUT") {
        return { version: "v2", updatedAt: "2026-08-26T10:00:00Z" };
      }
      if (url.includes("/admin/schedules/staff/st_1")) {
        return schedulePayload();
      }
      if (url.includes("/public/business")) {
        return { timezone: "Asia/Tehran", name: "کلینیک" };
      }
      return {};
    });
  });

  it("Admin Login → Schedule → Edit Weekly → Add Break → Preview Impact → Save flow", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminScheduleStaffScreen staffReference="st_1" />, {
      session: createSessionValue({ user: authenticatedAdmin }),
    });

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /زمان‌بندی دکتر رضایی/i })).toBeInTheDocument();
    });

    await user.click(screen.getAllByRole("button", { name: /افزودن استراحت/i })[0]!);

    await user.click(screen.getByRole("button", { name: /ذخیره ساعات هفتگی/i }));

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
    expect(screen.getByText(/پیش‌نمایش تأثیر/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^ذخیره$/i }));

    await waitFor(() => {
      expect(mockedClient).toHaveBeenCalledWith(
        expect.stringContaining("/admin/schedules/staff/st_1"),
        expect.objectContaining({ method: "PUT" }),
      );
    });
  });
});
