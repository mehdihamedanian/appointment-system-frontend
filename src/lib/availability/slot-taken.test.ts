import { describe, expect, it } from "vitest";
import { handleSlotTaken, isSlotTakenError, SLOT_TAKEN_MESSAGE } from "@/lib/availability/slot-taken";
import { emptyBookingDraft } from "@/types/booking";

describe("slot taken handling", () => {
  it("recognizes 409 and SLOT_TAKEN without treating unrelated unavailable codes as taken", () => {
    expect(isSlotTakenError({ status: 409, message: "conflict" })).toBe(true);
    expect(isSlotTakenError({ status: 409, code: "SLOT_TAKEN", message: "taken" })).toBe(true);
    expect(isSlotTakenError({ status: 400, code: "SLOT_TAKEN", message: "taken" })).toBe(true);
    expect(
      isSlotTakenError({
        status: 404,
        code: "PUBLIC_BUSINESS_UNAVAILABLE",
        message: "missing",
      }),
    ).toBe(false);
  });

  it("clears the selected slot, keeps the date, and returns to time", () => {
    const draft = emptyBookingDraft();
    draft.serviceId = "svc_1";
    draft.branchId = "br_1";
    draft.date = "2026-08-22";
    draft.slotId = "slot_1";
    const next = handleSlotTaken(draft);
    expect(next.draft.slotId).toBeNull();
    expect(next.draft.date).toBe("2026-08-22");
    expect(next.draft.serviceId).toBe("svc_1");
    expect(next.draft.branchId).toBe("br_1");
    expect(next.step).toBe("time");
    expect(next.notice).toBe("slot_taken");
    expect(SLOT_TAKEN_MESSAGE).toBe("این زمان دیگر در دسترس نیست.");
  });
});
