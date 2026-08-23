import { queryKeys } from "@/lib/query/keys";
import type { QueryClient } from "@tanstack/react-query";
import {
  applyHoldExpired,
  applyHoldInvalid,
  applyHoldReleased,
} from "@/lib/booking/draft";
import {
  draftFromPersisted,
  readBookingDraft,
  writeBookingDraft,
} from "@/lib/booking/persistence";
import { clearHoldReference, writeHoldReturnNotice } from "@/lib/booking/hold-session";
import { bookingHref } from "@/lib/public/booking-href";
import type { BookingDraft, BookingNotice, BookingStepId } from "@/types/booking";

export function bookingHoldReturnHref(
  draft: Pick<BookingDraft, "serviceId" | "branchId" | "providerPreference">,
  step: BookingStepId = "time",
): string {
  const href = bookingHref({
    serviceId: draft.serviceId ?? undefined,
    branchId: draft.branchId ?? undefined,
    providerId:
      draft.providerPreference.type === "specific"
        ? draft.providerPreference.providerId
        : undefined,
  });
  const separator = href.includes("?") ? "&" : "?";
  return `${href}${separator}step=${step}`;
}

export function persistHoldTerminalDraft(
  notice: Extract<BookingNotice, "hold_expired" | "hold_invalid" | "hold_released">,
): BookingDraft | null {
  const persisted = readBookingDraft();
  if (!persisted) {
    clearHoldReference();
    return null;
  }
  const current = draftFromPersisted(persisted);
  const next =
    notice === "hold_invalid"
      ? applyHoldInvalid(current)
      : notice === "hold_released"
        ? applyHoldReleased(current)
        : applyHoldExpired(current);
  writeBookingDraft(next.draft, "time");
  writeHoldReturnNotice(notice);
  clearHoldReference();
  return next.draft;
}

export function invalidateAfterHoldExpiry(queryClient: QueryClient) {
  void queryClient.removeQueries({ queryKey: queryKeys.availability.all });
  void queryClient.removeQueries({ queryKey: ["booking", "quote"] });
}
