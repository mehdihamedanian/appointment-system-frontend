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
import { AdminPaymentReceiptAction } from "@/features/admin/payments/admin-payment-receipt-action";
import type { AdminPaymentListItemView } from "@/types/admin-payment";

function PaymentRowActions({ item }: { item: AdminPaymentListItemView }) {
  return (
    <div className="admin-payment-row-actions">
      {item.canViewDetail ? (
        <Button asChild size="sm">
          <Link href={item.detailHref}>جزئیات</Link>
        </Button>
      ) : null}
      {item.canDownloadReceipt ? (
        <AdminPaymentReceiptAction
          paymentReference={item.publicReference}
          receiptUrl={item.receiptUrl}
          receiptAvailable={item.receiptAvailable}
          size="sm"
        />
      ) : null}
    </div>
  );
}

export function AdminPaymentListTable({ items }: { items: AdminPaymentListItemView[] }) {
  const showBranch = items.some((item) => Boolean(item.branch?.name));

  return (
    <div className="admin-payment-list-desktop admin-payment-table-wrap">
      <Table caption="فهرست پرداخت‌های مدیریت">
        <TableHeader>
          <TableRow>
            <TableHead scope="col">کد پرداخت</TableHead>
            <TableHead scope="col">مشتری</TableHead>
            <TableHead scope="col">نوبت</TableHead>
            <TableHead scope="col">مبلغ</TableHead>
            <TableHead scope="col">روش</TableHead>
            <TableHead scope="col">وضعیت پرداخت</TableHead>
            <TableHead scope="col">بازپرداخت</TableHead>
            <TableHead scope="col">زمان</TableHead>
            {showBranch ? <TableHead scope="col">شعبه</TableHead> : null}
            <TableHead scope="col">اقدامات</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                <div className="admin-payment-refs">
                  <ReferenceCopy value={item.publicReference} label="رونوشت کد پرداخت" />
                  {item.transactionReference ? (
                    <span className="text-caption">
                      تراکنش: <span className="ltr-value">{item.transactionReference}</span>
                    </span>
                  ) : null}
                </div>
              </TableCell>
              <TableCell>
                {item.customer ? (
                  <Link href={item.customer.href}>{item.customer.displayName}</Link>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell>
                {item.appointment ? (
                  <Link href={item.appointment.href}>
                    {item.appointment.serviceName ?? item.appointment.reference}
                  </Link>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell>
                <span className="ltr-value booking-money">{item.amountLabel}</span>
                {item.classificationLabel ? (
                  <div className="text-caption">{item.classificationLabel}</div>
                ) : null}
              </TableCell>
              <TableCell>{item.methodLabel ?? "—"}</TableCell>
              <TableCell>
                <StatusBadge status={item.status} />
              </TableCell>
              <TableCell>
                {item.refundStatus ? (
                  <>
                    <StatusBadge status={item.refundStatus} />
                    {item.refundAmountLabel ? (
                      <div className="text-caption">{item.refundAmountLabel}</div>
                    ) : null}
                  </>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell>{item.timestampLabel ?? "—"}</TableCell>
              {showBranch ? <TableCell>{item.branch?.name ?? "—"}</TableCell> : null}
              <TableCell>
                <PaymentRowActions item={item} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function AdminPaymentListCards({ items }: { items: AdminPaymentListItemView[] }) {
  return (
    <ul className="admin-payment-list-mobile admin-payment-cards">
      {items.map((item) => (
        <li key={item.id} className="admin-payment-card">
          <div className="admin-payment-card__head">
            <div className="admin-payment-card__badges">
              <StatusBadge status={item.status} />
              {item.refundStatus ? <StatusBadge status={item.refundStatus} /> : null}
            </div>
            <p className="admin-payment-card__amount ltr-value booking-money">{item.amountLabel}</p>
          </div>
          <dl className="admin-payment-card__meta">
            <div>
              <dt>کد پرداخت</dt>
              <dd>
                <ReferenceCopy value={item.publicReference} label="رونوشت کد پرداخت" />
              </dd>
            </div>
            {item.customer ? (
              <div>
                <dt>مشتری</dt>
                <dd>
                  <Link href={item.customer.href}>{item.customer.displayName}</Link>
                </dd>
              </div>
            ) : null}
            {item.appointment ? (
              <div>
                <dt>نوبت</dt>
                <dd>
                  <Link href={item.appointment.href}>
                    {item.appointment.serviceName ?? item.appointment.reference}
                  </Link>
                </dd>
              </div>
            ) : null}
            {item.methodLabel ? (
              <div>
                <dt>روش</dt>
                <dd>{item.methodLabel}</dd>
              </div>
            ) : null}
            {item.timestampLabel ? (
              <div>
                <dt>زمان</dt>
                <dd>{item.timestampLabel}</dd>
              </div>
            ) : null}
            {item.branch?.name ? (
              <div>
                <dt>شعبه</dt>
                <dd>{item.branch.name}</dd>
              </div>
            ) : null}
          </dl>
          <PaymentRowActions item={item} />
        </li>
      ))}
    </ul>
  );
}
