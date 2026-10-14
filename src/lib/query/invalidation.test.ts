import { afterEach, describe, expect, it } from "vitest";
import { QueryClient, QueryObserver, type QueryKey } from "@tanstack/react-query";
import { invalidateAppointmentChange, refreshAvailabilityCaches } from "@/lib/query/invalidation";
import { queryKeys } from "@/lib/query/keys";

const preference = { type: "any" };

const keys = {
  slots: queryKeys.availability.slots("svc_1", "br_1", preference, "2026-10-20"),
  rescheduleSlots: queryKeys.reschedule.slots("BK1", "br_1", preference, "2026-10-20"),
  manualSlots: queryKeys.admin.manualBookingSlots("cus_1", "svc_1", "br_1", preference, "2026-10-20"),
  waitingListSlots: ["admin", "waiting-list", "admin_1", "availability", "WL1", "2026-10-20"],
  customerList: queryKeys.customer.appointmentList("user_1", "upcoming"),
  customerPayments: queryKeys.customer.payments("user_1"),
  customerNotifications: queryKeys.customer.notificationUnreadCount("user_1"),
  adminCalendar: ["admin", "calendar", "admin_1", "week"],
  adminAppointments: ["admin", "appointments", "admin_1", "list"],
  adminDashboard: ["admin", "dashboard", "admin_1", "2026-10-20"],
  adminServices: ["admin", "services", "admin_1"],
} satisfies Record<string, QueryKey>;

let client: QueryClient;
const unsubscribers: Array<() => void> = [];

function seed(key: QueryKey) {
  client.setQueryData(key, { seeded: true });
}

function mount(key: QueryKey) {
  const observer = new QueryObserver(client, {
    queryKey: key,
    queryFn: () => new Promise(() => undefined),
    staleTime: Infinity,
  });
  unsubscribers.push(observer.subscribe(() => undefined));
}

function state(key: QueryKey) {
  return client.getQueryState(key);
}

afterEach(() => {
  unsubscribers.splice(0).forEach((unsubscribe) => unsubscribe());
  client.clear();
});

describe("refreshAvailabilityCaches", () => {
  it("drops unmounted slot caches across booking, reschedule, manual booking, and waiting list", () => {
    client = new QueryClient();
    [keys.slots, keys.rescheduleSlots, keys.manualSlots, keys.waitingListSlots].forEach(seed);
    refreshAvailabilityCaches(client);
    expect(state(keys.slots)).toBeUndefined();
    expect(state(keys.rescheduleSlots)).toBeUndefined();
    expect(state(keys.manualSlots)).toBeUndefined();
    expect(state(keys.waitingListSlots)).toBeUndefined();
  });

  it("keeps a mounted slot picker but marks it stale so it refetches in place", () => {
    client = new QueryClient();
    seed(keys.slots);
    mount(keys.slots);
    refreshAvailabilityCaches(client);
    expect(state(keys.slots)?.isInvalidated).toBe(true);
  });
});

describe("invalidateAppointmentChange", () => {
  it("invalidates appointment, payment, notification, calendar, and dashboard domains only", () => {
    client = new QueryClient();
    Object.values(keys).forEach((key) => {
      seed(key);
      mount(key);
    });
    invalidateAppointmentChange(client, { customerUserId: "user_1", reference: "BK1" });

    for (const key of [
      keys.customerList,
      keys.customerPayments,
      keys.customerNotifications,
      keys.adminCalendar,
      keys.adminAppointments,
      keys.adminDashboard,
      keys.slots,
      keys.manualSlots,
    ]) {
      expect(state(key)?.isInvalidated, JSON.stringify(key)).toBe(true);
    }
    expect(state(keys.adminServices)?.isInvalidated).toBe(false);
  });

  it("leaves availability and payments alone when the change does not affect them", () => {
    client = new QueryClient();
    [keys.slots, keys.customerPayments, keys.adminCalendar].forEach((key) => {
      seed(key);
      mount(key);
    });
    invalidateAppointmentChange(client, {
      customerUserId: "user_1",
      availability: false,
      payments: false,
    });
    expect(state(keys.slots)?.isInvalidated).toBe(false);
    expect(state(keys.customerPayments)?.isInvalidated).toBe(false);
    expect(state(keys.adminCalendar)?.isInvalidated).toBe(true);
  });
});
