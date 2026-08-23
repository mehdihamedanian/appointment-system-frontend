import type { CapabilityKey } from "@/config/capabilities";
import {
  defaultCapabilities,
  isCapabilityVisible,
} from "@/config/capabilities";
import {
  adminNavSections,
  isNavItemActive,
  type NavItem,
  type NavSection,
} from "@/constants/navigation";
import { routes } from "@/constants/routes";
import { hasPermission } from "@/lib/permissions/access";
import type { SessionUser } from "@/types/session";

/**
 * When Backend has not issued granular permission codes yet, panel access
 * alone is enough to show navigation. Once codes exist, required permissions
 * are enforced for UI visibility (Backend remains authoritative).
 */
export function canSeeAdminNavItem(
  user: SessionUser | null | undefined,
  item: NavItem,
): boolean {
  if (!user) {
    return false;
  }
  if (!isCapabilityVisible(defaultCapabilities, item.capability)) {
    return false;
  }
  if (!item.permission) {
    return true;
  }
  if (user.permissionCodes.length === 0) {
    return true;
  }
  return hasPermission(user, item.permission);
}

export function filterAdminNavSections(
  user: SessionUser | null | undefined,
  sections: NavSection[] = adminNavSections,
): NavSection[] {
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => canSeeAdminNavItem(user, item)),
    }))
    .filter((section) => section.items.length > 0);
}

export function findAdminNavItem(
  pathname: string,
  sections: NavSection[] = adminNavSections,
): NavItem | undefined {
  let best: NavItem | undefined;
  for (const section of sections) {
    for (const item of section.items) {
      if (!isNavItemActive(pathname, item.href)) {
        continue;
      }
      if (item.href === routes.admin.home && pathname !== routes.admin.home) {
        continue;
      }
      if (!best || item.href.length > best.href.length) {
        best = item;
      }
    }
  }
  return best;
}

export function requiredPermissionForAdminPath(pathname: string): string | undefined {
  return findAdminNavItem(pathname)?.permission;
}

export function canAccessAdminPath(
  user: SessionUser | null | undefined,
  pathname: string,
): boolean {
  const item = findAdminNavItem(pathname);
  if (!item) {
    // Unknown admin subpath: allow shell; page-level gate may still apply.
    return true;
  }
  return canSeeAdminNavItem(user, item);
}

export type AdminBreadcrumbItem = {
  href?: string;
  label: string;
};

export function buildAdminBreadcrumbs(
  pathname: string,
  entityLabel?: string,
): AdminBreadcrumbItem[] {
  const items: AdminBreadcrumbItem[] = [
    { href: routes.admin.home, label: "پنل مدیریت" },
  ];
  const match = findAdminNavItem(pathname);
  if (!match || match.href === routes.admin.home) {
    if (pathname === routes.admin.home) {
      items.push({ label: "نمای کلی" });
    }
    return items;
  }
  if (entityLabel && pathname !== match.href) {
    items.push({ href: match.href, label: match.label });
    items.push({ label: entityLabel });
    return items;
  }
  items.push({ label: match.label });
  return items;
}

export function adminPageTitle(pathname: string, entityLabel?: string): string {
  if (entityLabel) return entityLabel;
  const match = findAdminNavItem(pathname);
  if (match) return match.label;
  return "پنل مدیریت";
}

/** Capability helper re-export for branch selector gating. */
export function isMultiBranchEnabled(): boolean {
  return isCapabilityVisible(defaultCapabilities, "multipleBranches" satisfies CapabilityKey);
}
