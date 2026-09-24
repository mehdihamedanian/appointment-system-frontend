import type { AdminManualBookingDraft } from "@/types/admin-manual-booking";
import type { ProviderPreference } from "@/types/provider";

const downstreamFromCustomer: Partial<AdminManualBookingDraft> = {
  serviceId: null,
  branchId: null,
  providerPreference: { type: "not_applicable" },
  date: null,
  slotId: null,
  allocationMode: "automatic",
  resourceSelections: {},
  quoteId: undefined,
  paymentMethod: undefined,
};

const downstreamFromService: Partial<AdminManualBookingDraft> = {
  branchId: null,
  providerPreference: { type: "not_applicable" },
  date: null,
  slotId: null,
  allocationMode: "automatic",
  resourceSelections: {},
  quoteId: undefined,
  paymentMethod: undefined,
};

const downstreamFromBranch: Partial<AdminManualBookingDraft> = {
  providerPreference: { type: "not_applicable" },
  date: null,
  slotId: null,
  allocationMode: "automatic",
  resourceSelections: {},
  quoteId: undefined,
  paymentMethod: undefined,
};

const downstreamFromProvider: Partial<AdminManualBookingDraft> = {
  date: null,
  slotId: null,
  allocationMode: "automatic",
  resourceSelections: {},
  quoteId: undefined,
  paymentMethod: undefined,
};

const downstreamFromDatetime: Partial<AdminManualBookingDraft> = {
  allocationMode: "automatic",
  resourceSelections: {},
  quoteId: undefined,
  paymentMethod: undefined,
};

const downstreamFromAllocation: Partial<AdminManualBookingDraft> = {
  quoteId: undefined,
  paymentMethod: undefined,
};

function mergeDraft(
  draft: AdminManualBookingDraft,
  patch: Partial<AdminManualBookingDraft>,
): AdminManualBookingDraft {
  return { ...draft, ...patch };
}

export function applyCustomerChange(
  draft: AdminManualBookingDraft,
  customerId: string | null,
): AdminManualBookingDraft {
  if (draft.customerId === customerId) {
    return draft;
  }
  return mergeDraft(draft, { customerId, ...downstreamFromCustomer });
}

export function applyServiceChange(
  draft: AdminManualBookingDraft,
  serviceId: string | null,
): AdminManualBookingDraft {
  if (draft.serviceId === serviceId) {
    return draft;
  }
  return mergeDraft(draft, { serviceId, ...downstreamFromService });
}

export function applyBranchChange(
  draft: AdminManualBookingDraft,
  branchId: string | null,
): AdminManualBookingDraft {
  if (draft.branchId === branchId) {
    return draft;
  }
  return mergeDraft(draft, { branchId, ...downstreamFromBranch });
}

export function applyProviderChange(
  draft: AdminManualBookingDraft,
  providerPreference: ProviderPreference,
): AdminManualBookingDraft {
  const same =
    draft.providerPreference.type === providerPreference.type &&
    (providerPreference.type !== "specific" ||
      draft.providerPreference.type !== "specific" ||
      draft.providerPreference.providerId === providerPreference.providerId);
  if (same) {
    return draft;
  }
  return mergeDraft(draft, { providerPreference, ...downstreamFromProvider });
}

export function applyDateChange(
  draft: AdminManualBookingDraft,
  date: string | null,
): AdminManualBookingDraft {
  if (draft.date === date) {
    return draft;
  }
  return mergeDraft(draft, { date, slotId: null, ...downstreamFromDatetime });
}

export function applySlotChange(
  draft: AdminManualBookingDraft,
  slotId: string | null,
): AdminManualBookingDraft {
  if (draft.slotId === slotId) {
    return draft;
  }
  return mergeDraft(draft, { slotId, ...downstreamFromDatetime });
}

export function applyAllocationChange(
  draft: AdminManualBookingDraft,
  patch: Pick<AdminManualBookingDraft, "allocationMode" | "resourceSelections">,
): AdminManualBookingDraft {
  return mergeDraft(draft, { ...patch, ...downstreamFromAllocation });
}

export function applySlotTaken(draft: AdminManualBookingDraft): AdminManualBookingDraft {
  return mergeDraft(draft, { slotId: null, quoteId: undefined, paymentMethod: undefined });
}

export function isBranchValidForService(
  branchId: string | null,
  branchIds: string[],
): boolean {
  if (!branchId) {
    return branchIds.length === 0;
  }
  return branchIds.includes(branchId);
}

export function isProviderValidForContext(
  preference: ProviderPreference,
  providerIds: string[],
  allowsNoPreference: boolean,
): boolean {
  if (preference.type === "not_applicable") {
    return true;
  }
  if (preference.type === "any") {
    return allowsNoPreference;
  }
  if (preference.type === "specific") {
    return providerIds.includes(preference.providerId);
  }
  return false;
}

export function adminManualBookingIntentFingerprint(
  draft: AdminManualBookingDraft,
  quoteId?: string,
): string {
  const preference = draft.providerPreference;
  const resources = Object.entries(draft.resourceSelections)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([groupId, ids]) => `${groupId}:${[...ids].sort().join(",")}`)
    .join("|");
  return [
    draft.customerId ?? "",
    draft.serviceId ?? "",
    draft.branchId ?? "",
    preference.type,
    preference.type === "specific" ? preference.providerId : "",
    draft.date ?? "",
    draft.slotId ?? "",
    draft.allocationMode,
    resources,
    draft.paymentMethod ?? "",
    draft.bookingSource ?? "",
    quoteId ?? draft.quoteId ?? "",
  ].join(":");
}
