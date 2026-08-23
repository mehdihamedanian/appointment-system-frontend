import { describe, expect, it } from "vitest";
import {
  adaptReschedulePreview,
  adaptRescheduleQuote,
  adaptRescheduleResult,
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

  it("uses backend labels for success messaging", () => {
    expect(financialAdjustmentLabel({ status: "additional_payment" })).toMatch(/پرداخت/);
    expect(rescheduleSuccessHeadline({ status: "none" }).title).toMatch(/انجام شد/);
  });
});
