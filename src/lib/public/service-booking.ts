import { bookingHref, isSafePublicId } from "@/lib/public/booking-href";
import { isBookableService } from "@/lib/public/service-adapters";
import type { ServiceListItemView } from "@/types/service";

/**
 * Builds an initial Booking Wizard URL. The query is intent only.
 * The wizard must re-fetch and validate the service; it must not trust
 * price, duration or availability from this URL.
 */
export function serviceBookingHref(
  service: Pick<ServiceListItemView, "id" | "bookingEnabled" | "availability">,
  extra?: { branchId?: string; providerId?: string },
): string | null {
  if (!isBookableService(service) || !isSafePublicId(service.id)) {
    return null;
  }
  return bookingHref({
    serviceId: service.id,
    branchId: extra?.branchId,
    providerId: extra?.providerId,
  });
}
