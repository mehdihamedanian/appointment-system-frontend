import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminCalendarScreen } from "@/features/admin/calendar/admin-calendar-screen";
import { ApiError } from "@/lib/api/errors";
import { authenticatedAdmin, createSessionValue, renderWithProviders } from "@/test/render";

const replace = vi.fn();
const navigation = { search: new URLSearchParams() };

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/calendar",
  useRouter: () => ({ replace, push: replace }),
  useSearchParams: () => navigation.search,
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
        blockReason: "تعمیر دستگاه",
        columnId: "st_1",
      },
    ],
    filterOptions: { staff: [{ id: "st_1", name: "دکتر الف" }] },
  };
}

function appointmentDetail() {
  return {
    id: "apt_1",
    reference: "REF-CAL-1",
    status: "confirmed",
    startsAt: "2026-08-25T05:30:00.000Z",
    endsAt: "2026-08-25T06:00:00.000Z",
    customerName: "سارا محمدی",
    customer: { id: "cus_1", name: "سارا محمدی" },
    serviceName: "ویزیت",
    service: { id: "svc_1", name: "ویزیت" },
    paymentStatus: "paid",
  };
}

function lastReplacedUrl(): URL {
  const href = replace.mock.calls.at(-1)?.[0] as string;
  return new URL(href, "http://localhost");
}

describe("admin calendar flow (mocked Backend)", () => {
  beforeEach(() => {
    replace.mockReset();
    mockedClient.mockReset();
    navigation.search = new URLSearchParams("view=day&date=2026-08-25");
    mockedClient.mockImplementation(async (path: string) => {
      if (path === "/public/business") return { timezone: "Asia/Tehran" };
      if (path === "/admin/calendar") return calendarPayload();
      if (path === "/admin/appointments/REF-CAL-1") return appointmentDetail();
      throw new ApiError({ status: 404, message: "نیست" });
    });
  });

  function renderScreen(user = authenticatedAdmin) {
    return renderWithProviders(<AdminCalendarScreen />, {
      session: createSessionValue({ status: "authenticated", user }),
    });
  }

  it("requests the visible day and moves the date and range through the URL", async () => {
    const user = userEvent.setup();
    renderScreen();
    await screen.findAllByText(/سارا محمدی/);

    const calendarCall = mockedClient.mock.calls.find((call) => call[0] === "/admin/calendar");
    expect(calendarCall?.[1]).toEqual(expect.objectContaining({ method: "GET" }));
    expect(JSON.stringify(calendarCall?.[1]?.query)).toContain("2026-08-25");

    await user.click(screen.getByRole("button", { name: "بازه بعدی" }));
    expect(lastReplacedUrl().searchParams.get("date")).toBe("2026-08-26");

    await user.click(screen.getByRole("button", { name: "بازه قبلی" }));
    expect(lastReplacedUrl().searchParams.get("date")).toBe("2026-08-24");

    const views = screen.getByRole("group", { name: "بازه نمایش" });
    await user.click(within(views).getByRole("button", { name: "هفته" }));
    expect(lastReplacedUrl().searchParams.get("view")).toBe("week");
    expect(lastReplacedUrl().searchParams.get("date")).toBe("2026-08-25");

    const groups = screen.getByRole("group", { name: "گروه‌بندی" });
    await user.click(within(groups).getByRole("button", { name: "کارکنان" }));
    expect(lastReplacedUrl().pathname).toBe("/admin/calendar");
  });

  it("opens an appointment in the quick view and links to its detail page", async () => {
    const user = userEvent.setup();
    renderScreen();
    const [event] = await screen.findAllByRole("button", { name: /سارا محمدی/ });
    await user.click(event!);

    expect(lastReplacedUrl().searchParams.get("event")).toBe("REF-CAL-1");
    const drawer = await screen.findByRole("dialog", { name: "نمای سریع نوبت" });
    expect(await within(drawer).findByText("REF-CAL-1")).toBeInTheDocument();
    expect(within(drawer).getByText("وضعیت").nextElementSibling).toHaveTextContent("تأییدشده");
    expect(within(drawer).getByRole("link", { name: "مشاهده جزئیات کامل" })).toHaveAttribute(
      "href",
      "/admin/appointments/REF-CAL-1",
    );
    expect(mockedClient).toHaveBeenCalledWith("/admin/appointments/REF-CAL-1", expect.anything());
  });

  it("shows why time is blocked only to staff allowed to see block reasons", async () => {
    const user = userEvent.setup();
    const { unmount } = renderScreen();
    const [blocked] = await screen.findAllByRole("button", { name: /مسدود/ });
    await user.click(blocked!);
    const drawer = await screen.findByRole("dialog", { name: "زمان مسدود" });
    expect(within(drawer).getByText("تعمیر دستگاه")).toBeInTheDocument();
    unmount();

    renderScreen({ ...authenticatedAdmin, permissionCodes: ["admin.calendar.view"] });
    await screen.findAllByText(/سارا محمدی/);
    expect(screen.queryByText("تعمیر دستگاه")).not.toBeInTheDocument();
  });
});
