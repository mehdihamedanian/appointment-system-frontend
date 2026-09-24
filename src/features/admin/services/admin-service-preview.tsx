"use client";

import { Alert } from "@/components/ui/alert";
import { ServiceCard } from "@/features/services/service-card";
import { adminServiceToCustomerPreview } from "@/lib/admin/service-adapter";
import type { AdminServiceDetailView, AdminServiceFormInput } from "@/types/admin-service";

export function AdminServicePreview({
  form,
  detail,
  currency = "IRR",
}: {
  form?: AdminServiceFormInput;
  detail?: AdminServiceDetailView | null;
  currency?: string;
}) {
  const source = form ?? detail;
  if (!source) return null;

  const preview = adminServiceToCustomerPreview(source, currency);

  return (
    <section className="admin-service-preview" aria-labelledby="admin-service-preview-title">
      <h3 id="admin-service-preview-title" className="text-card-title">
        پیش‌نمایش مشتری
      </h3>
      <Alert
        tone="info"
        title="فقط نمایش"
        description="این پیش‌نمایش اطلاعات داخلی (منابع، بافر، کارکنان عملیاتی) را نشان نمی‌دهد. انتشار نهایی با تأیید Backend و وضعیت فعال انجام می‌شود."
      />
      <div className="admin-service-preview__card">
        <ServiceCard service={preview} bookingEnabled={preview.bookingEnabled} showActions={false} />
      </div>
    </section>
  );
}
