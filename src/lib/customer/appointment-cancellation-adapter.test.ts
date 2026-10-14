import { describe, expect, it } from "vitest";
import {
  adaptCancellationPreview,
  adaptCancellationResult,
  cancellationSuccessHeadline,
  refundStatusLabel,
  validateCancellationReason,
} from "@/lib/customer/appointment-cancellation-adapter";

const previewPayload = {
  canCancel: true,
  previewVersion: "pv_1",
  appointment: {
    publicReference: "apt_cancel_1",
    status: "confirmed",
    serviceName: "ویزیت",
    startsAt: "2026-08-22T09:00:00+03:30",
    endsAt: "2026-08-22T09:30:00+03:30",
    timezone: "Asia/Tehran",
    durationMinutes: 30,
    paymentStatus: "paid",
    provider: { mode: "specific", name: "دکتر نمونه" },
    branchName: "شعبه مرکزی",
    internalNote: "محرمانه",
    resourceAllocation: { room: "R-12" },
  },
  policy: {
    title: "سیاست لغو",
    summary: "تا ۲۴ ساعت قبل",
    deadlineLabel: "۲۴ ساعت قبل",
    feeLabel: "۵۰٬۰۰۰ تومان",
    refundLabel: "بازپرداخت جزئی",
  },
  refund: {
    status: "partial",
    paidAmount: { label: "۲۵۰٬۰۰۰ تومان" },
    cancellationFee: { label: "۵۰٬۰۰۰ تومان" },
    refundableAmount: { label: "۲۰۰٬۰۰۰ تومان" },
  },
  allowedReasons: [
    { code: "schedule_conflict", label: "تداخل زمانی" },
    { code: "other", label: "سایر", requiresText: true, maxLength: 200 },
  ],
};

describe("appointment cancellation adapter", () => {
  it("maps preview snapshots without internal fields", () => {
    const view = adaptCancellationPreview(previewPayload);
    expect(view?.canCancel).toBe(true);
    expect(view?.appointment.publicReference).toBe("apt_cancel_1");
    expect(view?.appointment.serviceName).toBe("ویزیت");
    expect(view?.policy.summary).toBe("تا ۲۴ ساعت قبل");
    expect(view?.refund.status).toBe("partial");
    expect(view?.refund.refundableAmount?.label).toBe("۲۰۰٬۰۰۰ تومان");
    expect(view?.allowedReasons).toHaveLength(2);
    expect(view?.previewVersion).toBe("pv_1");
  });

  it("defaults canCancel to false when eligibility is omitted", () => {
    const view = adaptCancellationPreview({
      appointment: previewPayload.appointment,
      policy: previewPayload.policy,
      refund: previewPayload.refund,
    });
    expect(view?.canCancel).toBe(false);
  });

  it("maps blocked preview reasons", () => {
    const view = adaptCancellationPreview({
      ...previewPayload,
      canCancel: false,
      blockedReason: "مهلت لغو به پایان رسیده است",
    });
    expect(view?.canCancel).toBe(false);
    expect(view?.blockedReason).toBe("مهلت لغو به پایان رسیده است");
  });

  it("maps cancellation result and refund statuses", () => {
    const result = adaptCancellationResult({
      appointmentReference: "apt_cancel_1",
      status: "cancelled",
      cancelledAt: "2026-08-21T12:00:00+03:30",
      refund: { status: "processing", refundableAmount: { label: "۲۰۰٬۰۰۰ تومان" } },
    });
    expect(result?.appointmentReference).toBe("apt_cancel_1");
    expect(result?.status).toBe("cancelled");
    expect(result?.refund.status).toBe("processing");
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
      staff: [],
      duration_snapshot: 30,
      payment: { payment_status: "unpaid", currency: "IRR", total_amount: "150000.00" },
      actions: { can_cancel: true, can_reschedule: true, can_repeat: false, can_pay: true },
    };

    it("reads cancel eligibility from the nested actions", () => {
      const view = adaptCancellationPreview({ success: true, data: backendDetail });
      expect(view?.canCancel).toBe(true);
      expect(view?.appointment.publicReference).toBe("APT-698A0409");
      expect(view?.appointment.serviceName).toBe("مشاوره آزمون");
      expect(view?.appointment.endsAt).toBe("2026-10-15T06:45:00Z");
      const blocked = adaptCancellationPreview({
        ...backendDetail,
        actions: { ...backendDetail.actions, can_cancel: false },
      });
      expect(blocked?.canCancel).toBe(false);
    });

    it("does not read the appointment status as a refund status", () => {
      const view = adaptCancellationPreview(backendDetail);
      expect(view?.refund.status).toBe("none");
    });

    it("maps the cancel response and its refund calculation", () => {
      const response = {
        appointment: { ...backendDetail, status: "cancelled" },
        cancelled_at: "2026-10-14T08:00:00Z",
        reason: null,
        refund: {
          refund_eligible: true,
          refund_policy_code: "full_before_deadline",
          calculation_base: "150000.00",
          calculated_refund_amount: "150000.00",
          payment_execution_required: true,
        },
      };
      const result = adaptCancellationResult({ success: true, data: response });
      expect(result?.appointmentReference).toBe("APT-698A0409");
      expect(result?.status).toBe("cancelled");
      expect(result?.cancelledAt).toBe("2026-10-14T08:00:00Z");
      expect(result?.refund.status).toBe("processing");
      expect(result?.refund.refundableAmount?.label).toBeTruthy();

      const unpaid = adaptCancellationResult({
        ...response,
        refund: { ...response.refund, refund_eligible: false, calculated_refund_amount: "0.00" },
      });
      expect(unpaid?.refund.status).toBe("none");
    });
  });

  it("validates required reason codes and other text", () => {
    const reasons = previewPayload.allowedReasons;
    expect(
      validateCancellationReason({ allowedReasons: reasons, selectedCode: undefined }),
    ).toMatch(/دلیل لغو/);
    expect(
      validateCancellationReason({
        allowedReasons: reasons,
        selectedCode: "other",
        reasonText: "",
      }),
    ).toMatch(/توضیح دلیل/);
    expect(
      validateCancellationReason({
        allowedReasons: reasons,
        selectedCode: "schedule_conflict",
      }),
    ).toBeUndefined();
  });

  it("keeps cancellation and refund messaging distinct", () => {
    expect(refundStatusLabel("processing")).toBe("بازپرداخت در حال پردازش");
    expect(cancellationSuccessHeadline({ status: "processing" }).description).toMatch(/بازپرداخت/);
    expect(cancellationSuccessHeadline({ status: "none" }).description).toMatch(/بازپرداختی/);
  });
});
