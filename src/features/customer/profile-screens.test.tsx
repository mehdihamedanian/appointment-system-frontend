import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient } from "@tanstack/react-query";
import { ProfileOverviewScreen } from "@/features/customer/profile-overview-screen";
import { ProfileEditScreen } from "@/features/customer/profile-edit-screen";
import { ProfileSecurityScreen } from "@/features/customer/profile-security-screen";
import { ProfileNotificationsScreen } from "@/features/customer/profile-notifications-screen";
import { ApiError } from "@/lib/api/errors";
import { clearFrontendCaches } from "@/lib/auth/session";
import { HOLD_SESSION_KEY, writeHoldReference } from "@/lib/booking/hold-session";
import { queryKeys } from "@/lib/query/keys";
import {
  createSessionValue,
  renderWithProviders,
} from "@/test/render";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace }),
  usePathname: () => "/profile",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/api/client", () => ({
  apiClient: vi.fn(),
}));

import { apiClient } from "@/lib/api/client";

const mockedClient = vi.mocked(apiClient);

const profilePayload = {
  id: "user_1",
  firstName: "علی",
  lastName: "رضایی",
  displayName: "علی رضایی",
  phone: "09121234567",
  email: "ali@example.com",
  phoneVerified: true,
  emailVerified: true,
  canChangePhone: true,
  canChangeEmail: true,
  canChangePassword: true,
};

describe("customer profile screens", () => {
  beforeEach(() => {
    mockedClient.mockReset();
    replace.mockReset();
    document.documentElement.dir = "rtl";
    window.sessionStorage.clear();
  });

  it("does not fetch profile before session restoration", () => {
    renderWithProviders(<ProfileOverviewScreen />, {
      session: createSessionValue({ status: "loading", user: null }),
    });
    expect(mockedClient).not.toHaveBeenCalled();
  });

  it("renders profile overview without internal fields", async () => {
    mockedClient.mockResolvedValue({
      ...profilePayload,
      internalNotes: "محرمانه",
      tags: ["risk"],
    });
    renderWithProviders(<ProfileOverviewScreen />);
    expect(await screen.findByRole("heading", { name: "علی رضایی" })).toBeInTheDocument();
    expect(screen.getByText(/0912\*\*\*/)).toBeInTheDocument();
    expect(screen.queryByText("محرمانه")).not.toBeInTheDocument();
    expect(screen.queryByText("risk")).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "ویرایش مشخصات" })[0]).toHaveAttribute(
      "href",
      "/profile/edit",
    );
  });

  it("shows profile load error with retry", async () => {
    mockedClient.mockRejectedValue(new ApiError({ status: 500, message: "خطا", requestId: "req_p" }));
    renderWithProviders(<ProfileOverviewScreen />);
    expect(await screen.findByText("بارگذاری حساب ممکن نشد")).toBeInTheDocument();
    expect(screen.getByText("req_p")).toBeInTheDocument();
  });

  it("edits and saves profile fields", async () => {
    mockedClient.mockImplementation(async (path, options) => {
      if (path === "/customer/profile" && options?.method === "PATCH") {
        return {
          ...profilePayload,
          firstName: "سارا",
          displayName: "سارا رضایی",
        };
      }
      return profilePayload;
    });
    const user = userEvent.setup();
    renderWithProviders(<ProfileEditScreen />);
    const firstName = await screen.findByDisplayValue("علی");
    await user.clear(firstName);
    await user.type(firstName, "سارا");
    expect(screen.getByRole("button", { name: "ذخیره تغییرات" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "ذخیره تغییرات" }));
    await waitFor(() => {
      expect(mockedClient).toHaveBeenCalledWith(
        "/customer/profile",
        expect.objectContaining({ method: "PATCH" }),
      );
    });
    expect((await screen.findAllByText("مشخصات ذخیره شد.")).length).toBeGreaterThan(0);
  });

  it("requests phone change challenge and verifies OTP", async () => {
    mockedClient.mockImplementation(async (path) => {
      if (path === "/customer/profile/phone/change") {
        return {
          challengeId: "ch_phone",
          maskedDestination: "0912***99",
          expiresAt: "2099-01-01T00:00:00.000Z",
          resendAvailableAt: "2020-01-01T00:00:00.000Z",
        };
      }
      if (path === "/customer/profile/phone/verify") {
        return {
          ...profilePayload,
          phone: "09129999999",
          phoneMasked: "0912***99",
        };
      }
      return profilePayload;
    });
    const user = userEvent.setup();
    renderWithProviders(<ProfileSecurityScreen />);
    await screen.findByRole("heading", { name: "تغییر شماره موبایل" });
    await user.type(screen.getByLabelText(/شماره موبایل جدید/), "09129999999");
    await user.click(screen.getByRole("button", { name: "ارسال کد تأیید" }));
    expect(await screen.findByText(/0912\*\*\*99/)).toBeInTheDocument();
    await user.type(screen.getByLabelText(/کد تأیید/), "123456");
    await user.click(screen.getByRole("button", { name: "تأیید شماره جدید" }));
    await waitFor(() => {
      expect(mockedClient).toHaveBeenCalledWith(
        "/customer/profile/phone/verify",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  it("keeps required notification preferences disabled", async () => {
    mockedClient.mockResolvedValue({
      items: [
        {
          id: "n1",
          eventKey: "reminder",
          label: "یادآوری نوبت",
          channel: "sms",
          enabled: true,
          required: true,
        },
        {
          id: "n2",
          eventKey: "promo",
          label: "پیام اختیاری",
          channel: "email",
          enabled: false,
          required: false,
        },
      ],
    });
    renderWithProviders(<ProfileNotificationsScreen />);
    expect(await screen.findByText("یادآوری نوبت")).toBeInTheDocument();
    const switches = screen.getAllByRole("switch");
    expect(switches[0]).toBeDisabled();
    expect(switches[1]).toBeEnabled();
  });

  it("updates optional notification preference and rolls back on failure", async () => {
    mockedClient.mockImplementation(async (path, options) => {
      if (path === "/customer/profile/notifications" && options?.method === "PATCH") {
        throw new ApiError({ status: 500, message: "شکست اعلان" });
      }
      return {
        items: [
          {
            id: "n2",
            eventKey: "promo",
            label: "پیام اختیاری",
            channel: "email",
            enabled: false,
            required: false,
          },
        ],
      };
    });
    const user = userEvent.setup();
    renderWithProviders(<ProfileNotificationsScreen />);
    const toggle = await screen.findByRole("switch");
    await user.click(toggle);
    expect(await screen.findByText("ذخیره نشد")).toBeInTheDocument();
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
  });

  it("clears hold session and profile cache on logout cleanup", () => {
    writeHoldReference("hold_abc");
    const queryClient = new QueryClient();
    queryClient.setQueryData(queryKeys.customer.profile("user_1"), profilePayload);
    clearFrontendCaches(queryClient);
    expect(window.sessionStorage.getItem(HOLD_SESSION_KEY)).toBeNull();
    expect(queryClient.getQueryData(queryKeys.customer.profile("user_1"))).toBeUndefined();
  });
});
