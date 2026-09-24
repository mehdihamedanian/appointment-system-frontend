import { describe, expect, it } from "vitest";
import {
  adaptAdminAllowedActions,
  adaptAdminAppointmentListItem,
} from "@/lib/admin/appointment-adapter";

describe("admin appointment adapter", () => {
  it("maps allowed actions from backend payload", () => {
    const actions = adaptAdminAllowedActions({
      allowedActions: {
        confirm: true,
        checkIn: true,
        cancel: true,
      },
    });
    expect(actions.confirm).toBe(true);
    expect(actions.checkIn).toBe(true);
    expect(actions.cancel).toBe(true);
    expect(actions.complete).toBeUndefined();
  });

  it("maps list item with customer and booking source", () => {
    const item = adaptAdminAppointmentListItem({
      id: "apt_1",
      reference: "REF-1",
      customerName: "علی",
      serviceName: "ویزیت",
      startsAt: "2026-08-23T09:00:00.000Z",
      status: "confirmed",
      paymentStatus: "paid",
      bookingSource: "online",
    });
    expect(item?.customerName).toBe("علی");
    expect(item?.reference).toBe("REF-1");
    expect(item?.bookingSource).toBe("online");
  });

  it("falls back unknown status to neutral unknown", () => {
    const item = adaptAdminAppointmentListItem({
      id: "apt_2",
      customerName: "نمونه",
      serviceName: "خدمت",
      startsAt: "2026-08-23T10:00:00.000Z",
      status: "mystery",
    });
    expect(item?.status).toBe("unknown");
  });
});
