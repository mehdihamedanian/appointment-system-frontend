"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/data-display";
import { ReferenceCopy } from "@/components/ui/reference-copy";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PaymentReceiptAction } from "@/features/customer/payment-receipt-action";
import { routes } from "@/constants/routes";
import type { PaymentHistoryItemView } from "@/types/payment-history";
import { PAYMENT_HISTORY_DETAIL_ENABLED } from "@/types/payment-history";

export function PaymentHistoryTable({ items }: { items: PaymentHistoryItemView[] }) {
  return (
    <Table caption="فهرست پرداخت‌های مشتری">
      <TableHeader>
        <TableRow>
          <TableHead scope="col">مبلغ</TableHead>
          <TableHead scope="col">وضعیت</TableHead>
          <TableHead scope="col">زمان</TableHead>
          <TableHead scope="col">مراجع</TableHead>
          <TableHead scope="col">نوبت</TableHead>
          <TableHead scope="col">اقدامات</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell>
              <div className="payment-table__amount">{item.amountLabel}</div>
              {item.classificationLabel ? (
                <div className="text-caption">{item.classificationLabel}</div>
              ) : null}
            </TableCell>
            <TableCell>
              <div className="payment-table__badges">
                <StatusBadge status={item.status} />
                {item.refundStatus ? <StatusBadge status={item.refundStatus} /> : null}
              </div>
              {item.refundAmountLabel ? (
                <div className="text-caption">{item.refundAmountLabel}</div>
              ) : null}
            </TableCell>
            <TableCell>
              {item.timestampLabel ? (
                <time dateTime={item.paidAt ?? item.createdAt}>{item.timestampLabel}</time>
              ) : (
                "—"
              )}
            </TableCell>
            <TableCell>
              <div className="payment-table__refs">
                <ReferenceCopy value={item.publicReference} label="رونوشت کد پرداخت" />
                {item.transactionReference ? (
                  <span className="text-caption">
                    تراکنش: <span className="ltr-value">{item.transactionReference}</span>
                  </span>
                ) : null}
                {item.bookingReference ? (
                  <span className="text-caption">
                    رزرو: <span className="ltr-value">{item.bookingReference}</span>
                  </span>
                ) : null}
              </div>
            </TableCell>
            <TableCell>
              {item.appointmentAvailable && item.appointmentId ? (
                <Button asChild variant="ghost" size="sm">
                  <Link href={routes.customer.appointmentDetail(item.appointmentId)}>
                    {item.serviceName ?? "مشاهده نوبت"}
                  </Link>
                </Button>
              ) : item.appointmentId ? (
                <span className="text-caption">نوبت در دسترس نیست</span>
              ) : (
                <span className="text-caption">—</span>
              )}
            </TableCell>
            <TableCell>
              <div className="payment-table__actions">
                {PAYMENT_HISTORY_DETAIL_ENABLED ? (
                  <Button asChild size="sm">
                    <Link href={routes.customer.paymentDetail(item.publicReference)}>جزئیات</Link>
                  </Button>
                ) : null}
                <PaymentReceiptAction
                  paymentReference={item.publicReference}
                  receiptUrl={item.receiptUrl}
                  receiptAvailable={item.receiptAvailable}
                />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
