import { describe, expect, it } from "vitest";
import {
  adaptBookingConfirmation,
  confirmationHeadline,
  confirmationProviderLabel,
  confirmationResultKind,
} from "@/lib/booking/confirmation-adapter";

const base = {
  id: "apt_1",
  reference: "BK-22A",
  serviceName: "ویزیت",
  startsAt: "2026-08-22T09:00:00+03:30",
  status: "confirmed",
};

describe("booking confirmation adapter", () => {
  it("reads the Backend's CustomerAppointmentDetail amounts and pay permission as given", () => {
    const detail = {
      id: "6f1c1d2e-0000-4000-8000-000000000001",
      booking_reference: "BK7Q2M",
      service: { id: "svc_1", title: "ویزیت" },
      starts_at: "2026-08-22T10:00:00+03:30",
      status: "pending",
      payment_status: "unpaid",
      price_snapshot: "150000.00",
      payment: {
        payment_status: "unpaid",
        currency: "IRR",
        total_amount: "150000.00",
        successful_paid_amount: "0.00",
        outstanding_balance: "150000.00",
      },
      actions: { can_cancel: true, can_reschedule: true, can_repeat: false, can_pay: true },
    };
    const view = adaptBookingConfirmation({ appointment: detail });
    expect(view?.reference).toBe("BK7Q2M");
    expect(view?.pricing.totalLabel).toMatch(/۱۵۰٬۰۰۰/);
    expect(view?.pricing.remainingLabel).toMatch(/۱۵۰٬۰۰۰/);
    expect(view?.payHref).toBe("/appointments/BK7Q2M/payment");

    const notPayable = adaptBookingConfirmation({
      ...detail,
      actions: { ...detail.actions, can_pay: false },
    });
    expect(notPayable?.payHref).toBeUndefined();
    expect(adaptBookingConfirmation({ ...detail, actions: null })?.payHref).toBeUndefined();
  });

  it("maps a confirmed booking without calculating money", () => {
    const view = adaptBookingConfirmation({
      ...base,
      paymentStatus: "paid",
      pricing: {
        totalAmount: { label: "۲۵۰٬۰۰۰ تومان" },
        paidAmount: { label: "۲۵۰٬۰۰۰ تومان" },
      },
    });
    expect(view?.reference).toBe("BK-22A");
    expect(view?.pricing.totalLabel).toBe("۲۵۰٬۰۰۰ تومان");
    expect(confirmationResultKind(view!)).toBe("confirmed");
    expect(confirmationHeadline("confirmed").title).toBe("نوبت شما با موفقیت ثبت شد.");
  });

  it("keeps pending confirmation distinct from success", () => {
    const view = adaptBookingConfirmation({ ...base, status: "pending_confirmation" });
    expect(confirmationResultKind(view!)).toBe("pending");
    expect(confirmationHeadline("pending").title).toContain("در انتظار تأیید مجموعه");
    expect(confirmationHeadline("pending").showSuccessIcon).toBe(false);
  });

  it("maps pay at location from payment status, not amounts", () => {
    const view = adaptBookingConfirmation({
      ...base,
      paymentStatus: "pay_at_location",
      remainingAmountLabel: "۱۵۰٬۰۰۰ تومان",
    });
    expect(view?.paymentStatus).toBe("payAtLocation");
    expect(confirmationResultKind(view!)).toBe("pay_at_location");
    expect(view?.pricing.remainingLabel).toBe("۱۵۰٬۰۰۰ تومان");
  });

  it("maps payment pending without claiming success", () => {
    const view = adaptBookingConfirmation({ ...base, status: "scheduled", paymentStatus: "pending_payment" });
    expect(confirmationResultKind(view!)).toBe("payment_pending");
    expect(confirmationHeadline("payment_pending").showSuccessIcon).toBe(false);
  });

  it("presents provider assignment modes without null", () => {
    expect(
      confirmationProviderLabel(
        adaptBookingConfirmation({ ...base, provider: { name: "دکتر آریا", title: "پوست" } })?.provider,
      ),
    ).toContain("دکتر آریا");
    expect(
      confirmationProviderLabel(
        adaptBookingConfirmation({ ...base, providerMode: "automatic" })?.provider,
      ),
    ).toBe("متخصص توسط مجموعه تعیین می‌شود");
    expect(adaptBookingConfirmation({ ...base, providerMode: "not_applicable" })?.provider).toBeUndefined();
  });

  it("does not expose internal resources or sequential ids as the public reference", () => {
    const view = adaptBookingConfirmation({
      ...base,
      id: "apt_1",
      reference: "12",
      room: "اتاق ۳",
      allocation: { resourceId: "room_9", kind: "room" },
      notesInternal: "یادداشت داخلی",
    });
    expect(view?.reference).toBeUndefined();
    expect(JSON.stringify(view)).not.toMatch(/اتاق ۳|room_9|یادداشت داخلی/);
  });

  it("strips HTML from customer instructions", () => {
    const view = adaptBookingConfirmation({
      ...base,
      instructions: "<b>ناشتا</b> باشید",
    });
    expect(view?.instructions).toBe("ناشتا باشید");
  });
});
