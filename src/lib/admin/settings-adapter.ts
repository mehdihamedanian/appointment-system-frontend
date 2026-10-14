import { asList, asSafeText, readBoolean, unwrapPayload } from "@/lib/public/read";
import { isRecord, readString } from "@/lib/utilities/records";
import type {
  AdminBookingSettingsFormErrors,
  AdminBookingSettingsFormInput,
  AdminBookingSettingsView,
  AdminGeneralSettingsFormErrors,
  AdminGeneralSettingsFormInput,
  AdminGeneralSettingsView,
  AdminLocalizationSettingsFormErrors,
  AdminLocalizationSettingsFormInput,
  AdminLocalizationSettingsView,
  AdminNotificationSettingsFormErrors,
  AdminNotificationSettingsFormInput,
  AdminNotificationSettingsView,
  AdminPaymentGatewayStatus,
  AdminPaymentSettingsFormErrors,
  AdminPaymentSettingsFormInput,
  AdminPaymentSettingsView,
  AdminSettingsAllowedActions,
  AdminSettingsCapabilities,
  AdminSettingsImpactPreview,
  AdminSettingsSelectOption,
  AdminSettingsSectionMeta,
} from "@/types/admin-settings";

function readNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function adaptSelectOption(value: unknown): AdminSettingsSelectOption | undefined {
  if (!isRecord(value)) return undefined;
  const optionValue = readString(value.value) ?? readString(value.id) ?? readString(value.key);
  if (!optionValue) return undefined;
  return {
    value: optionValue,
    label: asSafeText(value.label) ?? asSafeText(value.name) ?? optionValue,
    description: asSafeText(value.description),
    disabled: readBoolean(value.disabled) === true,
  };
}

function adaptSelectOptions(value: unknown): AdminSettingsSelectOption[] {
  return asList(value, ["items", "options", "results"])
    .map(adaptSelectOption)
    .filter((item): item is AdminSettingsSelectOption => Boolean(item));
}

function adaptAllowedActions(value: unknown): AdminSettingsAllowedActions {
  const source = isRecord(value) ? value : {};
  return {
    view: readBoolean(source.view) !== false,
    edit: readBoolean(source.edit) === true,
    uploadLogo: readBoolean(source.uploadLogo ?? source.logoUpload) === true,
    removeLogo: readBoolean(source.removeLogo ?? source.logoRemove) === true,
    changeCurrency: readBoolean(source.changeCurrency) === true,
    changeTimezone: readBoolean(source.changeTimezone) === true,
    processing: readBoolean(source.processing) === true,
    blockedReason: asSafeText(source.blockedReason),
  };
}

function adaptCapabilities(value: unknown): AdminSettingsCapabilities {
  const source = isRecord(value) ? value : {};
  return {
    supportsImpactPreview: readBoolean(source.supportsImpactPreview) !== false,
    supportsLogoUpload: readBoolean(source.supportsLogoUpload) !== false,
    supportsBranchScopedSettings: readBoolean(source.supportsBranchScopedSettings) === true,
    supportsGatewayStatus: readBoolean(source.supportsGatewayStatus) !== false,
    publicCacheAffected: readBoolean(source.publicCacheAffected) === true,
  };
}

function adaptSectionMeta(source: Record<string, unknown>): AdminSettingsSectionMeta {
  const unsupported = asList(source.unsupportedFields ?? source.unsupported, [
    "items",
    "unsupportedFields",
    "unsupported",
  ])
    .map((item) => asSafeText(item) ?? readString(item))
    .filter((item): item is string => Boolean(item));
  return {
    version: readString(source.version) ?? readString(source.etag),
    etag: readString(source.etag),
    updatedAt: readString(source.updatedAt),
    updatedAtLabel: asSafeText(source.updatedAtLabel),
    allowedActions: adaptAllowedActions(source.allowedActions),
    capabilities: adaptCapabilities(source.capabilities),
    unsupportedFields: unsupported,
  };
}

function stringField(
  source: Record<string, unknown>,
  ...keys: string[]
): string {
  for (const key of keys) {
    const value = asSafeText(source[key]) ?? readString(source[key]);
    if (value !== undefined && value !== null) return value;
  }
  return "";
}

