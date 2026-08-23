import { applySlotTaken } from "@/lib/booking/draft";
import type { AppApiError } from "@/types/api";
import type { BookingDraft, BookingNotice } from "@/types/booking";

export function isSlotTakenError(error: AppApiError): boolean {
  const code = error.code?.toUpperCase() ?? "";
  if (code.includes("QUOTE") || code.includes("PRICE") || code.includes("POLICY")) {
    return false;
  }
  if (error.status === 409) {
    return true;
  }
  return code === "SLOT_TAKEN" || code === "TAKEN" || (code.includes("SLOT") && code.includes("TAKEN"));
}

export function handleSlotTaken(draft: BookingDraft): {
  draft: BookingDraft;
  notice: BookingNotice;
  step: "time";
} {
  const next = applySlotTaken(draft);
  return {
    draft: next.draft,
    notice: next.notice,
    step: "time",
  };
}

export const SLOT_TAKEN_MESSAGE = "این زمان دیگر در دسترس نیست.";
