import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient } from "@tanstack/react-query";
import { AppointmentsScreen } from "@/features/customer/appointments-screen";
import { ApiError } from "@/lib/api/errors";
import { clearFrontendCaches } from "@/lib/auth/session";
import { queryKeys } from "@/lib/query/keys";
import {
  createSessionValue,
  renderWithProviders,
} from "@/test/render";

const push = vi.fn();
const replace = vi.fn();
const search = { current: new URLSearchParams() };

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
  usePathname: () => "/appointments",
  useSearchParams: () => search.current,
}));

vi.mock("@/lib/api/client", () => ({
  apiClient: vi.fn(),
}));

import { apiClient } from "@/lib/api/client";

const mockedClient = vi.mocked(apiClient);

function item(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    publicReference: id,
    status: "confirmed",
    service: { id: "svc_1", name: "ویزیت" },
    provider: { mode: "specific", id: "prv_1", name: "دکتر نمونه" },
    branch: { id: "br_1", name: "شعبه مرکزی" },
    startsAt: "2026-08-22T09:00:00+03:30",
    durationMinutes: 30,
    paymentStatus: "paid",
    timezone: "Asia/Tehran",
    actions: {
      canView: true,
      canCancel: true,
      canReschedule: true,
      canRepeat: true,
      canPay: false,
    },
    ...overrides,
  };
}

