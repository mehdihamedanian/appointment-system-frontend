import { describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { applyHoldExpired } from "@/lib/booking/draft";
import { invalidateAfterHoldExpiry, persistHoldTerminalDraft } from "@/lib/booking/hold-expiry";
import { HOLD_RETURN_NOTICE_KEY, HOLD_SESSION_KEY, writeHoldReference } from "@/lib/booking/hold-session";
import { BOOKING_DRAFT_STORAGE_KEY, writeBookingDraft } from "@/lib/booking/persistence";
import { queryKeys } from "@/lib/query/keys";
import { emptyBookingDraft } from "@/types/booking";

describe("hold expiry draft reset", () => {
  it("clears the slot without choosing a replacement", () => {
    const draft = emptyBookingDraft();
    draft.serviceId = "svc_1";
    draft.branchId = "br_1";
    draft.date = "2026-08-22";
    draft.slotId = "slot_1";
    draft.holdId = "hold_1";
    const next = applyHoldExpired(draft);
    expect(next.draft.slotId).toBeNull();
    expect(next.draft.date).toBe("2026-08-22");
    expect(next.draft.serviceId).toBe("svc_1");
    expect(next.draft.branchId).toBe("br_1");
    expect(next.draft.holdId).toBeUndefined();
    expect(next.notice).toBe("hold_expired");
  });

  it("persists a time-step draft and a return notice", () => {
    const draft = emptyBookingDraft();
    draft.serviceId = "svc_1";
    draft.date = "2026-08-22";
    draft.slotId = "slot_1";
    writeBookingDraft(draft, "checkout");
    writeHoldReference("hold_1");
    persistHoldTerminalDraft("hold_expired");
    const stored = JSON.parse(window.sessionStorage.getItem(BOOKING_DRAFT_STORAGE_KEY) ?? "{}") as {
      slotId: string | null;
      currentStep: string;
      date: string;
    };
    expect(stored.slotId).toBeNull();
    expect(stored.date).toBe("2026-08-22");
    expect(stored.currentStep).toBe("time");
    expect(window.sessionStorage.getItem(HOLD_SESSION_KEY)).toBeNull();
    expect(window.sessionStorage.getItem(HOLD_RETURN_NOTICE_KEY)).toContain("hold_expired");
  });

  it("invalidates availability after expiry", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(queryKeys.availability.all, { dates: ["2026-08-22"] });
    invalidateAfterHoldExpiry(queryClient);
    expect(queryClient.getQueryData(queryKeys.availability.all)).toBeUndefined();
  });
});
