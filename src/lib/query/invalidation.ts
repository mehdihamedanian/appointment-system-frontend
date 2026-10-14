import type { Query, QueryClient, QueryKey } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";

const AVAILABILITY_PREFIXES: readonly QueryKey[] = [
  queryKeys.availability.all,
  queryKeys.reschedule.all,
  ["admin", "manual-booking", "dates"],
  ["admin", "manual-booking", "slots"],
];

function startsWith(key: QueryKey, prefix: QueryKey): boolean {
  return prefix.every((part, index) => key[index] === part);
}

function isAvailabilityQuery(query: Query): boolean {
  const key = query.queryKey;
  if (AVAILABILITY_PREFIXES.some((prefix) => startsWith(key, prefix))) {
    return true;
  }
  return key[0] === "admin" && key[1] === "waiting-list" && key[3] === "availability";
}

/**
 * Any booking write can change capacity. Inactive slot caches are dropped so no screen can
 * reopen with a taken slot; mounted pickers refetch in place.
 */
export function refreshAvailabilityCaches(queryClient: QueryClient): void {
  queryClient.removeQueries({ predicate: isAvailabilityQuery, type: "inactive" });
  void queryClient.invalidateQueries({ predicate: isAvailabilityQuery });
}

export type AppointmentChange = {
  /** Signed-in customer whose own caches changed; omit for staff-side writes. */
  customerUserId?: string;
  /** Booking reference or appointment id that changed. */
  reference?: string;
  /** Capacity changed: booking, cancellation, reschedule, no-show, manual booking. */
  availability?: boolean;
  /** Payment state or balance may have changed. */
  payments?: boolean;
};

/**
 * Cross-domain invalidation after an appointment write. Targets the appointment, calendar,
 * dashboard, notification, payment, and availability domains only; unrelated admin catalogs
 * (services, staff, settings) are left cached.
 */
export function invalidateAppointmentChange(
  queryClient: QueryClient,
  change: AppointmentChange,
): void {
  const { customerUserId, reference } = change;

  if (customerUserId) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.customer.appointments(customerUserId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.customer.dashboard(customerUserId) });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.customer.notifications(customerUserId),
    });
    if (change.payments !== false) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.customer.payments(customerUserId) });
    }
  } else {
    void queryClient.invalidateQueries({ queryKey: ["customer", "appointments"] });
    void queryClient.invalidateQueries({ queryKey: ["customer", "dashboard"] });
    void queryClient.invalidateQueries({ queryKey: ["customer", "notifications"] });
    if (change.payments !== false) {
      void queryClient.invalidateQueries({ queryKey: ["customer", "payments"] });
    }
  }

  void queryClient.invalidateQueries({ queryKey: ["admin", "appointments"] });
  void queryClient.invalidateQueries({ queryKey: ["admin", "calendar"] });
  void queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
  void queryClient.invalidateQueries({
    predicate: (query) =>
      query.queryKey[0] === "admin" &&
      query.queryKey[1] === "customers" &&
      query.queryKey[3] === "appointments",
  });
  if (change.payments !== false) {
    void queryClient.invalidateQueries({ queryKey: ["admin", "payments"] });
  }
  if (reference) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.booking.confirmation(reference) });
  }

  if (change.availability !== false) {
    refreshAvailabilityCaches(queryClient);
  }
}
