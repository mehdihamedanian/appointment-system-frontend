import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import {
  adaptAdminBookingSettings,
  adaptAdminGeneralSettings,
  adaptAdminLocalizationSettings,
  adaptAdminPaymentSettings,
  buildBookingSettingsPayload,
  buildGeneralSettingsPayload,
  buildLocalCurrencyTimezoneImpact,
  formFromBookingSettings,
  formFromGeneralSettings,
  isSettingsFormDirty,
  isValidIanaTimezone,
  isValidLogoFile,
  localizationChangeIsHighImpact,
  serializeSettingsBaseline,
  stripSensitivePaymentFields,
  validateBookingSettingsForm,
  validateGeneralSettingsForm,
  validateLocalizationSettingsForm,
} from "@/lib/admin/settings-adapter";
import { invalidateAfterAdminSettingsMutation } from "@/lib/admin/settings-cache";
import {
  canAccessSettingsSection,
  canEditSettingsSection,
  PHASE41_EXPECTED_PERMISSION_KEYS,
  settingsPermission,
} from "@/lib/admin/settings-filters";
import { queryKeys } from "@/lib/query/keys";

describe("settings adapter", () => {
  it("adapts general settings and builds payload", () => {
    const view = adaptAdminGeneralSettings({
      businessName: "کلینیک نمونه",
      contactEmail: "info@example.com",
      logoUrl: "https://cdn.example/logo.png",
      allowedActions: { view: true, edit: true, uploadLogo: true },
      capabilities: { supportsLogoUpload: true },
      version: "v1",
    });
    expect(view.businessName).toBe("کلینیک نمونه");
    expect(view.logoUploadSupported).toBe(true);
    const form = formFromGeneralSettings(view);
    expect(validateGeneralSettingsForm(form)).toEqual({});
    expect(buildGeneralSettingsPayload(form, "v1").version).toBe("v1");
  });

  it("validates general email and required name", () => {
    expect(validateGeneralSettingsForm(formFromGeneralSettings(null)).businessName).toBeTruthy();
    expect(
      validateGeneralSettingsForm({
        ...formFromGeneralSettings(null),
        businessName: "A",
        contactEmail: "bad",
      }).contactEmail,
    ).toBeTruthy();
  });

  it("detects dirty state against baseline", () => {
    const form = formFromGeneralSettings(null);
    const baseline = serializeSettingsBaseline(form);
    expect(isSettingsFormDirty(baseline, form)).toBe(false);
    expect(isSettingsFormDirty(baseline, { ...form, businessName: "X" })).toBe(true);
  });

  it("validates IANA timezone and localization high-impact", () => {
    expect(isValidIanaTimezone("Asia/Tehran")).toBe(true);
    expect(isValidIanaTimezone("not-a-tz")).toBe(false);
    const view = adaptAdminLocalizationSettings({
      currency: "IRR",
      timezone: "Asia/Tehran",
      timezoneOptions: [],
      allowedActions: { edit: true, changeCurrency: true, changeTimezone: true },
    });
    const form = {
      defaultLanguage: "",
      currency: "USD",
      timezone: "Asia/Tehran",
      locale: "",
      calendarType: "",
      numberFormat: "",
    };
    expect(validateLocalizationSettingsForm(form, view)).toEqual({});
    const impact = localizationChangeIsHighImpact(
      { ...form, currency: "IRR" },
      form,
    );
    expect(impact.currencyChanged).toBe(true);
    expect(impact.highImpact).toBe(true);
    const local = buildLocalCurrencyTimezoneImpact(impact);
    expect(local.effects.some((line) => line.includes("قیمت"))).toBe(true);
  });

  it("adapts booking settings with units and validates numbers", () => {
    const view = adaptAdminBookingSettings({
      minAdvanceBookingMinutes: 60,
      slotIntervalMinutes: 15,
      fieldUnits: { slotIntervalMinutes: "دقیقه" },
      allowedActions: { edit: true },
      capabilities: { supportsImpactPreview: true },
    });
    expect(view.fieldUnits.slotIntervalMinutes).toBe("دقیقه");
    const form = formFromBookingSettings(view);
    expect(form.slotIntervalMinutes).toBe("15");
    expect(validateBookingSettingsForm({ ...form, slotIntervalMinutes: "-1" }).slotIntervalMinutes).toBeTruthy();
    expect(buildBookingSettingsPayload(form).slotIntervalMinutes).toBe(15);
  });

  it("strips sensitive payment fields and adapts gateway status", () => {
    const view = adaptAdminPaymentSettings({
      gatewayStatus: "connected",
      fullPaymentEnabled: true,
      secretKey: "should-not-survive-adapter-view-as-field",
      allowedActions: { edit: true },
    });
    expect(view.gatewayStatus).toBe("connected");
    expect(view.gatewayStatusLabel).toBeTruthy();
    const stripped = stripSensitivePaymentFields({
      fullPaymentEnabled: true,
      secretKey: "x",
      apiToken: "y",
      paymentTimeoutMinutes: 10,
    });
    expect(stripped.secretKey).toBeUndefined();
    expect(stripped.apiToken).toBeUndefined();
    expect(stripped.paymentTimeoutMinutes).toBe(10);
  });

  it("validates logo file type and size", () => {
    const ok = new File([new Uint8Array(10)], "a.png", { type: "image/png" });
    expect(isValidLogoFile(ok)).toBeUndefined();
    const badType = new File([new Uint8Array(10)], "a.gif", { type: "image/gif" });
    expect(isValidLogoFile(badType)).toBeTruthy();
    const big = new File([new Uint8Array(3 * 1024 * 1024)], "a.png", {
      type: "image/png",
    });
    expect(isValidLogoFile(big)).toBeTruthy();
  });
});

describe("settings permissions", () => {
  it("exposes Phase 41 expected keys", () => {
    expect(PHASE41_EXPECTED_PERMISSION_KEYS).toContain("admin.settings.booking.edit");
    expect(settingsPermission("paymentsEdit")).toBe("admin.settings.payments.edit");
  });

  it("gates sections independently with hub fallback", () => {
    expect(canAccessSettingsSection([], "booking")).toBe(true);
    expect(canAccessSettingsSection(["admin.settings.view"], "booking")).toBe(true);
    expect(
      canAccessSettingsSection(
        ["admin.settings.booking.view", "admin.settings.payments.edit"],
        "payments",
      ),
    ).toBe(true);
    expect(
      canAccessSettingsSection(
        ["admin.settings.booking.view", "admin.settings.payments.edit"],
        "general",
      ),
    ).toBe(false);
    expect(canEditSettingsSection(["admin.settings.booking.edit"], "booking")).toBe(true);
    expect(canEditSettingsSection(["admin.settings.booking.view"], "booking")).toBe(false);
  });
});

describe("settings cache invalidation", () => {
  it("invalidates targeted keys for booking without clearing all", async () => {
    const client = new QueryClient();
    client.setQueryData(queryKeys.admin.settingsSection("u1", "booking"), { ok: true });
    client.setQueryData(queryKeys.publicBusiness, { name: "x" });
    client.setQueryData(["unrelated"], { keep: true });
    invalidateAfterAdminSettingsMutation(client, "u1", "booking");
    await Promise.resolve();
    expect(client.getQueryState(queryKeys.admin.settingsSection("u1", "booking"))?.isInvalidated).toBe(
      true,
    );
    expect(client.getQueryState(queryKeys.publicBusiness)?.isInvalidated).toBe(true);
    expect(client.getQueryData(["unrelated"])).toEqual({ keep: true });
  });
});
