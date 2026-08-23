import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/lib/api/errors";
import { CustomerLoginForm } from "@/features/auth/customer-login-form";
import { CustomerRegisterForm } from "@/features/auth/customer-register-form";
import { AdminLoginForm } from "@/features/auth/admin-login-form";
import { ForgotPasswordForm } from "@/features/auth/forgot-password-form";
import { ResetPasswordForm } from "@/features/auth/reset-password-form";
import { VerifyOtpForm } from "@/features/auth/verify-otp-form";
import { OtpInput } from "@/features/auth/otp-input";
import { OtpCountdown } from "@/features/auth/otp-countdown";
import { SessionExpiredState } from "@/components/feedback/app-states";
import { getDocumentLocale } from "@/config/locale";
import { authenticatedAdmin, authenticatedCustomer, renderWithProviders } from "@/test/render";
import { saveAuthChallenge } from "@/lib/auth/challenge-store";

const replace = vi.fn();
const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/login",
}));

vi.mock("@/lib/api/auth", () => ({
  loginWithPassword: vi.fn(),
  adminLogin: vi.fn(),
  registerCustomer: vi.fn(),
  requestOtp: vi.fn(),
  verifyOtp: vi.fn(),
  resendOtp: vi.fn(),
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
  changePassword: vi.fn(),
}));

import {
  adminLogin,
  loginWithPassword,
  registerCustomer,
  requestPasswordReset,
  resetPassword,
} from "@/lib/api/auth";

describe("customer login", () => {
  beforeEach(() => {
    replace.mockReset();
    push.mockReset();
    vi.mocked(loginWithPassword).mockReset();
    sessionStorage.clear();
  });

  it("validates phone and password before submit", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CustomerLoginForm />);
    await user.click(screen.getByRole("button", { name: "ورود" }));
    expect(await screen.findByText(/شماره موبایل را به‌صورت ۱۱ رقم/)).toBeInTheDocument();
    expect(loginWithPassword).not.toHaveBeenCalled();
  });

  it("handles a successful login response", async () => {
    const user = userEvent.setup();
    vi.mocked(loginWithPassword).mockResolvedValue({ user: authenticatedCustomer });
    renderWithProviders(<CustomerLoginForm />);
    await user.type(screen.getByLabelText(/شماره موبایل/), "09121234567");
    await user.type(screen.getByLabelText(/^رمز عبور/), "secret-pass");
    await user.click(screen.getByRole("button", { name: "ورود" }));
    await waitFor(() => {
      expect(loginWithPassword).toHaveBeenCalledWith("09121234567", "secret-pass");
      expect(replace).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("shows a safe message for invalid credentials", async () => {
    const user = userEvent.setup();
    vi.mocked(loginWithPassword).mockRejectedValue(
      new ApiError({ status: 401, code: "INVALID_CREDENTIALS", message: "stack" }),
    );
    renderWithProviders(<CustomerLoginForm />);
    await user.type(screen.getByLabelText(/شماره موبایل/), "09121234567");
    await user.type(screen.getByLabelText(/^رمز عبور/), "wrong");
    await user.click(screen.getByRole("button", { name: "ورود" }));
    expect(await screen.findByText("ورود ناموفق")).toBeInTheDocument();
    expect(screen.getByText("اطلاعات واردشده نادرست است.")).toBeInTheDocument();
    expect(screen.queryByText("stack")).not.toBeInTheDocument();
  });

  it("shows a rate-limit state", async () => {
    const user = userEvent.setup();
    vi.mocked(loginWithPassword).mockRejectedValue(
      new ApiError({ status: 429, code: "RATE_LIMITED", message: "slow down" }),
    );
    renderWithProviders(<CustomerLoginForm />);
    await user.type(screen.getByLabelText(/شماره موبایل/), "09121234567");
    await user.type(screen.getByLabelText(/^رمز عبور/), "secret-pass");
    await user.click(screen.getByRole("button", { name: "ورود" }));
    expect(await screen.findByText("تعداد تلاش بیش از حد")).toBeInTheDocument();
  });

  it("normalizes Persian phone digits", async () => {
    const user = userEvent.setup();
    vi.mocked(loginWithPassword).mockResolvedValue({ user: authenticatedCustomer });
    renderWithProviders(<CustomerLoginForm />);
    await user.type(screen.getByLabelText(/شماره موبایل/), "۰۹۱۲۱۲۳۴۵۶۷");
    await user.type(screen.getByLabelText(/^رمز عبور/), "secret-pass");
    await user.click(screen.getByRole("button", { name: "ورود" }));
    await waitFor(() => {
      expect(loginWithPassword).toHaveBeenCalledWith("09121234567", "secret-pass");
    });
  });

  it("supports keyboard tab order and submit with Enter", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CustomerLoginForm />);
    const phone = screen.getByLabelText(/شماره موبایل/);
    phone.focus();
    await user.tab();
    expect(screen.getByLabelText(/^رمز عبور/)).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "نمایش رمز" })).toHaveFocus();
  });

  it("renders in RTL Persian", () => {
    renderWithProviders(<CustomerLoginForm />);
    expect(getDocumentLocale().dir).toBe("rtl");
    expect(screen.getByRole("button", { name: "ورود" })).toBeInTheDocument();
  });
});

