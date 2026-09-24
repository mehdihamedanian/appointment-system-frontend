"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/data-display";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  AdminNotificationDeliveryStatus,
  AdminNotificationLogListItemView,
} from "@/types/admin-notification";

function deliveryTone(status: AdminNotificationDeliveryStatus) {
  switch (status) {
    case "delivered":
      return "success" as const;
    case "sent":
      return "primary" as const;
    case "queued":
    case "processing":
      return "warning" as const;
    case "failed":
    case "bounced":
    case "rejected":
      return "danger" as const;
    default:
      return "neutral" as const;
  }
}

function DeliveryStatusBadge({
  status,
  label,
}: {
  status: AdminNotificationDeliveryStatus;
  label: string;
}) {
  return (
    <Badge tone={deliveryTone(status)} className="admin-notification-delivery-status" data-status={status}>
      {label}
    </Badge>
  );
}

export function AdminNotificationLogListTable({ items }: { items: AdminNotificationLogListItemView[] }) {
  return (
    <>
      <div className="admin-notification-list-desktop admin-notification-table-wrap">
        <Table caption="گزارش ارسال اعلان‌ها">
          <TableHeader>
            <TableRow>
              <TableHead scope="col">زمان</TableHead>
              <TableHead scope="col">رویداد</TableHead>
              <TableHead scope="col">کانال</TableHead>
              <TableHead scope="col">گیرنده</TableHead>
              <TableHead scope="col">وضعیت</TableHead>
              <TableHead scope="col">قالب</TableHead>
              <TableHead scope="col">عملیات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.reference}>
                <TableCell>{item.sentAtLabel}</TableCell>
                <TableCell>{item.eventTypeLabel}</TableCell>
                <TableCell>{item.channelLabel}</TableCell>
                <TableCell className="ltr-value">{item.maskedRecipient}</TableCell>
                <TableCell>
                  <DeliveryStatusBadge status={item.deliveryStatus} label={item.deliveryStatusLabel} />
                </TableCell>
                <TableCell>{item.templateReference ?? "—"}</TableCell>
                <TableCell>
                  <Button asChild size="sm">
                    <Link href={item.detailHref}>جزئیات</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="admin-notification-list-mobile admin-notification-cards">
        {items.map((item) => (
          <li key={item.reference} className="admin-notification-card">
            <div className="admin-notification-card__head">
              <strong>{item.eventTypeLabel}</strong>
              <DeliveryStatusBadge status={item.deliveryStatus} label={item.deliveryStatusLabel} />
            </div>
            <dl className="admin-notification-card__meta">
              <div>
                <dt>زمان</dt>
                <dd>{item.sentAtLabel}</dd>
              </div>
              <div>
                <dt>کانال</dt>
                <dd>{item.channelLabel}</dd>
              </div>
              <div>
                <dt>گیرنده</dt>
                <dd className="ltr-value">{item.maskedRecipient}</dd>
              </div>
            </dl>
            <Button asChild size="sm">
              <Link href={item.detailHref}>جزئیات</Link>
            </Button>
          </li>
        ))}
      </ul>
    </>
  );
}
