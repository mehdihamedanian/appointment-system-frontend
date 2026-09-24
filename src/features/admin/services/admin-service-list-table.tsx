"use client";

import Link from "next/link";
import { ServiceMedia } from "@/features/services/service-media";
import { formatDurationMinutes } from "@/lib/date-time/format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AdminServiceListItem } from "@/types/admin-service";

function LifecycleBadge({ item }: { item: AdminServiceListItem }) {
  return (
    <span className="admin-service-lifecycle" data-lifecycle={item.lifecycle}>
      {item.lifecycleLabel}
    </span>
  );
}

export function AdminServiceListTable({
  items,
  showBranch,
}: {
  items: AdminServiceListItem[];
  showBranch?: boolean;
}) {
  return (
    <div className="admin-service-table-wrap">
      <Table caption="فهرست خدمات">
        <TableHeader>
          <TableRow>
            <TableHead scope="col">خدمت</TableHead>
            <TableHead scope="col">مدت</TableHead>
            <TableHead scope="col">قیمت</TableHead>
            <TableHead scope="col">بیعانه</TableHead>
            <TableHead scope="col">ظرفیت</TableHead>
            {showBranch ? <TableHead scope="col">شعب</TableHead> : null}
            <TableHead scope="col">Provider</TableHead>
            <TableHead scope="col">منابع</TableHead>
            <TableHead scope="col">وضعیت</TableHead>
            <TableHead scope="col">ترتیب</TableHead>
            <TableHead scope="col">اقدام</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                <div className="admin-service-row-identity">
                  <ServiceMedia
                    src={item.image?.imageUrl}
                    alt={item.image?.alt ?? item.name}
                    className="admin-service-row-media"
                  />
                  <div>
                    <Link href={item.detailHref}>{item.name}</Link>
                    <div className="text-caption ltr-value">{item.reference}</div>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                {item.durationMinutes ? formatDurationMinutes(item.durationMinutes) : "—"}
              </TableCell>
              <TableCell>{item.pricing.priceLabel}</TableCell>
              <TableCell>{item.pricing.depositLabel ?? "—"}</TableCell>
              <TableCell>{item.capacity ?? "—"}</TableCell>
              {showBranch ? (
                <TableCell>
                  {item.branches.length ? item.branches.map((b) => b.name).join("، ") : "—"}
                </TableCell>
              ) : null}
              <TableCell>{item.providerCount ?? "—"}</TableCell>
              <TableCell>
                {item.requirementSummary?.length ? (
                  <span className="text-caption">{item.requirementSummary[0]}</span>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell>
                <LifecycleBadge item={item} />
              </TableCell>
              <TableCell>{item.sortOrder ?? "—"}</TableCell>
              <TableCell>
                <div className="admin-service-row-actions">
                  <Link href={item.detailHref}>جزئیات</Link>
                  {item.allowedActions.edit !== false ? (
                    <Link href={item.editHref}>ویرایش</Link>
                  ) : null}
                  <Link href={item.resourcesHref}>منابع</Link>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function AdminServiceListCards({ items }: { items: AdminServiceListItem[] }) {
  return (
    <ul className="admin-service-cards">
      {items.map((item) => (
        <li key={item.id} className="admin-service-card card">
          <ServiceMedia src={item.image?.imageUrl} alt={item.image?.alt ?? item.name} />
          <div className="admin-service-card__body">
            <Link href={item.detailHref} className="text-card-title">
              {item.name}
            </Link>
            <p className="text-caption">
              {item.durationMinutes ? formatDurationMinutes(item.durationMinutes) : "—"} ·{" "}
              {item.pricing.priceLabel}
            </p>
            <LifecycleBadge item={item} />
            <div className="admin-service-row-actions">
              <Link href={item.editHref}>ویرایش</Link>
              <Link href={item.resourcesHref}>منابع</Link>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