export function isSettingsFormDirty(baseline: string, current: unknown): boolean {
  return JSON.stringify(current) !== baseline;
}

export function serializeSettingsBaseline(form: unknown): string {
  return JSON.stringify(form);
}

/* ─── General ─────────────────────────────────────────────── */

function flattenBusiness(root: Record<string, unknown>): Record<string, unknown> {
  const business = isRecord(root.business) ? root.business : root;
  const contact = isRecord(business.contact) ? business.contact : {};
  const address = isRecord(business.address) ? business.address : {};
  return {
    ...root,
    ...business,
    businessName: business.businessName ?? business.business_name ?? root.businessName,
    timezone: business.timezone ?? root.timezone,
    currency: business.currency_code ?? business.currency ?? root.currency,
    logoUrl: business.logoUrl ?? business.logo_url ?? root.logoUrl,
    contactPhone:
      contact.primary_phone ?? contact.primaryPhone ?? business.contactPhone ?? root.contactPhone,
    contactEmail: contact.email ?? business.contactEmail ?? root.contactEmail,
    address:
      address.address_line1 ??
      address.addressLine1 ??
      business.address ??
      root.address,
  };
}

export function adaptAdminGeneralSettings(payload: unknown): AdminGeneralSettingsView {
  const root = unwrapPayload(payload);
  const source = flattenBusiness(isRecord(root) ? root : {});
  const meta = adaptSectionMeta(source);
  return {
    section: "general",
    ...meta,
    businessName: stringField(source, "businessName", "name"),
    shortDescription: stringField(source, "shortDescription", "description", "tagline"),
    contactPhone: stringField(source, "contactPhone", "phone"),
    contactEmail: stringField(source, "contactEmail", "email"),
    address: stringField(source, "address"),
    publicContactDetails: stringField(source, "publicContactDetails", "publicContact"),
    publicPageTitle: stringField(source, "publicPageTitle", "pageTitle"),
    logoUrl: readString(source.logoUrl ?? source.logo) ?? undefined,
    logoUploadSupported:
      meta.capabilities.supportsLogoUpload && meta.allowedActions.uploadLogo !== false,
  };
}

export function formFromGeneralSettings(
  view?: AdminGeneralSettingsView | null,
): AdminGeneralSettingsFormInput {
  return {
    businessName: view?.businessName ?? "",
    shortDescription: view?.shortDescription ?? "",
    contactPhone: view?.contactPhone ?? "",
    contactEmail: view?.contactEmail ?? "",
    address: view?.address ?? "",
    publicContactDetails: view?.publicContactDetails ?? "",
    publicPageTitle: view?.publicPageTitle ?? "",
  };
}

export function validateGeneralSettingsForm(
  form: AdminGeneralSettingsFormInput,
): AdminGeneralSettingsFormErrors {
  const errors: AdminGeneralSettingsFormErrors = {};
  if (!form.businessName.trim()) {
    errors.businessName = "نام کسب‌وکار الزامی است.";
  }
  if (form.contactEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail.trim())) {
    errors.contactEmail = "ایمیل معتبر نیست.";
  }
  return errors;
}

export function buildGeneralSettingsPayload(
  form: AdminGeneralSettingsFormInput,
  version?: string,
): Record<string, unknown> {
  return {
    businessName: form.businessName.trim(),
    shortDescription: form.shortDescription.trim() || undefined,
    contactPhone: form.contactPhone.trim() || undefined,
    contactEmail: form.contactEmail.trim() || undefined,
    address: form.address.trim() || undefined,
    publicContactDetails: form.publicContactDetails.trim() || undefined,
    publicPageTitle: form.publicPageTitle.trim() || undefined,
    version: version || undefined,
  };
}

export function isValidLogoFile(file: File, maxBytes = 2 * 1024 * 1024): string | undefined {
  if (!file.type.startsWith("image/")) {
    return "فقط تصویر مجاز است.";
  }
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(file.type)) {
    return "فرمت مجاز: JPEG، PNG یا WebP.";
  }
  if (file.size > maxBytes) {
    return "حجم تصویر بیش از حد مجاز است.";
  }
  return undefined;
}

