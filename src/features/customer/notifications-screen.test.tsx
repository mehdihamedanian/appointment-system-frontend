import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient } from "@tanstack/react-query";
import { CustomerNotificationBell } from "@/features/customer/customer-notification-bell";
import { NotificationsScreen } from "@/features/customer/notifications-screen";
import { NotificationDetailScreen } from "@/features/customer/notification-detail-screen";
import { ApiError } from "@/lib/api/errors";
import { clearFrontendCaches } from "@/lib/auth/session";
import { queryKeys } from "@/lib/query/keys";
import { createSessionValue, renderWithProviders } from "@/test/render";

const push = vi.fn();
const replace = vi.fn();
const search = { current: new URLSearchParams() };
const params = { current: { notificationId: "n1" } as Record<string, string> };

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
  usePathname: () => "/notifications",
  useSearchParams: () => search.current,
  useParams: () => params.current,
}));

vi.mock("@/lib/api/client", () => ({
  apiClient: vi.fn(),
}));

import { apiClient } from "@/lib/api/client";

const mockedClient = vi.mocked(apiClient);

function notification(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    type: "appointment_reminder",
    title: `عنوان ${id}`,
    message: "متن اعلان",
    createdAt: "2026-08-22T10:00:00.000Z",
    read: false,
    entityType: "appointment",
    entityReference: "apt_1",
    ...overrides,
  };
}

describe("CustomerNotificationBell", () => {
  beforeEach(() => {
    mockedClient.mockReset();
    document.documentElement.dir = "rtl";
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    });
  });

  it("shows unread badge with accessible label", async () => {
    mockedClient.mockImplementation(async (path) => {
      if (String(path).includes("unread-count")) {
        return { success: true, data: { unread_count: 2 } };
      }
      if (String(path) === "/notifications/in-app") {
        return { items: [notification("n1"), notification("n2", { read: true })] };
      }
      return {};
    });
    renderWithProviders(<CustomerNotificationBell />);
    expect(await screen.findByRole("button", { name: /۲ خوانده‌نشده/ })).toBeInTheDocument();
    expect(screen.getByText("۲")).toBeInTheDocument();
  });

  it("opens recent notifications and keeps header usable on error", async () => {
    mockedClient.mockImplementation(async (path) => {
      if (String(path).includes("unread-count")) {
        return { unreadCount: 1 };
      }
      if (String(path) === "/notifications/in-app") {
        throw new ApiError({ status: 500, code: "SERVER", message: "fail" });
      }
      return {};
    });
    const user = userEvent.setup();
    renderWithProviders(<CustomerNotificationBell />);
    await user.click(await screen.findByRole("button", { name: /خوانده‌نشده/ }));
    expect(await screen.findByText("اعلان‌ها بارگذاری نشد.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "تلاش دوباره" })).toBeInTheDocument();
  });
});

