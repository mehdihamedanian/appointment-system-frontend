import { describe, expect, it } from "vitest";
import {
  adaptReschedulePreview,
  adaptRescheduleQuote,
  adaptRescheduleResult,
  buildRescheduleReview,
  financialAdjustmentLabel,
  rescheduleSuccessHeadline,
} from "@/lib/customer/appointment-reschedule-adapter";

const previewPayload = {
  canReschedule: true,
  previewVersion: "pv_1",
  appointment: {
    publicReference: "apt_resched_1",
    status: "confirmed",
    service: { id: "svc_1", name: "ویزیت" },
    startsAt: "2026-08-22T09:00:00+03:30",
    endsAt: "2026-08-22T09:30:00+03:30",
    timezone: "Asia/Tehran",
    provider: { mode: "specific", id: "prv_1", name: "دکتر نمونه" },
    branch: { id: "br_1", name: "شعبه مرکزی" },
    internalAllocation: { room: "R-12" },
  },
  selection: {
    serviceId: "svc_1",
    branchId: "br_1",
    providerPreference: { type: "specific", providerId: "prv_1" },
    requiresBranch: true,
    providerMode: "optional",
  },
  permissions: { allowBranchChange: false, allowProviderChange: false },
  policy: { summary: "یک بار رایگان" },
};

