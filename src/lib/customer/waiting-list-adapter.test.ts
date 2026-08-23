import { describe, expect, it } from "vitest";
import {
  adaptWaitingListAcceptOutcome,
  adaptWaitingListEligibility,
  adaptWaitingListEntry,
  adaptWaitingListList,
  adaptWaitingListOffer,
  parseJoinDatePreference,
  parseWaitingListEntryStatus,
  parseWaitingListOfferStatus,
} from "@/lib/customer/waiting-list-adapter";
import { remainingMsFromTimestamps } from "@/lib/date-time/server-clock";
import { waitingListJoinFingerprint } from "@/lib/customer/waiting-list-idempotency";

describe("waiting-list adapter", () => {
  it("maps known and unknown entry statuses", () => {
    expect(parseWaitingListEntryStatus("active")).toBe("active");
    expect(parseWaitingListEntryStatus("offer_pending")).toBe("offered");
    expect(parseWaitingListEntryStatus("weird_state")).toBe("unknown");
  });

  it("maps known and unknown offer statuses", () => {
    expect(parseWaitingListOfferStatus("pending")).toBe("pending");
    expect(parseWaitingListOfferStatus("taken")).toBe("slot_taken");
    expect(parseWaitingListOfferStatus("mystery")).toBe("unknown");
  });

  it("adapts entries without inventing internal resources", () => {
    const entry = adaptWaitingListEntry({
      publicReference: "wle_1",
      status: "offered",
      service: { id: "svc_1", name: "ویزیت" },
      provider: { type: "any", name: "بدون ترجیح" },
      branch: { id: "br_1", name: "مرکزی" },
      datePreference: { mode: "specific", date: "2026-08-25" },
      timePreference: "morning",
      createdAt: "2026-08-22T10:00:00.000Z",
      activeOffer: { publicReference: "wlo_1", status: "pending" },
      room: { id: "room_1", name: "اتاق ۱", kind: "room" },
    });
    expect(entry?.publicReference).toBe("wle_1");
    expect(entry?.status).toBe("offered");
    expect(entry?.provider?.preference).toEqual({ type: "any" });
    expect(entry?.activeOffer?.href).toBe("/waiting-list/offers/wlo_1");
    expect(JSON.stringify(entry)).not.toMatch(/اتاق|room_1/);
  });

  it("rejects internal-only payloads", () => {
    expect(
      adaptWaitingListEntry({
        kind: "room",
        publicReference: "room_9",
        service: { name: "اتاق" },
        createdAt: "2026-08-22T10:00:00.000Z",
      }),
    ).toBeNull();
  });

  it("adapts list empty and items", () => {
    expect(adaptWaitingListList({ items: [] }).empty).toBe(true);
    const list = adaptWaitingListList({
      items: [
        {
          publicReference: "wle_1",
          status: "active",
          serviceName: "ویزیت",
          createdAt: "2026-08-22T10:00:00.000Z",
          providerPreference: { type: "no_preference" },
        },
      ],
    });
    expect(list.items).toHaveLength(1);
    expect(list.items[0]?.provider?.preference.type).toBe("any");
  });

  it("adapts offers with server clock fields and reject policy", () => {
    const offer = adaptWaitingListOffer({
      publicReference: "wlo_1",
      status: "pending",
      service: { name: "ویزیت" },
      startsAt: "2026-08-25T09:00:00+03:30",
      expiresAt: "2026-08-22T12:00:00.000Z",
      serverNow: "2026-08-22T11:55:00.000Z",
      durationMinutes: 30,
      priceLabel: "۲۵۰٬۰۰۰ تومان",
      rejectKeepsEntryActive: true,
      canAccept: true,
      canReject: true,
      equipment: { id: "eq_1", name: "دستگاه" },
    });
    expect(offer?.serverNow).toBe("2026-08-22T11:55:00.000Z");
    expect(offer?.rejectKeepsEntryActive).toBe(true);
    expect(JSON.stringify(offer)).not.toMatch(/دستگاه|eq_1/);
  });

  it("adapts accept outcomes used by Booking / Hold / Payment", () => {
    expect(
      adaptWaitingListAcceptOutcome({
        outcome: "confirmed",
        bookingReference: "BK21A",
      }),
    ).toEqual({ outcome: "confirmed", bookingReference: "BK21A", message: undefined });
    expect(
      adaptWaitingListAcceptOutcome({
        outcome: "payment_required",
        holdReference: "hold_1",
      }).outcome,
    ).toBe("payment_required");
    expect(adaptWaitingListAcceptOutcome({ outcome: "slot_taken" }).outcome).toBe(
      "slot_taken",
    );
    expect(adaptWaitingListAcceptOutcome({ outcome: "expired" }).outcome).toBe("expired");
  });

  it("adapts eligibility without inventing true", () => {
    expect(adaptWaitingListEligibility({ eligible: false }).eligible).toBe(false);
    expect(adaptWaitingListEligibility({ waitingListJoinAllowed: true }).eligible).toBe(true);
    expect(adaptWaitingListEligibility({})).toEqual({ eligible: false });
  });

  it("validates join date preferences", () => {
    expect(parseJoinDatePreference({ mode: "any" })).toEqual({ mode: "any" });
    expect(parseJoinDatePreference({ mode: "specific", date: "2026-08-25" })).toEqual({
      mode: "specific",
      date: "2026-08-25",
    });
    expect(parseJoinDatePreference({ mode: "specific", date: "bad" })).toBeNull();
    expect(
      parseJoinDatePreference({ mode: "range", from: "2026-08-25", to: "2026-08-20" }),
    ).toEqual({ mode: "range", from: "2026-08-25", to: "2026-08-20" });
  });
});

describe("waiting-list countdown helper", () => {
  it("accounts for server/client clock difference", () => {
    const remaining = remainingMsFromTimestamps({
      expiresAt: "2026-08-22T12:00:00.000Z",
      serverNow: "2026-08-22T11:59:00.000Z",
      receivedAt: 1_000_000,
      now: 1_000_000 + 15_000,
    });
    expect(remaining).toBe(45_000);
  });
});

describe("waiting-list join fingerprint", () => {
  it("changes when provider preference changes", () => {
    const base = {
      serviceId: "svc_1",
      providerPreference: { type: "any" as const },
      datePreference: { mode: "any" as const },
      timePreference: "any" as const,
    };
    const a = waitingListJoinFingerprint(base);
    const b = waitingListJoinFingerprint({
      ...base,
      providerPreference: { type: "specific", providerId: "prv_1" },
    });
    expect(a).not.toBe(b);
  });
});
