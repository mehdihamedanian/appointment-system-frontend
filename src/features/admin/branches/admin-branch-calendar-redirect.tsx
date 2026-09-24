"use client";

import { useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { InlineLoading } from "@/components/feedback/loading-states";
import { AdminBranchesGate } from "@/features/admin/branches/admin-branches-gate";
import { PermissionGate } from "@/features/admin/permission-gate";
import { adminBranchCalendarHref } from "@/lib/admin/branch-filters";
import { sanitizeIsoDate } from "@/lib/admin/appointment-filters";

/**
 * Reuses Phase 27 Admin Calendar with the current branch preselected.
 */
export function AdminBranchCalendarRedirect() {
  const params = useParams<{ branchReference: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const reference = decodeURIComponent(params.branchReference ?? "");
  const date = sanitizeIsoDate(searchParams.get("date"));

  useEffect(() => {
    if (!reference) return;
    router.replace(adminBranchCalendarHref(reference, date));
  }, [reference, date, router]);

  return (
    <PermissionGate permission="admin.branches.view">
      <AdminBranchesGate>
        <InlineLoading label="انتقال به تقویم شعبه" />
      </AdminBranchesGate>
    </PermissionGate>
  );
}