/* ─── Localization ─────────────────────────────────────────── */

const IANA_TZ_PATTERN = /^[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+)+$/;

export function isValidIanaTimezone(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 64) return false;
  if (trimmed === "UTC") return true;
  return IANA_TZ_PATTERN.test(trimmed);
}

export function adaptAdminLocalizationSettings(
  payload: unknown,
): AdminLocalizationSettingsView {
  const root = unwrapPayload(payload);
  const source = flattenBusiness(isRecord(root) ? root : {});
  const meta = adaptSectionMeta(source);
  return {
    section: "localization",
    ...meta,
    defaultLanguage: stringField(source, "defaultLanguage", "language"),
    currency: stringField(source, "currency"),
    timezone: stringField(source, "timezone", "timeZone"),
    locale: stringField(source, "locale"),
    calendarType: stringField(source, "calendarType", "calendar"),
    numberFormat: stringField(source, "numberFormat", "numberFormatting"),
    languageOptions: adaptSelectOptions(source.languageOptions ?? source.languages),
    currencyOptions: adaptSelectOptions(source.currencyOptions ?? source.currencies),
    timezoneOptions: adaptSelectOptions(source.timezoneOptions ?? source.timezones),
    localeOptions: adaptSelectOptions(source.localeOptions ?? source.locales),
    calendarTypeOptions: adaptSelectOptions(
      source.calendarTypeOptions ?? source.calendars,
    ),
    numberFormatOptions: adaptSelectOptions(
      source.numberFormatOptions ?? source.numberFormats,
    ),
    sampleBusinessTimeLabel: asSafeText(source.sampleBusinessTimeLabel),
    timezoneOffsetLabel: asSafeText(source.timezoneOffsetLabel ?? source.offsetLabel),
  };
}

export function formFromLocalizationSettings(
  view?: AdminLocalizationSettingsView | null,
): AdminLocalizationSettingsFormInput {
  return {
    defaultLanguage: view?.defaultLanguage ?? "",
    currency: view?.currency ?? "",
    timezone: view?.timezone ?? "",
    locale: view?.locale ?? "",
    calendarType: view?.calendarType ?? "",
    numberFormat: view?.numberFormat ?? "",
  };
}

export function validateLocalizationSettingsForm(
  form: AdminLocalizationSettingsFormInput,
  view?: AdminLocalizationSettingsView | null,
): AdminLocalizationSettingsFormErrors {
  const errors: AdminLocalizationSettingsFormErrors = {};
  if (!form.timezone.trim()) {
    errors.timezone = "منطقه زمانی الزامی است.";
  } else if (
    view?.timezoneOptions.length === 0 &&
    !isValidIanaTimezone(form.timezone)
  ) {
    errors.timezone = "شناسه منطقه زمانی IANA معتبر نیست.";
  }
  if (!form.currency.trim()) {
    errors.currency = "واحد پول الزامی است.";
  }
  return errors;
}

export function buildLocalizationSettingsPayload(
  form: AdminLocalizationSettingsFormInput,
  version?: string,
): Record<string, unknown> {
  return {
    defaultLanguage: form.defaultLanguage.trim() || undefined,
    currency: form.currency.trim(),
    timezone: form.timezone.trim(),
    locale: form.locale.trim() || undefined,
    calendarType: form.calendarType.trim() || undefined,
    numberFormat: form.numberFormat.trim() || undefined,
    version: version || undefined,
  };
}

export function localizationChangeIsHighImpact(
  baseline: AdminLocalizationSettingsFormInput,
  form: AdminLocalizationSettingsFormInput,
): { currencyChanged: boolean; timezoneChanged: boolean; highImpact: boolean } {
  const currencyChanged = baseline.currency !== form.currency;
  const timezoneChanged = baseline.timezone !== form.timezone;
  return {
    currencyChanged,
    timezoneChanged,
    highImpact: currencyChanged || timezoneChanged,
  };
}

/* ─── Booking ──────────────────────────────────────────────── */

