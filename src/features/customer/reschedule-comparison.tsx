"use client";

import {
  appointmentProviderLabel,
  financialAdjustmentLabel,
  formatRescheduleWhen,
} from "@/lib/customer/appointment-reschedule-adapter";
import { EXTERNAL_LINK_REL } from "@/lib/public/links";
import type { RescheduleQuoteView } from "@/types/appointment-reschedule";
import type { PolicySnapshot } from "@/types/appointment-detail";

function PolicyBlock({ policy }: { policy: PolicySnapshot }) {
  if (!policy.title && !policy.summary && !policy.deadlineLabel && !policy.feeLabel && !policy.refundLabel) {
    return null;
  }
  return (
    <section className="appointment-reschedule-card" aria-labelledby="reschedule-policy">
      <h2 id="reschedule-policy" className="text-card-title">
        {policy.title ?? "سیاست زمان‌بندی مجدد"}
      </h2>
      {policy.summary ? <p>{policy.summary}</p> : null}
      <dl className="booking-summary-list">
        {policy.deadlineLabel ? (
          <div>
            <dt>مهلت</dt>
            <dd>{policy.deadlineLabel}</dd>
          </div>
        ) : null}
        {policy.feeLabel ? (
          <div>
            <dt>هزینه</dt>
            <dd className="ltr-value">{policy.feeLabel}</dd>
          </div>
        ) : null}
        {policy.refundLabel ? (
          <div>
            <dt>بازپرداخت</dt>
            <dd>{policy.refundLabel}</dd>
          </div>
        ) : null}
      </dl>
      {policy.policyUrl ? (
        <p>
          <a href={policy.policyUrl} target="_blank" rel={EXTERNAL_LINK_REL}>
            مشاهده سیاست کامل
          </a>
        </p>
      ) : null}
    </section>
  );
}

export function RescheduleComparison({ quote }: { quote: RescheduleQuoteView }) {
  const currentWhen = formatRescheduleWhen(
    quote.current.startsAt,
    quote.current.endsAt,
    quote.current.timezone,
  );
  const proposedWhen = formatRescheduleWhen(
    quote.proposed.startsAt,
    quote.proposed.endsAt,
    quote.current.timezone,
  );
  const currentProvider = appointmentProviderLabel(quote.current.provider);
  const proposedProvider = appointmentProviderLabel(quote.proposed.provider ?? quote.current.provider);
  const branchChanged =
    quote.proposed.branchName &&
    quote.proposed.branchName !== quote.current.branchName;
  const providerChanged = proposedProvider !== currentProvider;
  const { financial } = quote;

  return (
    <div className="appointment-reschedule__comparison">
      <section className="appointment-reschedule-card" aria-labelledby="reschedule-compare">
        <h2 id="reschedule-compare" className="text-card-title">
          مقایسه زمان نوبت
        </h2>
        <dl className="booking-summary-list">
          <div>
            <dt>تاریخ فعلی</dt>
            <dd>{currentWhen.date ?? <span className="ltr-value">{quote.current.startsAt}</span>}</dd>
          </div>
          <div>
            <dt>تاریخ جدید</dt>
            <dd>{proposedWhen.date ?? <span className="ltr-value">{quote.proposed.startsAt}</span>}</dd>
          </div>
          <div>
            <dt>ساعت فعلی</dt>
            <dd className="ltr-value">{currentWhen.range ?? currentWhen.time}</dd>
          </div>
          <div>
            <dt>ساعت جدید</dt>
            <dd className="ltr-value">{proposedWhen.range ?? proposedWhen.time ?? quote.proposed.timeLabel}</dd>
          </div>
          {providerChanged ? (
            <>
              <div>
                <dt>متخصص فعلی</dt>
                <dd>{currentProvider ?? "—"}</dd>
              </div>
              <div>
                <dt>متخصص جدید</dt>
                <dd>{proposedProvider ?? "—"}</dd>
              </div>
            </>
          ) : null}
          {branchChanged ? (
            <>
              <div>
                <dt>محل فعلی</dt>
                <dd>{quote.current.branchName ?? "—"}</dd>
              </div>
              <div>
                <dt>محل جدید</dt>
                <dd>{quote.proposed.branchName}</dd>
              </div>
            </>
          ) : null}
        </dl>
      </section>
      {financial.status !== "none" ||
      financial.currentAmountLabel ||
      financial.newAmountLabel ||
      financial.differenceLabel ? (
        <section className="appointment-reschedule-card" aria-labelledby="reschedule-financial">
          <h2 id="reschedule-financial" className="text-card-title">
            تغییرات مالی
          </h2>
          <p>{financialAdjustmentLabel(financial)}</p>
          {financial.note ? <p className="text-caption">{financial.note}</p> : null}
          <dl className="booking-summary-list">
            {financial.currentAmountLabel ? (
              <div>
                <dt>مبلغ فعلی</dt>
                <dd className="ltr-value">{financial.currentAmountLabel}</dd>
              </div>
            ) : null}
            {financial.newAmountLabel ? (
              <div>
                <dt>مبلغ جدید</dt>
                <dd className="ltr-value">{financial.newAmountLabel}</dd>
              </div>
            ) : null}
            {financial.differenceLabel ? (
              <div>
                <dt>تفاوت</dt>
                <dd className="ltr-value">{financial.differenceLabel}</dd>
              </div>
            ) : null}
            {financial.depositLabel ? (
              <div>
                <dt>بیعانه</dt>
                <dd className="ltr-value">{financial.depositLabel}</dd>
              </div>
            ) : null}
            {financial.refundLabel ? (
              <div>
                <dt>بازپرداخت</dt>
                <dd className="ltr-value">{financial.refundLabel}</dd>
              </div>
            ) : null}
          </dl>
        </section>
      ) : null}
      <PolicyBlock policy={quote.policy} />
      {quote.warning ? (
        <p className="text-caption" role="status">
          {quote.warning}
        </p>
      ) : null}
    </div>
  );
}
