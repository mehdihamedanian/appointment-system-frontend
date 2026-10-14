import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminManualBookingScreen } from "@/features/admin/manual-booking/admin-manual-booking-wizard";
import { rewriteBackendRequest } from "@/lib/api/backend-contract";
import { ApiError } from "@/lib/api/errors";
import { authenticatedAdmin, createSessionValue, renderWithProviders } from "@/test/render";

const push = vi.fn();
const navigation = { search: new URLSearchParams() };

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/bookings/new",
  useRouter: () => ({ replace: push, push }),
  useSearchParams: () => navigation.search,
}));

vi.mock("@/lib/api/client", () => ({
  apiClient: vi.fn(),
}));

import { apiClient } from "@/lib/api/client";

const mockedClient = vi.mocked(apiClient);

// 2026-08-22 09:00 Asia/Tehran (+03:30) = 05:30Z; "today" is 2026-08-20.
const SLOT_START = "2026-08-22T05:30:00Z";

type Overrides = Partial<Record<string, (init?: { method?: string; body?: unknown }) => unknown>>;

/** Only routes the Backend serves; manual-booking quote, allocation and options routes 404. */
function mockBackend(overrides: Overrides = {}) {
  mockedClient.mockImplementation(async (path: string, init?: { method?: string; body?: unknown }) => {
    const override = overrides[path];
    if (override) return override(init);
    switch (path) {
      case "/services":
        return { items: [{ id: "svc_1", name: "ویزیت", durationMinutes: 30, bookingEnabled: true }] };
      case "/services/svc_1":
        return { id: "svc_1", name: "ویزیت", bookingEnabled: true };
      case "/admin/customers/search":
        return {
          items: [
            { id: "cus_1", first_name: "سارا", last_name: "رضایی", mobile: "+989121234567", status: "active" },
          ],
          meta: { page: 1, page_size: 20, total_items: 1, total_pages: 1 },
        };
      case "/staff":
        return { items: [{ id: "st_1" }, { id: "st_2" }], meta: { total: 2 } };
      case "/staff/st_1":
        return {
          id: "st_1",
          branches: [
            { id: "br_1", name: "شعبه مرکزی", is_active: true },
            { id: "br_closed", name: "شعبه بسته", is_active: false },
          ],
        };
      case "/staff/st_2":
        return {
          id: "st_2",
          branches: [
            { id: "br_1", name: "شعبه مرکزی", is_active: true },
            { id: "br_2", name: "شعبه غرب", is_active: true },
          ],
        };
      case "/admin/services/svc_1/resource-requirements":
        return { service_id: "svc_1", requirements: [] };
      case "/services/svc_1/availability":
        return {
          success: true,
          data: {
            timezone: "Asia/Tehran",
            configuration_valid: true,
            days: [{ date: "2026-08-22", slots: [{ start: SLOT_START, end: "2026-08-22T06:00:00Z" }] }],
          },
        };
      case "/admin/bookings":
        return {
          success: true,
          data: {
            appointment: {
              id: "6f1c1d2e-0000-4000-8000-000000000002",
              booking_reference: "BK-M1",
              status: "confirmed",
              payment_status: "unpaid",
              price_snapshot: "250000.00",
            },
            confirmation_sent: false,
            idempotent_replay: false,
            customer_created: false,
          },
        };
      default:
        throw new ApiError({ status: 404, message: "Not Found" });
    }
  });
}

function postsTo(path: string) {
  return mockedClient.mock.calls.filter((call) => call[0] === path && call[1]?.method === "POST");
}

async function walkToReview(
  user: ReturnType<typeof userEvent.setup>,
  options: { chooseResource?: boolean } = {},
) {
  await user.type(await screen.findByRole("combobox", { name: "جستجوی مشتری" }), "سارا");
  await user.click(await screen.findByRole("option", { name: /سارا رضایی/ }));
  await user.click(screen.getByRole("button", { name: "مرحله بعد" }));

  await user.click(await screen.findByRole("radio", { name: /ویزیت/ }));
  await user.click(screen.getByRole("button", { name: "مرحله بعد" }));

  await user.click(screen.getByRole("button", { name: "مرحله بعد" }));

  await user.click(await screen.findByRole("gridcell", { name: /^31 مرداد.*قابل رزرو/ }));
  await user.click(await screen.findByRole("radio", { name: /۰۹:۰۰|09:00/ }));
  await user.click(screen.getByRole("button", { name: "مرحله بعد" }));

  if (options.chooseResource) {
    await user.click(await screen.findByRole("radio", { name: /^انتخاب از منابع معتبر/ }));
    await user.click(screen.getByRole("radio", { name: "اتاق ۱" }));
  } else {
    expect(await screen.findByRole("heading", { name: "تخصیص خودکار" })).toBeInTheDocument();
  }
  await user.click(screen.getByRole("button", { name: "مرحله بعد" }));

  expect(await screen.findByText(/مبلغ و وضعیت پرداخت را سرویس نوبت‌دهی هنگام ثبت نوبت تعیین می‌کند/)).toBeInTheDocument();
  expect(screen.queryByText("استعلام قیمت دریافت نشد")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "مرحله بعد" }));

  await screen.findByRole("heading", { name: "بررسی و تأیید" });
}

