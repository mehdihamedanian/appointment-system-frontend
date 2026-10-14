import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CustomerLoginForm } from "@/features/auth/customer-login-form";
import { AdminLoginForm } from "@/features/auth/admin-login-form";
import { renderWithProviders } from "@/test/render";
import { axeViolations } from "@/test/axe";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/login",
}));

vi.mock("@/lib/api/auth", () => ({
  loginWithPassword: vi.fn(),
  adminLogin: vi.fn(),
  requestOtp: vi.fn(),
}));

import { loginWithPassword } from "@/lib/api/auth";

describe("authentication form accessibility", () => {
  it("submits by keyboard and moves focus to the first invalid field with a linked error", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CustomerLoginForm />);
    expect(await axeViolations()).toEqual([]);

    await user.tab();
    const phone = screen.getByLabelText(/شماره موبایل/);
    expect(phone).toHaveFocus();
    await user.keyboard("0912{Enter}");

    await waitFor(() => expect(phone).toHaveFocus());
    expect(phone).toHaveAttribute("aria-invalid", "true");
    expect(phone).toHaveAccessibleDescription(/شماره موبایل را به‌صورت ۱۱ رقم/);
    expect(loginWithPassword).not.toHaveBeenCalled();
    expect(await axeViolations()).toEqual([]);
  });

  it("renders the admin login form without axe violations", async () => {
    renderWithProviders(<AdminLoginForm />);
    expect(await axeViolations()).toEqual([]);
  });
});
