"use client";

import { startTimeFromSlotId } from "@/lib/api/backend-contract";
import { formatAppointmentParts, formatDurationMinutes } from "@/lib/date-time/format";
import { providerPresentation } from "@/lib/booking/summary-display";
import type { AdminManualBookingDraft, AdminManualBookingQuoteView } from "@/types/admin-manual-booking";
import type { PublicBranch } from "@/types/public";
import type { ServiceDetailView, ServiceListItemView } from "@/types/service";
import type { EligibleProvidersView } from "@/types/provider";
import type { AdminManualBookingCustomerView } from "@/types/admin-manual-booking";

export function AdminManualBookingSummary({
  customer,
  service,
  branch,
  eligible,
  draft,
  quote,
  quoteLoading,
  timezone,
}: {
  customer?: AdminManualBookingCustomerView | null;
  service?: ServiceDetailView | ServiceListItemView;
  branch?: PublicBranch;
  eligible?: EligibleProvidersView;
  draft: AdminManualBookingDraft;
  quote?: AdminManualBookingQuoteView;
  quoteLoading?: boolean;
  timezone?: string;
}) {
  const provider = providerPresentation(draft.providerPreference, eligible);
  const slotStart = quote?.slot?.startsAt ?? startTimeFromSlotId(draft.slotId);
  const slotLabel =
    quote?.slot?.label ??
    (slotStart ? formatAppointmentParts(slotStart, timezone ?? quote?.timezone)?.time : undefined);

  return (
    <aside className="booking-summary admin-manual-booking-summary" aria-labelledby="admin-booking-summary-title">
      <h2 id="admin-booking-summary-title" className="text-card-title">
        خلاصه نوبت
      </h2>
      <dl className="booking-summary">
        {customer ? (
          <div>
            <dt>مشتری</dt>
            <dd>{customer.displayName}</dd>
          </div>
        ) : null}
        {service ? (
          <div>
            <dt>خدمت</dt>
            <dd>{service.name}</dd>
          </div>
        ) : null}
        {branch ? (
          <div>
            <dt>شعبه</dt>
            <dd>{branch.name}</dd>
          </div>
        ) : null}
        {provider ? (
          <div>
            <dt>متخصص</dt>
            <dd>{provider.label}</dd>
          </div>
        ) : null}
        {draft.date ? (
          <div>
            <dt>تاریخ</dt>
            <dd className="ltr-value">{draft.date}</dd>
          </div>
        ) : null}
        {draft.slotId ? (
          <div>
            <dt>ساعت</dt>
            <dd className="ltr-value">{slotLabel ?? draft.slotId}</dd>
          </div>
        ) : null}
        {quote?.durationMinutes ? (
          <div>
            <dt>مدت</dt>
            <dd>{formatDurationMinutes(quote.durationMinutes)}</dd>
          </div>
        ) : null}
        {quote?.finalAmountLabel ? (
          <div>
            <dt>مبلغ نهایی</dt>
            <dd className="ltr-value booking-money">{quote.finalAmountLabel}</dd>
          </div>
        ) : null}
        {quote?.payableNowLabel ? (
          <div>
            <dt>قابل پرداخت</dt>
            <dd className="ltr-value booking-money">{quote.payableNowLabel}</dd>
          </div>
        ) : null}
        {draft.bookingSource ? (
          <div>
            <dt>منبع ثبت</dt>
            <dd>{draft.bookingSource}</dd>
          </div>
        ) : null}
      </dl>
      {quoteLoading ? <p className="ds-help">در حال دریافت استعلام...</p> : null}
      {quote?.policy ? <p className="ds-help">{quote.policy}</p> : null}
    </aside>
  );
}
