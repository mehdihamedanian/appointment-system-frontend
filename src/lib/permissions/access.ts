import type { SessionUser } from "@/types/session";

/**
 * Permission codes are opaque placeholders until the Backend contract exists.
 * Hidden UI is never a security boundary.
 */
export function hasPermission(
  user: SessionUser | null | undefined,
  code: string,
): boolean {
  if (!user || !code) {
    return false;
  }

  return user.permissionCodes.includes(code);
}

export function canAccessAdminPanel(user: SessionUser | null | undefined): boolean {
  if (!user) {
    return false;
  }

  if (user.adminPanelAccess === "granted") {
    return true;
  }

  if (user.adminPanelAccess === "denied") {
    return false;
  }

  return false;
}

export function isAdminAccessUnknown(user: SessionUser | null | undefined): boolean {
  return user?.adminPanelAccess === "unknown";
}