describe("customer-only registration", () => {
  it("does not offer staff, provider or business signup", () => {
    renderWithProviders(<CustomerRegisterForm />);
    expect(screen.getByRole("button", { name: "ایجاد حساب مشتری" })).toBeInTheDocument();
    expect(screen.queryByText(/پزشک|پرسنل|مدیر|کسب‌وکار|ارائه‌دهنده/)).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("validates required customer fields", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CustomerRegisterForm />);
    await user.click(screen.getByRole("button", { name: "ایجاد حساب مشتری" }));
    expect(registerCustomer).not.toHaveBeenCalled();
    expect(await screen.findByText("نام را وارد کنید.")).toBeInTheDocument();
  });
});

describe("otp input", () => {
  it("pastes a complete normalized code", async () => {
    const user = userEvent.setup();
    function Harness() {
      const [value, setValue] = useState("");
      return <OtpInput id="otp" value={value} onChange={setValue} />;
    }
    renderWithProviders(<Harness />);
    const input = screen.getByLabelText(/کد تأیید/);
    await user.click(input);
    await user.paste("۱۲۳۴۵۶");
    expect(input).toHaveValue("123456");
  });

  it("keeps resend disabled until the timestamp allows it", () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    renderWithProviders(
      <OtpCountdown resendAvailableAt={future} onResend={() => undefined} />,
    );
    expect(screen.getByRole("button", { name: "ارسال دوباره" })).toBeDisabled();
  });

  it("enables resend when the timestamp is in the past", () => {
    const past = new Date(Date.now() - 1_000).toISOString();
    renderWithProviders(
      <OtpCountdown resendAvailableAt={past} onResend={() => undefined} />,
    );
    expect(screen.getByRole("button", { name: "ارسال دوباره" })).toBeEnabled();
  });
});

describe("forgot and reset password", () => {
  beforeEach(() => {
    vi.mocked(requestPasswordReset).mockReset();
    vi.mocked(resetPassword).mockReset();
  });

  it("shows a privacy-safe forgot-password result", async () => {
    const user = userEvent.setup();
    vi.mocked(requestPasswordReset).mockResolvedValue({ challenge: null });
    renderWithProviders(<ForgotPasswordForm />);
    await user.type(screen.getByLabelText(/شماره موبایل/), "09121234567");
    await user.click(screen.getByRole("button", { name: "ارسال دستورالعمل بازیابی" }));
    expect(
      await screen.findByText(/اگر حسابی با این اطلاعات وجود داشته باشد/),
    ).toBeInTheDocument();
  });

  it("shows an expired reset challenge when no token is present", () => {
    renderWithProviders(<ResetPasswordForm />);
    expect(screen.getByText("پیوند بازیابی نامعتبر است")).toBeInTheDocument();
  });
});

describe("admin login authorization", () => {
  it("does not send a customer into the admin panel", async () => {
    const user = userEvent.setup();
    vi.mocked(adminLogin).mockResolvedValue({ user: authenticatedCustomer });
    renderWithProviders(<AdminLoginForm />);
    await user.type(screen.getByLabelText(/شماره موبایل/), "09121234567");
    await user.type(screen.getByLabelText(/^رمز عبور/), "secret-pass");
    await user.click(screen.getByRole("button", { name: "ورود به پنل مدیریت" }));
    expect(await screen.findByText("دسترسی کافی نیست")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalledWith("/admin");
  });

  it("redirects granted staff to admin home", async () => {
    const user = userEvent.setup();
    vi.mocked(adminLogin).mockResolvedValue({ user: authenticatedAdmin });
    renderWithProviders(<AdminLoginForm />);
    await user.type(screen.getByLabelText(/شماره موبایل/), "09121234567");
    await user.type(screen.getByLabelText(/^رمز عبور/), "secret-pass");
    await user.click(screen.getByRole("button", { name: "ورود به پنل مدیریت" }));
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/admin");
    });
  });
});

describe("session expired UI", () => {
  it("renders a dedicated expired page state, not only a toast", () => {
    renderWithProviders(
      <SessionExpiredState description="نشست شما پایان یافته است." />,
    );
    expect(screen.getByRole("heading", { name: "نشست شما پایان یافته است" })).toBeInTheDocument();
  });
});

describe("verify otp incomplete code", () => {
  it("rejects an incomplete code", async () => {
    saveAuthChallenge({
      challengeId: "ch_1",
      purpose: "login",
      maskedDestination: "0912***67",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      resendAvailableAt: new Date(Date.now() + 30_000).toISOString(),
    });
    const user = userEvent.setup();
    renderWithProviders(<VerifyOtpForm />);
    await user.type(screen.getByLabelText(/کد تأیید/), "12");
    await user.click(screen.getByRole("button", { name: "تأیید کد" }));
    expect(await screen.findByText("کد را کامل وارد کنید.")).toBeInTheDocument();
  });
});
