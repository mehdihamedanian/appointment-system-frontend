"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ApiErrorState, EmptyState } from "@/components/feedback/app-states";
import { InlineLoading } from "@/components/feedback/loading-states";
import { Pagination } from "@/components/ui/pagination";
import { StatusBadge } from "@/components/ui/data-display";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminCustomerPaymentsQueryOptions } from "@/lib/api/admin-customers";
import { adminPaymentDetailHref } from "@/lib/admin/payment-filters";
import { toAppApiError } from "@/lib/api/errors";
import { routes } from "@/constants/routes";
import type { AdminCustomerDetailView } from "@/types/admin-customer";

export function AdminCustomerPaymentHistory({
  userId,
  view,
}: {
  userId: string;
  view: AdminCustomerDetailView;
}) {
  const [page, setPage] = useState(1);
  const query = useQuery(adminCustomerPaymentsQueryOptions(userId, view.reference, page));

  if (query.isPending) {
    return <InlineLoading label="بارگذاری تاریخچه پرداخت" />;
  }

  if (query.isError) {
    return (
      <ApiErrorState
        title="تاریخچه پرداخت دریافت نشد"
        description={toAppApiError(query.error).message}
        onRetry={() => void query.refetch()}
      />
    );
  }

  const data = query.data!;
  if (data.items.length === 0) {
    return (
      <EmptyState
        title="پرداختی ثبت نشده"
        description={data.emptyHistory ? "این مشتری پرداختی ندارد." : "نتیجه‌ای یافت نشد."}
      />
    );
  }

  return (
    <section aria-labelledby="customer-payment-history-title">
      <h3 id="customer-payment-history-title" className="visually-hidden">
        تاریخچه پرداخت
      </h3>
      <div className="admin-customer-table-wrap">
        <Table caption="پرداخت‌های مشتری">
          <TableHeader>
            <TableRow>
              <TableHead scope="col">مبلغ</TableHead>
              <TableHead scope="col">وضعیت پرداخت</TableHead>
              <TableHead scope="col">زمان</TableHead>
              <TableHead scope="col">مراجع</TableHead>
              <TableHead scope="col">نوبت</TableHead>
              <TableHead scope="col">جزئیات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.amountLabel}</TableCell>
                <TableCell>
                  <StatusBadge status={item.status} />
                  {item.refundStatus ? <StatusBadge status={item.refundStatus} /> : null}
                </TableCell>
                <TableCell>{item.timestampLabel ?? "—"}</TableCell>
                <TableCell className="ltr-value">{item.publicReference}</TableCell>
                <TableCell>
                  {item.appointmentId ? (
                    <Link href={routes.admin.appointmentDetail(item.appointmentId)}>
                      {item.serviceName ?? "نوبت"}
                    </Link>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>
                  <Link href={adminPaymentDetailHref(item.publicReference)}>جزئیات</Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {data.pageCount && data.pageCount > 1 ? (
        <Pagination page={page} pageCount={data.pageCount} onPageChange={setPage} />
      ) : null}
    </section>
  );
}
