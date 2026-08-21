export type SessionStatus =
  | "loading"
  | "authenticated"
  | "unauthenticated"
  | "expired"
  | "error";

/**
 * Coarse admin-panel access mapped from the Backend session payload.
 * Permission codes themselves stay opaque until the contract exists.
 */
export type AdminPanelAccess = "granted" | "denied" | "unknown";

export type SessionUser = {
  id: string;
  displayName?: string;
  email?: string;
  phone?: string;
  permissionCodes: readonly string[];
  adminPanelAccess: AdminPanelAccess;
};

export type ResolvedSession = {
  status: Exclude<SessionStatus, "loading">;
  user: SessionUser | null;
  requestId?: string;
  message?: string;
};
