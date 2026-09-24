"use client";

import { AdminBreadcrumb } from "@/components/layout/admin/admin-breadcrumb";
import { AdminPageHeader } from "@/components/layout/admin/admin-page-header";
import { AdminSettingsGate } from "@/features/admin/settings/admin-settings-gate";
import { AdminSettingsNav } from "@/features/admin/settings/admin-settings-nav";
import { AdminSettingsSkeleton } from "@/features/admin/settings/admin-settings-skeleton";
import { PermissionGate } from "@/features/admin/permission-gate";
import { useSession } from "@/features/auth/session-provider";
import { settingsPermission } from "@/lib/admin/settings-filters";
import { routes } from "@/constants/routes";
import {
  ADMIN_SETTINGS_SECTION_LABELS,
  type AdminSettingsSection,
} from "@/types/admin-settings";

export function AdminSettingsShell({
  section,
  children,
}: {
  section?: AdminSettingsSection;
  children?: React.ReactNode;
}) {
  const { status } = useSession();

  if (status === "loading") {
    return <AdminSettingsSkeleton />;
  }

  const title = section
    ? `تنظیمات — ${ADMIN_SETTINGS_SECTION_LABELS[section]}`
    : "تنظیمات";

  return (
    <PermissionGate permission={settingsPermission("view")}>
      <AdminSettingsGate>
        <>
          <AdminPageHeader
            title={title}
            description="تنظیمات هویت، منطقه، نوبت‌دهی، پرداخت و اعلان‌های این کسب‌وکار."
            breadcrumb={
              <AdminBreadcrumb
                pathname={routes.admin.settings}
                items={[
                  { href: routes.admin.home, label: "پنل مدیریت" },
                  { href: routes.admin.settings, label: "تنظیمات" },
                  ...(section
                    ? [{ label: ADMIN_SETTINGS_SECTION_LABELS[section] }]
                    : []),
                ]}
              />
            }
          />
          <AdminSettingsNav />
          {children}
        </>
      </AdminSettingsGate>
    </PermissionGate>
  );
}
