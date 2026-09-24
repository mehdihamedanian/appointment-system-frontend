"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/data-display";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AdminRoleListItemView } from "@/types/admin-access";

export function AdminRoleListTable({ items }: { items: AdminRoleListItemView[] }) {
  return (
    <>
      <div className="admin-access-list-desktop admin-access-table-wrap">
        <Table caption="نقش‌های پنل مدیریت">
          <TableHeader>
            <TableRow>
              <TableHead scope="col">نام</TableHead>
              <TableHead scope="col">توضیح</TableHead>
              <TableHead scope="col">نوع</TableHead>
              <TableHead scope="col">کاربران</TableHead>
              <TableHead scope="col">عملیات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.reference}>
                <TableCell>
                  <strong>{item.name}</strong>
                </TableCell>
                <TableCell>{item.description ?? "—"}</TableCell>
                <TableCell>
                  {item.system ? (
                    <Badge tone="information">سیستمی</Badge>
                  ) : (
                    <Badge tone="neutral">سفارشی</Badge>
                  )}
                </TableCell>
                <TableCell className="ltr-value">{item.userCountLabel ?? "—"}</TableCell>
                <TableCell>
                  <div className="admin-access-row-actions">
                    {item.canView ? (
                      <Button asChild size="sm" variant="secondary">
                        <Link href={item.detailHref}>جزئیات</Link>
                      </Button>
                    ) : null}
                    {item.canEdit ? (
                      <Button asChild size="sm">
                        <Link href={item.editHref}>ویرایش</Link>
                      </Button>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="admin-access-list-mobile admin-access-cards">
        {items.map((item) => (
          <li key={item.reference} className="admin-access-card">
            <div className="admin-access-card__head">
              <strong>{item.name}</strong>
              {item.system ? <Badge tone="information">سیستمی</Badge> : null}
            </div>
            <p className="text-caption">{item.description ?? "—"}</p>
            <div className="admin-access-row-actions">
              {item.canView ? (
                <Button asChild size="sm" variant="secondary">
                  <Link href={item.detailHref}>جزئیات</Link>
                </Button>
              ) : null}
              {item.canEdit ? (
                <Button asChild size="sm">
                  <Link href={item.editHref}>ویرایش</Link>
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
