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
