"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ApiErrorState, EmptyState } from "@/components/feedback/app-states";
import { InlineLoading } from "@/components/feedback/loading-states";
import { Pagination } from "@/components/ui/pagination";
import {
  AdminAppointmentListCards,
  AdminAppointmentListTable,
} from "@/features/admin/admin-appointment-list-table";
import { adminAppointmentListQueryOptions } from "@/lib/api/admin-appointments";
import { parseAdminAppointmentFilters } from "@/lib/admin/appointment-filters";
import { toAppApiError } from "@/lib/api/errors";
import type { AdminCustomerDetailView } from "@/types/admin-customer";

export function AdminCustomerAppointmentHistory({
  userId,
  view,
}: {
  userId: string;
  view: AdminCustomerDetailView;
}) {
  const [page, setPage] = useState(1);
  const filters = {
    ...parseAdminAppointmentFilters(new URLSearchParams()),
    customerId: view.id,
    page,
  };

  const query = useQuery(adminAppointmentListQueryOptions(userId, filters));

  if (query.isPending) {
    return <InlineLoading label="بارگذاری تاریخچه نوبت" />;
  }

  if (query.isError) {
    return (
      <ApiErrorState
        title="تاریخچه نوبت دریافت نشد"
        description={toAppApiError(query.error).message}
        onRetry={() => void query.refetch()}
      />
    );
  }

  const data = query.data!;
  if (data.items.length === 0) {
    return <EmptyState title="نوبتی ثبت نشده" description="این مشتری هنوز نوبتی ندارد." />;
  }

  return (
    <section aria-labelledby="customer-appt-history-title">
      <h3 id="customer-appt-history-title" className="visually-hidden">
        تاریخچه نوبت
      </h3>
      <div className="admin-customer-list-desktop">
        <AdminAppointmentListTable items={data.items} showBranch />
      </div>
      <div className="admin-customer-list-mobile">
        <AdminAppointmentListCards items={data.items} />
      </div>
      {data.pageCount && data.pageCount > 1 ? (
        <Pagination page={page} pageCount={data.pageCount} onPageChange={setPage} />
      ) : null}
    </section>
  );
}
