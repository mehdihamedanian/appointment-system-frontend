"use client";

import { FeatureDisabledState } from "@/components/feedback/app-states";
import { isAdminNotificationManagementEnabled } from "@/lib/admin/notification-context";
import { ADMIN_NOTIFICATION_MANAGEMENT_ENABLED } from "@/types/admin-notification";

export function AdminNotificationsGate({ children }: { children: React.ReactNode }) {
  if (!ADMIN_NOTIFICATION_MANAGEMENT_ENABLED) {
    return (
      <FeatureDisabledState
        title="اعلان‌ها"
        description="ماژول مدیریت قالب و گزارش ارسال در این نسخه فعال نیست."
      />
    );
  }

  if (!isAdminNotificationManagementEnabled()) {
    return (
      <FeatureDisabledState
        title="مدیریت اعلان غیرفعال است"
        description="این قابلیت برای کسب‌وکار شما فعال نیست."
      />
    );
  }

  return <>{children}</>;
}
