/**
 * Admin Business Settings (Phase 41) — view models and form contracts.
 * Field presence is Backend-driven; frontend does not invent production settings.
 */

export const ADMIN_SETTINGS_ENABLED = true;

export const ADMIN_SETTINGS_SECTIONS = [
  "general",
  "localization",
  "booking",
  "payments",
  "notifications",
] as const;

export type AdminSettingsSection = (typeof ADMIN_SETTINGS_SECTIONS)[number];

export type AdminSettingsSelectOption = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
};

export type AdminSettingsAllowedActions = {
  view: boolean;
  edit: boolean;
  uploadLogo?: boolean;
  removeLogo?: boolean;
  changeCurrency?: boolean;
  changeTimezone?: boolean;
  processing?: boolean;
  blockedReason?: string;
};

export type AdminSettingsCapabilities = {
  supportsImpactPreview: boolean;
  supportsLogoUpload: boolean;
  supportsBranchScopedSettings: boolean;
  supportsGatewayStatus: boolean;
  publicCacheAffected: boolean;
};

export type AdminSettingsImpactPreview = {
  title: string;
  summary: string;
  effects: string[];
  blocked: boolean;
  blockedReason?: string;
  confirmLabel?: string;
  previewVersion?: string;
  requiresConfirmation: boolean;
  highImpact: boolean;
};

export type AdminSettingsConflictState = {
  message: string;
  version?: string;
};

/** Shared meta returned with every section read. */
export type AdminSettingsSectionMeta = {
  version?: string;
  etag?: string;
  updatedAt?: string;
  updatedAtLabel?: string;
  allowedActions: AdminSettingsAllowedActions;
  capabilities: AdminSettingsCapabilities;
  unsupportedFields: string[];
};

/* ─── General ─────────────────────────────────────────────── */

export type AdminGeneralSettingsView = AdminSettingsSectionMeta & {
  section: "general";
  businessName: string;
  shortDescription: string;
  contactPhone: string;
  contactEmail: string;
  address: string;
  publicContactDetails: string;
  publicPageTitle: string;
  logoUrl?: string;
  logoUploadSupported: boolean;
};

export type AdminGeneralSettingsFormInput = {
  businessName: string;
  shortDescription: string;
  contactPhone: string;
  contactEmail: string;
  address: string;
  publicContactDetails: string;
  publicPageTitle: string;
};

export type AdminGeneralSettingsFormErrors = Partial<
  Record<keyof AdminGeneralSettingsFormInput, string>
> & { form?: string };

/* ─── Localization ─────────────────────────────────────────── */

export type AdminLocalizationSettingsView = AdminSettingsSectionMeta & {
  section: "localization";
  defaultLanguage: string;
  currency: string;
  timezone: string;
  locale: string;
  calendarType: string;
  numberFormat: string;
  languageOptions: AdminSettingsSelectOption[];
  currencyOptions: AdminSettingsSelectOption[];
  timezoneOptions: AdminSettingsSelectOption[];
  localeOptions: AdminSettingsSelectOption[];
  calendarTypeOptions: AdminSettingsSelectOption[];
  numberFormatOptions: AdminSettingsSelectOption[];
  /** Sample business-local time for the selected timezone (Backend-provided). */
  sampleBusinessTimeLabel?: string;
  timezoneOffsetLabel?: string;
};

export type AdminLocalizationSettingsFormInput = {
  defaultLanguage: string;
  currency: string;
  timezone: string;
  locale: string;
  calendarType: string;
  numberFormat: string;
};

export type AdminLocalizationSettingsFormErrors = Partial<
  Record<keyof AdminLocalizationSettingsFormInput, string>
> & { form?: string };

/* ─── Booking ──────────────────────────────────────────────── */

