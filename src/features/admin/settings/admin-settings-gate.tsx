"use client";

import { FeatureDisabledState } from "@/components/feedback/app-states";
import { isAdminSettingsEnabled } from "@/lib/admin/settings-context";

export function AdminSettingsGate({ children }: { children: React.ReactNode }) {
  if (!isAdminSettingsEnabled()) {
    return (
      <FeatureDisabledState
        title="تنظیمات"
        description="ماژول تنظیمات کسب‌وکار در این نسخه فعال نیست."
      />
    );
  }
  return <>{children}</>;
}
