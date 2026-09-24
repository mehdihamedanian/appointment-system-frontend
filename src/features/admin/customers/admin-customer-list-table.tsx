"use client";

import Link from "next/link";
import { formatAdminCustomerMetric } from "@/lib/admin/customer-adapter";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AdminCustomerListItem } from "@/types/admin-customer";

function LifecycleBadge({ item }: { item: AdminCustomerListItem }) {
  return (
    <span className="admin-customer-lifecycle" data-lifecycle={item.lifecycle}>
      {item.lifecycleLabel}
    </span>
  );
}

function TagList({ tags }: { tags: AdminCustomerListItem["tags"] }) {
  if (tags.length === 0) return <>—</>;
  return (
    <ul className="admin-customer-tag-list" aria-label="برچسب‌ها">
      {tags.map((tag) => (
        <li key={tag.id}>
          <span className="admin-customer-tag" data-color={tag.color ?? "default"}>
            {tag.name}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function AdminCustomerListTable({ items }: { items: AdminCustomerListItem[] }) {
  return (
    <div className="admin-customer-table-wrap">
      <Table caption="فهرست مشتریان">
        <TableHeader>
          <TableRow>
            <TableHead scope="col">نام</TableHead>
            <TableHead scope="col">تماس</TableHead>
            <TableHead scope="col">وضعیت</TableHead>
            <TableHead scope="col">نوبت بعدی</TableHead>
            <TableHead scope="col">آخرین مراجعه</TableHead>
            <TableHead scope="col">مراجعات</TableHead>
            <TableHead scope="col">لغو/عدم حضور</TableHead>
            <TableHead scope="col">برچسب</TableHead>
            <TableHead scope="col">اقدام</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                <Link href={item.detailHref}>{item.displayName}</Link>
                <div className="text-caption ltr-value">{item.reference}</div>
              </TableCell>
              <TableCell>
                {item.contact.phoneMasked || item.contact.emailMasked ? (
                  <div className="ltr-value">
                    {item.contact.phoneMasked ?? "—"}
                    {item.contact.emailMasked ? (
                      <div className="text-caption">{item.contact.emailMasked}</div>
                    ) : null}
                  </div>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell>
                <LifecycleBadge item={item} />
              </TableCell>
              <TableCell>{item.nextAppointmentLabel ?? "—"}</TableCell>
              <TableCell>{item.lastVisitLabel ?? "—"}</TableCell>
              <TableCell className="ltr-value">
                {formatAdminCustomerMetric(item.metrics.totalVisits, item.metrics.unavailable)}
              </TableCell>
              <TableCell className="ltr-value">
                {formatAdminCustomerMetric(item.metrics.cancellationCount, item.metrics.unavailable)}/
                {formatAdminCustomerMetric(item.metrics.noShowCount, item.metrics.unavailable)}
              </TableCell>
              <TableCell>
                <TagList tags={item.tags} />
              </TableCell>
              <TableCell>
                <div className="admin-customer-row-actions">
                  <Link href={item.detailHref}>جزئیات</Link>
                  <Link href={item.editHref}>ویرایش</Link>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function AdminCustomerListCards({ items }: { items: AdminCustomerListItem[] }) {
  return (
    <ul className="admin-customer-cards" aria-label="مشتریان">
      {items.map((item) => (
        <li key={item.id}>
          <article className="admin-customer-card ds-card">
            <div className="admin-customer-card__head">
              <h3>
                <Link href={item.detailHref}>{item.displayName}</Link>
              </h3>
              <LifecycleBadge item={item} />
            </div>
            {item.contact.phoneMasked ? <p className="ltr-value">{item.contact.phoneMasked}</p> : null}
            {item.nextAppointmentLabel ? (
              <p className="text-caption">نوبت بعدی: {item.nextAppointmentLabel}</p>
            ) : null}
            <div className="admin-customer-row-actions">
              <Link href={item.detailHref}>جزئیات</Link>
              <Link href={item.editHref}>ویرایش</Link>
            </div>
          </article>
        </li>
      ))}
    </ul>
  );
}
