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
import { AdminStaffAvatar } from "@/features/admin/staff/admin-staff-avatar";
import type { AdminStaffListItem } from "@/types/admin-staff";

function LifecycleBadge({ item }: { item: AdminStaffListItem }) {
  return (
    <span className="admin-staff-lifecycle" data-lifecycle={item.lifecycle}>
      {item.lifecycleLabel}
    </span>
  );
}

function FlagBadge({ label, active }: { label: string; active: boolean }) {
  return (
    <span className="admin-staff-flag" data-active={active ? "true" : "false"}>
      {label}
    </span>
  );
}

export function AdminStaffListTable({
  items,
  showBranch,
}: {
  items: AdminStaffListItem[];
  showBranch?: boolean;
}) {
  return (
    <div className="admin-staff-table-wrap">
      <Table caption="فهرست کارکنان">
        <TableHeader>
          <TableRow>
            <TableHead scope="col">کارمند</TableHead>
            <TableHead scope="col">سمت</TableHead>
            <TableHead scope="col">تخصص</TableHead>
            {showBranch ? <TableHead scope="col">شعب</TableHead> : null}
            <TableHead scope="col">خدمات</TableHead>
            <TableHead scope="col">وضعیت</TableHead>
            <TableHead scope="col">مشتری / رزرو</TableHead>
            <TableHead scope="col">زمان‌بندی</TableHead>
            <TableHead scope="col">اقدام</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                <div className="admin-staff-row-identity">
                  <AdminStaffAvatar avatar={item.avatar} name={item.name} size="sm" />
                  <div>
                    <Link href={routes.admin.staffDetail(item.reference)}>{item.name}</Link>
                    <div className="text-caption ltr-value">{item.reference}</div>
                  </div>
                </div>
              </TableCell>
              <TableCell>{item.jobTitle ?? "—"}</TableCell>
              <TableCell>{item.specialty ?? "—"}</TableCell>
              {showBranch ? (
                <TableCell>
                  {item.branches.length
                    ? item.branches.map((b) => b.name).join("، ")
                    : "—"}
                </TableCell>
              ) : null}
              <TableCell>
                {item.services.length
                  ? item.services.map((s) => s.name).join("، ")
                  : "—"}
              </TableCell>
              <TableCell>
                <LifecycleBadge item={item} />
              </TableCell>
              <TableCell>
                <div className="admin-staff-flags">
                  <FlagBadge
                    label={item.customerVisible ? "نمایش مشتری" : "مخفی"}
                    active={item.customerVisible}
                  />
                  <FlagBadge
                    label={item.bookable ? "قابل رزرو" : "غیرقابل رزرو"}
                    active={item.bookable}
                  />
                </div>
              </TableCell>
              <TableCell>{item.schedule?.summary ?? item.schedule?.sourceLabel ?? "—"}</TableCell>
              <TableCell>
                <div className="admin-staff-row-actions">
                  <Link href={routes.admin.staffDetail(item.reference)}>جزئیات</Link>
                  {item.allowedActions.edit !== false ? (
                    <Link href={routes.admin.staffEdit(item.reference)}>ویرایش</Link>
                  ) : null}
                  {item.allowedActions.viewCalendar !== false ? (
                    <Link href={routes.admin.staffCalendar(item.reference)}>تقویم</Link>
                  ) : null}
                  {item.resourceHref ? <Link href={item.resourceHref}>منبع</Link> : null}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function AdminStaffListCards({ items }: { items: AdminStaffListItem[] }) {
  return (
    <ul className="admin-staff-cards">
      {items.map((item) => (
        <li key={item.id} className="card admin-staff-card">
          <div className="admin-staff-card__head">
            <div className="admin-staff-row-identity">
              <AdminStaffAvatar avatar={item.avatar} name={item.name} />
              <div>
                <Link href={routes.admin.staffDetail(item.reference)}>{item.name}</Link>
                <div className="text-caption">{item.jobTitle ?? "—"}</div>
              </div>
            </div>
            <LifecycleBadge item={item} />
          </div>
          <p className="text-caption">{item.specialty ?? "بدون تخصص"}</p>
          <div className="admin-staff-flags">
            <FlagBadge
              label={item.customerVisible ? "نمایش مشتری" : "مخفی"}
              active={item.customerVisible}
            />
            <FlagBadge
              label={item.bookable ? "قابل رزرو" : "غیرقابل رزرو"}
              active={item.bookable}
            />
          </div>
          <div className="admin-staff-row-actions">
            <Link href={routes.admin.staffDetail(item.reference)}>جزئیات</Link>
            {item.allowedActions.edit !== false ? (
              <Link href={routes.admin.staffEdit(item.reference)}>ویرایش</Link>
            ) : null}
            {item.allowedActions.viewCalendar !== false ? (
              <Link href={routes.admin.staffCalendar(item.reference)}>تقویم</Link>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
