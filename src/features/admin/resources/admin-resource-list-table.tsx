"use client";

import Link from "next/link";
import { routes } from "@/constants/routes";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AdminResourceListItem } from "@/types/admin-resource";

function LifecycleBadge({ item }: { item: AdminResourceListItem }) {
  return (
    <span className="admin-resource-lifecycle" data-lifecycle={item.lifecycle}>
      {item.lifecycleLabel}
    </span>
  );
}

export function AdminResourceListTable({
  items,
  showBranch,
}: {
  items: AdminResourceListItem[];
  showBranch?: boolean;
}) {
  return (
    <div className="admin-resource-table-wrap">
      <Table caption="فهرست منابع عملیاتی">
        <TableHeader>
          <TableRow>
            <TableHead scope="col">نام</TableHead>
            <TableHead scope="col">نوع</TableHead>
            {showBranch ? <TableHead scope="col">شعبه</TableHead> : null}
            <TableHead scope="col">ظرفیت</TableHead>
            <TableHead scope="col">وضعیت</TableHead>
            <TableHead scope="col">زمان‌بندی</TableHead>
            <TableHead scope="col">خدمات</TableHead>
            <TableHead scope="col">اقدام</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                <Link href={routes.admin.resourceDetail(item.reference)}>{item.name}</Link>
                <div className="text-caption ltr-value">{item.reference}</div>
              </TableCell>
              <TableCell>{item.typeLabel}</TableCell>
              {showBranch ? <TableCell>{item.branch?.name ?? "—"}</TableCell> : null}
              <TableCell className="ltr-value">{item.capacity?.label ?? "—"}</TableCell>
              <TableCell>
                <LifecycleBadge item={item} />
              </TableCell>
              <TableCell>{item.schedule?.summary ?? item.schedule?.sourceLabel ?? "—"}</TableCell>
              <TableCell className="ltr-value">
                {typeof item.relatedServiceCount === "number" ? item.relatedServiceCount : "—"}
              </TableCell>
              <TableCell>
                <div className="admin-resource-row-actions">
                  <Link href={routes.admin.resourceDetail(item.reference)}>جزئیات</Link>
                  {item.allowedActions.edit !== false ? (
                    <Link href={routes.admin.resourceEdit(item.reference)}>ویرایش</Link>
                  ) : null}
                  {item.allowedActions.viewCalendar !== false ? (
                    <Link href={routes.admin.resourceCalendar(item.reference)}>تقویم</Link>
                  ) : null}
                  {item.type === "staff" && item.staffHref ? (
                    <Link href={item.staffHref}>پرونده کارکنان</Link>
                  ) : null}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function AdminResourceListCards({ items }: { items: AdminResourceListItem[] }) {
  return (
    <ul className="admin-resource-cards" aria-label="منابع">
      {items.map((item) => (
        <li key={item.id}>
          <article className="admin-resource-card ds-card">
            <div className="admin-resource-card__head">
              <h3>
                <Link href={routes.admin.resourceDetail(item.reference)}>{item.name}</Link>
              </h3>
              <LifecycleBadge item={item} />
            </div>
            <p className="text-caption">
              {item.typeLabel}
              {item.branch?.name ? ` · ${item.branch.name}` : ""}
            </p>
            <p className="text-caption">
              ظرفیت: <span className="ltr-value">{item.capacity?.label ?? "—"}</span>
              {typeof item.relatedServiceCount === "number"
                ? ` · خدمات: ${item.relatedServiceCount}`
                : ""}
            </p>
            {item.schedule?.summary ? <p className="text-caption">{item.schedule.summary}</p> : null}
            <div className="admin-resource-row-actions">
              <Link href={routes.admin.resourceDetail(item.reference)}>جزئیات</Link>
              {item.allowedActions.edit !== false ? (
                <Link href={routes.admin.resourceEdit(item.reference)}>ویرایش</Link>
              ) : null}
              {item.allowedActions.viewCalendar !== false ? (
                <Link href={routes.admin.resourceCalendar(item.reference)}>تقویم</Link>
              ) : null}
            </div>
          </article>
        </li>
      ))}
    </ul>
  );
}
