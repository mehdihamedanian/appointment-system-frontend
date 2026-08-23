import { bookingHref, isSafePublicId } from "@/lib/public/booking-href";
import type { CustomerAppointmentDetailView } from "@/types/appointment-detail";
import type { AppointmentListItemView } from "@/types/appointment-list";

export function repeatBookingHrefFromDetail(
  view: CustomerAppointmentDetailView,
): string | undefined {
  const serviceId = view.service.id;
  if (!isSafePublicId(serviceId)) {
    return undefined;
  }
  const providerId =
    view.provider?.mode === "specific" && isSafePublicId(view.provider.id)
      ? view.provider.id
      : undefined;
  const branchId = isSafePublicId(view.branch?.id) ? view.branch.id : undefined;
  return bookingHref({
    serviceId,
    providerId,
    branchId,
    repeatFrom: view.publicReference,
  });
}

export function repeatBookingHref(item: AppointmentListItemView): string | undefined {
  const serviceId = item.service.id;
  if (!isSafePublicId(serviceId)) {
    return undefined;
  }
  const providerId =
    item.provider?.mode === "specific" && isSafePublicId(item.provider.id)
      ? item.provider.id
      : undefined;
  const branchId = isSafePublicId(item.branch?.id) ? item.branch.id : undefined;
  return bookingHref({
    serviceId,
    providerId,
    branchId,
    repeatFrom: item.publicReference,
  });
}
