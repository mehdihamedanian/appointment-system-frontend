"use client";

import type { ReactNode } from "react";
import type { BookingQuoteView } from "@/types/booking";
import type { PaymentOptionView } from "@/types/payment";

function Row({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div>
      <dt>{term}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export function PaymentPricingSummary({
  quote,
  selected,
}: {
  quote: BookingQuoteView;
  selected?: PaymentOptionView;
}) {
  return (
    <section className="payment-pricing" aria-labelledby="payment-pricing-title">
      <h2 id="payment-pricing-title" className="text-card-title">
        مبلغ‌ها
      </h2>
      <dl className="booking-summary-list">
        {quote.lines.map((line) => (
          <Row key={line.id} term={line.label}>
            <span className="ltr-value booking-money">{line.amountLabel}</span>
          </Row>
        ))}
        {quote.finalAmountLabel ? (
          <Row term="مبلغ کل">
            <strong className="ltr-value booking-money">{quote.finalAmountLabel}</strong>
          </Row>
        ) : null}
        {(selected?.payableNowLabel ?? quote.payableNowLabel) ? (
          <Row term="قابل پرداخت اکنون">
            <strong className="ltr-value booking-money">
              {selected?.payableNowLabel ?? quote.payableNowLabel}
            </strong>
          </Row>
        ) : null}
        {(selected?.remainingAtLocationLabel ?? quote.payableAtLocationLabel) ? (
          <Row term="مانده / پرداخت در محل">
            <strong className="ltr-value booking-money">
              {selected?.remainingAtLocationLabel ?? quote.payableAtLocationLabel}
            </strong>
          </Row>
        ) : null}
        {selected?.refundability ? <Row term="بازپرداخت">{selected.refundability}</Row> : null}
      </dl>
    </section>
  );
}
