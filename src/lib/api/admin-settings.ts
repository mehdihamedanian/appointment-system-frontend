import { apiClient } from "@/lib/api/client";
import {
  adaptAdminBookingSettings,
  adaptAdminGeneralSettings,
  adaptAdminLocalizationSettings,
  adaptAdminNotificationSettings,
  adaptAdminPaymentSettings,
  adaptAdminSettingsImpactPreview,
  stripSensitivePaymentFields,
} from "@/lib/admin/settings-adapter";
import { queryKeys } from "@/lib/query/keys";
import type {
  AdminBookingSettingsView,
  AdminGeneralSettingsView,
  AdminLocalizationSettingsView,
  AdminNotificationSettingsView,
  AdminPaymentSettingsView,
  AdminSettingsImpactPreview,
  AdminSettingsSection,
} from "@/types/admin-settings";

function settingsPath(section: AdminSettingsSection): string {
  return `/admin/settings/${section}`;
}

export async function fetchAdminGeneralSettings(
  signal?: AbortSignal,
): Promise<AdminGeneralSettingsView> {
  const payload = await apiClient<unknown>(settingsPath("general"), {
    method: "GET",
    signal,
  });
  return adaptAdminGeneralSettings(payload);
}

export function adminGeneralSettingsQueryOptions(userId: string) {
  return {
    queryKey: queryKeys.admin.settingsSection(userId, "general"),
    queryFn: ({ signal }: { signal?: AbortSignal }) => fetchAdminGeneralSettings(signal),
    staleTime: 15_000,
    refetchOnMount: "always" as const,
    retry: false,
  };
}

export async function updateAdminGeneralSettings(
  body: Record<string, unknown>,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<AdminGeneralSettingsView> {
  const payload = await apiClient<unknown>(settingsPath("general"), {
    method: "PATCH",
    body,
    signal,
    headers: { "Idempotency-Key": idempotencyKey },
  });
  return adaptAdminGeneralSettings(payload);
}

export async function uploadAdminBusinessLogo(
  file: File,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<AdminGeneralSettingsView> {
  const formData = new FormData();
  formData.append("logo", file);
  const payload = await apiClient<unknown>(`${settingsPath("general")}/logo`, {
    method: "POST",
    body: formData,
    signal,
    headers: { "Idempotency-Key": idempotencyKey },
  });
  return adaptAdminGeneralSettings(payload);
}

export async function removeAdminBusinessLogo(
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<AdminGeneralSettingsView> {
  const payload = await apiClient<unknown>(`${settingsPath("general")}/logo`, {
    method: "DELETE",
    signal,
    headers: { "Idempotency-Key": idempotencyKey },
  });
  return adaptAdminGeneralSettings(payload);
}

export async function fetchAdminLocalizationSettings(
  signal?: AbortSignal,
): Promise<AdminLocalizationSettingsView> {
  const payload = await apiClient<unknown>(settingsPath("localization"), {
    method: "GET",
    signal,
  });
  return adaptAdminLocalizationSettings(payload);
}

export function adminLocalizationSettingsQueryOptions(userId: string) {
  return {
    queryKey: queryKeys.admin.settingsSection(userId, "localization"),
    queryFn: ({ signal }: { signal?: AbortSignal }) =>
      fetchAdminLocalizationSettings(signal),
    staleTime: 15_000,
    refetchOnMount: "always" as const,
    retry: false,
  };
}

export async function updateAdminLocalizationSettings(
  body: Record<string, unknown>,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<AdminLocalizationSettingsView> {
  const payload = await apiClient<unknown>(settingsPath("localization"), {
    method: "PATCH",
    body,
    signal,
    headers: { "Idempotency-Key": idempotencyKey },
  });
  return adaptAdminLocalizationSettings(payload);
}

export async function fetchAdminLocalizationImpactPreview(
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<AdminSettingsImpactPreview> {
  const payload = await apiClient<unknown>(
    `${settingsPath("localization")}/impact-preview`,
    { method: "POST", body, signal },
  );
  return adaptAdminSettingsImpactPreview(payload);
}

export async function fetchAdminBookingSettings(
  signal?: AbortSignal,
): Promise<AdminBookingSettingsView> {
  const payload = await apiClient<unknown>(settingsPath("booking"), {
    method: "GET",
    signal,
  });
  return adaptAdminBookingSettings(payload);
}

export function adminBookingSettingsQueryOptions(userId: string) {
  return {
    queryKey: queryKeys.admin.settingsSection(userId, "booking"),
    queryFn: ({ signal }: { signal?: AbortSignal }) => fetchAdminBookingSettings(signal),
    staleTime: 15_000,
    refetchOnMount: "always" as const,
    retry: false,
  };
}

export async function updateAdminBookingSettings(
  body: Record<string, unknown>,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<AdminBookingSettingsView> {
  const payload = await apiClient<unknown>(settingsPath("booking"), {
    method: "PATCH",
    body,
    signal,
    headers: { "Idempotency-Key": idempotencyKey },
  });
  return adaptAdminBookingSettings(payload);
}

export async function fetchAdminBookingImpactPreview(
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<AdminSettingsImpactPreview> {
  const payload = await apiClient<unknown>(`${settingsPath("booking")}/impact-preview`, {
    method: "POST",
    body,
    signal,
  });
  return adaptAdminSettingsImpactPreview(payload);
}

export async function fetchAdminPaymentSettings(
  signal?: AbortSignal,
): Promise<AdminPaymentSettingsView> {
  const payload = await apiClient<unknown>(settingsPath("payments"), {
    method: "GET",
    signal,
  });
  return adaptAdminPaymentSettings(payload);
}

export function adminPaymentSettingsQueryOptions(userId: string) {
  return {
    queryKey: queryKeys.admin.settingsSection(userId, "payments"),
    queryFn: ({ signal }: { signal?: AbortSignal }) => fetchAdminPaymentSettings(signal),
    staleTime: 15_000,
    refetchOnMount: "always" as const,
    retry: false,
  };
}

export async function updateAdminPaymentSettings(
  body: Record<string, unknown>,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<AdminPaymentSettingsView> {
  const safeBody = stripSensitivePaymentFields(body);
  const payload = await apiClient<unknown>(settingsPath("payments"), {
    method: "PATCH",
    body: safeBody,
    signal,
    headers: { "Idempotency-Key": idempotencyKey },
  });
  return adaptAdminPaymentSettings(payload);
}

export async function fetchAdminNotificationChannelSettings(
  signal?: AbortSignal,
): Promise<AdminNotificationSettingsView> {
  const payload = await apiClient<unknown>(settingsPath("notifications"), {
    method: "GET",
    signal,
  });
  return adaptAdminNotificationSettings(payload);
}

export function adminNotificationChannelSettingsQueryOptions(userId: string) {
  return {
    queryKey: queryKeys.admin.settingsSection(userId, "notifications"),
    queryFn: ({ signal }: { signal?: AbortSignal }) =>
      fetchAdminNotificationChannelSettings(signal),
    staleTime: 15_000,
    refetchOnMount: "always" as const,
    retry: false,
  };
}

export async function updateAdminNotificationChannelSettings(
  body: Record<string, unknown>,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<AdminNotificationSettingsView> {
  const payload = await apiClient<unknown>(settingsPath("notifications"), {
    method: "PATCH",
    body,
    signal,
    headers: { "Idempotency-Key": idempotencyKey },
  });
  return adaptAdminNotificationSettings(payload);
}
