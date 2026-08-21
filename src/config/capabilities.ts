export const capabilityKeys = [
  "multipleBranches",
  "selectableProviders",
  "onlinePayments",
  "waitingList",
  "reviews",
] as const;

export type CapabilityKey = (typeof capabilityKeys)[number];

/**
 * Optional product capabilities of this single business.
 * `unknown` is the Phase 1 default until the Backend contract exists.
 */
export type CapabilityState = "unknown" | "enabled" | "disabled";

export type BusinessCapabilities = Record<CapabilityKey, CapabilityState>;

export const defaultCapabilities: BusinessCapabilities = {
  multipleBranches: "unknown",
  selectableProviders: "unknown",
  onlinePayments: "unknown",
  waitingList: "unknown",
  reviews: "unknown",
};

export function isCapabilityVisible(
  capabilities: BusinessCapabilities,
  key: CapabilityKey | undefined,
): boolean {
  if (!key) {
    return true;
  }

  return capabilities[key] !== "disabled";
}

export function getBusinessCapabilities(): BusinessCapabilities {
  return defaultCapabilities;
}
