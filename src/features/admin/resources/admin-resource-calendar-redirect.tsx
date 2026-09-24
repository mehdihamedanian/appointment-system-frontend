"use client";

import { useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { InlineLoading } from "@/components/feedback/loading-states";
import { PermissionGate } from "@/features/admin/permission-gate";
import { adminResourceCalendarHref } from "@/lib/admin/resource-filters";
import { sanitizeIsoDate } from "@/lib/admin/appointment-filters";

/**
 * Reuses Phase 27 Admin Calendar with the current resource preselected.
 * Does not create a separate calendar engine.
 */
export function AdminResourceCalendarRedirect() {
  const params = useParams<{ resourceReference: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const reference = decodeURIComponent(params.resourceReference ?? "");
  const date = sanitizeIsoDate(searchParams.get("date"));

  useEffect(() => {
    if (!reference) return;
    router.replace(adminResourceCalendarHref(reference, date));
  }, [reference, date, router]);

  return (
    <PermissionGate permission="admin.resources.view">
      <InlineLoading label="انتقال به تقویم منبع" />
    </PermissionGate>
  );
}
