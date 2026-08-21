import { isRecord, readString } from "@/lib/utilities/records";
import type { AdminPanelAccess, ResolvedSession, SessionUser } from "@/types/session";

function readAdminPanelAccess(value: unknown): AdminPanelAccess {
  if (typeof value === "boolean") {
    return value ? "granted" : "denied";
  }

  const normalized = readString(value)?.toLowerCase();
  if (!normalized) {
    return "unknown";
  }

  if (["granted", "true", "yes", "allowed", "admin"].includes(normalized)) {
    return "granted";
  }

  if (["denied", "false", "no", "forbidden"].includes(normalized)) {
    return "denied";
  }

  return "unknown";
}

function readPermissionCodes(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => readString(item))
    .filter((item): item is string => Boolean(item));
}

function readUser(value: unknown): SessionUser | null {
  const source = isRecord(value) ? value : null;
  if (!source) {
    return null;
  }

  const id = readString(source.id) ?? readString(source.userId);
  if (!id) {
    return null;
  }

  return {
    id,
    displayName:
      readString(source.displayName) ??
      readString(source.fullName) ??
      readString(source.name),
    email: readString(source.email),
    phone: readString(source.phone) ?? readString(source.mobile),
    permissionCodes: (() => {
      const explicit = readPermissionCodes(source.permissionCodes);
      return explicit.length > 0
        ? explicit
        : readPermissionCodes(source.permissions);
    })(),
    adminPanelAccess: readAdminPanelAccess(
      source.adminPanelAccess ?? source.canAccessAdmin,
    ),
  };
}

export function adaptSessionPayload(payload: unknown): ResolvedSession {
  if (payload == null) {
    return { status: "unauthenticated", user: null };
  }

  const root = isRecord(payload) ? payload : {};
  const nestedUser =
    root.user ??
    (isRecord(root.data) ? root.data.user : undefined) ??
    (isRecord(root.session) ? root.session.user : undefined) ??
    (isRecord(root.data) ? root.data : undefined);

  const user = readUser(nestedUser) ?? readUser(root);
  if (!user) {
    return { status: "unauthenticated", user: null };
  }

  return {
    status: "authenticated",
    user,
    requestId: readString(root.requestId),
  };
}