describe("AppointmentsScreen", () => {
  beforeEach(() => {
    mockedClient.mockReset();
    push.mockReset();
    replace.mockReset();
    search.current = new URLSearchParams();
    document.documentElement.dir = "rtl";
  });

  it("does not fetch appointments before the customer session is ready", () => {
    renderWithProviders(<AppointmentsScreen />, {
      session: createSessionValue({ status: "unauthenticated", user: null }),
    });
    expect(mockedClient).not.toHaveBeenCalled();
    expect(screen.getByLabelText("در حال بارگذاری نوبت‌ها")).toBeInTheDocument();
  });

  it("renders upcoming cards from Backend order", async () => {
    mockedClient.mockResolvedValue({
      items: [item("apt_2"), item("apt_1", { service: { id: "svc_1", name: "سونوگرافی" } })],
      counts: { upcoming: 2, past: 0, cancelled: 1 },
    });
    renderWithProviders(<AppointmentsScreen />);
    expect(await screen.findByRole("heading", { name: "ویزیت" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "سونوگرافی" })).toBeInTheDocument();
    expect(screen.getAllByText("تأییدشده").length).toBeGreaterThan(0);
    expect(screen.getAllByText("پرداخت‌شده").length).toBeGreaterThan(0);
    expect(screen.getAllByText("دکتر نمونه").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/دقیقه/).length).toBeGreaterThan(0);
    expect(screen.getByText("apt_2")).toHaveClass("ltr-value");
    expect(screen.getAllByRole("link", { name: "مشاهده جزئیات" })[0]).toHaveAttribute(
      "href",
      "/appointments/apt_2",
    );
    expect(screen.getByRole("tab", { name: /آینده/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /آینده/ })).toHaveTextContent("2");
    expect(document.documentElement.dir).toBe("rtl");
  });

  it("restores the past tab from the URL", async () => {
    search.current = new URLSearchParams("category=past");
    mockedClient.mockResolvedValue({ items: [item("apt_9", { status: "completed" })] });
    renderWithProviders(<AppointmentsScreen />);
    expect(await screen.findByRole("tab", { name: /گذشته/ })).toHaveAttribute("aria-selected", "true");
    expect(mockedClient).toHaveBeenCalledWith(
      expect.stringContaining("category=past"),
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("falls back from an invalid category to upcoming", async () => {
    search.current = new URLSearchParams("category=admin");
    mockedClient.mockResolvedValue({ items: [] });
    renderWithProviders(<AppointmentsScreen />);
    expect(await screen.findByRole("tab", { name: /آینده/ })).toHaveAttribute("aria-selected", "true");
    expect(mockedClient).toHaveBeenCalledWith(
      expect.stringContaining("category=upcoming"),
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("switches tabs through keyboard-accessible controls", async () => {
    mockedClient.mockResolvedValue({ items: [] });
    const user = userEvent.setup();
    renderWithProviders(<AppointmentsScreen />);
    await screen.findByRole("heading", { name: "نوبت آینده‌ای ندارید." });
    await user.click(screen.getByRole("tab", { name: /لغوشده/ }));
    expect(push).toHaveBeenCalledWith("/appointments?category=cancelled");
  });

  it("shows the upcoming empty state with a booking CTA", async () => {
    mockedClient.mockResolvedValue({ items: [] });
    renderWithProviders(<AppointmentsScreen />);
    expect(await screen.findByRole("heading", { name: "نوبت آینده‌ای ندارید." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "رزرو نوبت" })).toHaveAttribute("href", "/booking");
  });

  it("shows the past empty state", async () => {
    search.current = new URLSearchParams("category=past");
    mockedClient.mockResolvedValue({ items: [] });
    renderWithProviders(<AppointmentsScreen />);
    expect(await screen.findByRole("heading", { name: "هنوز نوبت تکمیل‌شده‌ای ندارید." })).toBeInTheDocument();
  });

  it("shows the cancelled empty state", async () => {
    search.current = new URLSearchParams("category=cancelled");
    mockedClient.mockResolvedValue({ items: [] });
    renderWithProviders(<AppointmentsScreen />);
    expect(await screen.findByRole("heading", { name: "نوبت لغوشده‌ای وجود ندارد." })).toBeInTheDocument();
  });

  it("keeps the selected tab visible on API error and does not show empty", async () => {
    search.current = new URLSearchParams("category=past");
    mockedClient.mockRejectedValue(new ApiError({ status: 500, message: "خطا", requestId: "req_ap" }));
    renderWithProviders(<AppointmentsScreen />);
    expect(await screen.findByText("نوبت‌ها بارگذاری نشد")).toBeInTheDocument();
    expect(screen.getByText("req_ap")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /گذشته/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByText("هنوز نوبت تکمیل‌شده‌ای ندارید.")).not.toBeInTheDocument();
  });

  it("shows cancel action when Backend allows it", async () => {
    mockedClient.mockResolvedValue({ items: [item("apt_1")] });
    const user = userEvent.setup();
    renderWithProviders(<AppointmentsScreen />);
    await screen.findByRole("heading", { name: "ویزیت" });
    await user.click(screen.getByRole("button", { name: /اقدامات بیشتر/ }));
    expect(screen.getByRole("menuitem", { name: "لغو نوبت" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "زمان‌بندی مجدد" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "رزرو دوباره" })).toBeInTheDocument();
  });

  it("shows continue payment only when Backend allows it", async () => {
    mockedClient.mockResolvedValue({
      items: [
        item("apt_pay", {
          paymentStatus: "pending_payment",
          actions: { canView: true, canPay: true, payHref: "/booking/payment" },
        }),
      ],
    });
    renderWithProviders(<AppointmentsScreen />);
    expect(await screen.findByRole("link", { name: "ادامه پرداخت" })).toHaveAttribute(
      "href",
      "/booking/payment",
    );
  });

  it("hides unsafe actions when eligibility is omitted", async () => {
    mockedClient.mockResolvedValue({
      items: [
        item("apt_1", {
          actions: {},
          notes: "یادداشت داخلی",
          resources: [{ kind: "chair", name: "صندلی ۴" }],
        }),
      ],
    });
    renderWithProviders(<AppointmentsScreen />);
    await screen.findByRole("heading", { name: "ویزیت" });
    expect(screen.queryByRole("link", { name: "مشاهده جزئیات" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "ادامه پرداخت" })).not.toBeInTheDocument();
    expect(screen.queryByText(/یادداشت داخلی|صندلی ۴/)).not.toBeInTheDocument();
  });

  it("repeats a booking without carrying slot or price", async () => {
    mockedClient.mockResolvedValue({ items: [item("apt_1")] });
    const user = userEvent.setup();
    renderWithProviders(<AppointmentsScreen />);
    await screen.findByRole("heading", { name: "ویزیت" });
    await user.click(screen.getByRole("button", { name: /اقدامات بیشتر/ }));
    await user.click(screen.getByRole("menuitem", { name: "رزرو دوباره" }));
    expect(push).toHaveBeenCalledWith(
      expect.stringMatching(/^\/booking\?service=svc_1.*repeatFrom=apt_1/),
    );
    expect(push.mock.calls[0]?.[0]).not.toMatch(/slot|price|coupon/);
  });

  it("keeps existing cards while loading more", async () => {
    mockedClient.mockImplementation(async (path: string) => {
      if (path.includes("cursor=cur_2")) {
        return { items: [item("apt_2")], hasMore: false };
      }
      return { items: [item("apt_1")], hasMore: true, nextCursor: "cur_2" };
    });
    const user = userEvent.setup();
    renderWithProviders(<AppointmentsScreen />);
    expect(await screen.findByRole("heading", { name: "ویزیت" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "نمایش نوبت‌های بیشتر" }));
    await waitFor(() => {
      expect(screen.getAllByRole("heading", { name: "ویزیت" })).toHaveLength(2);
    });
  });

  it("paginates with keyboard-accessible page controls", async () => {
    mockedClient.mockResolvedValue({
      items: [item("apt_1")],
      page: 1,
      pageCount: 3,
    });
    const user = userEvent.setup();
    renderWithProviders(<AppointmentsScreen />);
    await screen.findByLabelText("صفحه‌بندی");
    await user.click(screen.getByRole("button", { name: "2" }));
    expect(push).toHaveBeenCalledWith("/appointments?category=upcoming&page=2");
  });

  it("scopes list cache per customer and clears it on logout", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(queryKeys.customer.appointmentList("user_1", "upcoming", { page: 1 }), {
      secret: true,
    });
    clearFrontendCaches(queryClient);
    expect(
      queryClient.getQueryData(queryKeys.customer.appointmentList("user_1", "upcoming", { page: 1 })),
    ).toBeUndefined();
    expect(queryKeys.customer.appointmentList("user_1", "upcoming", { page: 1 })).not.toEqual(
      queryKeys.customer.appointmentList("user_2", "upcoming", { page: 1 }),
    );
  });
});