export function adaptAdminBookingSettings(payload: unknown): AdminBookingSettingsView {
  const root = unwrapPayload(payload);
  const nested = isRecord(root) && isRecord(root.booking) ? { ...root, ...root.booking } : root;
  const source = isRecord(nested) ? nested : {};
  const meta = adaptSectionMeta(source);
  const unitsSource = isRecord(source.fieldUnits) ? source.fieldUnits : {};
  return {
    section: "booking",
    ...meta,
    minAdvanceBookingMinutes: readNumber(
      source.minAdvanceBookingMinutes ??
        source.min_advance_booking_minutes ??
        source.minAdvanceMinutes,
    ),
    maxAdvanceBookingDays: readNumber(
      source.maxAdvanceBookingDays ??
        source.max_advance_booking_days ??
        source.maxAdvanceDays,
    ),
    slotIntervalMinutes: readNumber(
      source.slotIntervalMinutes ?? source.slot_interval_minutes ?? source.slotInterval,
    ),
    slotHoldDurationMinutes: readNumber(
      source.slotHoldDurationMinutes ?? source.holdDurationMinutes,
    ),
    confirmationMode: readString(source.confirmationMode) ?? undefined,
    providerSelectionEnabled: readBoolean(source.providerSelectionEnabled),
    anyProviderEnabled: readBoolean(source.anyProviderEnabled),
    payAtLocationEnabled: readBoolean(source.payAtLocationEnabled),
    cancellationPolicyText: asSafeText(
      source.cancellationPolicyText ?? source.cancellationPolicy,
    ),
    reschedulePolicyText: asSafeText(
      source.reschedulePolicyText ?? source.reschedulePolicy,
    ),
    confirmationModeOptions: adaptSelectOptions(source.confirmationModeOptions),
    fieldUnits: {
      minAdvanceBookingMinutes:
        asSafeText(unitsSource.minAdvanceBookingMinutes) ?? "دقیقه",
      maxAdvanceBookingDays: asSafeText(unitsSource.maxAdvanceBookingDays) ?? "روز",
      slotIntervalMinutes: asSafeText(unitsSource.slotIntervalMinutes) ?? "دقیقه",
      slotHoldDurationMinutes:
        asSafeText(unitsSource.slotHoldDurationMinutes) ?? "دقیقه",
    },
  };
}

export function formFromBookingSettings(
  view?: AdminBookingSettingsView | null,
): AdminBookingSettingsFormInput {
  return {
    minAdvanceBookingMinutes:
      view?.minAdvanceBookingMinutes !== undefined
        ? String(view.minAdvanceBookingMinutes)
        : "",
    maxAdvanceBookingDays:
      view?.maxAdvanceBookingDays !== undefined ? String(view.maxAdvanceBookingDays) : "",
    slotIntervalMinutes:
      view?.slotIntervalMinutes !== undefined ? String(view.slotIntervalMinutes) : "",
    slotHoldDurationMinutes:
      view?.slotHoldDurationMinutes !== undefined
        ? String(view.slotHoldDurationMinutes)
        : "",
    confirmationMode: view?.confirmationMode ?? "",
    providerSelectionEnabled: view?.providerSelectionEnabled === true,
    anyProviderEnabled: view?.anyProviderEnabled === true,
    payAtLocationEnabled: view?.payAtLocationEnabled === true,
    cancellationPolicyText: view?.cancellationPolicyText ?? "",
    reschedulePolicyText: view?.reschedulePolicyText ?? "",
  };
}

function parseOptionalNonNegativeInt(value: string, label: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < 0) {
    return `${label} باید عدد صحیح غیرمنفی باشد.`;
  }
  return undefined;
}

