"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";
import { Popover } from "@/components/ui/popover";
import { routes } from "@/constants/routes";

/**
 * Phase 23 shell only — no admin notification API / fake items.
 * Customer and admin notification data models stay separate.
 */
export function AdminNotificationMenu() {
  return (
    <Popover
      trigger={
        <IconButton label="اعلان‌های مدیریت" tooltip="اعلان‌ها">
          <Bell size={20} />
        </IconButton>
      }
    >
      <div className="admin-notification-menu" role="dialog" aria-label="اعلان‌های مدیریت">
        <p className="admin-notification-menu__title">اعلان‌ها</p>
        <p className="text-caption">
          فهرست اعلان‌های مدیریتی پس از اتصال API در اینجا نمایش داده می‌شود. داده نمایشی وجود ندارد.
        </p>
        <Link className="admin-notification-menu__link" href={routes.admin.notifications}>
          صفحه اعلان‌ها
        </Link>
      </div>
    </Popover>
  );
}
