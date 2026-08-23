import { isSafePublicId } from "@/lib/public/booking-href";
import { isEligibleProviderId } from "@/lib/public/provider-adapters";
import type {
  EligibleProvidersView,
  ProviderPreference,
  ProviderSelectionMode,
  ProviderSelectionNotice,
} from "@/types/provider";

export const PROVIDER_RADIO_ANY = "pref:any";

export function preferencesEqual(
  left: ProviderPreference | undefined,
  right: ProviderPreference | undefined,
): boolean {
  if (!left && !right) {
    return true;
  }
  if (!left || !right || left.type !== right.type) {
    return false;
  }
  if (left.type === "specific" && right.type === "specific") {
    return left.providerId === right.providerId;
  }
  return true;
}

export function preferenceToRadioValue(preference: ProviderPreference | undefined): string | undefined {
  if (!preference) {
    return undefined;
  }
  if (preference.type === "any") {
    return PROVIDER_RADIO_ANY;
  }
  if (preference.type === "specific") {
    return preference.providerId;
  }
  return undefined;
}

export function radioValueToPreference(value: string): ProviderPreference | undefined {
  if (value === PROVIDER_RADIO_ANY) {
    return { type: "any" };
  }
  if (isSafePublicId(value)) {
    return { type: "specific", providerId: value };
  }
  return undefined;
}

export function preferenceForMode(mode: ProviderSelectionMode): ProviderPreference | undefined {
  if (mode === "not_applicable") {
    return { type: "not_applicable" };
  }
  if (mode === "automatic") {
    return { type: "automatic" };
  }
  return undefined;
}

export function reconcileProviderPreference(
  preference: ProviderPreference | undefined,
  eligible: EligibleProvidersView,
  reason: "service" | "branch" | "refresh" = "refresh",
): { preference: ProviderPreference | undefined; notice?: ProviderSelectionNotice } {
  if (eligible.mode === "not_applicable") {
    return { preference: { type: "not_applicable" } };
  }
  if (eligible.mode === "automatic") {
    return { preference: { type: "automatic" } };
  }

  if (!preference || preference.type === "not_applicable" || preference.type === "automatic") {
    return { preference: undefined };
  }

  if (preference.type === "any") {
    const allowed = eligible.mode === "optional" || eligible.anyAvailableAllowed;
    if (allowed) {
      return { preference };
    }
    return { preference: undefined, notice: "removed" };
  }

  if (isEligibleProviderId(preference.providerId, eligible.providers)) {
    return { preference };
  }

  const notice: ProviderSelectionNotice =
    reason === "branch"
      ? "unavailable_branch"
      : reason === "service"
        ? "unavailable_service"
        : "removed";
  return { preference: undefined, notice };
}

export function validateProviderPreference(
  mode: ProviderSelectionMode,
  preference: ProviderPreference | undefined,
  eligible: EligibleProvidersView,
): string | undefined {
  if (mode === "not_applicable" || mode === "automatic") {
    return undefined;
  }

  if (mode === "required" && eligible.providers.length === 0 && !eligible.anyAvailableAllowed) {
    return "در حال حاضر متخصص واجد شرایطی برای این خدمت وجود ندارد.";
  }

  if (!preference) {
    return mode === "required"
      ? "لطفاً یک متخصص را انتخاب کنید."
      : "لطفاً یک متخصص را انتخاب کنید یا گزینه «فرقی ندارد» را بزنید.";
  }

  if (preference.type === "any") {
    if (mode === "optional" || eligible.anyAvailableAllowed) {
      return undefined;
    }
    return "لطفاً یک متخصص را انتخاب کنید.";
  }

  if (preference.type !== "specific" || !isEligibleProviderId(preference.providerId, eligible.providers)) {
    return "انتخاب متخصص دیگر معتبر نیست. لطفاً دوباره انتخاب کنید.";
  }

  return undefined;
}

export function bookingProviderId(
  preference: ProviderPreference | undefined,
): string | undefined {
  return preference?.type === "specific" ? preference.providerId : undefined;
}
