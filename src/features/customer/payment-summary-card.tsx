import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, StatusBadge } from "@/components/ui/data-display";
import type { PaymentSummaryView } from "@/types/customer";

export function PaymentSummaryCard({ summary }: { summary: PaymentSummaryView }) {
  return (
    <section aria-labelledby="payment-summary-title">
      <Card>
        <h2 id="payment-summary-title" className="text-card-title">
          پرداخت
        </h2>
        {summary.status ? <StatusBadge status={summary.status} /> : null}
        {summary.amountLabel ? <p className="ltr-value">{summary.amountLabel}</p> : null}
        {summary.refundStatus ? (
          <p>
            بازپرداخت: <StatusBadge status={summary.refundStatus} />
          </p>
        ) : null}
        {summary.continueHref ? (
          <Button asChild>
            <Link href={summary.continueHref}>ادامه پرداخت</Link>
          </Button>
        ) : null}
      </Card>
    </section>
  );
}