export function validateBookingSettingsForm(
  form: AdminBookingSettingsFormInput,
): AdminBookingSettingsFormErrors {
  const errors: AdminBookingSettingsFormErrors = {};
  const minErr = parseOptionalNonNegativeInt(
    form.minAdvanceBookingMinutes,
    "حداقل زمان رزرو از قبل",
  );
  if (minErr) errors.minAdvanceBookingMinutes = minErr;
  const maxErr = parseOptionalNonNegativeInt(
    form.maxAdvanceBookingDays,
    "حداکثر بازه رزرو از قبل",
  );
  if (maxErr) errors.maxAdvanceBookingDays = maxErr;
  const slotErr = parseOptionalNonNegativeInt(form.slotIntervalMinutes, "بازه اسلات");
  if (slotErr) errors.slotIntervalMinutes = slotErr;
  const holdErr = parseOptionalNonNegativeInt(
    form.slotHoldDurationMinutes,
    "مدت نگهداری اسلات",
  );
  if (holdErr) errors.slotHoldDurationMinutes = holdErr;
  return errors;
}

export function buildBookingSettingsPayload(
  form: AdminBookingSettingsFormInput,
  version?: string,
): Record<string, unknown> {
  const optionalInt = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return undefined;
    return Number(trimmed);
  };
  return {
    minAdvanceBookingMinutes: optionalInt(form.minAdvanceBookingMinutes),
    maxAdvanceBookingDays: optionalInt(form.maxAdvanceBookingDays),
    slotIntervalMinutes: optionalInt(form.slotIntervalMinutes),
    slotHoldDurationMinutes: optionalInt(form.slotHoldDurationMinutes),
    confirmationMode: form.confirmationMode.trim() || undefined,
    providerSelectionEnabled: form.providerSelectionEnabled,
    anyProviderEnabled: form.anyProviderEnabled,
    payAtLocationEnabled: form.payAtLocationEnabled,
    cancellationPolicyText: form.cancellationPolicyText.trim() || undefined,
    reschedulePolicyText: form.reschedulePolicyText.trim() || undefined,
    version: version || undefined,
  };
}

/* ─── Payments ─────────────────────────────────────────────── */

function adaptGatewayStatus(value: unknown): AdminPaymentGatewayStatus {
  const raw = readString(value)?.toLowerCase().replace(/[\s-]+/g, "_");
  if (raw === "connected") return "connected";
  if (raw === "not_connected" || raw === "disconnected") return "not_connected";
  if (raw === "disabled") return "disabled";
  if (raw === "requires_action" || raw === "action_required") return "requires_action";
  return "unknown";
}

const GATEWAY_STATUS_LABELS: Record<AdminPaymentGatewayStatus, string> = {
  connected: "متصل",
  not_connected: "متصل نیست",
  disabled: "غیرفعال",
  requires_action: "نیاز به اقدام",
  unknown: "نامشخص",
};

export function adaptAdminPaymentSettings(payload: unknown): AdminPaymentSettingsView {
  const root = unwrapPayload(payload);
  const nested = isRecord(root) && isRecord(root.payment) ? { ...root, ...root.payment } : root;
  const source = isRecord(nested) ? nested : {};
  const meta = adaptSectionMeta(source);
  const gatewayStatus = adaptGatewayStatus(source.gatewayStatus ?? source.connectionStatus);
  const methodIds = asList(source.enabledMethodIds ?? source.enabledMethods, [
    "items",
    "enabledMethodIds",
    "enabledMethods",
  ])
    .map((item) => {
      if (typeof item === "string") return item;
      if (isRecord(item)) return readString(item.id) ?? readString(item.value);
      return undefined;
    })
    .filter((item): item is string => Boolean(item));
  return {
    section: "payments",
    ...meta,
    fullPaymentEnabled: readBoolean(source.fullPaymentEnabled),
    depositEnabled: readBoolean(source.depositEnabled),
    payAtLocationEnabled: readBoolean(source.payAtLocationEnabled),
    enabledMethodIds: methodIds,
    methodOptions: adaptSelectOptions(source.methodOptions ?? source.paymentMethods),
    paymentTimeoutMinutes: readNumber(source.paymentTimeoutMinutes ?? source.timeoutMinutes),
    customerFacingPaymentText: asSafeText(
      source.customerFacingPaymentText ?? source.paymentHelpText,
    ),
    gatewayStatus,
    gatewayStatusLabel:
      asSafeText(source.gatewayStatusLabel) ?? GATEWAY_STATUS_LABELS[gatewayStatus],
  };
}

