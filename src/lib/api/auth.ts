import { apiClient } from "@/lib/api/client";
import { adaptSessionUser } from "@/lib/api/session-adapter";
import { maskPhone } from "@/lib/auth/phone";
import { isRecord, readString } from "@/lib/utilities/records";
import type { AuthChallenge } from "@/lib/auth/challenge-store";
import type { OtpPurpose } from "@/config/auth";
import type { SessionUser } from "@/types/session";

export type AuthSuccess = {
  user: SessionUser | null;
};

export type PasswordResetResult = {
  token?: string;
};

function readIso(value: unknown, fallbackMs: number): string {
  const raw = readString(value);
  if (raw && !Number.isNaN(Date.parse(raw))) {
    return new Date(raw).toISOString();
  }
  return new Date(Date.now() + fallbackMs).toISOString();
}

function rootOf(payload: unknown): Record<string, unknown> {
  if (!isRecord(payload)) {
    return {};
  }
  if (isRecord(payload.data)) {
    return payload.data;
  }
  return payload;
}

export function adaptOtpChallenge(
  payload: unknown,
  purpose: OtpPurpose,
  phone: string,
): AuthChallenge {
  const root = rootOf(payload);
  const challengeId =
    readString(root.challengeId) ??
    readString(root.challenge_id) ??
    ((root.expiresAt ?? root.expires_at ?? root.resendAvailableAt)
      ? readString(root.id)
      : undefined);

  if (!challengeId) {
    throw new Error("MISSING_CHALLENGE");
  }

  return {
    challengeId,
    purpose,
    maskedDestination:
      readString(root.maskedDestination) ??
      readString(root.destination) ??
      maskPhone(phone),
    expiresAt: readIso(root.expiresAt ?? root.expires_at, 120_000),
    resendAvailableAt: readIso(
      root.resendAvailableAt ?? root.resend_available_at,
      60_000,
    ),
  };
}

export function adaptAuthSuccess(payload: unknown): AuthSuccess {
  const root = rootOf(payload);
  const user =
    adaptSessionUser(root.user) ??
    adaptSessionUser(root) ??
    null;
  return { user };
}

export function adaptResetToken(payload: unknown): PasswordResetResult {
  const root = rootOf(payload);
  return {
    token:
      readString(root.resetToken) ??
      readString(root.token) ??
      readString(root.challengeId),
  };
}

export async function loginWithPassword(phone: string, password: string) {
  return adaptAuthSuccess(
    await apiClient("/auth/login", {
      method: "POST",
      body: { phone, password },
    }),
  );
}

export async function adminLogin(phone: string, password: string) {
  return adaptAuthSuccess(
    await apiClient("/auth/admin/login", {
      method: "POST",
      body: { phone, password },
    }),
  );
}

export async function registerCustomer(input: {
  firstName: string;
  lastName: string;
  phone: string;
  password: string;
  consent: boolean;
}) {
  const payload = await apiClient("/auth/register", {
    method: "POST",
    body: {
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      password: input.password,
      consent: input.consent,
    },
  });

  let challenge: AuthChallenge | null = null;
  try {
    challenge = adaptOtpChallenge(payload, "register", input.phone);
  } catch {
    challenge = null;
  }

  return {
    ...adaptAuthSuccess(payload),
    challenge,
  };
}

export async function requestOtp(phone: string, purpose: OtpPurpose) {
  return adaptOtpChallenge(
    await apiClient("/auth/otp/request", {
      method: "POST",
      body: { phone, purpose },
    }),
    purpose,
    phone,
  );
}

export async function verifyOtp(challengeId: string, code: string) {
  const payload = await apiClient("/auth/otp/verify", {
    method: "POST",
    body: { challengeId, code },
  });
  return {
    ...adaptAuthSuccess(payload),
    ...adaptResetToken(payload),
  };
}

export async function resendOtp(challenge: AuthChallenge) {
  return adaptOtpChallenge(
    await apiClient("/auth/otp/resend", {
      method: "POST",
      body: { challengeId: challenge.challengeId },
    }),
    challenge.purpose,
    challenge.maskedDestination,
  );
}

export async function requestPasswordReset(phone: string) {
  const payload = await apiClient("/auth/password/forgot", {
    method: "POST",
    body: { phone },
  });
  try {
    return { challenge: adaptOtpChallenge(payload, "reset_password", phone) };
  } catch {
    return { challenge: null };
  }
}

export async function resetPassword(token: string, password: string) {
  return apiClient("/auth/password/reset", {
    method: "POST",
    body: { token, password },
  });
}

export async function changePassword(currentPassword: string, newPassword: string) {
  return apiClient("/auth/password/change", {
    method: "POST",
    body: { currentPassword, newPassword },
  });
}
