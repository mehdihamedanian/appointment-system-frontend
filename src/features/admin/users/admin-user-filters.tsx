"use client";

import { useMemo } from "react";
import { Label } from "@/components/ui/form-field";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { sanitizeIsoDate } from "@/lib/admin/dashboard-filters";
import type {
  AdminInvitationStatusFilter,
  AdminUserFilterOptions,
  AdminUserLinkedStaffFilter,
  AdminUserListFilters,
  AdminUserStatusFilter,
} from "@/types/admin-access";

function FilterFields({
  filters,
  options,
  showBranchFilter,
  onChange,
}: {
  filters: AdminUserListFilters;
  options?: AdminUserFilterOptions;
  showBranchFilter?: boolean;
  onChange: (next: Partial<AdminUserListFilters>) => void;
}) {
  const roleOptions = useMemo(
    () => [
      { value: "all", label: "همه نقش‌ها" },
      ...(options?.roles?.map((item) => ({ value: item.id, label: item.label })) ?? []),
    ],
    [options?.roles],
  );
  const branchOptions = useMemo(
    () => [
      { value: "all", label: "همه شعب" },
      ...(options?.branches?.map((item) => ({ value: item.id, label: item.label })) ?? []),
    ],
    [options?.branches],
  );

  return (
    <div className="admin-access-filters__grid">
      <div className="admin-access-filters__field">
        <Label htmlFor="admin-user-status">وضعیت</Label>
        <Select
          id="admin-user-status"
          value={filters.status}
          options={[
            { value: "all", label: "همه" },
            { value: "active", label: "فعال" },
            { value: "inactive", label: "غیرفعال" },
          ]}
          onChange={(value) =>
            onChange({
              status: (value as AdminUserStatusFilter) ?? "all",
              page: 1,
            })
          }
          allowClear={false}
        />
      </div>
      <div className="admin-access-filters__field">
        <Label htmlFor="admin-user-invite">وضعیت دعوت</Label>
        <Select
          id="admin-user-invite"
          value={filters.invitationStatus}
          options={[
            { value: "all", label: "همه" },
            { value: "pending", label: "در انتظار" },
            { value: "accepted", label: "پذیرفته" },
            { value: "expired", label: "منقضی" },
            { value: "revoked", label: "لغو شده" },
            { value: "none", label: "بدون دعوت" },
          ]}
          onChange={(value) =>
            onChange({
              invitationStatus: (value as AdminInvitationStatusFilter) ?? "all",
              page: 1,
            })
          }
          allowClear={false}
        />
      </div>
      <div className="admin-access-filters__field">
        <Label htmlFor="admin-user-role">نقش</Label>
        <Select
          id="admin-user-role"
          value={filters.roleReference ?? "all"}
          options={roleOptions}
          onChange={(value) =>
            onChange({
              roleReference: value === "all" ? undefined : value ?? undefined,
              page: 1,
            })
          }
        />
      </div>
      <div className="admin-access-filters__field">
        <Label htmlFor="admin-user-staff-link">پیوند پرسنل</Label>
        <Select
          id="admin-user-staff-link"
          value={filters.linkedStaff}
          options={[
            { value: "all", label: "همه" },
            { value: "linked", label: "پیوندشده" },
            { value: "unlinked", label: "بدون پیوند" },
          ]}
          onChange={(value) =>
            onChange({
              linkedStaff: (value as AdminUserLinkedStaffFilter) ?? "all",
              page: 1,
            })
          }
          allowClear={false}
        />
      </div>
      {showBranchFilter ? (
        <div className="admin-access-filters__field">
          <Label htmlFor="admin-user-branch">محدوده شعبه</Label>
          <Select
            id="admin-user-branch"
            value={filters.branchId ?? "all"}
            options={branchOptions}
            onChange={(value) =>
              onChange({
                branchId: value === "all" ? undefined : value ?? undefined,
                page: 1,
              })
            }
          />
        </div>
      ) : null}
      <div className="admin-access-filters__field">
        <Label htmlFor="admin-user-login-from">آخرین ورود از</Label>
        <input
          id="admin-user-login-from"
          type="date"
          className="ds-control ltr-value"
          value={filters.lastLoginFrom ?? ""}
          onChange={(event) =>
            onChange({ lastLoginFrom: sanitizeIsoDate(event.target.value), page: 1 })
          }
        />
      </div>
      <div className="admin-access-filters__field">
        <Label htmlFor="admin-user-login-to">آخرین ورود تا</Label>
        <input
          id="admin-user-login-to"
          type="date"
          className="ds-control ltr-value"
          value={filters.lastLoginTo ?? ""}
          onChange={(event) =>
            onChange({ lastLoginTo: sanitizeIsoDate(event.target.value), page: 1 })
          }
        />
      </div>
    </div>
  );
}

export function AdminUserFilters({
  filters,
  options,
  showBranchFilter,
  mobileOpen,
  onMobileOpenChange,
  onChange,
  onClear,
}: {
  filters: AdminUserListFilters;
  options?: AdminUserFilterOptions;
  showBranchFilter?: boolean;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
  onChange: (next: Partial<AdminUserListFilters>) => void;
  onClear: () => void;
}) {
  return (
    <>
      <div className="admin-access-filters admin-access-filters--desktop">
        <FilterFields
          filters={filters}
          options={options}
          showBranchFilter={showBranchFilter}
          onChange={onChange}
        />
        <div className="admin-access-filters__actions">
          <Button variant="secondary" onClick={onClear}>
            پاک کردن فیلترها
          </Button>
        </div>
      </div>
      <Drawer
        open={mobileOpen}
        onClose={() => onMobileOpenChange(false)}
        title="فیلتر کاربران"
        placement="bottom"
      >
        <FilterFields
          filters={filters}
          options={options}
          showBranchFilter={showBranchFilter}
          onChange={onChange}
        />
        <div className="admin-access-filters__drawer-actions">
          <Button variant="secondary" onClick={onClear}>
            پاک کردن
          </Button>
          <Button onClick={() => onMobileOpenChange(false)}>اعمال</Button>
        </div>
      </Drawer>
    </>
  );
}
