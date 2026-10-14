"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/data-display";
import { ReferenceCopy } from "@/components/ui/reference-copy";
import { PaymentReceiptAction } from "@/features/customer/payment-receipt-action";
import { routes } from "@/constants/routes";
import type { PaymentHistoryItemView } from "@/types/payment-history";
import { PAYMENT_HISTORY_DETAIL_ENABLED } from "@/types/payment-history";

export function PaymentHistoryCard({ item }: { item: PaymentHistoryItemView }) {
  const headingId = `payment-${item.id}-amount`;
  const showDetail = PAYMENT_HISTORY_DETAIL_ENABLED;
  const showAppointment =
    item.appointmentAvailable && Boolean(item.appointmentId);
  const appointmentUnavailable =
    Boolean(item.appointmentId) && !item.appointmentAvailable;

  return (
    <article className="payment-card" aria-labelledby={headingId}>
      <div className="payment-card__status">
        <StatusBadge status={item.status} />
        {item.refundStatus ? <StatusBadge status={item.refundStatus} /> : null}
      </div>
      <h2 id={headingId} className="payment-card__amount">
        {item.amountLabel}
      </h2>
      {item.timestampLabel ? <p>{item.timestampLabel}</p> : null}
      {item.classificationLabel ? <p className="text-caption">{item.classificationLabel}</p> : null}
      {item.methodLabel ? <p className="text-caption">{item.methodLabel}</p> : null}
      {item.serviceName ? <p>{item.serviceName}</p> : null}
      {item.appointmentWhenLabel ? (
        <p className="text-caption">زمان نوبت: {item.appointmentWhenLabel}</p>
      ) : null}
      {item.refundAmountLabel ? (
        <p className="text-caption">مبلغ بازپرداخت: {item.refundAmountLabel}</p>
      ) : null}
      <div className="payment-card__refs">
        <div className="text-caption">
          کد پرداخت: <ReferenceCopy value={item.publicReference} label="رونوشت کد پرداخت" />
        </div>
        {item.transactionReference ? (
          <div className="text-caption">
            کد تراکنش:{" "}
            <ReferenceCopy value={item.transactionReference} label="رونوشت کد تراکنش" />
          </div>
        ) : null}
        {item.bookingReference ? (
          <p className="text-caption">
            کد رزرو: <span className="ltr-value">{item.bookingReference}</span>
          </p>
        ) : null}
      </div>
      {item.statusHint ? <p className="text-caption">{item.statusHint}</p> : null}
      {appointmentUnavailable ? (
        <p className="text-caption">نوبت مرتبط در دسترس نیست.</p>
      ) : null}
      <div className="payment-card__actions">
        {showDetail ? (
          <Button asChild>
            <Link href={routes.customer.paymentDetail(item.publicReference)}>جزئیات پرداخت</Link>
          </Button>
        ) : null}
        {showAppointment && item.appointmentId ? (
          <Button asChild variant="secondary">
            <Link href={routes.customer.appointmentDetail(item.appointmentId)}>مشاهده نوبت</Link>
          </Button>
        ) : null}
        <PaymentReceiptAction
          paymentReference={item.publicReference}
          receiptUrl={item.receiptUrl}
          receiptAvailable={item.receiptAvailable}
        />
      </div>
    </article>
  );
}
