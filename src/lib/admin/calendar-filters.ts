import { todayIsoInTimeZone } from "@/lib/date-time/format";
import {
  parseAdminAppointmentStatus,
  parseAdminPaymentStatus,
  sanitizeFilterId,
  sanitizeIsoDate,
} from "@/lib/admin/appointment-filters";
import { routes } from "@/constants/routes";
import {
  ADMIN_CALENDAR_GROUPINGS,
  ADMIN_CALENDAR_RANGES,
  type AdminCalendarGrouping,
  type AdminCalendarPresentation,
  type AdminCalendarRange,
  type AdminCalendarState,
} from "@/types/admin-calendar";
import { visibleRangeFor } from "@/lib/admin/calendar-range";

function parseRange(value: string | null | undefined): AdminCalendarRange {
  const raw = value?.trim().toLowerCase();
  if (raw && (ADMIN_CALENDAR_RANGES as readonly string[]).includes(raw)) {
    return raw as AdminCalendarRange;
  }
  return "day";
}

function parseGrouping(value: string | null | undefined): AdminCalendarGrouping {
  const raw = value?.trim().toLowerCase();
  if (raw && (ADMIN_CALENDAR_GROUPINGS as readonly string[]).includes(raw)) {
    return raw as AdminCalendarGrouping;
  }
  return "general";
}

function parsePresentation(value: string | null | undefined): AdminCalendarPresentation {
  return value?.trim().toLowerCase() === "agenda" ? "agenda" : "grid";
}

export function parseAdminCalendarState(
  search: { get(name: string): string | null },
  timezone?: string,
  now: Date = new Date(),
): AdminCalendarState {
  const range = parseRange(search.get("view") ?? search.get("range"));
  const grouping = parseGrouping(search.get("group"));
  const presentation = parsePresentation(search.get("mode"));
  const date =
    sanitizeIsoDate(search.get("date")) ?? todayIsoInTimeZone(timezone, now);

  const state: AdminCalendarState = {
    range,
    grouping,
    presentation,
    date,
    status: parseAdminAppointmentStatus(search.get("status")),
    paymentStatus: parseAdminPaymentStatus(search.get("paymentStatus")),
  };

  const branchId = sanitizeFilterId(search.get("branch"));
  if (branchId) state.branchId = branchId;
  const staffId = sanitizeFilterId(search.get("staff"));
  if (staffId) state.staffId = staffId;
  const resourceId = sanitizeFilterId(search.get("resource"));
  if (resourceId) state.resourceId = resourceId;
  const resourceType = search.get("resourceType")?.trim();
  if (resourceType && resourceType !== "all") {
    state.resourceType = resourceType.slice(0, 40);
  }
  const serviceId = sanitizeFilterId(search.get("service"));
  if (serviceId) state.serviceId = serviceId;
  const event = sanitizeFilterId(search.get("event"));
  if (event) state.event = event;

  // Dependent cleanup: staff/resource grouping without matching filter is fine;
  // clearing branch clears nothing else here — branch change handled by caller.
  if (grouping === "branch" && !state.branchId) {
    // Keep general branch filter optional; grouping still works with all branches.
  }
  return state;
}

export function adminCalendarFiltersApplied(state: AdminCalendarState): boolean {
  return (
    Boolean(state.branchId) ||
    Boolean(state.staffId) ||
    Boolean(state.resourceId) ||
    Boolean(state.resourceType) ||
    Boolean(state.serviceId) ||
    state.status !== "all" ||
    state.paymentStatus !== "all"
  );
}

export function countActiveAdminCalendarFilters(state: AdminCalendarState): number {
  let count = 0;
  if (state.branchId) count += 1;
  if (state.staffId) count += 1;
  if (state.resourceId) count += 1;
  if (state.resourceType) count += 1;
  if (state.serviceId) count += 1;
  if (state.status !== "all") count += 1;
  if (state.paymentStatus !== "all") count += 1;
  return count;
}

export function clearAdminCalendarFilters(state: AdminCalendarState): AdminCalendarState {
  return {
    range: state.range,
    grouping: state.grouping,
    presentation: state.presentation,
    date: state.date,
    status: "all",
    paymentStatus: "all",
    event: state.event,
  };
}

/** When branch changes, drop staff/resource that may be out of scope. */
export function applyBranchChange(
  state: AdminCalendarState,
  branchId: string | undefined,
): AdminCalendarState {
  return {
    ...state,
    branchId,
    staffId: undefined,
    resourceId: undefined,
  };
}

export function adminCalendarHref(state: Partial<AdminCalendarState> = {}): string {
  const params = new URLSearchParams();
  const range = state.range ?? "day";
  if (range !== "day") params.set("view", range);
  const grouping = state.grouping ?? "general";
  if (grouping !== "general") params.set("group", grouping);
  if (state.presentation === "agenda") params.set("mode", "agenda");
  if (state.date) params.set("date", state.date);
  if (state.branchId) params.set("branch", state.branchId);
  if (state.staffId) params.set("staff", state.staffId);
  if (state.resourceId) params.set("resource", state.resourceId);
  if (state.resourceType) params.set("resourceType", state.resourceType);
  if (state.serviceId) params.set("service", state.serviceId);
  if (state.status && state.status !== "all") params.set("status", state.status);
  if (state.paymentStatus && state.paymentStatus !== "all") {
    params.set("paymentStatus", state.paymentStatus);
  }
  if (state.event) params.set("event", state.event);
  const query = params.toString();
  return query ? `${routes.admin.calendar}?${query}` : routes.admin.calendar;
}

export function filtersToAdminCalendarParams(
  state: AdminCalendarState,
  weekStartsOn = 6,
): Record<string, string> {
  const { from, to } = visibleRangeFor(state.date, state.range, weekStartsOn);
  const params: Record<string, string> = {
    from,
    to,
    view: state.range,
    groupBy: state.grouping,
  };
  if (state.branchId) params.branchId = state.branchId;
  if (state.staffId) params.staffId = state.staffId;
  if (state.resourceId) params.resourceId = state.resourceId;
  if (state.resourceType) params.resourceType = state.resourceType;
  if (state.serviceId) params.serviceId = state.serviceId;
  if (state.status !== "all") params.status = state.status;
  if (state.paymentStatus !== "all") params.paymentStatus = state.paymentStatus;
  return params;
}

export function manualBookingHrefFromCalendar(state: AdminCalendarState): string {
  const params = new URLSearchParams();
  if (state.date) params.set("date", state.date);
  if (state.branchId) params.set("branch", state.branchId);
  if (state.staffId) params.set("staff", state.staffId);
  if (state.resourceId) params.set("resource", state.resourceId);
  const query = params.toString();
  return query ? `${routes.admin.manualBooking}?${query}` : routes.admin.manualBooking;
}
