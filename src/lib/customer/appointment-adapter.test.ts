import { describe, expect, it } from "vitest";
import {
  adaptAppointmentList,
  adaptAppointmentListItem,
  appointmentProviderLabel,
} from "@/lib/customer/appointment-adapter";
import { parseAppointmentCategory, parseAppointmentPage } from "@/lib/customer/appointment-category";
import { repeatBookingHref } from "@/lib/customer/repeat-booking";

const base = {
  id: "apt_1",
  publicReference: "apt_1",
  status: "confirmed",
  service: { id: "svc_1", name: "ویزیت تخصصی طولانی" },
  provider: { mode: "specific", id: "prv_1", name: "دکتر نمونه" },
  branch: { id: "br_1", name: "شعبه مرکزی" },
  startsAt: "2026-08-22T09:00:00+03:30",
  durationMinutes: 30,
  paymentStatus: "paid",
  actions: {
    canView: true,
    canCancel: true,
    canReschedule: true,
    canRepeat: true,
    canPay: false,
  },
};

describe("appointment category URL state", () => {
  it("falls back from an invalid category and page", () => {
    expect(parseAppointmentCategory("secret")).toBe("upcoming");
    expect(parseAppointmentCategory("past")).toBe("past");
    expect(parseAppointmentPage("-2")).toBe(1);
    expect(parseAppointmentPage("3")).toBe(3);
  });
});

describe("appointment list adapter", () => {
  it("maps customer-safe snapshots and ignores internal notes and resources", () => {
    const item = adaptAppointmentListItem({
      ...base,
      notes: "یادداشت داخلی پزشک",
      staffNotes: "محرمانه",
      resources: [{ kind: "room", name: "اتاق ۳" }],
    });
    expect(item?.service.name).toBe("ویزیت تخصصی طولانی");
    expect(item?.publicReference).toBe("apt_1");
    expect(item?.paymentStatus).toBe("paid");
    expect(JSON.stringify(item)).not.toMatch(/یادداشت|اتاق ۳|محرمانه/);
  });

  it("does not invent or merge unknown statuses", () => {
    expect(adaptAppointmentListItem({ ...base, status: "staff_only_review" })).toBeNull();
  });

  it("maps provider assignment without a public name", () => {
    const item = adaptAppointmentListItem({
      ...base,
      provider: { mode: "pending_assignment" },
    });
    expect(appointmentProviderLabel(item?.provider)).toBe("متخصص توسط مجموعه تعیین می‌شود");
  });

  it("does not infer payment status from amounts", () => {
    const item = adaptAppointmentListItem({
      ...base,
      paymentStatus: undefined,
      totalAmount: 250000,
      paidAmount: 0,
    });
    expect(item?.paymentStatus).toBeUndefined();
  });

  it("hides unsafe actions when eligibility is unknown", () => {
    const item = adaptAppointmentListItem({
      ...base,
      actions: {},
    });
    expect(item?.actions.canCancel).toBe(false);
    expect(item?.actions.canReschedule).toBe(false);
    expect(item?.actions.canPay).toBe(false);
    expect(item?.actions.canRepeat).toBe(false);
    expect(item?.actions.canView).toBe(false);
    expect(item?.actions.canReview).toBe(false);
  });

  it("keeps continue payment only while Backend says it is valid", () => {
    const valid = adaptAppointmentListItem({
      ...base,
      paymentStatus: "pending_payment",
      actions: {
        canView: true,
        canPay: true,
        payHref: "/booking/payment",
        payValidUntil: "2099-01-01T00:00:00.000Z",
      },
    });
    expect(valid?.actions.canPay).toBe(true);
    expect(valid?.actions.payHref).toBe("/booking/payment");
    const expired = adaptAppointmentListItem(
      {
        ...base,
        actions: {
          canPay: true,
          payHref: "/booking/payment",
          payValidUntil: "2020-01-01T00:00:00.000Z",
        },
      },
      new Date("2026-08-22T10:00:00.000Z"),
    );
    expect(expired?.actions.canPay).toBe(false);
  });

  it("does not sort or recategorize a partial page", () => {
    const view = adaptAppointmentList(
      {
        category: "upcoming",
        items: [
          { ...base, id: "apt_2", publicReference: "apt_2", startsAt: "2026-08-23T09:00:00+03:30" },
          { ...base, id: "apt_1", publicReference: "apt_1", startsAt: "2026-08-22T09:00:00+03:30" },
        ],
        page: 1,
        pageCount: 2,
      },
      "upcoming",
      1,
    );
    expect(view.items.map((item) => item.id)).toEqual(["apt_2", "apt_1"]);
    expect(view.pageCount).toBe(2);
  });
});

describe("repeat booking href", () => {
  it("preselects service and omits slot, price and payment", () => {
    const item = adaptAppointmentListItem(base)!;
    const href = repeatBookingHref(item);
    expect(href).toContain("/booking?service=svc_1");
    expect(href).toContain("repeatFrom=apt_1");
    expect(href).toContain("provider=prv_1");
    expect(href).not.toMatch(/slot|price|coupon|quote|hold|date=/);
  });
});
