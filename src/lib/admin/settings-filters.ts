import { routes } from "@/constants/routes";
import type { AdminSettingsSection } from "@/types/admin-settings";
import { ADMIN_SETTINGS_SECTIONS } from "@/types/admin-settings";

export function settingsPermission(
  action:
    | "view"
    | "generalView"
    | "generalEdit"
    | "localizationView"
    | "localizationEdit"
    | "bookingView"
    | "bookingEdit"
    | "paymentsView"
    | "paymentsEdit"
    | "notificationsView"
    | "notificationsEdit",
): string {
  switch (action) {
    case "view":
      return "admin.settings.view";
    case "generalView":
      return "admin.settings.general.view";
    case "generalEdit":
      return "admin.settings.general.edit";
    case "localizationView":
      return "admin.settings.localization.view";
    case "localizationEdit":
      return "admin.settings.localization.edit";
    case "bookingView":
      return "admin.settings.booking.view";
    case "bookingEdit":
      return "admin.settings.booking.edit";
    case "paymentsView":
      return "admin.settings.payments.view";
    case "paymentsEdit":
      return "admin.settings.payments.edit";
    case "notificationsView":
      return "admin.settings.notifications.view";
    case "notificationsEdit":
      return "admin.settings.notifications.edit";
    default:
      return "admin.settings.view";
  }
}

export function settingsSectionHref(section: AdminSettingsSection): string {
  switch (section) {
    case "general":
      return routes.admin.settingsGeneral;
    case "localization":
      return routes.admin.settingsLocalization;
    case "booking":
      return routes.admin.settingsBooking;
    case "payments":
      return routes.admin.settingsPayments;
    case "notifications":
      return routes.admin.settingsNotifications;
    default:
      return routes.admin.settings;
  }
}

export function parseAdminSettingsSection(
  value: string | null | undefined,
): AdminSettingsSection | undefined {
  const raw = value?.trim().toLowerCase();
  if (raw && (ADMIN_SETTINGS_SECTIONS as readonly string[]).includes(raw)) {
    return raw as AdminSettingsSection;
  }
  return undefined;
}

export function settingsSectionViewPermission(section: AdminSettingsSection): string {
  switch (section) {
    case "general":
      return settingsPermission("generalView");
    case "localization":
      return settingsPermission("localizationView");
    case "booking":
      return settingsPermission("bookingView");
    case "payments":
      return settingsPermission("paymentsView");
    case "notifications":
      return settingsPermission("notificationsView");
  }
}

export function settingsSectionEditPermission(section: AdminSettingsSection): string {
  switch (section) {
    case "general":
      return settingsPermission("generalEdit");
    case "localization":
      return settingsPermission("localizationEdit");
    case "booking":
      return settingsPermission("bookingEdit");
    case "payments":
      return settingsPermission("paymentsEdit");
    case "notifications":
      return settingsPermission("notificationsEdit");
  }
}

/** Phase 41 expected keys (UI contract). Backend catalog must align. */
export const PHASE41_EXPECTED_PERMISSION_KEYS = [
  "admin.settings.view",
  "admin.settings.general.view",
  "admin.settings.general.edit",
  "admin.settings.localization.view",
  "admin.settings.localization.edit",
  "admin.settings.booking.view",
  "admin.settings.booking.edit",
  "admin.settings.payments.view",
  "admin.settings.payments.edit",
  "admin.settings.notifications.view",
  "admin.settings.notifications.edit",
] as const;

/**
 * Section visibility: empty permissionCodes → allow (same as PermissionGate).
 * If granular section keys exist on the session, require view|edit for that section.
 * If only hub `admin.settings.view` is present, allow all sections as fallback.
 */
export function canAccessSettingsSection(
  permissionCodes: readonly string[] | undefined,
  section: AdminSettingsSection,
): boolean {
  const codes = permissionCodes ?? [];
  if (codes.length === 0) return true;
  const view = settingsSectionViewPermission(section);
  const edit = settingsSectionEditPermission(section);
  if (codes.includes(view) || codes.includes(edit)) return true;
  const granular = PHASE41_EXPECTED_PERMISSION_KEYS.filter(
    (key) => key !== "admin.settings.view",
  );
  const hasAnyGranular = granular.some((key) => codes.includes(key));
  if (!hasAnyGranular && codes.includes(settingsPermission("view"))) return true;
  return false;
}

export function canEditSettingsSection(
  permissionCodes: readonly string[] | undefined,
  section: AdminSettingsSection,
): boolean {
  const codes = permissionCodes ?? [];
  if (codes.length === 0) return true;
  const edit = settingsSectionEditPermission(section);
  if (codes.includes(edit)) return true;
  const granularEdits = PHASE41_EXPECTED_PERMISSION_KEYS.filter((key) =>
    key.endsWith(".edit"),
  );
  const hasAnyEdit = granularEdits.some((key) => codes.includes(key));
  if (!hasAnyEdit && codes.includes(settingsPermission("view"))) return true;
  return false;
}
