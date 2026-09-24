"use client";

import { useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { InlineLoading } from "@/components/feedback/loading-states";
import { PermissionGate } from "@/features/admin/permission-gate";
import { adminStaffCalendarHref } from "@/lib/admin/staff-filters";
import { sanitizeIsoDate } from "@/lib/admin/appointment-filters";

/** Reuses Phase 27 Admin Calendar with staff filter preselected. */
export function AdminStaffCalendarRedirect() {
  const params = useParams<{ staffReference: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const reference = decodeURIComponent(params.staffReference ?? "");
  const date = sanitizeIsoDate(searchParams.get("date"));

  useEffect(() => {
    if (!reference) return;
    router.replace(adminStaffCalendarHref(reference, date));
  }, [reference, date, router]);

  return (
    <PermissionGate permission="admin.staff.view">
      <InlineLoading label="انتقال به تقویم کارمند" />
    </PermissionGate>
  );
}
