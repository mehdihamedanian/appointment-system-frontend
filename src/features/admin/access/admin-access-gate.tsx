"use client";

import { FeatureDisabledState } from "@/components/feedback/app-states";
import { isAdminAccessManagementEnabled } from "@/lib/admin/access-context";
import { ADMIN_ACCESS_MANAGEMENT_ENABLED } from "@/types/admin-access";

export function AdminAccessGate({ children }: { children: React.ReactNode }) {
  if (!ADMIN_ACCESS_MANAGEMENT_ENABLED) {
    return (
      <FeatureDisabledState
        title="مدیریت دسترسی"
        description="ماژول کاربران و نقش‌ها در این نسخه فعال نیست."
      />
    );
  }

  if (!isAdminAccessManagementEnabled()) {
    return (
      <FeatureDisabledState
        title="مدیریت دسترسی غیرفعال است"
        description="این قابلیت برای کسب‌وکار شما فعال نیست."
      />
    );
  }

  return <>{children}</>;
}
