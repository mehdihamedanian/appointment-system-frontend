import { describe, expect, it } from "vitest";
import {
  adaptCustomerAppointmentDetail,
  adaptCustomerTimeline,
  adaptTimelineEvent,
  isCustomerVisibleTimelineEvent,
} from "@/lib/customer/appointment-detail-adapter";
import { repeatBookingHrefFromDetail } from "@/lib/customer/repeat-booking";

const baseDetail = {
  id: "apt_detail_1",
  publicReference: "apt_detail_1",
  status: "confirmed",
  service: {
    id: "svc_1",
    name: "ویزیت تخصصی",
    durationMinutes: 30,
    publicDescription: "توضیح عمومی خدمت",
    imageUrl: "https://cdn.example/service.jpg",
  },
  provider: { mode: "specific", id: "prv_1", name: "دکتر نمونه", title: "متخصص" },
  branch: {
    id: "br_1",
    name: "شعبه مرکزی",
    address: "تهران، خیابان نمونه",
    phone: "02112345678",
    directionsUrl: "https://maps.example/place",
    visitInstructions: "طبقه ۲",
  },
  singleBranch: true,
  startsAt: "2026-08-22T09:00:00+03:30",
  endsAt: "2026-08-22T09:30:00+03:30",
  timezone: "Asia/Tehran",
  durationMinutes: 30,
  paymentStatus: "paid",
  pricing: {
    currency: "IRR",
    totalAmount: { label: "۲۵۰٬۰۰۰ تومان" },
    paidAmount: { label: "۲۵۰٬۰۰۰ تومان" },
    depositAmount: { label: "۵۰٬۰۰۰ تومان" },
    remainingAmount: { label: "۰ تومان" },
  },
  transactionReference: "pay_abc",
  customerNote: "یادداشت <b>مشتری</b>",
  internalNote: "یادداشت داخلی محرمانه",
  staffNotes: "یادداشت پرسنل",
  timeline: [
    { id: "evt_1", title: "ثبت نوبت", occurredAt: "2026-08-21T10:00:00+03:30", state: "complete" },
    { id: "evt_2", title: "تأیید نوبت", occurredAt: "2026-08-21T11:00:00+03:30", state: "current" },
  ],
  cancellationPolicy: {
    title: "لغو نوبت",
    summary: "تا ۲۴ ساعت قبل بدون جریمه",
    deadlineLabel: "۲۴ ساعت قبل",
    feeLabel: "۱۰٪",
  },
  reschedulePolicy: {
    summary: "یک بار رایگان",
  },
  contact: {
    phone: "02187654321",
    email: "info@example.com",
    address: "تهران",
    hoursLabel: "۹ تا ۱۸",
  },
  actions: {
    canView: true,
    canCancel: true,
    canReschedule: true,
    canRepeat: true,
    canPay: false,
    cancelBlockedReason: "مهلت لغو گذشته است",
  },
};

describe("appointment detail adapter", () => {
  it("maps customer-safe appointment snapshots", () => {
    const view = adaptCustomerAppointmentDetail(baseDetail);
    expect(view?.publicReference).toBe("apt_detail_1");
    expect(view?.service.name).toBe("ویزیت تخصصی");
    expect(view?.service.description).toBe("توضیح عمومی خدمت");
    expect(view?.branch?.name).toBe("شعبه مرکزی");
    expect(view?.singleBranch).toBe(true);
    expect(view?.payment.totalLabel).toBe("۲۵۰٬۰۰۰ تومان");
    expect(view?.payment.depositLabel).toBe("۵۰٬۰۰۰ تومان");
    expect(view?.payment.transactionReference).toBe("pay_abc");
    expect(view?.customerNote).toBe("یادداشت مشتری");
    expect(view?.actions.cancelBlockedReason).toBe("مهلت لغو گذشته است");
    expect(JSON.stringify(view)).not.toMatch(/محرمانه|staffNotes|internalNote/);
  });

  it("does not invent unknown statuses", () => {
    expect(adaptCustomerAppointmentDetail({ ...baseDetail, status: "staff_review" })).toBeNull();
  });

  it("does not infer payment status from amounts", () => {
    const view = adaptCustomerAppointmentDetail({
      ...baseDetail,
      paymentStatus: undefined,
      pricing: { totalAmount: { amount: 250000 }, paidAmount: { amount: 0 } },
    });
    expect(view?.payment.status).toBeUndefined();
  });

  it("hides unsafe actions when eligibility is unknown", () => {
    const view = adaptCustomerAppointmentDetail({
      ...baseDetail,
      actions: {},
    });
    expect(view?.actions.canCancel).toBe(false);
    expect(view?.actions.canReschedule).toBe(false);
    expect(view?.actions.canRepeat).toBe(false);
    expect(view?.actions.canPay).toBe(false);
    expect(view?.actions.canReview).toBe(false);
  });

  it("maps provider assignment without public name", () => {
    const view = adaptCustomerAppointmentDetail({
      ...baseDetail,
      provider: { mode: "pending_assignment" },
    });
    expect(view?.provider?.mode).toBe("pending_assignment");
  });

  it("filters internal timeline events", () => {
    expect(
      isCustomerVisibleTimelineEvent({
        title: "تخصیص اتاق",
        kind: "resource_allocation",
      }),
    ).toBe(false);
    expect(
      isCustomerVisibleTimelineEvent({
        title: "یادداشت داخلی",
        internal: true,
      }),
    ).toBe(false);
    expect(
      isCustomerVisibleTimelineEvent({
        title: "تأیید نوبت",
        kind: "confirmed",
      }),
    ).toBe(true);
  });

  it("adapts public timeline events only", () => {
    const events = adaptCustomerTimeline({
      events: [
        { id: "evt_ok", title: "ثبت نوبت", state: "complete" },
        { id: "evt_bad", title: "تخصیص دستگاه", kind: "device_allocation", state: "complete" },
        { id: "evt_note", title: "یادداشت مدیر", internal: true },
      ],
    });
    expect(events).toHaveLength(1);
    expect(events[0]?.title).toBe("ثبت نوبت");
  });

  it("builds repeat booking href without reusing slot or payment", () => {
    const view = adaptCustomerAppointmentDetail(baseDetail);
    expect(view).not.toBeNull();
    const href = repeatBookingHrefFromDetail(view!);
    expect(href).toContain("service=svc_1");
    expect(href).toContain("provider=prv_1");
    expect(href).toContain("branch=br_1");
    expect(href).toContain("repeatFrom=apt_detail_1");
    expect(href).not.toMatch(/slot|payment|quote|hold/i);
  });
});

describe("timeline event adapter", () => {
  it("drops events without customer-visible titles", () => {
    expect(adaptTimelineEvent({ kind: "audit", description: "secret" }, 0)).toBeNull();
  });
});
