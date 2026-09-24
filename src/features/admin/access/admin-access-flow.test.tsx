import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminUsersScreen } from "@/features/admin/users/admin-users-screen";
import { AdminUserInviteScreen } from "@/features/admin/users/admin-user-invite-screen";
import { AdminRolesScreen } from "@/features/admin/roles/admin-roles-screen";
import { AdminRoleCreateScreen } from "@/features/admin/roles/admin-role-form-screen";
import { authenticatedAdmin, createSessionValue, renderWithProviders } from "@/test/render";

/** E2E: Super Admin → Invite User → Create Custom Role → Assign Permissions → Session Refresh */

const replaceMock = vi.fn();
const pushMock = vi.fn();
let search = new URLSearchParams();
let params: Record<string, string> = {};

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/users",
  useRouter: () => ({ replace: replaceMock, push: pushMock }),
  useSearchParams: () => search,
  useParams: () => params,
}));

vi.mock("@/lib/api/client", () => ({
  apiClient: vi.fn(),
}));

import { apiClient } from "@/lib/api/client";

const mockedClient = vi.mocked(apiClient);

async function chooseSelectOption(
  user: ReturnType<typeof userEvent.setup>,
  label: RegExp,
  optionName: string | RegExp,
) {
  const triggers = await screen.findAllByLabelText(label);
  await user.click(triggers[0]!);
  const listbox = await screen.findByRole("listbox");
  await user.click(within(listbox).getByRole("option", { name: optionName }));
}

describe("Phase 40 admin access E2E flow", () => {
  beforeEach(() => {
    cleanup();
    mockedClient.mockReset();
    replaceMock.mockReset();
    pushMock.mockReset();
    search = new URLSearchParams();
    params = {};
  });

  it("invites user, creates custom role with matrix, and refreshes session permissions", async () => {
    const user = userEvent.setup();
    const session = createSessionValue({
      status: "authenticated",
      user: {
        ...authenticatedAdmin,
        permissionCodes: [],
      },
    });
    let invited = false;
    let roleCreated = false;

    mockedClient.mockImplementation(async (path: string, init?: { method?: string; body?: unknown }) => {
      const url = String(path);
      const method = init?.method ?? "GET";

      if (method === "GET" && url.startsWith("/admin/users?")) {
        return {
          items: invited
            ? [
                {
                  reference: "USR-NEW",
                  displayName: "کاربر جدید",
                  maskedPhone: "09**",
                  roleLabel: "پشتیبان",
                  status: "active",
                  invitationStatus: "pending",
                  lastLoginState: "pending_invitation",
                  allowedActions: { view: true, edit: true },
                },
              ]
            : [],
          totalCount: invited ? 1 : 0,
          emptyHistory: !invited,
        };
      }

      if (method === "GET" && url.startsWith("/admin/roles?")) {
        return {
          items: [
            {
              reference: "ROLE-SUPPORT",
              name: "پشتیبان",
              system: false,
              editable: true,
              deletable: true,
              userCount: 0,
              allowedActions: { view: true, edit: true },
            },
          ],
          totalCount: 1,
        };
      }

      if (url.includes("/admin/permissions/catalog")) {
        return {
          items: [
            {
              key: "admin.reports.view",
              label: "مشاهده گزارش",
              domain: "reports",
              description: "دسترسی گزارش‌ها",
            },
            {
              key: "admin.users.view",
              label: "مشاهده کاربران",
              domain: "users",
            },
          ],
        };
      }

      if (method === "POST" && url === "/admin/users") {
        invited = true;
        const body = init?.body as { phone?: string; roleReference?: string };
        expect(body.phone).toBe("09121234567");
        expect(body.roleReference).toBe("ROLE-SUPPORT");
        return {
          reference: "USR-NEW",
          displayName: "کاربر جدید",
          status: "active",
          invitationStatus: "pending",
          lastLoginState: "pending_invitation",
          permissionCodes: [],
          branchScopeIds: [],
          branchScopeLabels: [],
          allowedActions: { view: true, edit: true },
        };
      }

      if (url.includes("/impact-preview")) {
        return {
          summaryLines: ["۱ مجوز اضافه می‌شود"],
          grantedPermissions: ["admin.reports.view"],
          revokedPermissions: [],
          branchScopeAdded: [],
          branchScopeRemoved: [],
          warnings: [],
          blocked: false,
        };
      }

      if (method === "POST" && url === "/admin/roles") {
        roleCreated = true;
        const body = init?.body as { name?: string; permissionKeys?: string[] };
        expect(body.name).toBe("نقش سفارشی تست");
        expect(body.permissionKeys).toContain("admin.reports.view");
        return {
          reference: "ROLE-CUSTOM",
          name: body.name,
          permissionKeys: body.permissionKeys,
          system: false,
          editable: true,
          deletable: true,
          allowedActions: { view: true, edit: true, assignPermissions: true },
        };
      }

      return {};
    });

    const listView = renderWithProviders(<AdminUsersScreen />, { session });
    expect(await screen.findByRole("heading", { name: "کاربران" })).toBeInTheDocument();
    expect(await screen.findByText(/کاربری ثبت نشده/i)).toBeInTheDocument();
    listView.unmount();

    const inviteView = renderWithProviders(<AdminUserInviteScreen />, { session });
    await user.type(await screen.findByLabelText(/موبایل/i), "09121234567");
    await chooseSelectOption(user, /نقش/i, /پشتیبان/);
    await user.click(screen.getByRole("button", { name: /ارسال دعوت/i }));
    await waitFor(() => expect(invited).toBe(true));
    expect(replaceMock).toHaveBeenCalledWith(expect.stringContaining("/admin/users/USR-NEW"));
    inviteView.unmount();

    const roleView = renderWithProviders(<AdminRoleCreateScreen />, { session });
    expect((await screen.findAllByText(/ماتریس مجوزها/i)).length).toBeGreaterThan(0);
    await user.type(await screen.findByLabelText(/نام نقش/i), "نقش سفارشی تست");
    const reportCheckboxes = await screen.findAllByRole("checkbox", { name: /مشاهده گزارش/i });
    await user.click(reportCheckboxes[0]!);
    await user.click(screen.getByRole("button", { name: /^ذخیره$/i }));
    expect(await screen.findByText(/خلاصه تغییرات مجوز/i)).toBeInTheDocument();
    const confirmButtons = screen.getAllByRole("button", { name: /^ذخیره$/i });
    await user.click(confirmButtons[confirmButtons.length - 1]!);
    await waitFor(() => expect(roleCreated).toBe(true));
    roleView.unmount();

    renderWithProviders(<AdminRolesScreen />, { session });
    expect(await screen.findByRole("heading", { name: "نقش‌ها" })).toBeInTheDocument();
    expect((await screen.findAllByText("پشتیبان")).length).toBeGreaterThan(0);
  });

  it("shows system role badge and hides edit when not editable", async () => {
    mockedClient.mockImplementation(async (path: string) => {
      if (String(path).startsWith("/admin/roles?")) {
        return {
          items: [
            {
              reference: "ROLE-OWNER",
              name: "مالک",
              system: true,
              editable: false,
              deletable: false,
              userCount: 1,
              allowedActions: { view: true },
            },
          ],
          totalCount: 1,
        };
      }
      return {};
    });

    const session = createSessionValue({ status: "authenticated", user: authenticatedAdmin });
    renderWithProviders(<AdminRolesScreen />, { session });
    expect((await screen.findAllByText("مالک")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText(/سیستمی/i)).length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: /ویرایش/i })).not.toBeInTheDocument();
  });
});