export type AdminBookingSettingsView = AdminSettingsSectionMeta & {
  section: "booking";
  /** Minutes */
  minAdvanceBookingMinutes?: number;
  /** Days */
  maxAdvanceBookingDays?: number;
  /** Minutes — not service duration */
  slotIntervalMinutes?: number;
  /** Minutes */
  slotHoldDurationMinutes?: number;
  confirmationMode?: string;
  providerSelectionEnabled?: boolean;
  anyProviderEnabled?: boolean;
  payAtLocationEnabled?: boolean;
  cancellationPolicyText?: string;
  reschedulePolicyText?: string;
  confirmationModeOptions: AdminSettingsSelectOption[];
  /** Field-level unit labels from Backend when present */
  fieldUnits: Partial<
    Record<
      | "minAdvanceBookingMinutes"
      | "maxAdvanceBookingDays"
      | "slotIntervalMinutes"
      | "slotHoldDurationMinutes",
      string
    >
  >;
};

export type AdminBookingSettingsFormInput = {
  minAdvanceBookingMinutes: string;
  maxAdvanceBookingDays: string;
  slotIntervalMinutes: string;
  slotHoldDurationMinutes: string;
  confirmationMode: string;
  providerSelectionEnabled: boolean;
  anyProviderEnabled: boolean;
  payAtLocationEnabled: boolean;
  cancellationPolicyText: string;
  reschedulePolicyText: string;
};

export type AdminBookingSettingsFormErrors = Partial<
  Record<keyof AdminBookingSettingsFormInput, string>
> & { form?: string };

/* ─── Payments ─────────────────────────────────────────────── */

export type AdminPaymentGatewayStatus =
  | "connected"
  | "not_connected"
  | "disabled"
  | "requires_action"
  | "unknown";

export type AdminPaymentSettingsView = AdminSettingsSectionMeta & {
  section: "payments";
  fullPaymentEnabled?: boolean;
  depositEnabled?: boolean;
  payAtLocationEnabled?: boolean;
  enabledMethodIds: string[];
  methodOptions: AdminSettingsSelectOption[];
  /** Minutes */
  paymentTimeoutMinutes?: number;
  customerFacingPaymentText?: string;
  gatewayStatus: AdminPaymentGatewayStatus;
  gatewayStatusLabel: string;
};

export type AdminPaymentSettingsFormInput = {
  fullPaymentEnabled: boolean;
  depositEnabled: boolean;
  payAtLocationEnabled: boolean;
  enabledMethodIds: string[];
  paymentTimeoutMinutes: string;
  customerFacingPaymentText: string;
};

export type AdminPaymentSettingsFormErrors = Partial<
  Record<keyof AdminPaymentSettingsFormInput, string>
> & { form?: string };

/* ─── Notifications (high-level prefs; not Phase 38 templates) ─ */

export type AdminNotificationSettingsView = AdminSettingsSectionMeta & {
  section: "notifications";
  smsEnabled?: boolean;
  emailEnabled?: boolean;
  bookingConfirmationEnabled?: boolean;
  appointmentReminderEnabled?: boolean;
  cancellationEnabled?: boolean;
  rescheduleEnabled?: boolean;
  paymentEnabled?: boolean;
  waitingListOfferEnabled?: boolean;
  templatesManageHref?: string;
};

export type AdminNotificationSettingsFormInput = {
  smsEnabled: boolean;
  emailEnabled: boolean;
  bookingConfirmationEnabled: boolean;
  appointmentReminderEnabled: boolean;
  cancellationEnabled: boolean;
  rescheduleEnabled: boolean;
  paymentEnabled: boolean;
  waitingListOfferEnabled: boolean;
};

export type AdminNotificationSettingsFormErrors = Partial<
  Record<keyof AdminNotificationSettingsFormInput, string>
> & { form?: string };

export const ADMIN_SETTINGS_SECTION_LABELS: Record<AdminSettingsSection, string> = {
  general: "عمومی",
  localization: "زبان و منطقه",
  booking: "نوبت‌دهی",
  payments: "پرداخت",
  notifications: "اعلان‌ها",
};

export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const LOGO_ACCEPT = "image/jpeg,image/png,image/webp";
