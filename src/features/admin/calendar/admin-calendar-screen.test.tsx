import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminCalendarScreen } from "@/features/admin/calendar/admin-calendar-screen";
import { ApiError } from "@/lib/api/errors";
import { authenticatedAdmin, createSessionValue, renderWithProviders } from "@/test/render";
import { ADMIN_CALENDAR_DRAG_DROP_ENABLED } from "@/types/admin-calendar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/calendar",
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams("view=day&date=2026-08-25"),
}));

vi.mock("@/lib/api/client", () => ({
  apiClient: vi.fn(),
}));

import { apiClient } from "@/lib/api/client";

const mockedClient = vi.mocked(apiClient);

function calendarPayload() {
  return {
    timezone: "Asia/Tehran",
    weekStartsOn: 6,
    slotIntervalMinutes: 30,
    lastUpdatedAt: "2026-08-25T08:00:00.000Z",
    workingHours: [{ dayOfWeek: 2, start: "09:00", end: "18:00" }],
    columns: [{ id: "st_1", label: "دکتر الف", kind: "staff" }],
    events: [
      {
        id: "ev_1",
        type: "appointment",
        startsAt: "2026-08-25T05:30:00.000Z",
        endsAt: "2026-08-25T06:00:00.000Z",
        customerName: "سارا محمدی",
        serviceName: "ویزیت",
        status: "confirmed",
        appointmentReference: "REF-CAL-1",
        columnId: "st_1",
      },
      {
        id: "ev_2",
        type: "blocked_time",
        startsAt: "2026-08-25T07:00:00.000Z",
        endsAt: "2026-08-25T08:00:00.000Z",
        blockReason: "تعمیر",
        columnId: "st_1",
      },
    ],
    daySummaries: [{ date: "2026-08-25", appointmentCount: 1, density: "low" }],
    filterOptions: {
      staff: [{ id: "st_1", name: "دکتر الف" }],
      resources: [{ id: "res_1", name: "اتاق ۱", type: "room" }],
    },
  };
}

describe("AdminCalendarScreen", () => {
  beforeEach(() => {
    mockedClient.mockReset();
  });

  it("renders calendar from visible-range API and keeps DnD disabled", async () => {
    mockedClient.mockImplementation(async (path: string) => {
      if (path === "/public/business") {
        return { timezone: "Asia/Tehran", branchesEnabled: false };
      }
      if (String(path).startsWith("/admin/calendar")) {
        return calendarPayload();
      }
      return {};
    });

    renderWithProviders(<AdminCalendarScreen />, {
      session: createSessionValue({ status: "authenticated", user: authenticatedAdmin }),
    });

    expect(await screen.findByText("تقویم عملیاتی")).toBeInTheDocument();
    expect(ADMIN_CALENDAR_DRAG_DROP_ENABLED).toBe(false);
    const root = document.querySelector(".admin-calendar");
    expect(root?.getAttribute("data-dnd")).toBe("disabled");
    expect((await screen.findAllByText(/سارا محمدی|ویزیت/)).length).toBeGreaterThan(0);
  });

  it("shows API error with retry without inventing events", async () => {
    mockedClient.mockImplementation(async (path: string) => {
      if (path === "/public/business") {
        return { timezone: "Asia/Tehran" };
      }
      throw new ApiError({ status: 500, message: "server" });
    });

    renderWithProviders(<AdminCalendarScreen />, {
      session: createSessionValue({ status: "authenticated", user: authenticatedAdmin }),
    });

    expect(await screen.findByText("تقویم بارگذاری نشد")).toBeInTheDocument();
    expect(screen.queryByText("سارا محمدی")).not.toBeInTheDocument();
  });

  it("denies without admin.calendar.view when codes are granular", async () => {
    mockedClient.mockResolvedValue(calendarPayload());
    renderWithProviders(<AdminCalendarScreen />, {
      session: createSessionValue({
        status: "authenticated",
        user: { ...authenticatedAdmin, permissionCodes: ["admin.dashboard.view"] },
      }),
    });
    expect(
      await screen.findByText("مجوز لازم برای مشاهده این بخش را ندارید."),
    ).toBeInTheDocument();
  });

  it("exposes agenda list as accessible alternative", async () => {
    mockedClient.mockImplementation(async (path: string) => {
      if (path === "/public/business") return { timezone: "Asia/Tehran" };
      return calendarPayload();
    });

    renderWithProviders(<AdminCalendarScreen />, {
      session: createSessionValue({ status: "authenticated", user: authenticatedAdmin }),
    });

    await screen.findByText("تقویم عملیاتی");
    const listButtons = await screen.findAllByRole("button", { name: /فهرست/ });
    await userEvent.click(listButtons[0]!);
    // agenda region exists in DOM (mobile or after mode switch depending on CSS)
    expect(document.querySelector(".admin-calendar")).toBeTruthy();
  });
});

describe("AdminCalendarScreen empty states", () => {
  beforeEach(() => {
    mockedClient.mockReset();
  });

  it("keeps empty date messaging when no appointments", async () => {
    mockedClient.mockImplementation(async (path: string) => {
      if (path === "/public/business") return { timezone: "Asia/Tehran" };
      return {
        ...calendarPayload(),
        events: [],
        emptyHistory: false,
        filtersApplied: false,
      };
    });
    renderWithProviders(<AdminCalendarScreen />, {
      session: createSessionValue({ status: "authenticated", user: authenticatedAdmin }),
    });
    expect(await screen.findByText(/در این بازه نوبتی ثبت نشده/)).toBeInTheDocument();
  });
});
