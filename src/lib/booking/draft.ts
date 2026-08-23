import { isSafePublicId } from "@/lib/public/booking-href";
import { preferencesEqual } from "@/lib/public/provider-preference";
import type { ProviderPreference } from "@/types/provider";
import type { BookingDraft, BookingNotice } from "@/types/booking";
import { emptyBookingDraft } from "@/types/booking";

function clearSchedule(draft: BookingDraft): BookingDraft {
  return {
    ...draft,
    date: null,
    slotId: null,
    quoteId: undefined,
    holdId: undefined,
  };
}

export function selectService(
  draft: BookingDraft,
  serviceId: string | null,
): { draft: BookingDraft; notice?: BookingNotice } {
  if (draft.serviceId === serviceId) {
    return { draft };
  }
  const next = emptyBookingDraft();
  next.serviceId = serviceId && isSafePublicId(serviceId) ? serviceId : null;
  return {
    draft: next,
    notice: draft.serviceId ? "service_changed" : undefined,
  };
}

export function selectBranch(
  draft: BookingDraft,
  branchId: string | null,
): { draft: BookingDraft; notice?: BookingNotice } {
  const safe = branchId && isSafePublicId(branchId) ? branchId : null;
  if (draft.branchId === safe) {
    return { draft };
  }
  return {
    draft: clearSchedule({ ...draft, branchId: safe }),
    notice: draft.branchId ? "branch_changed" : undefined,
  };
}

export function selectProviderPreference(
  draft: BookingDraft,
  preference: ProviderPreference,
): { draft: BookingDraft; notice?: BookingNotice } {
  if (preferencesEqual(draft.providerPreference, preference)) {
    return { draft };
  }
  return {
    draft: clearSchedule({ ...draft, providerPreference: preference }),
    notice:
      draft.providerPreference.type === "specific" ||
      draft.providerPreference.type === "any"
        ? "provider_changed"
        : undefined,
  };
}

export function selectDate(
  draft: BookingDraft,
  date: string | null,
): { draft: BookingDraft; notice?: BookingNotice } {
  if (draft.date === date) {
    return { draft };
  }
  return {
    draft: {
      ...draft,
      date,
      slotId: null,
      quoteId: undefined,
      holdId: undefined,
    },
  };
}

export function selectSlot(draft: BookingDraft, slotId: string | null): BookingDraft {
  const safe = slotId && isSafePublicId(slotId) ? slotId : null;
  if (draft.slotId === safe) {
    return draft;
  }
  return {
    ...draft,
    slotId: safe,
    quoteId: undefined,
    holdId: undefined,
  };
}

export function setAdditionalValue(
  draft: BookingDraft,
  fieldId: string,
  value: string | boolean,
): BookingDraft {
  if (!isSafePublicId(fieldId)) {
    return draft;
  }
  return {
    ...draft,
    additionalData: {
      ...draft.additionalData,
      [fieldId]: value,
    },
  };
}

export function applySlotTaken(draft: BookingDraft): { draft: BookingDraft; notice: BookingNotice } {
  return {
    draft: { ...draft, slotId: null, quoteId: undefined, holdId: undefined },
    notice: "slot_taken",
  };
}

export function applyHoldExpired(draft: BookingDraft): { draft: BookingDraft; notice: BookingNotice } {
  return {
    draft: { ...draft, slotId: null, quoteId: undefined, holdId: undefined },
    notice: "hold_expired",
  };
}

export function applyHoldInvalid(draft: BookingDraft): { draft: BookingDraft; notice: BookingNotice } {
  return {
    draft: { ...draft, slotId: null, quoteId: undefined, holdId: undefined },
    notice: "hold_invalid",
  };
}

export function applyHoldReleased(draft: BookingDraft): { draft: BookingDraft; notice: BookingNotice } {
  return {
    draft: { ...draft, slotId: null, quoteId: undefined, holdId: undefined },
    notice: "hold_released",
  };
}

export function applyQuoteChanged(
  draft: BookingDraft,
  quoteId?: string,
): { draft: BookingDraft; notice: BookingNotice } {
  return {
    draft: { ...draft, quoteId },
    notice: "quote_changed",
  };
}

export function persistableDraft(draft: BookingDraft): Omit<BookingDraft, "additionalData" | "quoteId" | "holdId"> {
  return {
    serviceId: draft.serviceId,
    branchId: draft.branchId,
    providerPreference: draft.providerPreference,
    date: draft.date,
    slotId: draft.slotId,
  };
}

export function hasInternalResourceKeys(value: Record<string, unknown>): boolean {
  return ["resourceId", "roomId", "deviceId", "chairId", "deskId", "bedId", "equipmentId", "allocationId"].some(
    (key) => key in value,
  );
}
