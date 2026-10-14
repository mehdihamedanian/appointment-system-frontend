import { calendarMonthBounds } from "@/lib/date-time/calendar-adapter";
import { parseInstant } from "@/lib/date-time/zoned";
import { isRecord } from "@/lib/utilities/records";
import type { ApiQueryValue } from "@/types/api";


export type RewrittenRequest = {
  path: string;
  query: Record<string, string>;
  body: unknown;
};

const FRONTEND_ONLY_KEYS = new Set([
  "quoteId",
  "quote_id",
  "previewVersion",
  "preview_version",
  "version",
  "additionalData",
  "additional_data",
  "consent",
  "date",
  "slotId",
  "slot_id",
  "providerPreference",
  "provider_preference",
  "preference",
  "providerId",
  "allocationMode",
  "paymentMethod",
  "holdReference",
  "bookingReference",
  "acknowledged",
  "reasonCode",
  "reasonText",
  "contextDate",
  "datePreference",
  "timePreference",
  "note",
  "timeFrom",
  "timeTo",
]);

function camelToSnake(key: string): string {
  return key.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`);
}

export function startTimeFromSlotId(slotId: unknown): string | undefined {
  const raw = typeof slotId === "string" ? slotId.trim() : "";
  if (!raw) {
    return undefined;
  }
  const encoded = /^slot_(\d+)$/.exec(raw);
  if (encoded) {
    const epoch = Number(encoded[1]);
    if (Number.isFinite(epoch)) {
      return new Date(epoch).toISOString();
    }
  }
  return parseInstant(raw)?.toISOString();
}

function staffIdFromBody(body: Record<string, unknown>): string | undefined {
  const preference = body.providerPreference ?? body.provider_preference;
  if (isRecord(preference) && preference.type === "specific") {
    const id = preference.providerId ?? preference.provider_id ?? preference.staffId;
    return typeof id === "string" ? id : undefined;
  }
  const direct = body.staffId ?? body.staff_id ?? body.providerId ?? body.provider_id;
  return typeof direct === "string" ? direct : undefined;
}

function reasonFromBody(body: Record<string, unknown>): string | undefined {
  const text = body.reasonText ?? body.reason_text ?? body.reason;
  if (typeof text === "string" && text.trim()) {
    return text.trim();
  }
  const code = body.reasonCode ?? body.reason_code;
  return typeof code === "string" && code.trim() ? code.trim() : undefined;
}

function waitingListDates(body: Record<string, unknown>): {
  from?: string;
  to?: string;
} {
  const preference = body.datePreference ?? body.date_preference;
  if (isRecord(preference)) {
    if (preference.mode === "specific" && typeof preference.date === "string") {
      return { from: preference.date, to: preference.date };
    }
    if (preference.mode === "range") {
      return {
        from: typeof preference.from === "string" ? preference.from : undefined,
        to: typeof preference.to === "string" ? preference.to : undefined,
      };
    }
    if (preference.mode === "multiple" && Array.isArray(preference.dates)) {
      const dates = preference.dates.filter((item): item is string => typeof item === "string").sort();
      if (dates.length > 0) {
        return { from: dates[0], to: dates[dates.length - 1] };
      }
    }
  }
  const context = body.contextDate ?? body.context_date;
  if (typeof context === "string" && /^\d{4}-\d{2}-\d{2}$/.test(context)) {
    return { from: context, to: context };
  }
  return {};
}

function toSnakeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => toSnakeValue(item));
  }
  if (!isRecord(value)) {
    return value;
  }
  const next: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value)) {
    if (FRONTEND_ONLY_KEYS.has(key)) {
      continue;
    }
    next[camelToSnake(key)] = toSnakeValue(nested);
  }
  return next;
}

function bookingLikeBody(body: Record<string, unknown>): Record<string, unknown> {
  const mapped: Record<string, unknown> = {};
  const serviceId = body.serviceId ?? body.service_id;
  const branchId = body.branchId ?? body.branch_id;
  const startTime =
    body.startTime ??
    body.start_time ??
    startTimeFromSlotId(body.slotId ?? body.slot_id);
  const staffId = staffIdFromBody(body);
  const coupon = body.couponCode ?? body.coupon_code;
  const notes =
    body.customerNotes ??
    body.customer_notes ??
    body.customerNote ??
    body.note;
  if (typeof serviceId === "string") mapped.service_id = serviceId;
  if (typeof branchId === "string") mapped.branch_id = branchId;
  if (typeof startTime === "string") mapped.start_time = startTime;
  if (staffId) mapped.staff_id = staffId;
  if (typeof coupon === "string" && coupon.trim()) mapped.coupon_code = coupon.trim();
  if (typeof notes === "string" && notes.trim()) mapped.customer_notes = notes.trim();
  const customerId = body.customerId ?? body.customer_id;
  if (typeof customerId === "string") mapped.customer_id = customerId;
  const internal = body.internalNote ?? body.internal_notes ?? body.internalNotes;
  if (typeof internal === "string" && internal.trim()) mapped.internal_notes = internal.trim();
  const source = body.bookingSource ?? body.booking_source;
  if (typeof source === "string") mapped.booking_source = source;
  if (body.allocationMode !== "automatic" && isRecord(body.resourceSelections)) {
    const selections = Object.entries(body.resourceSelections).flatMap(([requirementId, ids]) =>
      Array.isArray(ids) && typeof ids[0] === "string"
        ? [{ requirement_id: requirementId, resource_id: ids[0] }]
        : [],
    );
    if (selections.length > 0) mapped.resource_selections = selections;
  }
  return mapped;
}

/** Backend `ServiceCreate`/`ServiceUpdate` forbid unknown fields; send only what they accept. */
function serviceWriteBody(body: Record<string, unknown>, method: string): Record<string, unknown> {
  const mapped: Record<string, unknown> = {};
  const title = body.name ?? body.title;
  if (typeof title === "string") mapped.title = title;
  const description = body.description ?? body.shortDescription;
  if (typeof description === "string") mapped.description = description;
  const numeric: Array<[string, unknown]> = [
    ["duration_minutes", body.durationMinutes],
    ["buffer_before_minutes", body.bufferBeforeMinutes],
    ["buffer_after_minutes", body.bufferAfterMinutes],
    ["capacity", body.capacity],
    ["sort_order", body.sortOrder],
    ["price", body.price],
  ];
  for (const [key, value] of numeric) {
    if (typeof value === "number" && Number.isFinite(value)) mapped[key] = value;
  }
  if (body.depositType === "none") mapped.deposit = 0;
  if (body.depositType === "fixed" && typeof body.depositAmount === "number") {
    mapped.deposit = body.depositAmount;
  }
  if (method === "POST" && typeof body.bookingEnabled === "boolean") {
    mapped.status = body.bookingEnabled ? "active" : "inactive";
  }
  return mapped;
}

function rewriteBody(path: string, method: string, body: unknown): unknown {
  if (body == null || typeof FormData !== "undefined" && body instanceof FormData) {
    return body;
  }
  if (!isRecord(body)) {
    return body;
  }

  if (path === "/auth/register") {
    const mapped: Record<string, unknown> = {
      first_name: body.firstName ?? body.first_name,
      last_name: body.lastName ?? body.last_name,
      mobile: body.mobile ?? body.phone,
      password: body.password,
    };
    if (body.email) mapped.email = body.email;
    if (body.password) mapped.password_confirmation = body.password_confirmation ?? body.password;
    return mapped;
  }
  if (path === "/auth/password/forgot" || path === "/auth/forgot-password") {
    return { mobile: body.mobile ?? body.phone };
  }
  if (path === "/auth/password/reset" || path === "/auth/reset-password") {
    return {
      reset_token: body.reset_token ?? body.token,
      new_password: body.new_password ?? body.password,
    };
  }
  if (path === "/auth/password/change" || path === "/auth/change-password") {
    return {
      current_password: body.current_password ?? body.currentPassword,
      new_password: body.new_password ?? body.newPassword,
    };
  }

  if (
    path === "/customer/bookings" ||
    path === "/customer/bookings/holds" ||
    path === "/admin/bookings" ||
    path === "/appointments/me" ||
    path === "/holds"
  ) {
    return bookingLikeBody(body);
  }

  if (
    (path === "/admin/services" && method === "POST") ||
    (/^\/admin\/services\/[^/]+$/.test(path) && method === "PATCH")
  ) {
    return serviceWriteBody(body, method);
  }

  if (path.endsWith("/reschedule")) {
    const mapped: Record<string, unknown> = {};
    const start =
      body.new_start_time ??
      body.newStartTime ??
      startTimeFromSlotId(body.slotId ?? body.slot_id);
    if (typeof start === "string") mapped.new_start_time = start;
    const staffId = staffIdFromBody(body);
    if (staffId) mapped.staff_id = staffId;
    const reason = reasonFromBody(body);
    if (reason) mapped.reason = reason;
    return mapped;
  }

  if (path.endsWith("/cancel") || path.endsWith("/cancellation") || path.endsWith("/no-show")) {
    const mapped: Record<string, unknown> = {};
    const reason = reasonFromBody(body);
    if (reason) mapped.reason = reason;
    return mapped;
  }

  if (path.endsWith("/review") && method === "POST") {
    return {
      service_rating: body.service_rating ?? body.rating,
      comment: body.comment,
    };
  }

  if (path === "/public/booking/quote" || path === "/coupons/validate") {
    const mapped: Record<string, unknown> = {
      coupon_code: body.couponCode ?? body.coupon_code ?? body.code,
      service_id: body.serviceId ?? body.service_id,
    };
    const hold = body.holdToken ?? body.hold_token ?? body.holdId;
    if (typeof hold === "string") mapped.hold_token = hold;
    return mapped;
  }

  if (path === "/customer/payments/sessions") {
    const paymentType =
      body.payment_type ??
      (body.method === "deposit" || body.method === "pay_deposit" ? "deposit" : "full");
    const mapped: Record<string, unknown> = { payment_type: paymentType };
    const coupon = body.couponCode ?? body.coupon_code;
    if (typeof coupon === "string" && coupon.trim()) mapped.coupon_code = coupon.trim();
    return mapped;
  }

  if (path === "/customer/waiting-list" && method === "POST") {
    const dates = waitingListDates(body);
    const mapped: Record<string, unknown> = {
      service_id: body.serviceId ?? body.service_id,
    };
    const branchId = body.branchId ?? body.branch_id;
    if (typeof branchId === "string") mapped.branch_id = branchId;
    const staffId = staffIdFromBody(body);
    if (staffId) mapped.staff_preference_id = staffId;
    if (dates.from) mapped.preferred_date_from = dates.from;
    if (dates.to) mapped.preferred_date_to = dates.to;
    const timeStart = body.timeFrom ?? body.preferred_time_start;
    const timeEnd = body.timeTo ?? body.preferred_time_end;
    if (typeof timeStart === "string") mapped.preferred_time_start = timeStart;
    if (typeof timeEnd === "string") mapped.preferred_time_end = timeEnd;
    return mapped;
  }

  if (path.startsWith("/admin/settings/")) {
    const section = path.slice("/admin/settings/".length).split("/")[0];
    const snake = toSnakeValue(body) as Record<string, unknown>;
    delete snake.version;
    delete snake.expected_updated_at;
    if (section === "general") {
      return {
        business: {
          business_name: snake.business_name ?? body.businessName,
          contact: {
            primary_phone: snake.contact_phone ?? body.contactPhone,
            email: snake.contact_email ?? body.contactEmail,
          },
          address: {
            address_line1: snake.address ?? body.address,
          },
        },
      };
    }
    if (section === "localization") {
      return {
        business: {
          timezone: snake.timezone ?? body.timezone,
          currency_code: snake.currency ?? body.currency,
        },
      };
    }
    if (section === "booking") {
      return { booking: snake };
    }
    if (section === "payments") {
      return { payment: snake };
    }
    if (section === "notifications") {
      return { notifications: snake };
    }
  }

  if (path === "/customer/profile" && method === "PATCH") {
    const mapped: Record<string, unknown> = {};
    if (body.firstName ?? body.first_name) mapped.first_name = body.firstName ?? body.first_name;
    if (body.lastName ?? body.last_name) mapped.last_name = body.lastName ?? body.last_name;
    return mapped;
  }

  return toSnakeValue(body);
}

function rewriteQuery(path: string, query: Record<string, string>): Record<string, string> {
  const next: Record<string, string> = {};
  const keepLimit =
    path.includes("staff-utilization") ||
    path.includes("resource-utilization") ||
    path.includes("peak-times");

  for (const [key, value] of Object.entries(query)) {
    if (value === "" || value == null) {
      continue;
    }
    if (key === "limit" && !keepLimit) {
      next.page_size = value;
      continue;
    }
    next[camelToSnake(key)] = value;
  }

  if (path.startsWith("/admin/appointments") || path === "/admin/appointments") {
    if (next.q) {
      next.search = next.q;
      delete next.q;
    }
    if (next.from) {
      next.starts_from = /^\d{4}-\d{2}-\d{2}$/.test(next.from)
        ? `${next.from}T00:00:00Z`
        : next.from;
      delete next.from;
    }
    if (next.to) {
      next.starts_to = /^\d{4}-\d{2}-\d{2}$/.test(next.to) ? `${next.to}T23:59:59Z` : next.to;
      delete next.to;
    }
    delete next.sort;
    delete next.direction;
    delete next.payment_status;
  }

  if (path.startsWith("/calendar") || path === "/admin/calendar") {
    const view = next.view;
    if (view === "day") next.view = "daily";
    if (view === "week") next.view = "weekly";
    if (view === "month") next.view = "monthly";
    if (!next.date && next.from) {
      next.date = next.from.slice(0, 10);
    }
    delete next.from;
    delete next.to;
    delete next.group_by;
    delete next.payment_status;
    delete next.resource_type;
  }

  if (path.startsWith("/admin/dashboard") || path.startsWith("/admin/reports")) {
    if (next.from) {
      next.start_date = next.from;
      delete next.from;
    }
    if (next.to) {
      next.end_date = next.to;
      delete next.to;
    }
    if (next.preset === "last_7_days") next.preset = "7d";
    if (next.preset === "last_30_days") next.preset = "30d";
    if (next.preset === "this_month" || next.preset === "previous_month") next.preset = "month";
  }

  if (next.provider_id && !next.staff_id) {
    next.staff_id = next.provider_id;
    delete next.provider_id;
  }

  if (path === "/customers" && next.q && !next.search) {
    next.search = next.q;
    delete next.q;
  }

  return next;
}

function availabilityFromAdminBooking(
  path: string,
  query: Record<string, string>,
): { path: string; query: Record<string, string> } | null {
  const serviceId = query.serviceId ?? query.service_id;
  if (!serviceId) {
    return null;
  }
  const next: Record<string, string> = {};
  const branchId = query.branchId ?? query.branch_id;
  if (branchId) next.branch_id = branchId;
  const staffId = query.staffId ?? query.staff_id ?? query.providerId ?? query.provider_id;
  if (staffId) next.staff_id = staffId;
  if (path.endsWith("/dates")) {
    const bounds = query.month ? calendarMonthBounds(query.month) : undefined;
    if (bounds) {
      next.from = bounds.from;
      next.to = bounds.to;
    }
  } else if (query.date) {
    next.date = query.date;
  }
  return { path: `/services/${encodeURIComponent(serviceId)}/availability`, query: next };
}

function reportPath(report: string): string {
  if (report === "staff") return "/admin/dashboard/staff-utilization";
  if (report === "resources") return "/admin/dashboard/resource-utilization";
  if (report === "peak") return "/admin/dashboard/peak-times";
  return "/admin/dashboard/summary";
}

function rewritePath(
  method: string,
  path: string,
  query: Record<string, string>,
  body: unknown,
): { path: string; query: Record<string, string> } {
  const holdToken =
    (isRecord(body) && typeof (body.holdReference ?? body.hold_token ?? body.holdId) === "string"
      ? String(body.holdReference ?? body.hold_token ?? body.holdId)
      : undefined) ?? query.hold_token;

  if (path === "/auth/password/forgot") return { path: "/auth/forgot-password", query };
  if (path === "/auth/password/reset") return { path: "/auth/reset-password", query };
  if (path === "/auth/password/change") return { path: "/auth/change-password", query };

  if (path === "/customer/dashboard") {
    return { path: "/appointments/me/upcoming", query };
  }
  if (path === "/customer/profile" || path === "/customer/profile/") {
    return { path: "/customers/me", query };
  }

  if (path === "/customer/appointments") {
    const category = (query.category ?? "").toLowerCase();
    const rest = { ...query };
    delete rest.category;
    delete rest.cursor;
    const suffix =
      category === "past" || category === "history" || category === "cancelled"
        ? "/history"
        : "/upcoming";
    return { path: `/appointments/me${suffix}`, query: rest };
  }

  const customerAppointment = /^\/customer\/appointments\/([^/]+)(?:\/(.*))?$/.exec(path);
  if (customerAppointment) {
    const reference = customerAppointment[1];
    const rest = customerAppointment[2] ?? "";
    if (rest === "cancellation") {
      return { path: `/appointments/me/${reference}/cancel`, query };
    }
    if (rest === "cancellation-preview" || rest === "reschedule-preview" || rest === "timeline") {
      return { path: `/appointments/me/${reference}`, query };
    }
    if (rest.startsWith("reschedule/availability/")) {
      const serviceId = query.serviceId ?? query.service_id;
      if (serviceId) {
        const mapped = availabilityFromAdminBooking(
          rest.endsWith("dates") ? "/dates" : "/slots",
          query,
        );
        if (mapped) return mapped;
      }
      return { path: `/appointments/me/${reference}`, query };
    }
    if (rest) {
      return { path: `/appointments/me/${reference}/${rest}`, query };
    }
    return { path: `/appointments/me/${reference}`, query };
  }

  if (path === "/customer/bookings") {
    return { path: "/appointments/me", query };
  }
  const customerBooking = /^\/customer\/bookings\/([^/]+)$/.exec(path);
  if (customerBooking && customerBooking[1] !== "holds") {
    return { path: `/appointments/me/${customerBooking[1]}`, query };
  }
  if (path === "/customer/bookings/holds") {
    return { path: "/holds", query };
  }
  const holdGet = /^\/customer\/bookings\/holds\/([^/]+)$/.exec(path);
  if (holdGet) {
    return { path: `/holds/${holdGet[1]}`, query };
  }

  if (path === "/public/booking/quote" || path === "/customer/bookings/preview") {
    return { path: "/coupons/validate", query };
  }

  if (path === "/customer/payments/sessions") {
    if (holdToken) {
      return { path: `/holds/${encodeURIComponent(holdToken)}/payments/intents`, query };
    }
    const bookingRef =
      isRecord(body) && typeof (body.bookingReference ?? body.appointmentId) === "string"
        ? String(body.bookingReference ?? body.appointmentId)
        : undefined;
    if (bookingRef) {
      return { path: `/appointments/${encodeURIComponent(bookingRef)}/payments/intents`, query };
    }
  }
  const customerPayment = /^\/customer\/payments\/([^/]+)(?:\/(.*))?$/.exec(path);
  if (customerPayment && customerPayment[1] !== "sessions") {
    const rest = customerPayment[2];
    if (!rest || rest === "verify") {
      return { path: `/payment-intents/${customerPayment[1]}`, query };
    }
  }

  if (path === "/customer/waiting-list") {
    return { path: method === "POST" ? "/waiting-list" : "/waiting-list/me", query };
  }
  const waitingMine = /^\/customer\/waiting-list\/([^/]+)(?:\/(.*))?$/.exec(path);
  if (waitingMine && waitingMine[1] !== "offers" && waitingMine[1] !== "eligibility") {
    const rest = waitingMine[2];
    if (rest === "leave") {
      return { path: `/waiting-list/me/${waitingMine[1]}`, query };
    }
    return { path: `/waiting-list/me/${waitingMine[1]}`, query };
  }
  const waitingOffer = /^\/customer\/waiting-list\/offers\/([^/]+)(?:\/(.*))?$/.exec(path);
  if (waitingOffer) {
    const action = waitingOffer[2];
    if (action === "accept" || action === "reject") {
      return { path: `/waiting-list/offers/${waitingOffer[1]}/${action}`, query };
    }
    return { path: `/waiting-list/offers/${waitingOffer[1]}`, query };
  }

  if (path.startsWith("/admin/settings/") && !path.includes("impact-preview") && !path.endsWith("/logo")) {
    return { path: "/admin/settings", query };
  }

  if (path === "/admin/calendar") {
    const staffId = query.staffId ?? query.staff_id;
    const resourceId = query.resourceId ?? query.resource_id;
    if (staffId) return { path: `/calendar/staff/${encodeURIComponent(staffId)}`, query };
    if (resourceId) {
      return { path: `/calendar/resources/${encodeURIComponent(resourceId)}`, query };
    }
    return { path: "/calendar", query };
  }

  if (path === "/admin/activity-logs" || path.startsWith("/admin/activity-logs/")) {
    return { path: path.replace("/admin/activity-logs", "/admin/audit-logs"), query };
  }

  if (path === "/admin/permissions/catalog") {
    return { path: "/permissions", query };
  }

  const reportMatch = /^\/admin\/reports\/([^/?]+)$/.exec(path);
  if (reportMatch && reportMatch[1] !== "meta" && reportMatch[1] !== "export") {
    return { path: reportPath(reportMatch[1]), query };
  }

  if (path === "/admin/customers/search") {
    return { path: "/customers", query };
  }

  if (path === "/admin/bookings/availability/dates" || path === "/admin/bookings/availability/slots") {
    const mapped = availabilityFromAdminBooking(path, query);
    if (mapped) return mapped;
  }
  if (path === "/admin/bookings") {
    return { path: "/admin/appointments", query };
  }

  if (path === "/admin/schedules/business") {
    return { path: "/business/schedule", query };
  }
  const branchSchedule = /^\/admin\/schedules\/branches\/([^/]+)$/.exec(path);
  if (branchSchedule) {
    return { path: `/branches/${branchSchedule[1]}/schedule`, query };
  }
  if (path === "/admin/schedules/holidays") {
    return { path: "/business/schedule-exceptions", query };
  }

  const serviceRequirements = /^\/admin\/services\/([^/]+)\/resource-requirements(.*)$/.exec(path);
  if (serviceRequirements) {
    return {
      path: `/services/${serviceRequirements[1]}/resource-requirements${serviceRequirements[2]}`,
      query,
    };
  }

  const prefixMap: Array<[string, string]> = [
    ["/admin/staff", "/staff"],
    ["/admin/resources", "/resources"],
    ["/admin/services", "/services"],
    ["/admin/customers", "/customers"],
    ["/admin/users", "/users"],
    ["/admin/roles", "/roles"],
    ["/admin/coupons", "/admin/coupons"],
  ];
  for (const [from, to] of prefixMap) {
    if (path === from || path.startsWith(`${from}/`)) {
      return { path: `${to}${path.slice(from.length)}`, query };
    }
  }

  const adminCancel = /^\/admin\/appointments\/([^/]+)\/cancellation$/.exec(path);
  if (adminCancel) {
    return { path: `/admin/appointments/${adminCancel[1]}/cancel`, query };
  }
  const adminCancelPreview = /^\/admin\/appointments\/([^/]+)\/cancellation-preview$/.exec(path);
  if (adminCancelPreview) {
    return { path: `/admin/appointments/${adminCancelPreview[1]}`, query };
  }

  return { path, query };
}

export function rewriteBackendRequest(input: {
  path: string;
  query?: Record<string, ApiQueryValue>;
  method?: string;
  body?: unknown;
}): RewrittenRequest {
  const method = (input.method ?? "GET").toUpperCase();
  const qIndex = input.path.indexOf("?");
  const pathname = qIndex >= 0 ? input.path.slice(0, qIndex) : input.path;
  const merged: Record<string, string> = {};
  if (qIndex >= 0) {
    const fromPath = new URLSearchParams(input.path.slice(qIndex + 1));
    fromPath.forEach((value, key) => {
      merged[key] = value;
    });
  }
  if (input.query) {
    for (const [key, value] of Object.entries(input.query)) {
      if (value === null || value === undefined || value === "") {
        continue;
      }
      merged[key] = String(value);
    }
  }

  const rewritten = rewritePath(method, pathname, merged, input.body);
  const query = rewriteQuery(rewritten.path, rewritten.query);
  const body =
    method === "GET" || input.body === undefined
      ? input.body
      : rewriteBody(pathname, method, input.body);

  return { path: rewritten.path, query, body };
}

