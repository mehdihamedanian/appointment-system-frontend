"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AdminBreadcrumb } from "@/components/layout/admin/admin-breadcrumb";
import { AdminPageHeader } from "@/components/layout/admin/admin-page-header";
import { AdminNotificationsGate } from "@/features/admin/notifications/admin-notifications-gate";
import { PermissionGate } from "@/features/admin/permission-gate";
import { notificationPermission } from "@/lib/admin/notification-filters";
import { routes } from "@/constants/routes";
import { cx } from "@/lib/utilities/cx";

export function AdminNotificationsHubScreen() {
  const pathname = usePathname();
  const onTemplates = pathname.startsWith(routes.admin.notificationTemplates);
  const onLogs = pathname.startsWith(routes.admin.notificationLogs);

  return (
    <PermissionGate permission={notificationPermission("view")}>
      <AdminNotificationsGate>
        <>
          <AdminPageHeader
            title="اعلان‌ها"
            description="مدیریت قالب‌های پیامک و ایمیل و پیگیری گزارش ارسال."
            breadcrumb={
              <AdminBreadcrumb
                pathname={routes.admin.notifications}
                items={[
                  { href: routes.admin.home, label: "پنل مدیریت" },
                  { label: "اعلان‌ها" },
                ]}
              />
            }
          />
          <nav className="admin-notification-hub-nav" aria-label="بخش‌های اعلان">
            <Link
              href={routes.admin.notificationTemplates}
              className={cx("admin-notification-hub-nav__link", (onTemplates || pathname === routes.admin.notifications) && "is-active")}
              aria-current={onTemplates || pathname === routes.admin.notifications ? "page" : undefined}
            >
              قالب‌ها
            </Link>
            <Link
              href={routes.admin.notificationLogs}
              className={cx("admin-notification-hub-nav__link", onLogs && "is-active")}
              aria-current={onLogs ? "page" : undefined}
            >
              گزارش ارسال
            </Link>
          </nav>
        </>
      </AdminNotificationsGate>
    </PermissionGate>
  );
}
