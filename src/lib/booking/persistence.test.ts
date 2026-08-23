import { describe, expect, it } from "vitest";
import {
  isBookingDraftCompleted,
  markBookingDraftCompleted,
  parsePersistedBookingDraft,
  serializeBookingDraft,
} from "@/lib/booking/persistence";
import { emptyBookingDraft } from "@/types/booking";

describe("booking draft persistence", () => {
  it("persists only safe selection ids", () => {
    const draft = emptyBookingDraft();
    draft.serviceId = "svc_1";
    draft.date = "2026-08-22";
    draft.additionalData = { medical: "no" };
    const serialized = serializeBookingDraft(draft, "date", Date.parse("2026-08-21T10:00:00.000Z"));
    expect(serialized.serviceId).toBe("svc_1");
    expect(serialized).not.toHaveProperty("additionalData");
    expect(JSON.stringify(serialized)).not.toMatch(/medical|otp|token|hold|price/);
  });

  it("expires stale drafts", () => {
    const serialized = serializeBookingDraft(emptyBookingDraft(), "service", Date.parse("2026-08-21T10:00:00.000Z"));
    expect(
      parsePersistedBookingDraft(JSON.stringify(serialized), Date.parse("2026-08-22T13:00:00.000Z")),
    ).toBeNull();
  });

  it("rejects drafts that smuggle sensitive or internal fields", () => {
    expect(
      parsePersistedBookingDraft(
        JSON.stringify({
          version: 1,
          expiresAt: "2026-08-22T10:00:00.000Z",
          serviceId: "svc_1",
          branchId: null,
          providerPreference: { type: "not_applicable" },
          date: null,
          slotId: null,
          additionalData: { note: "x" },
        }),
      ),
    ).toBeNull();
  });

  it("marks a completed draft so browser back cannot restore it", () => {
    window.sessionStorage.clear();
    markBookingDraftCompleted("BK22A");
    expect(isBookingDraftCompleted()).toBe(true);
    expect(window.sessionStorage.getItem("appointment.booking.draft.v1")).toBeNull();
  });
});
