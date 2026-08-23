import { isSafePublicId } from "@/lib/public/booking-href";
import type { AvailabilityContext, AvailabilityQueryInput } from "@/types/availability";
import type { ProviderPreference } from "@/types/provider";

export function availabilityContextFrom(
  serviceId: string,
  branchId: string | undefined,
  preference: ProviderPreference,
): AvailabilityContext {
  return branchId
    ? { serviceId, branchId, providerPreference: preference }
    : { serviceId, providerPreference: preference };
}

export function preferenceKey(preference: ProviderPreference): string {
  if (preference.type === "specific") {
    return `specific:${preference.providerId}`;
  }
  return preference.type;
}

export function canQueryAvailability(input: AvailabilityQueryInput): boolean {
  if (!isSafePublicId(input.serviceId)) {
    return false;
  }
  if (input.requiresBranch && !isSafePublicId(input.branchId)) {
    return false;
  }
  if (input.providerMode === "required" || input.providerMode === "optional") {
    return input.preference.type === "specific" || input.preference.type === "any";
  }
  return input.preference.type === "automatic" || input.preference.type === "not_applicable";
}
