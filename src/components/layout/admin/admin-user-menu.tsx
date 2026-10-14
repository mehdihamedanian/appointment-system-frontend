"use client";

import { useRouter } from "next/navigation";
import { LogOut, Settings } from "lucide-react";
import { Avatar } from "@/components/ui/data-display";
import { Dropdown, DropdownItem, DropdownSeparator } from "@/components/ui/dropdown";
import { IconButton } from "@/components/ui/icon-button";
import { routes } from "@/constants/routes";
import { useSession } from "@/features/auth/session-provider";

export function AdminUserMenu() {
  const { user, logout } = useSession();
  const router = useRouter();
  const name = user?.displayName?.trim() || "حساب مدیریت";

  async function onLogout() {
    await logout();
    router.replace(routes.auth.adminLogin);
  }

  return (
    <Dropdown
      trigger={
        <IconButton label={`منوی کاربر ${name}`} tooltip={name}>
          <Avatar name={name} size="sm" />
        </IconButton>
      }
    >
      <div className="admin-user-menu__meta" role="presentation">
        <p className="admin-user-menu__name" dir="auto">
          {name}
        </p>
        {user?.jobTitle ? (
          <p className="admin-user-menu__role text-caption">{user.jobTitle}</p>
        ) : null}
      </div>
      <DropdownSeparator />
      <DropdownItem
        onSelect={() => {
          router.push(routes.admin.settings);
        }}
      >
        <Settings size={16} aria-hidden="true" />
        تنظیمات
      </DropdownItem>
      <DropdownItem
        destructive
        onSelect={() => {
          void onLogout();
        }}
      >
        <LogOut size={16} aria-hidden="true" />
        خروج
      </DropdownItem>
    </Dropdown>
  );
}