export function formFromPaymentSettings(
  view?: AdminPaymentSettingsView | null,
): AdminPaymentSettingsFormInput {
  return {
    fullPaymentEnabled: view?.fullPaymentEnabled === true,
    depositEnabled: view?.depositEnabled === true,
    payAtLocationEnabled: view?.payAtLocationEnabled === true,
    enabledMethodIds: view?.enabledMethodIds ?? [],
    paymentTimeoutMinutes:
      view?.paymentTimeoutMinutes !== undefined ? String(view.paymentTimeoutMinutes) : "",
    customerFacingPaymentText: view?.customerFacingPaymentText ?? "",
  };
}

export function validatePaymentSettingsForm(
  form: AdminPaymentSettingsFormInput,
): AdminPaymentSettingsFormErrors {
  const errors: AdminPaymentSettingsFormErrors = {};
  const timeoutErr = parseOptionalNonNegativeInt(
    form.paymentTimeoutMinutes,
    "مهلت پرداخت",
  );
  if (timeoutErr) errors.paymentTimeoutMinutes = timeoutErr;
  return errors;
}

export function buildPaymentSettingsPayload(
  form: AdminPaymentSettingsFormInput,
  version?: string,
): Record<string, unknown> {
  const timeout = form.paymentTimeoutMinutes.trim();
  return {
    fullPaymentEnabled: form.fullPaymentEnabled,
    depositEnabled: form.depositEnabled,
    payAtLocationEnabled: form.payAtLocationEnabled,
    enabledMethodIds: form.enabledMethodIds,
    paymentTimeoutMinutes: timeout ? Number(timeout) : undefined,
    customerFacingPaymentText: form.customerFacingPaymentText.trim() || undefined,
    version: version || undefined,
  };
}

/** Never include secrets in payloads or logs — strip if present by mistake. */
export const SENSITIVE_PAYMENT_KEYS = [
  "secret",
  "secretKey",
  "privateKey",
  "apiKey",
  "token",
  "password",
  "credentials",
  "merchantKey",
] as const;

export function stripSensitivePaymentFields(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...payload };
  for (const key of Object.keys(next)) {
    const lower = key.toLowerCase();
    if (
      SENSITIVE_PAYMENT_KEYS.some((sensitive) => lower.includes(sensitive.toLowerCase()))
    ) {
      delete next[key];
    }
  }
  return next;
}

/* ─── Notifications ────────────────────────────────────────── */

export function adaptAdminNotificationSettings(
  payload: unknown,
): AdminNotificationSettingsView {
  const root = unwrapPayload(payload);
  const channels = isRecord(root) && isRecord(root.notifications) ? root.notifications : {};
  const sms = isRecord(channels) && isRecord(channels.sms) ? channels.sms : {};
  const email = isRecord(channels) && isRecord(channels.email) ? channels.email : {};
  const source: Record<string, unknown> = isRecord(root)
    ? {
        ...root,
        smsEnabled: sms.enabled ?? root.smsEnabled,
        emailEnabled: email.enabled ?? root.emailEnabled,
      }
    : {};
  const meta = adaptSectionMeta(source);
  return {
    section: "notifications",
    ...meta,
    smsEnabled: readBoolean(source.smsEnabled),
    emailEnabled: readBoolean(source.emailEnabled),
    bookingConfirmationEnabled: readBoolean(
      source.bookingConfirmationEnabled ?? source.bookingConfirmation,
    ),
    appointmentReminderEnabled: readBoolean(
      source.appointmentReminderEnabled ?? source.reminder,
    ),
    cancellationEnabled: readBoolean(source.cancellationEnabled ?? source.cancellation),
    rescheduleEnabled: readBoolean(source.rescheduleEnabled ?? source.reschedule),
    paymentEnabled: readBoolean(source.paymentEnabled ?? source.payment),
    waitingListOfferEnabled: readBoolean(
      source.waitingListOfferEnabled ?? source.waitingListOffer,
    ),
    templatesManageHref: readString(source.templatesManageHref) ?? undefined,
  };
}

