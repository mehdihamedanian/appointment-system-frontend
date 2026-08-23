import { describe, expect, it } from "vitest";
import {
  hasInternalResourceKeys,
  persistableDraft,
  selectBranch,
  selectDate,
  selectProviderPreference,
  selectService,
  selectSlot,
} from "@/lib/booking/draft";
import { emptyBookingDraft } from "@/types/booking";

describe("booking draft dependencies", () => {
  it("resets later selections when the service changes", () => {
    const draft = emptyBookingDraft();
    draft.serviceId = "svc_1";
    draft.branchId = "br_1";
    draft.date = "2026-08-22";
    draft.slotId = "slot_1";
    const next = selectService(draft, "svc_2");
    expect(next.draft.serviceId).toBe("svc_2");
    expect(next.draft.branchId).toBeNull();
    expect(next.draft.date).toBeNull();
    expect(next.draft.slotId).toBeNull();
    expect(next.notice).toBe("service_changed");
  });

  it("resets date and slot when the branch changes", () => {
    const draft = emptyBookingDraft();
    draft.serviceId = "svc_1";
    draft.branchId = "br_1";
    draft.date = "2026-08-22";
    draft.slotId = "slot_1";
    const next = selectBranch(draft, "br_2");
    expect(next.draft.branchId).toBe("br_2");
    expect(next.draft.date).toBeNull();
    expect(next.draft.slotId).toBeNull();
    expect(next.notice).toBe("branch_changed");
  });

  it("resets date and slot when the provider preference changes", () => {
    const draft = emptyBookingDraft();
    draft.date = "2026-08-22";
    draft.slotId = "slot_1";
    draft.providerPreference = { type: "specific", providerId: "p1" };
    const next = selectProviderPreference(draft, { type: "any" });
    expect(next.draft.date).toBeNull();
    expect(next.draft.slotId).toBeNull();
    expect(next.notice).toBe("provider_changed");
  });

  it("does not treat displayed time text as a slot id", () => {
    const draft = selectSlot(emptyBookingDraft(), "09:00");
    expect(draft.slotId).toBeNull();
    expect(selectSlot(emptyBookingDraft(), "slot_9").slotId).toBe("slot_9");
  });

  it("does not persist additional data, quote or hold", () => {
    const draft = emptyBookingDraft();
    draft.additionalData = { note: "secret" };
    draft.quoteId = "q1";
    draft.holdId = "h1";
    expect(persistableDraft(draft)).not.toHaveProperty("additionalData");
    expect(persistableDraft(draft)).not.toHaveProperty("quoteId");
    expect(persistableDraft(draft)).not.toHaveProperty("holdId");
  });

  it("detects internal resource keys so they are never stored", () => {
    expect(hasInternalResourceKeys({ roomId: "r1" })).toBe(true);
    expect(hasInternalResourceKeys({ serviceId: "svc_1" })).toBe(false);
  });

  it("clears the slot when the date changes", () => {
    const draft = emptyBookingDraft();
    draft.date = "2026-08-22";
    draft.slotId = "slot_1";
    expect(selectDate(draft, "2026-08-23").draft.slotId).toBeNull();
  });
});
