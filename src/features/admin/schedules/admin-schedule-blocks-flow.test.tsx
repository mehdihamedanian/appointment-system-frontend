import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminScheduleResourceScreen } from "@/features/admin/schedules/admin-schedule-editor-screen";
import { ApiError } from "@/lib/api/errors";
import { formatAppointmentParts } from "@/lib/date-time/format";
import { authenticatedAdmin, createSessionValue, renderWithProviders } from "@/test/render";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/schedules/resources/res_1",
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

vi.mock("@/lib/api/client", () => ({
  apiClient: vi.fn(),
}));

import { apiClient } from "@/lib/api/client";

const mockedClient = vi.mocked(apiClient);
const BASE = "/resources/res_1";

const resourceRead = {
  id: "res_1",
  name: "اتاق لیزر",
  description: null,
  is_active: true,
  capacity: 1,
  resource_type: { id: "rt_room", code: "room", display_name: "Room" },
  branches: [{ id: "br_1", name: "شعبه مرکزی", is_active: true }],
};

function blockRead(id: string, startsAt: string, endsAt: string, reason: string) {
  return { id, starts_at: startsAt, ends_at: endsAt, reason, is_active: true };
}

const existingBlock = blockRead(
  "blk_1",
  "2026-08-25T00:00:00+03:30",
  "2026-08-26T00:00:00+03:30",
  "تعمیر دستگاه",
);

