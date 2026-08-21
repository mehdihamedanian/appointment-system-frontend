import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { AdminGuard, CustomerGuard, GuestGuard } from "@/features/auth/guards";
import {
  authenticatedAdmin,
  authenticatedCustomer,
  createSessionValue,
  renderWithProviders,
} from "@/test/render";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ replace, push: replace }),
  useSearchParams: () => new URLSearchParams(),
}));

describe("route guards", () => {
  beforeEach(() => {
    replace.mockReset();
  });

  it("redirects unauthenticated customers to login with a safe return path", async () => {
    renderWithProviders(
      <CustomerGuard>
        <p>محافظت‌شده</p>
      </CustomerGuard>,
      {
        session: createSessionValue({
          status: "unauthenticated",
          user: null,
        }),
      },
    );

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/login?redirect=%2Fdashboard");
    });
    expect(screen.queryByText("محافظت‌شده")).not.toBeInTheDocument();
  });

  it("shows a branded 403 when admin access is denied", () => {
    renderWithProviders(
      <AdminGuard>
        <p>پنل مدیریت</p>
      </AdminGuard>,
      {
        session: createSessionValue({
          user: authenticatedCustomer,
        }),
      },
    );

    expect(screen.getByText("دسترسی مجاز نیست")).toBeInTheDocument();
    expect(screen.queryByText("پنل مدیریت")).not.toBeInTheDocument();
  });

  it("allows granted admin access", () => {
    renderWithProviders(
      <AdminGuard>
        <p>پنل مدیریت</p>
      </AdminGuard>,
      {
        session: createSessionValue({
          user: authenticatedAdmin,
        }),
      },
    );

    expect(screen.getByText("پنل مدیریت")).toBeInTheDocument();
  });

  it("redirects authenticated visitors away from anonymous auth routes", async () => {
    renderWithProviders(
      <GuestGuard>
        <p>ورود</p>
      </GuestGuard>,
      {
        session: createSessionValue({
          user: authenticatedCustomer,
        }),
      },
    );

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/dashboard");
    });
  });
});
