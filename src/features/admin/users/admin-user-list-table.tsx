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
import type { AdminUserListItemView } from "@/types/admin-access";

function statusTone(status: AdminUserListItemView["status"]) {
  if (status === "active") return "success" as const;
  if (status === "inactive") return "neutral" as const;
  return "outline" as const;
}

export function AdminUserListTable({ items }: { items: AdminUserListItemView[] }) {
  return (
    <>
      <div className="admin-access-list-desktop admin-access-table-wrap">
        <Table caption="کاربران پنل مدیریت">
          <TableHeader>
            <TableRow>
              <TableHead scope="col">نام</TableHead>
              <TableHead scope="col">تماس</TableHead>
              <TableHead scope="col">نقش</TableHead>
              <TableHead scope="col">پرسنل</TableHead>
              <TableHead scope="col">وضعیت</TableHead>
              <TableHead scope="col">دعوت</TableHead>
              <TableHead scope="col">آخرین ورود</TableHead>
              <TableHead scope="col">عملیات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.reference}>
                <TableCell>
                  <strong>{item.displayName}</strong>
                  {item.createdAtLabel ? (
                    <div className="text-caption">{item.createdAtLabel}</div>
                  ) : null}
                </TableCell>
                <TableCell>
                  <div className="ltr-value">{item.maskedEmail ?? "—"}</div>
                  <div className="ltr-value text-caption">{item.maskedPhone ?? ""}</div>
                </TableCell>
                <TableCell>{item.roleLabel ?? "—"}</TableCell>
                <TableCell>
                  {item.staffHref && item.staffLabel ? (
                    <Link href={item.staffHref} className="ds-link">
                      {item.staffLabel}
                    </Link>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>
                  <Badge tone={statusTone(item.status)}>{item.statusLabel}</Badge>
                </TableCell>
                <TableCell>{item.invitationStatusLabel}</TableCell>
                <TableCell>{item.lastLoginLabel}</TableCell>
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
              <strong>{item.displayName}</strong>
              <Badge tone={statusTone(item.status)}>{item.statusLabel}</Badge>
            </div>
            <dl className="admin-access-card__meta">
              <div>
                <dt>نقش</dt>
                <dd>{item.roleLabel ?? "—"}</dd>
              </div>
              <div>
                <dt>آخرین ورود</dt>
                <dd>{item.lastLoginLabel}</dd>
              </div>
              <div>
                <dt>دعوت</dt>
                <dd>{item.invitationStatusLabel}</dd>
              </div>
            </dl>
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
