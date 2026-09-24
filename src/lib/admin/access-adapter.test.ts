import { describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import {
  adaptAdminPermissionCatalog,
  adaptAdminRoleDetail,
  adaptAdminRoleListItem,
  adaptAdminUserDetail,
  adaptAdminUserListItem,
  buildLocalPermissionDiff,
  isAdminAccessConflict,
  isDuplicateAccessError,
} from "@/lib/admin/access-adapter";
import {
  accessPermission,
  adminUsersHref,
  parseAdminUserFilters,
} from "@/lib/admin/access-filters";
import {
  auditPermissionCatalogCoverage,
  FRONTEND_CONSUMED_PERMISSION_KEYS,
  PHASE40_EXPECTED_PERMISSION_KEYS,
  diffPermissionSets,
} from "@/lib/admin/permission-catalog-audit";
import { clearAdminAccessCaches } from "@/lib/admin/access-cache";

describe("permission catalog audit", () => {
  it("lists frontend-consumed keys without inventing renames", () => {
    expect(FRONTEND_CONSUMED_PERMISSION_KEYS.some((item) => item.key === "admin.users.view")).toBe(
      true,
    );
    expect(PHASE40_EXPECTED_PERMISSION_KEYS).toContain("admin.roles.assign_permissions");
  });

  it("reports frontend-only gaps against Backend catalog", () => {
    const audit = auditPermissionCatalogCoverage(["admin.users.view", "admin.roles.view"]);
    expect(audit.shared).toEqual(["admin.roles.view", "admin.users.view"]);
    expect(audit.frontendOnly.length).toBeGreaterThan(0);
  });

  it("diffs permission sets without inventing percentages", () => {
    expect(diffPermissionSets(["a", "b"], ["b", "c"])).toEqual({
      granted: ["c"],
      revoked: ["a"],
      unchanged: ["b"],
    });
  });
});

describe("admin access adapter", () => {
  it("adapts user list with masked contacts and last-login states", () => {
    const item = adaptAdminUserListItem({
      reference: "USR-1",
      displayName: "مدیر",
      maskedEmail: "a***@example.com",
      maskedPhone: "09**",
      roleLabel: "Owner",
      status: "active",
      invitationStatus: "pending",
      lastLoginState: "never",
      allowedActions: { view: true, edit: true },
    });
    expect(item?.maskedEmail).toBe("a***@example.com");
    expect(item?.lastLoginLabel).toBe("هرگز وارد نشده");
    expect(item?.invitationStatusLabel).toMatch(/دعوت/);
  });

  it("marks current user and branch scope on detail", () => {
    const detail = adaptAdminUserDetail(
      {
        reference: "USR-1",
        displayName: "من",
        status: "active",
        permissionCodes: ["admin.users.view"],
        branchScopeIds: ["br_1"],
        branchScopeLabels: ["مرکزی"],
        branchScopeSupported: true,
        allowedActions: { edit: true, deactivate: false, blockedReason: "آخرین مدیر" },
      },
      "USR-1",
    );
    expect(detail?.isCurrentUser).toBe(true);
    expect(detail?.allowedActions.deactivate).toBe(false);
    expect(detail?.branchScopeLabels).toEqual(["مرکزی"]);
  });

  it("protects system roles from unsupported edit/delete flags", () => {
    const role = adaptAdminRoleListItem({
      reference: "ROLE-SYS",
      name: "Owner",
      system: true,
      editable: false,
      deletable: false,
      userCount: 1,
      allowedActions: { view: true },
    });
    expect(role?.system).toBe(true);
    expect(role?.canEdit).toBe(false);
    expect(role?.canDelete).toBe(false);
  });

  it("adapts permission catalog domains from Backend", () => {
    const catalog = adaptAdminPermissionCatalog({
      items: [
        {
          key: "admin.appointments.view",
          label: "مشاهده نوبت",
          domain: "appointments",
          dependsOn: [],
        },
        {
          key: "admin.appointments.create",
          label: "ایجاد نوبت",
          domain: "appointments",
          dependsOn: ["admin.appointments.view"],
        },
      ],
    });
    expect(catalog.items).toHaveLength(2);
    expect(catalog.items[1]?.dependsOn).toContain("admin.appointments.view");
  });

  it("builds local permission diff summary", () => {
    const preview = buildLocalPermissionDiff(["a"], ["a", "b"]);
    expect(preview.grantedPermissions).toEqual(["b"]);
    expect(preview.summaryLines.length).toBeGreaterThan(0);
  });

  it("detects conflict and duplicate errors", () => {
    expect(isAdminAccessConflict({ status: 409, code: "VERSION_CONFLICT" })).toBe(true);
    expect(isDuplicateAccessError({ status: 409, code: "USER_EXISTS" })).toBe(true);
  });

  it("adapts role detail permission keys", () => {
    const detail = adaptAdminRoleDetail({
      reference: "ROLE-1",
      name: "Custom",
      permissionKeys: ["admin.reports.view"],
      system: false,
      editable: true,
      allowedActions: { edit: true, assignPermissions: true },
    });
    expect(detail?.permissionKeys).toContain("admin.reports.view");
  });
});

describe("admin access filters", () => {
  it("parses URL filters and builds href", () => {
    const filters = parseAdminUserFilters(
      new URLSearchParams("status=active&invitationStatus=pending&role=ROLE-1&q=ali"),
    );
    expect(filters.status).toBe("active");
    expect(filters.invitationStatus).toBe("pending");
    expect(filters.roleReference).toBe("ROLE-1");
    expect(adminUsersHref(filters)).toContain("status=active");
    expect(accessPermission("rolesAssignPermissions")).toBe(
      "admin.roles.assign_permissions",
    );
  });

  it("clears access caches", () => {
    const client = new QueryClient();
    client.setQueryData(["admin", "users", "staff_1", "list"], { secret: true });
    clearAdminAccessCaches(client, "staff_1");
    expect(client.getQueryData(["admin", "users", "staff_1", "list"])).toBeUndefined();
  });
});
