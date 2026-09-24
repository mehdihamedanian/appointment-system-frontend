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
import type { AdminNotificationTemplateListItemView } from "@/types/admin-notification";

function TemplateStatusBadges({ item }: { item: AdminNotificationTemplateListItemView }) {
  return (
    <div className="admin-notification-status-badges">
      <Badge tone={item.enabled ? "success" : "neutral"}>
        {item.enabled ? "فعال" : "غیرفعال"}
      </Badge>
      {item.required ? <Badge tone="warning">الزامی</Badge> : null}
      {item.system ? <Badge tone="neutral">سیستمی</Badge> : null}
    </div>
  );
}

function RowActions({ item }: { item: AdminNotificationTemplateListItemView }) {
  return (
    <div className="admin-notification-row-actions">
      {item.canViewDetail ? (
        <Button asChild size="sm">
          <Link href={item.detailHref}>ویرایش</Link>
        </Button>
      ) : null}
    </div>
  );
}

export function AdminNotificationTemplateListTable({
  items,
}: {
  items: AdminNotificationTemplateListItemView[];
}) {
  const showBranch = items.some((item) => Boolean(item.branchName));

  return (
    <>
      <div className="admin-notification-list-desktop admin-notification-table-wrap">
        <Table caption="فهرست قالب‌های اعلان">
          <TableHeader>
            <TableRow>
              <TableHead scope="col">رویداد</TableHead>
              <TableHead scope="col">کانال</TableHead>
              <TableHead scope="col">زبان</TableHead>
              {showBranch ? <TableHead scope="col">شعبه</TableHead> : null}
              <TableHead scope="col">وضعیت</TableHead>
              <TableHead scope="col">به‌روزرسانی</TableHead>
              <TableHead scope="col">عملیات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.reference}>
                <TableCell>{item.eventTypeLabel}</TableCell>
                <TableCell>{item.channelLabel}</TableCell>
                <TableCell>{item.languageLabel}</TableCell>
                {showBranch ? <TableCell>{item.branchName ?? "—"}</TableCell> : null}
                <TableCell>
                  <TemplateStatusBadges item={item} />
                </TableCell>
                <TableCell>{item.updatedAtLabel ?? "—"}</TableCell>
                <TableCell>
                  <RowActions item={item} />
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
              <TemplateStatusBadges item={item} />
            </div>
            <dl className="admin-notification-card__meta">
              <div>
                <dt>کانال</dt>
                <dd>{item.channelLabel}</dd>
              </div>
              <div>
                <dt>زبان</dt>
                <dd>{item.languageLabel}</dd>
              </div>
              {item.branchName ? (
                <div>
                  <dt>شعبه</dt>
                  <dd>{item.branchName}</dd>
                </div>
              ) : null}
              {item.updatedAtLabel ? (
                <div>
                  <dt>به‌روزرسانی</dt>
                  <dd>{item.updatedAtLabel}</dd>
                </div>
              ) : null}
            </dl>
            <RowActions item={item} />
          </li>
        ))}
      </ul>
    </>
  );
}
