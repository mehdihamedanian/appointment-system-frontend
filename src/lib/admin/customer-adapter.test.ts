import { describe, expect, it } from "vitest";
import {
  adaptAdminCustomerDetail,
  adaptAdminCustomerImpactPreview,
  adaptAdminCustomerList,
  formatAdminCustomerMetric,
  sanitizeAdminCustomerBody,
  validateAdminCustomerForm,
} from "@/lib/admin/customer-adapter";

describe("admin customer adapter", () => {
  it("adapts list with masked contact and metrics", () => {
    const view = adaptAdminCustomerList(
      {
        items: [
          {
            id: "c_1",
            reference: "C-1",
            displayName: "سارا رضایی",
            status: "active",
            phoneMasked: "0912***4567",
            totalVisits: 5,
            cancellationCount: 1,
            noShowCount: 0,
            tags: [{ id: "tag_1", name: "VIP" }],
          },
        ],
        totalCount: 1,
      },
      1,
    );
    expect(view.items[0]?.displayName).toBe("سارا رضایی");
    expect(view.items[0]?.contact.phoneMasked).toBe("0912***4567");
    expect(view.items[0]?.metrics.totalVisits).toBe(5);
    expect(view.items[0]?.detailHref).toBe("/admin/customers/C-1");
  });

  it("adapts detail with upcoming appointment and internal notes", () => {
    const detail = adaptAdminCustomerDetail({
      id: "c_1",
      reference: "C-1",
      displayName: "سارا",
      status: "active",
      metrics: { totalVisits: 3, cancellationCount: 0, noShowCount: 1 },
      upcomingAppointment: {
        id: "ap_1",
        reference: "REF-1",
        startsAt: "2026-09-01T10:00:00Z",
        status: "confirmed",
        serviceName: "ویزیت",
      },
      notes: [{ id: "n1", body: "یادداشت داخلی", authorLabel: "ادمین" }],
      allowedActions: { manageNotes: true, viewPayments: true },
      capabilities: { supportsNotesAppend: true },
    });
    expect(detail?.upcomingAppointment?.reference).toBe("REF-1");
    expect(detail?.notes[0]?.body).toBe("یادداشت داخلی");
    expect(detail?.metrics.noShowCount).toBe(1);
  });

  it("shows unavailable metrics instead of zero when flagged", () => {
    expect(formatAdminCustomerMetric(null, true)).toBe("—");
    expect(formatAdminCustomerMetric(undefined, false)).toBe("نامشخص");
    expect(formatAdminCustomerMetric(0, false)).toBe("0");
  });

  it("validates create form", () => {
    expect(validateAdminCustomerForm({ firstName: "", lastName: "ر", phone: "0912", email: "" })).toEqual(
      expect.objectContaining({ firstName: expect.any(String), phone: expect.any(String) }),
    );
  });

  it("maps the form to the Backend customer create and update bodies", () => {
    const form = { firstName: " سارا ", lastName: "رضایی", phone: "09121234567", email: "", version: "3" };
    expect(sanitizeAdminCustomerBody(form)).toEqual({
      first_name: "سارا",
      last_name: "رضایی",
      mobile: "+989121234567",
    });
    expect(sanitizeAdminCustomerBody({ ...form, email: "sara@example.com" }, "update")).toEqual({
      first_name: "سارا",
      last_name: "رضایی",
      email: "sara@example.com",
    });
  });

  it("adapts block impact preview", () => {
    const preview = adaptAdminCustomerImpactPreview(
      {
        title: "مسدودسازی",
        summary: "۲ نوبت آینده",
        futureAppointmentCount: 2,
        requiresReason: true,
      },
      "block",
    );
    expect(preview?.requiresReason).toBe(true);
    expect(preview?.futureAppointmentCount).toBe(2);
  });
});
