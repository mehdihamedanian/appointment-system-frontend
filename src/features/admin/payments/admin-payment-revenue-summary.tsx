"use client";

import { useQuery } from "@tanstack/react-query";
import { InlineLoading } from "@/components/feedback/loading-states";
import { METRIC_UNAVAILABLE_LABEL } from "@/lib/admin/dashboard-format";
import { adminPaymentRevenueSummaryQueryOptions } from "@/lib/api/admin-payments";
import type { AdminPaymentListFilters } from "@/types/admin-payment";

export function AdminPaymentRevenueSummary({
  userId,
  filters,
  enabled,
}: {
  userId: string;
  filters: AdminPaymentListFilters;
  enabled: boolean;
}) {
  const query = useQuery(adminPaymentRevenueSummaryQueryOptions(userId, filters, enabled));

  if (!enabled) {
    return null;
  }

  if (query.isPending) {
    return <InlineLoading label="بارگذاری خلاصه درآمد" />;
  }

  const summary = query.data;
  if (!summary || summary.state === "unavailable") {
    return null;
  }

  if (summary.state === "error") {
    return (
      <section className="admin-payment-revenue" aria-labelledby="admin-payment-revenue-title">
        <h2 id="admin-payment-revenue-title" className="text-card-title">
          خلاصه درآمد
        </h2>
        <p className="text-caption">خلاصه درآمد در حال حاضر در دسترس نیست.</p>
      </section>
    );
  }

  return (
    <section className="admin-payment-revenue" aria-labelledby="admin-payment-revenue-title">
      <h2 id="admin-payment-revenue-title" className="text-card-title">
        خلاصه درآمد
      </h2>
      {summary.periodLabel ? <p className="text-caption">{summary.periodLabel}</p> : null}
      {summary.branchLabel ? <p className="text-caption">{summary.branchLabel}</p> : null}
      <dl className="admin-payment-revenue__grid">
        <div>
          <dt>جمع دریافتی</dt>
          <dd className="ltr-value booking-money">{summary.collectedLabel ?? METRIC_UNAVAILABLE_LABEL}</dd>
        </div>
        <div>
          <dt>در انتظار</dt>
          <dd className="ltr-value booking-money">{summary.pendingLabel ?? METRIC_UNAVAILABLE_LABEL}</dd>
        </div>
        <div>
          <dt>بازپرداخت‌شده</dt>
          <dd className="ltr-value booking-money">{summary.refundedLabel ?? METRIC_UNAVAILABLE_LABEL}</dd>
        </div>
        <div>
          <dt>درآمد خالص</dt>
          <dd className="ltr-value booking-money">{summary.netRevenueLabel ?? METRIC_UNAVAILABLE_LABEL}</dd>
        </div>
        {typeof summary.successfulCount === "number" ? (
          <div>
            <dt>تراکنش موفق</dt>
            <dd>{new Intl.NumberFormat("fa-IR").format(summary.successfulCount)}</dd>
          </div>
        ) : null}
      </dl>
      {summary.methodBreakdown?.length ? (
        <ul className="admin-payment-revenue__methods">
          {summary.methodBreakdown.map((item) => (
            <li key={item.methodLabel}>
              <span>{item.methodLabel}</span>
              <span className="ltr-value booking-money">{item.amountLabel}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
