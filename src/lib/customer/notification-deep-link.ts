import { getSafeCustomerDeepLink } from "@/lib/customer/deep-link";
import { isSafePublicId } from "@/lib/public/booking-href";
import { routes } from "@/constants/routes";

export type NotificationEntityInput = {
  entityType?: string | null;
  entityReference?: string | null;
  actionType?: string | null;
  href?: string | null;
};

/**
 * Resolve a customer notification destination using entity metadata first,
 * then a sanitized internal href. Never trusts arbitrary external URLs.
 */
export function resolveNotificationDeepLink(input: NotificationEntityInput): string | undefined {
  const fromEntity = hrefFromEntity(input.entityType, input.entityReference, input.actionType);
  if (fromEntity) {
    return fromEntity;
  }
  return getSafeCustomerDeepLink(input.href ?? undefined);
}

function hrefFromEntity(
  entityType: string | null | undefined,
  entityReference: string | null | undefined,
  actionType: string | null | undefined,
): string | undefined {
  const type = entityType?.trim().toLowerCase().replace(/[\s-]+/g, "_");
  const ref = entityReference?.trim();
  if (!type) {
    return undefined;
  }

  if (
    type === "appointment" ||
    type === "booking" ||
    type === "customer_appointment"
  ) {
    if (ref && isSafePublicId(ref) && !/^\d+$/.test(ref)) {
      const action = actionType?.trim().toLowerCase().replace(/[\s-]+/g, "_");
      if (action === "cancel") {
        return routes.customer.appointmentCancel(ref);
      }
      if (action === "reschedule") {
        return routes.customer.appointmentReschedule(ref);
      }
      return routes.customer.appointmentDetail(ref);
    }
    return routes.customer.appointments;
  }

  if (type === "payment" || type === "customer_payment") {
    if (ref && isSafePublicId(ref) && !/^\d+$/.test(ref)) {
      return routes.customer.paymentDetail(ref);
    }
    return routes.customer.payments;
  }

  if (type === "booking_confirmation" || type === "confirmation") {
    if (ref && isSafePublicId(ref) && !/^\d+$/.test(ref)) {
      return routes.customer.bookingConfirmation(ref);
    }
    return routes.customer.dashboard;
  }

  // Waiting-list offer and entry destinations.
  if (
    type === "waiting_list" ||
    type === "waiting_list_offer" ||
    type === "waiting_list_entry" ||
    type === "waitlist_offer"
  ) {
    if (ref && isSafePublicId(ref) && !/^\d+$/.test(ref)) {
      const action = actionType?.trim().toLowerCase().replace(/[\s-]+/g, "_");
      if (action === "entry" || type === "waiting_list_entry") {
        return routes.customer.waitingListEntry(ref);
      }
      return routes.customer.waitingListOffer(ref);
    }
    return routes.customer.waitingList;
  }

  // Review request / form destinations.
  if (type === "review" || type === "review_request") {
    if (ref && isSafePublicId(ref) && !/^\d+$/.test(ref)) {
      return routes.customer.appointmentReview(ref);
    }
    return routes.customer.appointments;
  }

  return undefined;
}

export function defaultNotificationActionLabel(
  entityType: string | null | undefined,
  href?: string,
): string | undefined {
  if (!href) {
    return undefined;
  }
  const type = entityType?.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (type === "payment" || type === "customer_payment" || href.startsWith("/payments")) {
    return "مشاهده پرداخت";
  }
  if (
    type === "appointment" ||
    type === "booking" ||
    type === "customer_appointment" ||
    href.startsWith("/appointments")
  ) {
    return "مشاهده نوبت";
  }
  if (href.startsWith("/booking/confirmation")) {
    return "مشاهده تأیید رزرو";
  }
  if (
    type === "review" ||
    type === "review_request" ||
    href.includes("/review")
  ) {
    return "ثبت نظر";
  }
  return "مشاهده";
}