export function formFromNotificationSettings(
  view?: AdminNotificationSettingsView | null,
): AdminNotificationSettingsFormInput {
  return {
    smsEnabled: view?.smsEnabled === true,
    emailEnabled: view?.emailEnabled === true,
    bookingConfirmationEnabled: view?.bookingConfirmationEnabled === true,
    appointmentReminderEnabled: view?.appointmentReminderEnabled === true,
    cancellationEnabled: view?.cancellationEnabled === true,
    rescheduleEnabled: view?.rescheduleEnabled === true,
    paymentEnabled: view?.paymentEnabled === true,
    waitingListOfferEnabled: view?.waitingListOfferEnabled === true,
  };
}

export function validateNotificationSettingsForm(
  form: AdminNotificationSettingsFormInput,
): AdminNotificationSettingsFormErrors {
  void form;
  return {};
}

export function buildNotificationSettingsPayload(
  form: AdminNotificationSettingsFormInput,
  version?: string,
): Record<string, unknown> {
  return {
    smsEnabled: form.smsEnabled,
    emailEnabled: form.emailEnabled,
    bookingConfirmationEnabled: form.bookingConfirmationEnabled,
    appointmentReminderEnabled: form.appointmentReminderEnabled,
    cancellationEnabled: form.cancellationEnabled,
    rescheduleEnabled: form.rescheduleEnabled,
    paymentEnabled: form.paymentEnabled,
    waitingListOfferEnabled: form.waitingListOfferEnabled,
    version: version || undefined,
  };
}

/* ─── Impact preview ───────────────────────────────────────── */

export function adaptAdminSettingsImpactPreview(
  payload: unknown,
): AdminSettingsImpactPreview {
  const root = unwrapPayload(payload);
  const source = isRecord(root) ? root : {};
  const effects = asList(source.effects ?? source.summaryLines ?? source.warnings, [
    "effects",
    "summaryLines",
    "warnings",
    "items",
  ])
    .map((item) => asSafeText(item) ?? readString(item))
    .filter((item): item is string => Boolean(item));
  const blocked = readBoolean(source.blocked) === true;
  return {
    title: asSafeText(source.title) ?? "تأثیر تغییرات",
    summary: asSafeText(source.summary) ?? asSafeText(source.description) ?? "",
    effects,
    blocked,
    blockedReason: asSafeText(source.blockedReason),
    confirmLabel: asSafeText(source.confirmLabel) ?? "اعمال تغییرات",
    previewVersion: readString(source.previewVersion ?? source.version),
    requiresConfirmation:
      readBoolean(source.requiresConfirmation) !== false || effects.length > 0 || blocked,
    highImpact: readBoolean(source.highImpact) === true,
  };
}

export function buildLocalCurrencyTimezoneImpact(input: {
  currencyChanged: boolean;
  timezoneChanged: boolean;
}): AdminSettingsImpactPreview {
  const effects: string[] = [];
  if (input.currencyChanged) {
    effects.push(
      "تغییر واحد پول، قیمت‌های تاریخی را تبدیل نمی‌کند و نرخ ارز اعمال نمی‌شود.",
    );
  }
  if (input.timezoneChanged) {
    effects.push(
      "تغییر منطقه زمانی، برچسب‌های زمانی تاریخی را بازنویسی نمی‌کند؛ نمایش و ورودی‌ها به‌روز می‌شوند.",
    );
  }
  return {
    title: "تأثیر تغییر واحد پول / منطقه زمانی",
    summary: "این تغییر پرریسک است و پس از تأیید ذخیره می‌شود.",
    effects,
    blocked: false,
    confirmLabel: "تأیید و ذخیره",
    requiresConfirmation: true,
    highImpact: true,
  };
}

export function isAdminSettingsConflict(error: {
  status?: number;
  code?: string;
}): boolean {
  if (error.status === 409) return true;
  const code = error.code?.toUpperCase() ?? "";
  return code.includes("CONFLICT") || code.includes("VERSION") || code.includes("ETAG");
}

export function adminSettingsConflictMessage(): string {
  return "تنظیمات در جای دیگری تغییر کرده است. نسخه جدید بارگذاری شد؛ لطفاً مرور و دوباره ذخیره کنید.";
}
