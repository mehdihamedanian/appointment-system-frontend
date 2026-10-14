import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminScheduleStaffScreen } from "@/features/admin/schedules/admin-schedule-editor-screen";
import { ApiError } from "@/lib/api/errors";
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
const BASE = "/staff/st_1";

const staffRead = {
  id: "st_1",
  resource_id: "res_st_1",
  resource_type_code: "specialist",
  first_name: "دکتر",
  last_name: "رضایی",
  is_active: true,
  capacity: 1,
  branches: [
    { id: "br_1", name: "شعبه مرکزی", is_active: true },
    { id: "br_2", name: "شعبه غرب", is_active: true },
    { id: "br_3", name: "شعبه بسته", is_active: false },
  ],
};

function effective(branchId: string) {
  return {
    scope: "resource",
    branch_id: branchId,
    from_date: "2026-08-20",
    to_date: "2026-08-26",
    timezone: "Asia/Tehran",
    intervals: [],
  };
}

describe("AdminScheduleStaffScreen (Backend staff schedule contract)", () => {
  let timeOff: unknown[];

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-08-20T08:00:00Z"));
    timeOff = [];
    mockedClient.mockReset();
    mockedClient.mockImplementation(async (path, init) => {
      const method = init?.method ?? "GET";
      if (path === `${BASE}/time-off` && method === "POST") {
        const body = init!.body as Record<string, unknown>;
        const created = {
          id: "to_1",
          starts_at: body.starts_at,
          ends_at: body.ends_at,
          reason: body.reason,
          is_full_day: body.is_full_day,
        };
        timeOff = [...timeOff, created];
        return created;
      }
      if (path === `${BASE}/time-off/to_1` && method === "DELETE") {
        timeOff = [];
        return undefined;
      }
      if (path === `${BASE}/time-off`) return timeOff;
      if (path === `${BASE}/working-hours`) return [];
      if (path === `${BASE}/blocked-times`) return [];
      if (path === `${BASE}/schedule`) {
        const query = init?.query as Record<string, string>;
        return effective(query.branch_id);
      }
      if (path === BASE) return staffRead;
      if (path === "/public/business") return { timezone: "Asia/Tehran", name: "کلینیک" };
      throw new ApiError({ status: 404, message: "نیست" });
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function pickDate(user: ReturnType<typeof userEvent.setup>, field: string, day: RegExp) {
    await user.click(screen.getByRole("combobox", { name: field }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("gridcell", { name: day }));
  }

  it("Admin → staff schedule → add full-day leave → confirm → Backend time-off", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminScheduleStaffScreen staffReference="st_1" />, {
      session: createSessionValue({ user: authenticatedAdmin }),
    });

    expect(await screen.findByRole("heading", { name: /زمان‌بندی دکتر رضایی/ })).toBeInTheDocument();
    const scheduleCalls = mockedClient.mock.calls.filter((call) => call[0] === `${BASE}/schedule`);
    expect(scheduleCalls.map((call) => (call[1]?.query as Record<string, string>).branch_id)).toEqual([
      "br_1",
      "br_2",
    ]);
    expect(screen.queryByRole("button", { name: /ذخیره ساعات هفتگی/ })).not.toBeInTheDocument();
    expect(mockedClient.mock.calls.some((call) => String(call[0]).includes("/admin/schedules"))).toBe(false);

    await user.click(screen.getByRole("tab", { name: "مرخصی" }));
    // 30 Mordad 1405 = 2026-08-21.
    await pickDate(user, "شروع", /^30 مرداد/);
    await pickDate(user, "پایان", /^30 مرداد/);
    await user.type(screen.getByRole("textbox", { name: "دلیل" }), "مرخصی استحقاقی");
    await user.click(screen.getByRole("button", { name: "ثبت مرخصی" }));

    const dialog = await screen.findByRole("dialog", { name: "تأیید تغییر" });
    await user.click(within(dialog).getByRole("button", { name: "ذخیره" }));

    await waitFor(() => {
      expect(mockedClient).toHaveBeenCalledWith(
        `${BASE}/time-off`,
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({ "Idempotency-Key": expect.any(String) }),
          body: {
            starts_at: "2026-08-21T00:00:00+03:30",
            ends_at: "2026-08-22T00:00:00+03:30",
            reason: "مرخصی استحقاقی",
            is_full_day: true,
          },
        }),
      );
    });
    expect(await screen.findByText("مرخصی استحقاقی")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "حذف مرخصی" }));
    const deleteDialog = await screen.findByRole("dialog", { name: "تأیید تغییر" });
    await user.click(within(deleteDialog).getByRole("button", { name: "ذخیره" }));
    await waitFor(() => {
      expect(mockedClient).toHaveBeenCalledWith(
        `${BASE}/time-off/to_1`,
        expect.objectContaining({ method: "DELETE" }),
      );
    });
    expect(await screen.findByText("مرخصی ثبت نشده.")).toBeInTheDocument();
  });
});