describe("resource blocking (Backend blocked-times contract)", () => {
  let blocks: unknown[];
  let workingHours: unknown[];

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-08-20T08:00:00Z"));
    blocks = [existingBlock];
    workingHours = [];
    mockedClient.mockReset();
    mockedClient.mockImplementation(async (path, init) => {
      const method = init?.method ?? "GET";
      if (path === `${BASE}/blocked-times` && method === "POST") {
        const body = init!.body as Record<string, string>;
        const created = blockRead("blk_2", body.starts_at, body.ends_at, body.reason);
        blocks = [...blocks, created];
        return created;
      }
      if (path === `${BASE}/blocked-times/blk_1/release` && method === "POST") {
        blocks = blocks.filter((item) => (item as { id: string }).id !== "blk_1");
        return { ...existingBlock, is_active: false };
      }
      if (path === `${BASE}/blocked-times`) return blocks;
      if (path === `${BASE}/working-hours`) return workingHours;
      if (path === `${BASE}/time-off`) return [];
      if (path === `${BASE}/schedule`) {
        return {
          scope: "resource",
          from_date: "2026-08-20",
          to_date: "2026-08-26",
          timezone: "Asia/Tehran",
          intervals: [
            {
              date: "2026-08-22",
              starts_at: "2026-08-22T09:00:00+03:30",
              ends_at: "2026-08-22T17:00:00+03:30",
              timezone: "Asia/Tehran",
            },
          ],
        };
      }
      if (path === BASE) return resourceRead;
      if (path === "/public/business") return { name: "کلینیک", timezone: "Asia/Tehran" };
      throw new ApiError({ status: 404, message: "نیست" });
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function renderScreen() {
    return renderWithProviders(<AdminScheduleResourceScreen resourceReference="res_1" />, {
      session: createSessionValue({ user: authenticatedAdmin }),
    });
  }

  async function pickDate(user: ReturnType<typeof userEvent.setup>, field: string, day: RegExp) {
    await user.click(screen.getByRole("combobox", { name: field }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("gridcell", { name: day }));
  }

  function calledPath(path: string, method: string) {
    return mockedClient.mock.calls.some(
      (call) => call[0] === path && (call[1]?.method ?? "GET") === method,
    );
  }

  it("reads the effective schedule for the resource's own branch and keeps weekly hours read-only", async () => {
    renderScreen();
    expect(await screen.findByText(/ساعات هفتگی این مورد در این صفحه فقط نمایش داده می‌شود/)).toBeInTheDocument();
    expect(mockedClient).toHaveBeenCalledWith(
      `${BASE}/schedule`,
      expect.objectContaining({
        query: { from: "2026-08-20", to: "2026-08-26", branch_id: "br_1" },
      }),
    );
    expect(mockedClient).toHaveBeenCalledWith(
      `${BASE}/blocked-times`,
      expect.objectContaining({ query: { active_only: "true" } }),
    );
    expect(screen.queryByRole("button", { name: "ذخیره ساعات هفتگی" })).not.toBeInTheDocument();
    const start = formatAppointmentParts("2026-08-22T09:00:00+03:30", "Asia/Tehran")!;
    const end = formatAppointmentParts("2026-08-22T17:00:00+03:30", "Asia/Tehran")!;
    expect(screen.getByText(`${start.date}: ${start.time} – ${end.time}`)).toBeInTheDocument();
  });

  it("explains why branch-specific working hours are not editable here", async () => {
    workingHours = [{ id: "wh_1", weekday: 0, branch_id: "br_1", start_time: "10:00:00", end_time: "14:00:00" }];
    renderScreen();
    expect(await screen.findByText(/ساعات کاری مخصوص شعبه دارد/)).toBeInTheDocument();
  });

  it("blocks whole days in the schedule timezone with a required reason after confirmation", async () => {
    const user = userEvent.setup();
    renderScreen();
    await user.click(await screen.findByRole("tab", { name: "مسدودی" }));
    expect(screen.getByText("تعمیر دستگاه")).toBeInTheDocument();
    expect(screen.queryByRole("switch", { name: "تمام‌روز" })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "یادداشت داخلی" })).not.toBeInTheDocument();

    const submit = screen.getByRole("button", { name: /ثبت مسدودی/ });
    // 30 and 31 Mordad 1405 = 2026-08-21 and 2026-08-22.
    await pickDate(user, "شروع", /^30 مرداد/);
    await pickDate(user, "پایان", /^31 مرداد/);
    expect(submit).toBeDisabled();
    await user.type(screen.getByRole("textbox", { name: /دلیل/ }), "سرویس دوره‌ای");
    expect(submit).toBeEnabled();
    await user.click(submit);

    const dialog = await screen.findByRole("dialog", { name: "تأیید تغییر" });
    expect(calledPath(`${BASE}/blocked-times`, "POST")).toBe(false);
    await user.click(within(dialog).getByRole("button", { name: "ذخیره" }));

    await waitFor(() => {
      expect(mockedClient).toHaveBeenCalledWith(
        `${BASE}/blocked-times`,
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({ "Idempotency-Key": expect.any(String) }),
          body: {
            starts_at: "2026-08-21T00:00:00+03:30",
            ends_at: "2026-08-23T00:00:00+03:30",
            reason: "سرویس دوره‌ای",
          },
        }),
      );
    });
    expect(await screen.findByText("سرویس دوره‌ای")).toBeInTheDocument();
  });

  it("does not block when the confirmation is cancelled", async () => {
    const user = userEvent.setup();
    renderScreen();
    await user.click(await screen.findByRole("tab", { name: "مسدودی" }));
    await pickDate(user, "شروع", /^30 مرداد/);
    await pickDate(user, "پایان", /^31 مرداد/);
    await user.type(screen.getByRole("textbox", { name: /دلیل/ }), "سرویس");
    await user.click(screen.getByRole("button", { name: /ثبت مسدودی/ }));

    const dialog = await screen.findByRole("dialog", { name: "تأیید تغییر" });
    await user.click(within(dialog).getByRole("button", { name: /انصراف/ }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "تأیید تغییر" })).not.toBeInTheDocument());
    expect(calledPath(`${BASE}/blocked-times`, "POST")).toBe(false);
  });

  it("rejects an end date before the start date", async () => {
    const user = userEvent.setup();
    renderScreen();
    await user.click(await screen.findByRole("tab", { name: "مسدودی" }));
    await pickDate(user, "شروع", /^31 مرداد/);
    await pickDate(user, "پایان", /^30 مرداد/);
    await user.type(screen.getByRole("textbox", { name: /دلیل/ }), "سرویس");
    expect(screen.getByText("تاریخ پایان نباید پیش از شروع باشد.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ثبت مسدودی/ })).toBeDisabled();
  });

  it("releases only the chosen block after confirmation", async () => {
    const user = userEvent.setup();
    renderScreen();
    await user.click(await screen.findByRole("tab", { name: "مسدودی" }));
    await user.click(screen.getByRole("button", { name: "رفع مسدودی" }));

    const dialog = await screen.findByRole("dialog", { name: "تأیید تغییر" });
    await user.click(within(dialog).getByRole("button", { name: "ذخیره" }));

    await waitFor(() => {
      expect(mockedClient).toHaveBeenCalledWith(
        `${BASE}/blocked-times/blk_1/release`,
        expect.objectContaining({ method: "POST", body: {} }),
      );
    });
    expect(calledPath(`${BASE}/blocked-times/blk_1`, "DELETE")).toBe(false);
    await waitFor(() => expect(screen.queryByText("تعمیر دستگاه")).not.toBeInTheDocument());
    expect(screen.getByText("مسدودی ثبت نشده.")).toBeInTheDocument();
  });

  it("surfaces a Backend rejection without showing a fake block", async () => {
    const user = userEvent.setup();
    const original = mockedClient.getMockImplementation()!;
    mockedClient.mockImplementation(async (path, init) => {
      if (path === `${BASE}/blocked-times` && init?.method === "POST") {
        throw new ApiError({ status: 409, code: "CONFLICT", message: "نوبت قطعی در این بازه وجود دارد." });
      }
      return original(path, init);
    });
    renderScreen();
    await user.click(await screen.findByRole("tab", { name: "مسدودی" }));
    await pickDate(user, "شروع", /^30 مرداد/);
    await pickDate(user, "پایان", /^31 مرداد/);
    await user.type(screen.getByRole("textbox", { name: /دلیل/ }), "سرویس");
    await user.click(screen.getByRole("button", { name: /ثبت مسدودی/ }));
    const dialog = await screen.findByRole("dialog", { name: "تأیید تغییر" });
    await user.click(within(dialog).getByRole("button", { name: "ذخیره" }));

    expect((await screen.findAllByText("نوبت قطعی در این بازه وجود دارد.")).length).toBeGreaterThan(0);
    expect(screen.queryByText(/نسخه تغییر کرده/)).not.toBeInTheDocument();
    expect(screen.queryByText("سرویس")).not.toBeInTheDocument();
  });
});