describe("admin manual booking flow (current Backend contract)", () => {
  beforeEach(() => {
    mockedClient.mockReset();
    push.mockReset();
    navigation.search = new URLSearchParams("branch=br_1");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-08-20T08:00:00Z"));
    document.documentElement.dir = "rtl";
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function renderScreen() {
    return renderWithProviders(<AdminManualBookingScreen />, {
      session: createSessionValue({ status: "authenticated", user: authenticatedAdmin }),
    });
  }

  it("requires a customer before leaving the first step", async () => {
    const user = userEvent.setup();
    mockBackend();
    renderScreen();
    await user.click(await screen.findByRole("button", { name: "مرحله بعد" }));
    expect(screen.getByText("لطفاً یک مشتری را انتخاب کنید یا مشتری جدید بسازید.")).toHaveAttribute("role", "alert");
    expect(screen.getByRole("heading", { name: "جستجوی مشتری" })).toBeInTheDocument();
  });

  it("searches Backend customers by the search parameter and lists them by name", async () => {
    const user = userEvent.setup();
    mockBackend();
    renderScreen();
    await user.type(await screen.findByRole("combobox", { name: "جستجوی مشتری" }), "سارا");
    expect(await screen.findByRole("option", { name: /سارا رضایی/ })).toBeInTheDocument();
    const searches = mockedClient.mock.calls.filter((call) => call[0] === "/admin/customers/search");
    expect(searches.at(-1)?.[1]).toMatchObject({ query: { search: "سارا" } });
  });

  it("books through POST /admin/appointments without a quote route and confirms exactly once", async () => {
    const user = userEvent.setup();
    mockBackend();
    renderScreen();
    await walkToReview(user);

    const summaries = screen.getAllByRole("complementary", { name: "خلاصه نوبت" });
    for (const summary of summaries) {
      expect(within(summary).getByText("۰۹:۰۰")).toBeInTheDocument();
    }

    await user.dblClick(screen.getByRole("button", { name: "ثبت نوبت" }));

    expect(await screen.findByRole("heading", { name: "نوبت ثبت شد" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "BK-M1" })).toBeInTheDocument();
    expect(screen.getByText("پرداخت‌نشده")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "مشاهده نوبت" })).toHaveAttribute("href", expect.stringContaining("BK-M1"));

    const confirms = postsTo("/admin/bookings");
    expect(confirms).toHaveLength(1);
    const [path, init] = confirms[0]!;
    expect(init?.headers).toEqual(expect.objectContaining({ "Idempotency-Key": expect.any(String) }));
    const rewritten = rewriteBackendRequest({ path, method: "POST", body: init?.body });
    expect(rewritten.path).toBe("/admin/appointments");
    expect(rewritten.body).toEqual({
      customer_id: "cus_1",
      service_id: "svc_1",
      branch_id: "br_1",
      start_time: new Date(SLOT_START).toISOString(),
    });
    expect(mockedClient.mock.calls.some(([callPath]) => callPath === "/admin/bookings/quote")).toBe(false);
  });

  it("returns to date and time with the slot cleared when the slot was taken", async () => {
    const user = userEvent.setup();
    mockBackend({
      "/admin/bookings": () => {
        throw new ApiError({ status: 409, code: "SLOT_TAKEN", message: "taken" });
      },
    });
    renderScreen();
    await walkToReview(user);
    await user.click(screen.getByRole("button", { name: "ثبت نوبت" }));

    expect(await screen.findByText("این زمان دیگر در دسترس نیست. لطفاً ساعت دیگری انتخاب کنید.")).toBeInTheDocument();
    const slot = await screen.findByRole("radio", { name: /۰۹:۰۰|09:00/ });
    expect(slot).not.toBeChecked();
    expect(screen.queryByRole("heading", { name: "نوبت ثبت شد" })).not.toBeInTheDocument();
  });

  const roomRequirement = {
    "/admin/services/svc_1/resource-requirements": () => ({
      service_id: "svc_1",
      requirements: [
        { id: "req_staff", resource_type_code: "staff", resource_type_display_name: "کارمند", alternatives: [] },
        { id: "req_room", resource_type_code: "room", resource_type_display_name: "اتاق", label: "اتاق درمان" },
      ],
    }),
    "/admin/services/svc_1/resource-requirements/req_room/eligible-resources": () => ({
      requirement_id: "req_room",
      service_id: "svc_1",
      resources: [
        { id: "res_1", name: "اتاق ۱", resource_type_code: "room", is_active: true },
        { id: "res_off", name: "اتاق تعطیل", resource_type_code: "room", is_active: false },
      ],
    }),
  };

  it("offers the eligible resources of each non-staff requirement and books the chosen one", async () => {
    const user = userEvent.setup();
    mockBackend(roomRequirement);
    renderScreen();
    await walkToReview(user, { chooseResource: true });

    const eligibleCalls = mockedClient.mock.calls.filter(([path]) => String(path).endsWith("/eligible-resources"));
    expect(eligibleCalls).toHaveLength(1);
    expect(eligibleCalls[0]![1]).toMatchObject({ query: { active_only: "true", branch_id: "br_1" } });

    await user.click(screen.getByRole("button", { name: "ثبت نوبت" }));
    expect(await screen.findByRole("heading", { name: "نوبت ثبت شد" })).toBeInTheDocument();
    const [path, init] = postsTo("/admin/bookings")[0]!;
    expect(rewriteBackendRequest({ path, method: "POST", body: init?.body }).body).toMatchObject({
      resource_selections: [{ requirement_id: "req_room", resource_id: "res_1" }],
    });
  });

  it("falls back to automatic allocation when the Backend rejects chosen resources", async () => {
    const user = userEvent.setup();
    mockBackend({
      ...roomRequirement,
      "/admin/bookings": () => {
        throw new ApiError({ status: 422, code: "RESOURCE_CONFLICT", message: "conflict" });
      },
    });
    renderScreen();
    await walkToReview(user, { chooseResource: true });
    await user.click(screen.getByRole("button", { name: "ثبت نوبت" }));

    expect(await screen.findByText("تخصیص منابع با تغییر دیگری در تضاد است.")).toBeInTheDocument();
    expect(await screen.findByRole("radio", { name: /^تخصیص خودکار/ })).toBeChecked();
    expect(screen.queryByRole("radio", { name: "اتاق ۱" })).not.toBeInTheDocument();
  });

  async function chooseCustomerAndService(user: ReturnType<typeof userEvent.setup>) {
    await user.type(await screen.findByRole("combobox", { name: "جستجوی مشتری" }), "سارا");
    await user.click(await screen.findByRole("option", { name: /سارا رضایی/ }));
    await user.click(screen.getByRole("button", { name: "مرحله بعد" }));
    await user.click(await screen.findByRole("radio", { name: /ویزیت/ }));
  }

  it("offers the active branches of staff qualified for the service and requires one", async () => {
    const user = userEvent.setup();
    navigation.search = new URLSearchParams();
    mockBackend();
    renderScreen();
    await chooseCustomerAndService(user);

    const branches = await screen.findByRole("group", { name: "انتخاب شعبه" });
    expect(within(branches).getAllByRole("radio")).toHaveLength(2);
    expect(within(branches).queryByText("شعبه بسته")).not.toBeInTheDocument();
    expect(mockedClient).toHaveBeenCalledWith(
      "/staff",
      expect.objectContaining({ query: { service_id: "svc_1", is_active: "true", page_size: 50 } }),
    );

    await user.click(screen.getByRole("button", { name: "مرحله بعد" }));
    expect(await screen.findByText("لطفاً یک شعبه را انتخاب کنید.")).toBeInTheDocument();
    expect(mockedClient.mock.calls.some(([callPath]) => callPath === "/services/svc_1/availability")).toBe(false);

    await user.click(within(branches).getByRole("radio", { name: /شعبه غرب/ }));
    await user.click(screen.getByRole("button", { name: "مرحله بعد" }));
    await user.click(screen.getByRole("button", { name: "مرحله بعد" }));
    await screen.findByRole("gridcell", { name: /^31 مرداد.*قابل رزرو/ });
    const availability = mockedClient.mock.calls.find(([callPath]) => callPath === "/services/svc_1/availability");
    expect(availability?.[1]).toEqual(
      expect.objectContaining({ query: expect.objectContaining({ branch_id: "br_2" }) }),
    );
  });

  it("explains that no branch is available when no active staff is qualified", async () => {
    const user = userEvent.setup();
    navigation.search = new URLSearchParams();
    mockBackend({ "/staff": () => ({ items: [], meta: { total: 0 } }) });
    renderScreen();
    await chooseCustomerAndService(user);

    expect(await screen.findByText("شعبه‌ای برای این خدمت نیست")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "مرحله بعد" }));
    expect(mockedClient.mock.calls.some(([callPath]) => callPath === "/services/svc_1/availability")).toBe(false);
    expect(postsTo("/admin/bookings")).toHaveLength(0);
  });
});
