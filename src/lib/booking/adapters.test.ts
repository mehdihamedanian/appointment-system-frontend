import { describe, expect, it } from "vitest";
import {
  adaptAdditionalFields,
  adaptBookableDates,
  adaptBookableSlots,
  adaptBookingConfirm,
  adaptBookingQuote,
} from "@/lib/booking/adapters";
import { isStepValid } from "@/lib/booking/validation";
import { emptyBookingDraft } from "@/types/booking";

describe("booking adapters", () => {
  it("does not invent bookable dates and maps day states from the backend", () => {
    expect(adaptBookableDates(null).dates).toEqual([]);
    expect(adaptBookableDates({ dates: ["2026-08-22", "not-a-date"] }).dates).toEqual(["2026-08-22"]);
    expect(adaptBookableDates({ dates: ["2026-08-22"] }).days).toEqual([
      { date: "2026-08-22", status: "available" },
    ]);
    const mixed = adaptBookableDates({
      timezone: "Asia/Tehran",
      minDate: "2026-08-01",
      maxDate: "2026-09-30",
      serverNow: "2026-08-21T12:00:00Z",
      days: [
        { date: "2026-08-22", status: "available" },
        { date: "2026-08-23", status: "closed" },
        { date: "2026-08-24", status: "full" },
      ],
    });
    expect(mixed.dates).toEqual(["2026-08-22"]);
    expect(mixed.days.map((day) => day.status)).toEqual(["available", "closed", "no_capacity"]);
    expect(mixed.minDate).toBe("2026-08-01");
    expect(mixed.serverNow).toBe("2026-08-21T12:00:00Z");
  });

  it("keeps backend slot ids and ignores internal resources", () => {
    const slots = adaptBookableSlots({
      slots: [
        { id: "slot_1", startLabel: "09:00" },
        { id: "room_1", kind: "room", startLabel: "10:00" },
        { id: "slot_2", startsAt: "2026-08-22T14:00:00+03:30", status: "held" },
      ],
    });
    expect(slots.slots.map((item) => item.id)).toEqual(["slot_1", "slot_2"]);
    expect(slots.slots[0]?.label).toBe("09:00");
    expect(slots.slots[0]?.startsAt).toBe("");
    expect(slots.slots[1]?.status).toBe("held");
    expect(slots.slots[1]?.startsAt).toBe("2026-08-22T14:00:00+03:30");
  });

  it("does not calculate quote totals", () => {
    const quote = adaptBookingQuote({
      id: "q1",
      priceLabel: "۲۵۰ هزار",
      checkoutPath: "pay_deposit",
      changed: true,
    });
    expect(quote.priceLabel).toBe("۲۵۰ هزار");
    expect(quote.checkoutPath).toBe("pay_deposit");
    expect(quote.paymentMode).toBe("deposit");
    expect(quote.changed).toBe(true);
    expect(quote.authoritative).toBe(true);
  });

  it("maps nested pricing lines without summing them", () => {
    const quote = adaptBookingQuote({
      id: "q2",
      expiresAt: "2026-08-22T10:00:00Z",
      serverNow: "2026-08-22T09:50:00Z",
      paymentMode: "deposit",
      pricing: {
        currency: "IRR",
        baseAmount: { label: "۳۰۰٬۰۰۰ تومان" },
        discountAmount: { label: "۵۰٬۰۰۰ تومان" },
        totalAmount: { label: "۲۵۰٬۰۰۰ تومان" },
        payableNow: { label: "۱۰۰٬۰۰۰ تومان" },
        payableAtLocation: { label: "۱۵۰٬۰۰۰ تومان" },
        fees: [{ id: "fee_1", label: "هزینه خدمات", amountLabel: "۱۰٬۰۰۰ تومان", kind: "fee" }],
      },
      cancellationPolicy: {
        summary: "تا ۲۴ ساعت قبل رایگان",
        fullText: "متن کامل",
        consentRequired: true,
        consentLabel: "قوانین را می‌پذیرم",
      },
      slot: { id: "slot_1", startsAt: "2026-08-22T09:00:00+03:30", label: "09:00" },
      allocation: { resourceId: "room_9", kind: "room" },
    });
    expect(quote.finalAmountLabel).toBe("۲۵۰٬۰۰۰ تومان");
    expect(quote.payableNowLabel).toBe("۱۰۰٬۰۰۰ تومان");
    expect(quote.payableNowLabel).not.toBe(quote.finalAmountLabel);
    expect(quote.lines.some((line) => line.kind === "fee")).toBe(true);
    expect(quote.policySnapshot?.consentRequired).toBe(true);
    expect(JSON.stringify(quote)).not.toMatch(/room_9/);
  });

  it("ignores unknown additional field types and html", () => {
    const fields = adaptAdditionalFields({
      additionalFields: [
        { id: "note", label: "توضیح", type: "textarea", required: false, helpText: "<b>x</b>" },
        { id: "html", label: "خطر", type: "html" },
        { id: "file_1", label: "پیوست", type: "file" },
      ],
    });
    expect(fields.map((item) => item.id)).toEqual(["note"]);
    expect(fields[0]?.helpText).toBe("x");
  });

  it("maps confirm outcomes without inventing a booking id", () => {
    expect(adaptBookingConfirm(null).outcome).toBe("missing_endpoint");
    expect(adaptBookingConfirm({ status: "confirmed", id: "apt_1", reference: "apt_1" })).toMatchObject({
      outcome: "confirmed",
      bookingId: "apt_1",
      reference: "apt_1",
    });
    expect(adaptBookingConfirm({ status: "quote_changed", changed: true }).outcome).toBe("quote_changed");
  });
});

describe("required step blocking", () => {
  it("blocks continuing without a service or slot", () => {
    const draft = emptyBookingDraft();
    const ctx = { requiresBranch: false };
    expect(isStepValid("service", draft, ctx)).toBe(false);
    draft.serviceId = "svc_1";
    expect(isStepValid("service", draft, ctx)).toBe(true);
    expect(isStepValid("time", draft, ctx)).toBe(false);
  });
});
