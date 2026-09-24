"use client";

import { FeatureDisabledState } from "@/components/feedback/app-states";
import { isAdminReportsEnabled } from "@/lib/admin/report-context";
import { ADMIN_REPORTS_ENABLED } from "@/types/admin-report";

export function AdminReportsGate({ children }: { children: React.ReactNode }) {
  if (!ADMIN_REPORTS_ENABLED) {
    return (
      <FeatureDisabledState
        title="گزارش‌ها"
        description="ماژول گزارش‌های مدیریتی در این نسخه فعال نیست."
      />
    );
  }

  if (!isAdminReportsEnabled()) {
    return (
      <FeatureDisabledState
        title="گزارش‌ها غیرفعال است"
        description="این قابلیت برای کسب‌وکار شما فعال نیست."
      />
    );
  }

  return <>{children}</>;
}
