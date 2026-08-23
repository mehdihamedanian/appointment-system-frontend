import { routes } from "@/constants/routes";
import {
  NOTIFICATION_READ_FILTERS,
  type NotificationReadFilter,
} from "@/types/customer-notification";

export function parseNotificationReadFilter(
  value: string | null | undefined,
): NotificationReadFilter {
  const raw = value?.trim().toLowerCase();
  if (raw && (NOTIFICATION_READ_FILTERS as string[]).includes(raw)) {
    return raw as NotificationReadFilter;
  }
  return "all";
}

export function parseNotificationPage(value: string | null | undefined): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export function notificationsHref(input: {
  read?: NotificationReadFilter;
  page?: number;
} = {}): string {
  const params = new URLSearchParams();
  if (input.read && input.read !== "all") {
    params.set("read", input.read);
  }
  if (input.page && input.page > 1) {
    params.set("page", String(input.page));
  }
  const query = params.toString();
  return query ? `${routes.customer.notifications}?${query}` : routes.customer.notifications;
}
