import type { OtpPurpose } from "@/config/auth";

export type AuthChallenge = {
  challengeId: string;
  purpose: OtpPurpose;
  maskedDestination: string;
  expiresAt: string;
  resendAvailableAt: string;
};

const MEMORY_KEY = "appointment.auth.challenge";

export function saveAuthChallenge(challenge: AuthChallenge): void {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.setItem(MEMORY_KEY, JSON.stringify(challenge));
}

export function readAuthChallenge(): AuthChallenge | null {
  if (typeof window === "undefined") {
    return null;
  }
  const raw = window.sessionStorage.getItem(MEMORY_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as AuthChallenge;
    if (!parsed.challengeId || !parsed.purpose) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearAuthChallenge(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.removeItem(MEMORY_KEY);
}