describe("appointment reschedule adapter", () => {
  it("maps preview eligibility and selection context from backend", () => {
    const view = adaptReschedulePreview(previewPayload);
    expect(view?.canReschedule).toBe(true);
    expect(view?.appointment.serviceId).toBe("svc_1");
    expect(view?.selection.branchId).toBe("br_1");
    expect(view?.permissions.allowProviderChange).toBe(false);
    expect(view?.previewVersion).toBe("pv_1");
  });

  it("defaults canReschedule to false when omitted", () => {
    const view = adaptReschedulePreview({
      appointment: previewPayload.appointment,
      selection: previewPayload.selection,
      policy: previewPayload.policy,
    });
    expect(view?.canReschedule).toBe(false);
  });

  it("maps quote comparison without calculating amounts", () => {
    const quote = adaptRescheduleQuote({
      previewVersion: "pv_2",
      appointment: previewPayload.appointment,
      proposed: {
        slotId: "slot_new",
        date: "2026-08-25",
        startsAt: "2026-08-25T09:00:00+03:30",
      },
      financial: {
        status: "additional_payment",
        currentAmountLabel: "۲۵۰٬۰۰۰ تومان",
        newAmountLabel: "۳۰۰٬۰۰۰ تومان",
        differenceLabel: "۵۰٬۰۰۰ تومان",
      },
      policy: { summary: "یک بار رایگان" },
    });
    expect(quote?.proposed.slotId).toBe("slot_new");
    expect(quote?.financial.differenceLabel).toBe("۵۰٬۰۰۰ تومان");
    expect(quote?.financial.status).toBe("additional_payment");
  });

  it("maps reschedule result and keeps financial status distinct", () => {
    const result = adaptRescheduleResult({
      appointmentReference: "apt_resched_1",
      status: "rescheduled",
      startsAt: "2026-08-25T09:00:00+03:30",
      financial: { status: "refund_pending", refundLabel: "۲۰٬۰۰۰ تومان" },
    });
    expect(result?.appointmentReference).toBe("apt_resched_1");
    expect(result?.financial.status).toBe("refund_pending");
  });

  describe("backend contract", () => {
    /** `GET /appointments/me/{reference}` — `CustomerAppointmentDetail`. */
    const backendDetail = {
      id: "f6e9a5a2-85aa-48d2-86bf-6f134a9e31d7",
      booking_reference: "APT-698A0409",
      starts_at: "2026-10-15T06:15:00Z",
      ends_at: "2026-10-15T06:45:00Z",
      status: "pending",
      payment_status: "unpaid",
      service: { id: "3fd22740-b8e6-4813-add2-d9979ffe8ab4", title: "مشاوره آزمون" },
      branch: { id: "11111111-2222-4333-8444-555555555555", name: "E2E Branch" },
      staff: [
        {
          staff_id: "a33d41a4-119f-473e-a868-0abecc08c9ca",
          resource_id: "480a7296-152c-4485-83d6-5ecd02f4b2bf",
          display_name: "Sara Fixture",
        },
      ],
      payment: { payment_status: "unpaid", currency: "IRR", total_amount: "150000.00" },
      actions: { can_cancel: true, can_reschedule: true, can_repeat: false, can_pay: true },
    };

    it("builds the preview from the appointment detail", () => {
      const view = adaptReschedulePreview({ success: true, data: backendDetail });
      expect(view?.canReschedule).toBe(true);
      expect(view?.appointment.publicReference).toBe("APT-698A0409");
      expect(view?.appointment.serviceId).toBe("3fd22740-b8e6-4813-add2-d9979ffe8ab4");
      expect(view?.appointment.startsAt).toBe("2026-10-15T06:15:00Z");
      expect(view?.appointment.provider?.name).toBe("Sara Fixture");
      expect(view?.selection.branchId).toBe("11111111-2222-4333-8444-555555555555");
      // The Backend auto-assigns staff when none is sent, so availability is not pinned to one.
      expect(view?.selection.providerPreference).toEqual({ type: "not_applicable" });
    });

    it("keeps reschedule blocked when the backend denies it", () => {
      const view = adaptReschedulePreview({
        ...backendDetail,
        actions: { ...backendDetail.actions, can_reschedule: false },
      });
      expect(view?.canReschedule).toBe(false);
    });

    it("reviews the chosen slot without inventing a price change", () => {
      const preview = adaptReschedulePreview(backendDetail);
      const review = buildRescheduleReview(preview!, {
        slotId: "slot_1",
        date: "2026-10-16",
        startsAt: "2026-10-16T06:15:00.000Z",
      });
      expect(review.current.publicReference).toBe("APT-698A0409");
      expect(review.proposed.startsAt).toBe("2026-10-16T06:15:00.000Z");
      expect(review.financial.status).toBe("pending_calculation");
      expect(review.financial.differenceLabel).toBeUndefined();
    });

    it("maps the replacement appointment from the reschedule response", () => {
      const replacement = {
        ...backendDetail,
        booking_reference: "APT-11AA22BB",
        starts_at: "2026-10-16T06:15:00Z",
        ends_at: "2026-10-16T06:45:00Z",
        status: "pending",
      };
      const result = adaptRescheduleResult({
        success: true,
        data: {
          original_appointment: { ...backendDetail, status: "rescheduled" },
          replacement_appointment: replacement,
          price_difference: "0.00",
          old_price: "150000.00",
          new_price: "150000.00",
        },
      });
      expect(result?.appointmentReference).toBe("APT-11AA22BB");
      expect(result?.startsAt).toBe("2026-10-16T06:15:00Z");
      expect(result?.branchName).toBe("E2E Branch");
      expect(result?.financial.status).toBe("none");
      expect(result?.paymentRequired).toBeUndefined();

      const pricier = adaptRescheduleResult({
        original_appointment: backendDetail,
        replacement_appointment: {
          ...replacement,
          payment: { ...replacement.payment, outstanding_balance: "200000.00" },
        },
        price_difference: "50000.00",
        old_price: "150000.00",
        new_price: "200000.00",
      });
      expect(pricier?.financial.status).toBe("additional_payment");
      expect(pricier?.financial.differenceLabel).toBeTruthy();
      expect(pricier?.paymentRequired).toBe(true);
    });
  });

  it("uses backend labels for success messaging", () => {
    expect(financialAdjustmentLabel({ status: "additional_payment" })).toMatch(/پرداخت/);
    expect(rescheduleSuccessHeadline({ status: "none" }).title).toMatch(/انجام شد/);
  });
});
