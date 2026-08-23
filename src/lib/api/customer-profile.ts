import { apiClient } from "@/lib/api/client";
import { ApiError, isNotFoundError, toAppApiError } from "@/lib/api/errors";
import {
  adaptCustomerProfile,
  adaptNotificationPreferences,
  adaptProfileChallenge,
} from "@/lib/customer/profile-adapter";
import { normalizeIranMobile } from "@/lib/auth/phone";
import { queryKeys } from "@/lib/query/keys";
import type {
  CustomerProfileUpdateInput,
  CustomerProfileView,
  NotificationPreferencesView,
  ProfileChallengeView,
} from "@/types/customer-profile";
import type { SessionUser } from "@/types/session";
import { adaptSessionUser } from "@/lib/api/session-adapter";

function missingProfileError(): ApiError {
  return new ApiError({
    status: 404,
    code: "PROFILE_NOT_FOUND",
    message: "پروفایل مشتری در دسترس نیست.",
  });
}

export async function fetchCustomerProfile(
  signal?: AbortSignal,
): Promise<CustomerProfileView> {
  try {
    const payload = await apiClient<unknown>("/customer/profile", {
      method: "GET",
      signal,
    });
    const view = adaptCustomerProfile(payload);
    if (!view) {
      throw missingProfileError();
    }
    return view;
  } catch (error) {
    if (isNotFoundError(toAppApiError(error))) {
      throw missingProfileError();
    }
    throw error;
  }
}

export async function updateCustomerProfile(
  input: CustomerProfileUpdateInput,
  signal?: AbortSignal,
): Promise<CustomerProfileView> {
  const body: Record<string, unknown> = {};
  if (input.firstName !== undefined) body.firstName = input.firstName;
  if (input.lastName !== undefined) body.lastName = input.lastName;
  if (input.email !== undefined) body.email = input.email;

  const payload = await apiClient<unknown>("/customer/profile", {
    method: "PATCH",
    signal,
    body,
  });
  const view = adaptCustomerProfile(payload);
  if (!view) {
    throw new ApiError({
      status: 422,
      code: "PROFILE_INVALID_RESPONSE",
      message: "پاسخ به‌روزرسانی پروفایل معتبر نیست.",
    });
  }
  return view;
}

export async function requestPhoneChange(
  phone: string,
  signal?: AbortSignal,
): Promise<ProfileChallengeView> {
  const normalized = normalizeIranMobile(phone);
  const payload = await apiClient<unknown>("/customer/profile/phone/change", {
    method: "POST",
    signal,
    body: { phone: normalized },
  });
  return adaptProfileChallenge(payload, "change_phone", normalized);
}

export async function verifyPhoneChange(
  challengeId: string,
  code: string,
  signal?: AbortSignal,
): Promise<{ profile: CustomerProfileView; user?: SessionUser | null }> {
  const payload = await apiClient<unknown>("/customer/profile/phone/verify", {
    method: "POST",
    signal,
    body: { challengeId, code },
  });
  const profile = adaptCustomerProfile(payload);
  if (!profile) {
    throw new ApiError({
      status: 422,
      code: "PHONE_VERIFY_INVALID",
      message: "پاسخ تأیید شماره موبایل معتبر نیست.",
    });
  }
  return {
    profile,
    user: adaptSessionUser(payload),
  };
}

export async function resendPhoneChangeOtp(
  challengeId: string,
  signal?: AbortSignal,
): Promise<ProfileChallengeView> {
  const payload = await apiClient<unknown>("/customer/profile/phone/resend", {
    method: "POST",
    signal,
    body: { challengeId },
  });
  return adaptProfileChallenge(payload, "change_phone");
}

export async function requestEmailChange(
  input: { email: string; currentPassword?: string },
  signal?: AbortSignal,
): Promise<{ profile: CustomerProfileView; challenge?: ProfileChallengeView }> {
  const payload = await apiClient<unknown>("/customer/profile/email/change", {
    method: "POST",
    signal,
    body: {
      email: input.email.trim(),
      currentPassword: input.currentPassword,
    },
  });
  const profile = adaptCustomerProfile(payload);
  if (!profile) {
    throw new ApiError({
      status: 422,
      code: "EMAIL_CHANGE_INVALID",
      message: "پاسخ تغییر ایمیل معتبر نیست.",
    });
  }
  let challenge: ProfileChallengeView | undefined;
  try {
    challenge = adaptProfileChallenge(payload, "change_email", input.email);
  } catch {
    challenge = undefined;
  }
  return { profile, challenge };
}

export async function verifyEmailChange(
  challengeId: string,
  code: string,
  signal?: AbortSignal,
): Promise<CustomerProfileView> {
  const payload = await apiClient<unknown>("/customer/profile/email/verify", {
    method: "POST",
    signal,
    body: { challengeId, code },
  });
  const profile = adaptCustomerProfile(payload);
  if (!profile) {
    throw new ApiError({
      status: 422,
      code: "EMAIL_VERIFY_INVALID",
      message: "پاسخ تأیید ایمیل معتبر نیست.",
    });
  }
  return profile;
}

export async function resendEmailChangeOtp(
  challengeId: string,
  signal?: AbortSignal,
): Promise<ProfileChallengeView> {
  const payload = await apiClient<unknown>("/customer/profile/email/resend", {
    method: "POST",
    signal,
    body: { challengeId },
  });
  return adaptProfileChallenge(payload, "change_email");
}

export async function fetchNotificationPreferences(
  signal?: AbortSignal,
): Promise<NotificationPreferencesView> {
  try {
    const payload = await apiClient<unknown>("/customer/profile/notifications", {
      method: "GET",
      signal,
    });
    return adaptNotificationPreferences(payload);
  } catch (error) {
    if (isNotFoundError(toAppApiError(error))) {
      return { items: [] };
    }
    throw error;
  }
}

export async function updateNotificationPreference(
  input: { id: string; enabled: boolean },
  signal?: AbortSignal,
): Promise<NotificationPreferencesView> {
  const payload = await apiClient<unknown>("/customer/profile/notifications", {
    method: "PATCH",
    signal,
    body: {
      id: input.id,
      enabled: input.enabled,
    },
  });
  return adaptNotificationPreferences(payload);
}

export function customerProfileQueryOptions(userId: string) {
  return {
    queryKey: queryKeys.customer.profile(userId),
    queryFn: ({ signal }: { signal: AbortSignal }) => fetchCustomerProfile(signal),
    enabled: Boolean(userId),
    staleTime: 30_000,
    retry: false,
  };
}

export function notificationPreferencesQueryOptions(userId: string) {
  return {
    queryKey: queryKeys.customer.notificationPreferences(userId),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      fetchNotificationPreferences(signal),
    enabled: Boolean(userId),
    staleTime: 30_000,
    retry: false,
  };
}

export function isProfileDisconnected(error: unknown): boolean {
  const normalized = toAppApiError(error);
  return isNotFoundError(normalized) || normalized.code === "PROFILE_NOT_FOUND";
}
