import { describe, expect, it } from "vitest";
import { rewriteBackendRequest, startTimeFromSlotId } from "@/lib/api/backend-contract";

describe("backend contract rewrite", () => {
  it("maps customer appointment lists to upcoming/history", () => {
    const upcoming = rewriteBackendRequest({
      path: "/customer/appointments?category=upcoming&page=1&limit=10",
      method: "GET",
    });
    expect(upcoming.path).toBe("/appointments/me/upcoming");
    expect(upcoming.query.page_size).toBe("10");
    expect(upcoming.query.category).toBeUndefined();

    const past = rewriteBackendRequest({
      path: "/customer/appointments",
      method: "GET",
      query: { category: "past", page: 2, limit: 10 },
    });
    expect(past.path).toBe("/appointments/me/history");
    expect(past.query.page).toBe("2");
  });

  it("maps booking confirm and holds to canonical routes with start_time", () => {
    const start = "2026-08-22T05:30:00.000Z";
    const slotId = startTimeFromSlotId(`slot_${Date.parse(start)}`);
    expect(slotId).toBe(new Date(Date.parse(start)).toISOString());

    const booking = rewriteBackendRequest({
      path: "/customer/bookings",
      method: "POST",
      body: {
        serviceId: "11111111-1111-1111-1111-111111111111",
        branchId: "22222222-2222-2222-2222-222222222222",
        slotId: `slot_${Date.parse(start)}`,
        quoteId: "drop-me",
        providerPreference: {
          type: "specific",
          providerId: "33333333-3333-3333-3333-333333333333",
        },
      },
    });
    expect(booking.path).toBe("/appointments/me");
    expect(booking.body).toMatchObject({
      service_id: "11111111-1111-1111-1111-111111111111",
      branch_id: "22222222-2222-2222-2222-222222222222",
      staff_id: "33333333-3333-3333-3333-333333333333",
    });
    expect(isRecord(booking.body) && "quote_id" in booking.body).toBe(false);

    const hold = rewriteBackendRequest({
      path: "/customer/bookings/holds",
      method: "POST",
      body: {
        serviceId: "11111111-1111-1111-1111-111111111111",
        branchId: "22222222-2222-2222-2222-222222222222",
        slotId: `slot_${Date.parse(start)}`,
      },
    });
    expect(hold.path).toBe("/holds");
  });

  it("maps hold payment to /holds/{token}/payments/intents", () => {
    const rewritten = rewriteBackendRequest({
      path: "/customer/payments/sessions",
      method: "POST",
      body: { method: "full", holdReference: "hold_token_1" },
    });
    expect(rewritten.path).toBe("/holds/hold_token_1/payments/intents");
    expect(rewritten.body).toMatchObject({ payment_type: "full" });
  });

  it("maps auth register and password routes to snake_case Backend bodies", () => {
    const register = rewriteBackendRequest({
      path: "/auth/register",
      method: "POST",
      body: {
        firstName: "Ali",
        lastName: "Reza",
        phone: "09121234567",
        password: "Secret123!",
        consent: true,
      },
    });
    expect(register.path).toBe("/auth/register");
    expect(register.body).toMatchObject({
      first_name: "Ali",
      last_name: "Reza",
      mobile: "09121234567",
      password: "Secret123!",
    });
    expect(isRecord(register.body) && "consent" in register.body).toBe(false);

    const forgot = rewriteBackendRequest({
      path: "/auth/password/forgot",
      method: "POST",
      body: { phone: "09121234567" },
    });
    expect(forgot.path).toBe("/auth/forgot-password");
    expect(forgot.body).toEqual({ mobile: "09121234567" });
  });

  it("collapses settings sections and admin prefixes", () => {
    const settings = rewriteBackendRequest({
      path: "/admin/settings/general",
      method: "GET",
    });
    expect(settings.path).toBe("/admin/settings");

    const staff = rewriteBackendRequest({
      path: "/admin/staff?page=1&limit=20",
      method: "GET",
    });
    expect(staff.path).toBe("/staff");
    expect(staff.query.page_size).toBe("20");

    const calendar = rewriteBackendRequest({
      path: "/admin/calendar",
      method: "GET",
      query: { view: "week", from: "2026-08-22", to: "2026-08-28", branchId: "br1" },
    });
    expect(calendar.path).toBe("/calendar");
    expect(calendar.query.view).toBe("weekly");
    expect(calendar.query.date).toBe("2026-08-22");
    expect(calendar.query.branch_id).toBe("br1");

    const reports = rewriteBackendRequest({
      path: "/admin/reports/peak?from=2026-08-01&to=2026-08-31",
      method: "GET",
    });
    expect(reports.path).toBe("/admin/dashboard/peak-times");
    expect(reports.query.start_date).toBe("2026-08-01");
  });

  it("does not rewrite login or session paths", () => {
    expect(rewriteBackendRequest({ path: "/auth/login", method: "POST" }).path).toBe(
      "/auth/login",
    );
    expect(rewriteBackendRequest({ path: "/auth/session", method: "GET" }).path).toBe(
      "/auth/session",
    );
  });

  it("maps admin service writes to the Backend ServiceCreate/ServiceUpdate fields only", () => {
    const form = {
      name: "لیزر",
      slug: "laser",
      shortDescription: "کوتاه",
      description: "توضیح کامل",
      durationMinutes: 45,
      bufferBeforeMinutes: 5,
      bufferAfterMinutes: 10,
      capacity: 2,
      priceType: "fixed",
      price: 1_500_000,
      currency: "IRR",
      depositType: "fixed",
      depositAmount: 300_000,
      providerMode: "auto",
      sortOrder: 3,
      bookingEnabled: false,
      version: "v1",
    };

    const created = rewriteBackendRequest({ path: "/admin/services", method: "POST", body: form });
    expect(created.path).toBe("/services");
    expect(created.body).toEqual({
      title: "لیزر",
      description: "توضیح کامل",
      duration_minutes: 45,
      buffer_before_minutes: 5,
      buffer_after_minutes: 10,
      capacity: 2,
      sort_order: 3,
      price: 1_500_000,
      deposit: 300_000,
      status: "inactive",
    });

    const updated = rewriteBackendRequest({
      path: "/admin/services/svc_1",
      method: "PATCH",
      body: { ...form, depositType: "none", depositAmount: undefined },
    });
    expect(updated.path).toBe("/services/svc_1");
    expect(updated.body).toMatchObject({ title: "لیزر", deposit: 0 });
    expect(updated.body).not.toHaveProperty("status");
    expect(updated.body).not.toHaveProperty("version");
  });

  it("leaves service sub-resource bodies to the generic mapping", () => {
    const rewritten = rewriteBackendRequest({
      path: "/admin/services/svc_1/resource-requirements",
      method: "PUT",
      body: { requirementMode: "all" },
    });
    expect(rewritten.body).toEqual({ requirement_mode: "all" });
  });
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
