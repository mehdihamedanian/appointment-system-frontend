"use client";

import { FeatureDisabledState } from "@/components/feedback/app-states";
import { isAdminActivityLogsEnabled } from "@/lib/admin/activity-log-context";

export function AdminActivityLogsGate({ children }: { children: React.ReactNode }) {
  if (!isAdminActivityLogsEnabled()) {
    return (
      <FeatureDisabledState
        title="گزارش فعالیت"
        description="ماژول گزارش فعالیت در این نسخه فعال نیست."
      />
    );
  }
  return <>{children}</>;
}