describe("NotificationsScreen", () => {
  beforeEach(() => {
    mockedClient.mockReset();
    push.mockReset();
    replace.mockReset();
    search.current = new URLSearchParams();
    document.documentElement.dir = "rtl";
  });

  it("does not fetch before session is ready", () => {
    renderWithProviders(<NotificationsScreen />, {
      session: createSessionValue({ status: "unauthenticated", user: null }),
    });
    expect(mockedClient).not.toHaveBeenCalled();
    expect(screen.getByLabelText("در حال بارگذاری اعلان‌ها")).toBeInTheDocument();
  });

  it("requests the Backend inbox with offset pagination and the unread filter", async () => {
    search.current = new URLSearchParams("read=unread");
    mockedClient.mockResolvedValue({
      success: true,
      data: {
        items: Array.from({ length: 21 }, (_, index) =>
          notification(`n${index + 1}`, { created_at: "2026-08-22T10:00:00Z" }),
        ),
        unread_count: 21,
      },
    });
    renderWithProviders(<NotificationsScreen />);
    expect(await screen.findByText("عنوان n1")).toBeInTheDocument();
    expect(screen.queryByText("عنوان n21")).not.toBeInTheDocument();
    expect(mockedClient).toHaveBeenCalledWith(
      "/notifications/in-app",
      expect.objectContaining({ query: { limit: 21, offset: 0, unread_only: true } }),
    );
  });

  it("renders unread and read notifications with deep link", async () => {
    mockedClient.mockResolvedValue({
      items: [
        notification("n1"),
        notification("n2", { read: true, type: "payment", entityType: "payment", entityReference: "pay_1" }),
      ],
      unreadCount: 1,
    });
    renderWithProviders(<NotificationsScreen />);
    expect(await screen.findByText("عنوان n1")).toBeInTheDocument();
    expect(screen.getAllByText("خوانده‌نشده").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "مشاهده نوبت" })).toHaveAttribute(
      "href",
      "/appointments/apt_1",
    );
    expect(screen.getByRole("link", { name: "مشاهده پرداخت" })).toHaveAttribute(
      "href",
      "/payments/pay_1",
    );
    expect(document.documentElement.dir).toBe("rtl");
  });

  it("shows empty inbox", async () => {
    mockedClient.mockResolvedValue({ items: [], emptyInbox: true });
    renderWithProviders(<NotificationsScreen />);
    expect(await screen.findByText("هنوز اعلانی ندارید")).toBeInTheDocument();
  });

  it("shows filtered no-results and retries errors", async () => {
    search.current = new URLSearchParams("read=unread");
    mockedClient.mockRejectedValueOnce(
      new ApiError({ status: 500, code: "SERVER", message: "خطا" }),
    );
    mockedClient.mockResolvedValueOnce({ items: [], totalCount: 0 });
    const user = userEvent.setup();
    renderWithProviders(<NotificationsScreen />);
    expect(await screen.findByText("اعلان‌ها بارگذاری نشد")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "تلاش دوباره" }));
    expect(await screen.findByText("نتیجه‌ای پیدا نشد")).toBeInTheDocument();
  });

  it("marks one notification as read and clears caches on logout", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    mockedClient.mockImplementation(async (path, options) => {
      if (String(path) === "/notifications/in-app/n1/read" && options?.method === "POST") {
        return { ...notification("n1"), read: true };
      }
      return {
        items: [notification("n1")],
        unreadCount: 1,
      };
    });
    const user = userEvent.setup();
    renderWithProviders(<NotificationsScreen />, { queryClient });
    expect(await screen.findByText("عنوان n1")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "علامت به‌عنوان خوانده‌شده" }));
    await waitFor(() => {
      expect(mockedClient).toHaveBeenCalledWith(
        "/notifications/in-app/n1/read",
        expect.objectContaining({ method: "POST" }),
      );
    });
    clearFrontendCaches(queryClient);
    expect(
      queryClient.getQueryData(queryKeys.customer.notificationList("user_1", { page: 1, read: "all" })),
    ).toBeUndefined();
  });

  it("marks all notifications as read after confirmation", async () => {
    mockedClient.mockImplementation(async (path, options) => {
      if (String(path) === "/notifications/in-app/read-all" && options?.method === "POST") {
        return { success: true, data: { unread_count: 0 } };
      }
      return {
        items: [notification("n1"), notification("n2")],
        unreadCount: 2,
      };
    });
    const user = userEvent.setup();
    renderWithProviders(<NotificationsScreen />);
    expect(await screen.findByText("عنوان n1")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "خواندن همه" }));
    expect(await screen.findByRole("heading", { name: "خواندن همه اعلان‌ها" })).toBeInTheDocument();
    const confirmButtons = screen.getAllByRole("button", { name: "خواندن همه" });
    await user.click(confirmButtons[confirmButtons.length - 1]!);
    await waitFor(() => {
      expect(mockedClient).toHaveBeenCalledWith(
        "/notifications/in-app/read-all",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });
});

describe("NotificationDetailScreen", () => {
  beforeEach(() => {
    mockedClient.mockReset();
    params.current = { notificationId: "n1" };
  });

  it("resolves detail from the Backend inbox and marks it as read", async () => {
    mockedClient.mockImplementation(async (path) => {
      if (String(path).includes("/read")) {
        return { ...notification("n1"), read: true };
      }
      return {
        success: true,
        data: {
          items: [
            notification("n2"),
            notification("n1", { detailMessage: "توضیح کامل" }),
          ],
          unread_count: 2,
        },
      };
    });
    const user = userEvent.setup();
    renderWithProviders(<NotificationDetailScreen />);
    expect(await screen.findByText("عنوان n1")).toBeInTheDocument();
    expect(screen.getByText("توضیح کامل")).toBeInTheDocument();
    expect(mockedClient).toHaveBeenCalledWith(
      "/notifications/in-app",
      expect.objectContaining({ query: { limit: 100 } }),
    );
    await user.click(screen.getByRole("button", { name: "علامت به‌عنوان خوانده‌شده" }));
    await waitFor(() => {
      expect(mockedClient).toHaveBeenCalledWith(
        "/notifications/in-app/n1/read",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  it("reports a notification missing from the inbox as not found", async () => {
    mockedClient.mockResolvedValue({ success: true, data: { items: [], unread_count: 0 } });
    renderWithProviders(<NotificationDetailScreen />);
    expect(await screen.findByText("اعلان در دسترس نیست")).toBeInTheDocument();
  });

  it("hides existence on forbidden access", async () => {
    mockedClient.mockRejectedValue(
      new ApiError({ status: 403, code: "FORBIDDEN", message: "no" }),
    );
    renderWithProviders(<NotificationDetailScreen />);
    expect(await screen.findByText("اعلان در دسترس نیست")).toBeInTheDocument();
  });
});
