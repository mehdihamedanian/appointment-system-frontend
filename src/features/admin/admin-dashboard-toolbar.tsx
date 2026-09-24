"use client";

import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/form-field";
import { Select } from "@/components/ui/select";
import {
  adminDashboardHref,
  sanitizeIsoDate,
} from "@/lib/admin/dashboard-filters";
import type { AdminDashboardFilters } from "@/types/admin-dashboard";
import type { PublicBranch } from "@/types/public";

export function AdminDashboardToolbar({
  filters,
  branches,
  showBranchFilter,
  analyticsRangeSupported,
}: {
  filters: AdminDashboardFilters;
  branches: PublicBranch[];
  showBranchFilter: boolean;
  analyticsRangeSupported: boolean;
}) {
  const router = useRouter();

  const branchOptions = useMemo(
    () => [
      { value: "all", label: "همه شعب" },
      ...branches.map((branch) => ({ value: branch.id, label: branch.name })),
    ],
    [branches],
  );

  const navigate = useCallback(
    (next: AdminDashboardFilters) => {
      router.replace(adminDashboardHref(next));
    },
    [router],
  );

  return (
    <div className="admin-dashboard-toolbar">
      {showBranchFilter ? (
        <div className="admin-dashboard-toolbar__field">
          <Label htmlFor="admin-dashboard-branch">شعبه</Label>
          <Select
            id="admin-dashboard-branch"
            value={filters.branchId ?? "all"}
            options={branchOptions}
            onChange={(value) => {
              navigate({
                ...filters,
                branchId: value === "all" ? undefined : value,
              });
            }}
            allowClear={false}
          />
        </div>
      ) : null}

      {analyticsRangeSupported ? (
        <>
          <div className="admin-dashboard-toolbar__field">
            <Label htmlFor="admin-dashboard-from">از تاریخ</Label>
            <input
              id="admin-dashboard-from"
              type="date"
              className="ds-control ltr-value"
              value={filters.analyticsFrom ?? ""}
              onChange={(event) => {
                const analyticsFrom = sanitizeIsoDate(event.target.value);
                navigate({ ...filters, analyticsFrom });
              }}
            />
          </div>
          <div className="admin-dashboard-toolbar__field">
            <Label htmlFor="admin-dashboard-to">تا تاریخ</Label>
            <input
              id="admin-dashboard-to"
              type="date"
              className="ds-control ltr-value"
              value={filters.analyticsTo ?? ""}
              onChange={(event) => {
                const analyticsTo = sanitizeIsoDate(event.target.value);
                navigate({ ...filters, analyticsTo });
              }}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
