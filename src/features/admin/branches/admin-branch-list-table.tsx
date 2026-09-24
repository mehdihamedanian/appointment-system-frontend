"use client";

import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AdminBranchListItem } from "@/types/admin-branch";

function LifecycleBadge({ item }: { item: AdminBranchListItem }) {
  return (
    <span className="admin-branch-lifecycle" data-lifecycle={item.lifecycle}>
      {item.lifecycleLabel}
    </span>
  );
}

export function AdminBranchListTable({ items }: { items: AdminBranchListItem[] }) {
  return (
    <div className="admin-branch-table-wrap">
      <Table caption="فهرست شعب">
        <TableHeader>
          <TableRow>
            <TableHead scope="col">نام</TableHead>
            <TableHead scope="col">آدرس</TableHead>
            <TableHead scope="col">تماس</TableHead>
            <TableHead scope="col">وضعیت</TableHead>
            <TableHead scope="col">ساعات</TableHead>
            <TableHead scope="col">کارکنان</TableHead>
            <TableHead scope="col">منابع</TableHead>
            <TableHead scope="col">خدمات</TableHead>
            <TableHead scope="col">اقدام</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                <Link href={item.detailHref}>{item.name}</Link>
                {item.publicTitle && item.publicTitle !== item.name ? (
                  <div className="text-caption">{item.publicTitle}</div>
                ) : null}
                <div className="text-caption ltr-value">{item.reference}</div>
              </TableCell>
              <TableCell>{item.address ?? "—"}</TableCell>
              <TableCell className="ltr-value">{item.phone ?? "—"}</TableCell>
              <TableCell>
                <LifecycleBadge item={item} />
              </TableCell>
              <TableCell>{item.schedule?.workingHoursLabel ?? item.schedule?.summary ?? "—"}</TableCell>
              <TableCell className="ltr-value">{item.staffCount ?? "—"}</TableCell>
              <TableCell className="ltr-value">{item.resourceCount ?? "—"}</TableCell>
              <TableCell className="ltr-value">{item.serviceCount ?? "—"}</TableCell>
              <TableCell>
                <div className="admin-branch-row-actions">
                  <Link href={item.detailHref}>جزئیات</Link>
                  <Link href={item.editHref}>ویرایش</Link>
                  {item.scheduleHref ? <Link href={item.scheduleHref}>زمان‌بندی</Link> : null}
                  {item.calendarHref ? <Link href={item.calendarHref}>تقویم</Link> : null}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function AdminBranchListCards({ items }: { items: AdminBranchListItem[] }) {
  return (
    <ul className="admin-branch-cards" aria-label="شعب">
      {items.map((item) => (
        <li key={item.id}>
          <article className="admin-branch-card ds-card">
            <div className="admin-branch-card__head">
              <h3>
                <Link href={item.detailHref}>{item.name}</Link>
              </h3>
              <LifecycleBadge item={item} />
            </div>
            {item.address ? <p>{item.address}</p> : null}
            {item.phone ? <p className="ltr-value">{item.phone}</p> : null}
            {item.schedule?.summary ? <p className="text-caption">{item.schedule.summary}</p> : null}
            <div className="admin-branch-row-actions">
              <Link href={item.detailHref}>جزئیات</Link>
              <Link href={item.editHref}>ویرایش</Link>
            </div>
          </article>
        </li>
      ))}
    </ul>
  );
}
