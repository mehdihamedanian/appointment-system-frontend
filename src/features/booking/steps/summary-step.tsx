"use client";

import type { ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/selection";
import { ApiErrorState } from "@/components/feedback/app-states";
import { InlineLoading, Skeleton } from "@/components/feedback/loading-states";
import { PublicImage } from "@/features/public/public-image";
import { formatAppointmentParts, formatDurationMinutes } from "@/lib/date-time/format";
import { formatAdditionalAnswer, providerPresentation, weekdayAndDateLabel } from "@/lib/booking/summary-display";
import { isQuoteExpired, PAYMENT_MODE_COPY } from "@/lib/booking/quote";
import type { AppApiError } from "@/types/api";
import type {
  AdditionalFieldDefinition,
  BookingDraft,
  BookingQuoteView,
  BookingStepId,
} from "@/types/booking";
import type { PublicBranch } from "@/types/public";
import type { ServiceDetailView } from "@/types/service";
import type { EligibleProvidersView } from "@/types/provider";

const EDIT_LABELS: Record<BookingStepId, string> = {
  service: "ویرایش خدمت",
  branch: "ویرایش شعبه",
  provider: "ویرایش متخصص",
  date: "ویرایش تاریخ نوبت",
  time: "ویرایش زمان نوبت",
  details: "ویرایش اطلاعات تکمیلی",
  summary: "ویرایش خلاصه",
  checkout: "ویرایش تأیید",
};

function EditButton({ step, onEdit }: { step: BookingStepId; onEdit: (step: BookingStepId) => void }) {
  return (
    <Button variant="link" size="sm" onClick={() => onEdit(step)}>
      {EDIT_LABELS[step]}
    </Button>
  );
}

function SummaryRow({
  term,
  children,
}: {
  term: string;
  children: ReactNode;
}) {
  return (
    <div>
      <dt>{term}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export function SummaryStep({
  draft,
  service,
  branch,
  eligible,
  fields,
  quote,
  quoteLoading,
  quoteRefreshing,
  quoteError,
  quoteReviewed,
  quoteReceivedAt,
  policyAccepted,
  onPolicyAccepted,
  onEdit,
  onRetryQuote,
  timezone,
  now,
}: {
  draft: BookingDraft;
  service?: ServiceDetailView;
  branch?: PublicBranch;
  eligible?: EligibleProvidersView;
  fields: AdditionalFieldDefinition[];
  quote?: BookingQuoteView;
  quoteLoading?: boolean;
  quoteRefreshing?: boolean;
  quoteError?: AppApiError;
  quoteReviewed: boolean;
  quoteReceivedAt: number;
  policyAccepted: boolean;
  onPolicyAccepted: (accepted: boolean) => void;
  onEdit: (step: BookingStepId) => void;
  onRetryQuote?: () => void;
  timezone?: string;
  now?: number;
}) {
  if (quoteLoading) {
    return (
      <div className="booking-summary" aria-busy="true" aria-label="در حال بارگذاری استعلام رزرو">
        <Skeleton variant="card" />
        <Skeleton variant="card" />
        <Skeleton variant="line" />
      </div>
    );
  }

  if (quoteError) {
    return (
      <ApiErrorState
        title="استعلام رزرو دریافت نشد"
        description={quoteError.message}
        requestId={quoteError.requestId}
        onRetry={onRetryQuote}
      />
    );
  }

  const expired = quote ? isQuoteExpired(quote, quoteReceivedAt, now ?? quoteReceivedAt) : false;
  const provider = providerPresentation(draft.providerPreference, eligible);
  const serviceName = quote?.service?.name ?? service?.name ?? draft.serviceId;
  const duration = quote?.durationMinutes ?? quote?.service?.durationMinutes ?? service?.durationMinutes;
  const branchName = quote?.branch?.name ?? branch?.name;
  const branchAddress = quote?.branch?.address ?? branch?.address;
  const tz = quote?.timezone ?? timezone;
  const slotParts = quote?.slot?.startsAt ? formatAppointmentParts(quote.slot.startsAt, tz) : null;
  const dateParts = draft.date ? weekdayAndDateLabel(draft.date, tz) : null;
  const timeLabel = quote?.slot?.label ?? slotParts?.time;
  const policy = quote?.policySnapshot;
  const consentRequired = policy?.consentRequired === true;
  const paymentCopy = PAYMENT_MODE_COPY[quote?.paymentMode ?? "unknown"];
  const answers = fields
    .map((field) => {
      const text = formatAdditionalAnswer(field, draft.additionalData[field.id]);
      return text ? { id: field.id, label: field.label, text } : null;
    })
    .filter((item): item is { id: string; label: string; text: string } => Boolean(item));

  return (
    <div className="booking-summary">
      <div className="booking-summary__main">
        {quote?.changed && !quoteReviewed ? (
          <div role="alert">
            <Alert
              tone="warning"
              title="مبلغ یا شرایط رزرو به‌روزرسانی شد."
              description="ادامه خودکار انجام نمی‌شود. لطفاً مقادیر جدید را بررسی کنید."
            />
          </div>
        ) : null}
        {quote?.policyChanged ? (
          <Alert tone="warning" title="قوانین رزرو تغییر کرده است. لطفاً دوباره بررسی و تأیید کنید." />
        ) : null}
        {expired ? (
          <Alert
            tone="error"
            title="اعتبار استعلام به پایان رسید."
            description="برای ادامه، استعلام را به‌روزرسانی کنید."
            action={
              onRetryQuote ? (
                <Button variant="secondary" size="sm" onClick={onRetryQuote}>
                  به‌روزرسانی استعلام
                </Button>
              ) : null
            }
          />
        ) : null}
        {!quote?.authoritative ? (
          <Alert
            tone="info"
            title="مبالغ نمایشی قطعی نیست"
            description="قیمت نهایی باید از استعلام سرویس نوبت‌دهی برسد. این صفحه مبلغ را محاسبه نمی‌کند."
          />
        ) : null}
        {quoteRefreshing ? <InlineLoading label="در حال به‌روزرسانی استعلام" /> : null}

        <section className="booking-summary-card" aria-labelledby="booking-summary-service">
          <h3 id="booking-summary-service">خدمت</h3>
          <div className="booking-summary-service">
            {quote?.service?.imageUrl || service?.imageUrl ? (
              <PublicImage
                src={(quote?.service?.imageUrl ?? service?.imageUrl) as string}
                alt=""
                width={72}
                height={72}
              />
            ) : null}
            <dl className="booking-summary-list">
              <SummaryRow term="نام">
                {serviceName}
                <EditButton step="service" onEdit={onEdit} />
              </SummaryRow>
              {quote?.service?.shortDescription || service?.shortDescription ? (
                <SummaryRow term="شرح">{quote?.service?.shortDescription ?? service?.shortDescription}</SummaryRow>
              ) : null}
              {duration ? (
                <SummaryRow term="مدت">{formatDurationMinutes(duration)}</SummaryRow>
              ) : null}
            </dl>
          </div>
        </section>

        {provider ? (
          <section className="booking-summary-card" aria-labelledby="booking-summary-provider">
            <h3 id="booking-summary-provider">متخصص</h3>
            <dl className="booking-summary-list">
              <SummaryRow term="نحوه تخصیص">
                {provider.label}
                {provider.title ? ` — ${provider.title}` : ""}
                {draft.providerPreference.type === "specific" || draft.providerPreference.type === "any" ? (
                  <EditButton step="provider" onEdit={onEdit} />
                ) : null}
              </SummaryRow>
            </dl>
          </section>
        ) : null}

        {branchName ? (
          <section className="booking-summary-card" aria-labelledby="booking-summary-branch">
            <h3 id="booking-summary-branch">شعبه</h3>
            <dl className="booking-summary-list">
              <SummaryRow term="نام">
                {branchName}
                <EditButton step="branch" onEdit={onEdit} />
              </SummaryRow>
              {branchAddress ? <SummaryRow term="نشانی">{branchAddress}</SummaryRow> : null}
            </dl>
          </section>
        ) : null}

        <section className="booking-summary-card" aria-labelledby="booking-summary-when">
          <h3 id="booking-summary-when">زمان نوبت</h3>
          <dl className="booking-summary-list">
            <SummaryRow term="تاریخ">
              {dateParts ? `${dateParts.weekday}، ${dateParts.date}` : <span className="ltr-value">{draft.date}</span>}
              <EditButton step="date" onEdit={onEdit} />
            </SummaryRow>
            <SummaryRow term="ساعت">
              <span className="ltr-value">{timeLabel ?? "اعلام‌شده توسط سرویس"}</span>
              {quote?.slot?.endsAt && !quote.slot.endsAt.includes("T") ? (
                <> تا <span className="ltr-value">{quote.slot.endsAt}</span></>
              ) : null}
              <EditButton step="time" onEdit={onEdit} />
            </SummaryRow>
            {tz ? <SummaryRow term="منطقه زمانی"><span className="ltr-value">{tz}</span></SummaryRow> : null}
          </dl>
        </section>

        {answers.length > 0 ? (
          <section className="booking-summary-card" aria-labelledby="booking-summary-notes">
            <h3 id="booking-summary-notes">اطلاعات تکمیلی</h3>
            <dl className="booking-summary-list">
              {answers.map((answer) => (
                <SummaryRow key={answer.id} term={answer.label}>
                  {answer.text}
                </SummaryRow>
              ))}
              <SummaryRow term="ویرایش">
                <EditButton step="details" onEdit={onEdit} />
              </SummaryRow>
            </dl>
          </section>
        ) : null}

        {policy?.summary || policy?.fullText || quote?.policy ? (
          <section className="booking-summary-card" aria-labelledby="booking-summary-policy">
            <h3 id="booking-summary-policy">قوانین لغو و تغییر نوبت</h3>
            <p>{policy?.summary ?? quote?.policy}</p>
            {policy?.rescheduleSummary ? <p>{policy.rescheduleSummary}</p> : null}
            {policy?.refundability ? <p>{policy.refundability}</p> : null}
            {policy?.fullText && policy.fullText !== policy.summary ? (
              <details>
                <summary>متن کامل قوانین</summary>
                <p>{policy.fullText}</p>
              </details>
            ) : null}
            {consentRequired ? (
              <Checkbox
                name="booking-policy-consent"
                label={policy?.consentLabel ?? "قوانین لغو و تغییر نوبت را می‌پذیرم."}
                checked={policyAccepted}
                onChange={(event) => onPolicyAccepted(event.currentTarget.checked)}
              />
            ) : null}
          </section>
        ) : consentRequired ? (
          <Checkbox
            name="booking-policy-consent"
            label={policy?.consentLabel ?? "قوانین لغو و تغییر نوبت را می‌پذیرم."}
            checked={policyAccepted}
            onChange={(event) => onPolicyAccepted(event.currentTarget.checked)}
          />
        ) : null}
      </div>

      <aside className="booking-summary__pricing" aria-label="هزینه و پرداخت">
        <section className="booking-summary-card">
          <h3>هزینه</h3>
          {quote?.lines.length ? (
            <dl className="booking-summary-list booking-summary-list--money">
              {quote.lines.map((line) => (
                <SummaryRow key={line.id} term={line.label}>
                  <span className={line.kind === "discount" ? "booking-money booking-money--discount ltr-value" : "booking-money ltr-value"}>
                    {line.amountLabel}
                    {line.kind === "discount" ? " تخفیف" : ""}
                  </span>
                </SummaryRow>
              ))}
              {quote.finalAmountLabel ? (
                <SummaryRow term="مبلغ کل">
                  <strong className="booking-money booking-money--total ltr-value">{quote.finalAmountLabel}</strong>
                </SummaryRow>
              ) : null}
              {quote.payableNowLabel && quote.payableNowLabel !== quote.finalAmountLabel ? (
                <SummaryRow term="قابل پرداخت اکنون">
                  <strong className="booking-money booking-money--now ltr-value">{quote.payableNowLabel}</strong>
                </SummaryRow>
              ) : null}
              {quote.depositLabel ? (
                <SummaryRow term="بیعانه">
                  <span className="booking-money ltr-value">{quote.depositLabel}</span>
                </SummaryRow>
              ) : null}
              {quote.payableAtLocationLabel ? (
                <SummaryRow term="مانده / پرداخت در محل">
                  <span className="booking-money ltr-value">{quote.payableAtLocationLabel}</span>
                </SummaryRow>
              ) : null}
            </dl>
          ) : (
            <p className="ds-help">مبلغ از استعلام سرویس نوبت‌دهی می‌آید و در این صفحه جمع زده نمی‌شود.</p>
          )}
          <p>
            <strong>{paymentCopy.title}</strong>
          </p>
          <p className="ds-help">{paymentCopy.description}</p>
          {onRetryQuote ? (
            <Button variant="secondary" onClick={onRetryQuote} disabled={quoteRefreshing}>
              به‌روزرسانی استعلام
            </Button>
          ) : null}
        </section>
      </aside>
    </div>
  );
}

export function canSubmitQuote(
  quote: BookingQuoteView | undefined,
  input: { quoteReviewed: boolean; policyAccepted: boolean; expired: boolean },
): boolean {
  if (!quote?.authoritative || input.expired) {
    return false;
  }
  if (quote.changed && !input.quoteReviewed) {
    return false;
  }
  if (quote.policySnapshot?.consentRequired && !input.policyAccepted) {
    return false;
  }
  if (quote.checkoutPath === "unknown" && quote.paymentMode === "unknown") {
    return false;
  }
  return true;
}
