"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/data-display";
import { Dropdown, DropdownItem, DropdownSeparator } from "@/components/ui/dropdown";
import { IconButton } from "@/components/ui/icon-button";
import { routes } from "@/constants/routes";
import { appointmentProviderLabel } from "@/lib/customer/appointment-adapter";
import { repeatBookingHref } from "@/lib/customer/repeat-booking";
import { formatAppointmentParts, formatDurationMinutes } from "@/lib/date-time/format";
import {
  APPOINTMENT_CANCEL_ENABLED,
  APPOINTMENT_DETAIL_ENABLED,
  APPOINTMENT_RESCHEDULE_ENABLED,
  APPOINTMENT_REVIEW_ENABLED,
  type AppointmentListItemView,
} from "@/types/appointment-list";
import { defaultCapabilities, isCapabilityVisible } from "@/config/capabilities";

export function AppointmentCard({ item }: { item: AppointmentListItemView }) {
  const router = useRouter();
  const when = formatAppointmentParts(item.startsAt, item.timezone);
  const provider = appointmentProviderLabel(item.provider);
  const headingId = `appointment-${item.id}-title`;
  const processing = item.actions.processing === true;
  const showDetail = APPOINTMENT_DETAIL_ENABLED && item.actions.canView;
  const showPay = item.actions.canPay && Boolean(item.actions.payHref);
  const repeatHref = item.actions.canRepeat ? repeatBookingHref(item) : undefined;
  const showRepeat = Boolean(repeatHref);
  const showCancel = APPOINTMENT_CANCEL_ENABLED && item.actions.canCancel;
  const showReschedule = APPOINTMENT_RESCHEDULE_ENABLED && item.actions.canReschedule;
  const showReview =
    APPOINTMENT_REVIEW_ENABLED &&
    isCapabilityVisible(defaultCapabilities, "reviews") &&
    item.actions.canReview;
  const secondary =
    showRepeat || showCancel || showReschedule || showReview || Boolean(item.actions.blockedReason);

  return (
    <article className="appointment-card" aria-labelledby={headingId}>
      <div className="appointment-card__status">
        <StatusBadge status={item.status} />
        {item.paymentStatus ? <StatusBadge status={item.paymentStatus} /> : null}
      </div>
      <h2 id={headingId} className="appointment-card__service">
        {item.service.name}
      </h2>
      {when ? (
        <p className="appointment-card__when">
          <time dateTime={item.startsAt}>{when.label}</time>
          {item.durationMinutes ? (
            <span className="text-caption"> · {formatDurationMinutes(item.durationMinutes)}</span>
          ) : null}
        </p>
      ) : item.durationMinutes ? (
        <p className="appointment-card__when">{formatDurationMinutes(item.durationMinutes)}</p>
      ) : null}
      {provider ? <p className="appointment-card__provider">{provider}</p> : null}
      {item.branch ? <p className="appointment-card__branch">{item.branch.name}</p> : null}
      <p className="appointment-card__payment text-caption">
        کد رزرو: <span className="ltr-value text-reference">{item.publicReference}</span>
      </p>
      <div className="appointment-card__actions">
        {showDetail ? (
          <Button asChild>
            <Link href={routes.customer.appointmentDetail(item.publicReference)}>مشاهده جزئیات</Link>
          </Button>
        ) : null}
        {showPay && !processing ? (
          <Button asChild variant="secondary">
            <Link href={item.actions.payHref!}>ادامه پرداخت</Link>
          </Button>
        ) : null}
        {showPay && processing ? (
          <Button variant="secondary" disabled>
            ادامه پرداخت
          </Button>
        ) : null}
        {secondary ? (
          <Dropdown
            trigger={
              <IconButton label={`اقدامات بیشتر برای ${item.service.name}`}>
                <MoreHorizontal size={18} />
              </IconButton>
            }
          >
            {showRepeat && repeatHref ? (
              <DropdownItem onSelect={() => router.push(repeatHref)}>رزرو دوباره</DropdownItem>
            ) : null}
            {showReschedule ? (
              <DropdownItem
                disabled={processing || Boolean(item.actions.blockedReason)}
                onSelect={() =>
                  router.push(routes.customer.appointmentReschedule(item.publicReference))
                }
              >
                زمان‌بندی مجدد
              </DropdownItem>
            ) : null}
            {showReview ? (
              <DropdownItem
                disabled={processing}
                onSelect={() =>
                  router.push(routes.customer.appointmentReview(item.publicReference))
                }
              >
                ثبت نظر
              </DropdownItem>
            ) : null}
            {showCancel ? (
              <DropdownItem
                disabled={processing || Boolean(item.actions.blockedReason)}
                destructive
                onSelect={() =>
                  router.push(routes.customer.appointmentCancel(item.publicReference))
                }
              >
                لغو نوبت
              </DropdownItem>
            ) : null}
            {item.actions.blockedReason ? (
              <>
                <DropdownSeparator />
                <DropdownItem disabled>{item.actions.blockedReason}</DropdownItem>
              </>
            ) : null}
          </Dropdown>
        ) : null}
      </div>
    </article>
  );
}
