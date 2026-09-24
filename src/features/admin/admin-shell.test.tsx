import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminShell } from "@/components/layout/admin-shell";
import { AdminGuard } from "@/features/auth/guards";
import { PermissionGate } from "@/features/admin/permission-gate";
import {
  authenticatedAdmin,
  authenticatedCustomer,
  createSessionValue,
  renderWithProviders,
} from "@/test/render";
import {
  ADMIN_SIDEBAR_COLLAPSED_PREF,
  readBooleanUiPreference,
  writeBooleanUiPreference,
} from "@/lib/ui/preferences";

const replace = vi.fn();
const pathname = { current: "/admin/appointments" };

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace }),
  usePathname: () => pathname.current,
  useSearchParams: () => new URLSearchParams(),
}));

describe("AdminShell", () => {
  beforeEach(() => {
    replace.mockReset();
    pathname.current = "/admin/appointments";
    document.documentElement.dir = "rtl";
    window.localStorage.clear();
  });

  it("renders landmarks, active navigation, and skip target", () => {
    renderWithProviders(
      <AdminShell>
        <p>محتوای مدیریت</p>
      </AdminShell>,
      { session: createSessionValue({ user: authenticatedAdmin }) },
    );
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
    expect(screen.getByLabelText("نوار کناری مدیریت")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "ناوبری مدیریت" })).toBeInTheDocument();
    const active = screen.getAllByRole("link", { name: "نوبت‌ها" });
    expect(active.some((link) => link.getAttribute("aria-current") === "page")).toBe(true);
    expect(screen.getByText("محتوای مدیریت")).toBeInTheDocument();
  });

  it("hides unauthorized nav items when granular permissions exist", () => {
    renderWithProviders(
      <AdminShell>
        <p>محتوا</p>
      </AdminShell>,
      {
        session: createSessionValue({
          user: {
            ...authenticatedAdmin,
            permissionCodes: ["admin.appointments.view"],
          },
        }),
      },
    );
    expect(screen.getAllByRole("link", { name: "نوبت‌ها" }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: "تنظیمات" })).not.toBeInTheDocument();
  });

  it("persists sidebar collapsed preference", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <AdminShell>
        <p>محتوا</p>
      </AdminShell>,
      { session: createSessionValue({ user: authenticatedAdmin }) },
    );
    await user.click(screen.getByRole("button", { name: "جمع کردن نوار کناری" }));
    expect(readBooleanUiPreference(ADMIN_SIDEBAR_COLLAPSED_PREF)).toBe(true);
    writeBooleanUiPreference(ADMIN_SIDEBAR_COLLAPSED_PREF, false);
    expect(readBooleanUiPreference(ADMIN_SIDEBAR_COLLAPSED_PREF)).toBe(false);
  });

  it("opens mobile drawer with focus trap and closes on Escape", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <AdminShell>
        <p>محتوا</p>
      </AdminShell>,
      { session: createSessionValue({ user: authenticatedAdmin }) },
    );
    await user.click(screen.getByRole("button", { name: "باز کردن منوی مدیریت" }));
    const dialog = await screen.findByRole("dialog", { name: "منوی مدیریت" });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByRole("navigation", { name: "ناوبری مدیریت" })).toBeInTheDocument();
    expect(document.body.style.overflow).toBe("hidden");
    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "منوی مدیریت" })).not.toBeInTheDocument();
    });
    expect(document.body.style.overflow).not.toBe("hidden");
  });

  it("closes mobile drawer after navigation and restores focus opportunity", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <AdminShell>
        <p>محتوا</p>
      </AdminShell>,
      { session: createSessionValue({ user: authenticatedAdmin }) },
    );
    const openButton = screen.getByRole("button", { name: "باز کردن منوی مدیریت" });
    await user.click(openButton);
    const dialog = await screen.findByRole("dialog", { name: "منوی مدیریت" });
    const calendarLinks = within(dialog).getAllByRole("link", { name: "تقویم" });
    await user.click(calendarLinks[0]!);
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "منوی مدیریت" })).not.toBeInTheDocument();
    });
  });

  it("logs out through the user menu", async () => {
    const user = userEvent.setup();
    const logout = vi.fn(async () => undefined);
    renderWithProviders(
      <AdminShell>
        <p>محتوا</p>
      </AdminShell>,
      {
        session: createSessionValue({
          user: { ...authenticatedAdmin, displayName: "مدیر آزمایشی", jobTitle: "پذیرش" },
          logout,
        }),
      },
    );
    await user.click(screen.getByRole("button", { name: /منوی کاربر/ }));
    expect(screen.getByText("پذیرش")).toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: /خروج/ }));
    await waitFor(() => {
      expect(logout).toHaveBeenCalled();
      expect(replace).toHaveBeenCalledWith("/admin/login");
    });
  });

  it("shows notification shell without fake items", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <AdminShell>
        <p>محتوا</p>
      </AdminShell>,
      { session: createSessionValue({ user: authenticatedAdmin }) },
    );
    await user.click(screen.getByRole("button", { name: "اعلان‌های مدیریت" }));
    expect(screen.getByText(/پس از اتصال API/)).toBeInTheDocument();
    expect(screen.queryByText(/اعلان آزمایشی/)).not.toBeInTheDocument();
  });
});

describe("AdminGuard", () => {
  beforeEach(() => {
    replace.mockReset();
    pathname.current = "/admin/settings";
  });

  it("rejects customer accounts without flashing admin content", () => {
    renderWithProviders(
      <AdminGuard>
        <p>محافظت‌شده</p>
      </AdminGuard>,
      { session: createSessionValue({ user: authenticatedCustomer }) },
    );
    expect(screen.queryByText("محافظت‌شده")).not.toBeInTheDocument();
    expect(screen.getByText(/حساب مشتری به پنل مدیریت هدایت نمی‌شود/)).toBeInTheDocument();
  });

  it("blocks direct unauthorized routes when permissions are present", () => {
    renderWithProviders(
      <AdminGuard>
        <p>تنظیمات محرمانه</p>
      </AdminGuard>,
      {
        session: createSessionValue({
          user: {
            ...authenticatedAdmin,
            permissionCodes: ["admin.appointments.view"],
          },
        }),
      },
    );
    expect(screen.queryByText("تنظیمات محرمانه")).not.toBeInTheDocument();
    expect(screen.getByText(/مجوز لازم برای این صفحه/)).toBeInTheDocument();
  });

  it("shows loading while session is resolving", () => {
    renderWithProviders(
      <AdminGuard>
        <p>محافظت‌شده</p>
      </AdminGuard>,
      { session: createSessionValue({ status: "loading", user: null }) },
    );
    expect(screen.queryByText("محافظت‌شده")).not.toBeInTheDocument();
    expect(screen.getByLabelText(/در حال بارگذاری|در حال بررسی/i)).toBeInTheDocument();
  });
});

describe("PermissionGate", () => {
  it("allows access when permission codes are not yet issued", () => {
    renderWithProviders(
      <PermissionGate permission="admin.settings.view">
        <p>مجاز</p>
      </PermissionGate>,
      { session: createSessionValue({ user: authenticatedAdmin }) },
    );
    expect(screen.getByText("مجاز")).toBeInTheDocument();
  });
});
