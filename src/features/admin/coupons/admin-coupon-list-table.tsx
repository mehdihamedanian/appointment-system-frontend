"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AdminCouponLifecycle, AdminCouponListItemView } from "@/types/admin-coupon";

function CouponLifecycleBadge({ lifecycle, label }: { lifecycle: AdminCouponLifecycle; label: string }) {
  return (
    <span className="admin-coupon-lifecycle" data-lifecycle={lifecycle}>
      {label}
    </span>
  );
}

function CouponRowActions({ item }: { item: AdminCouponListItemView }) {
  return (
    <div className="admin-coupon-row-actions">
      {item.canViewDetail ? (
        <Button asChild size="sm">
          <Link href={item.detailHref}>جزئیات</Link>
        </Button>
      ) : null}
      {item.canEdit ? (
        <Button asChild size="sm" variant="secondary">
          <Link href={item.editHref}>ویرایش</Link>
        </Button>
      ) : null}
    </div>
  );
}

function usageLabel(item: AdminCouponListItemView): string {
  if (item.usageCountLabel && item.usageLimitLabel) {
    return `${item.usageCountLabel} / ${item.usageLimitLabel}`;
  }
  if (item.usageCountLabel) return item.usageCountLabel;
  if (item.usageLimitLabel) return `— / ${item.usageLimitLabel}`;
  return "—";
}

export function AdminCouponListTable({ items }: { items: AdminCouponListItemView[] }) {
  return (
    <div className="admin-coupon-list-desktop admin-coupon-table-wrap">
      <Table caption="فهرست کوپن‌های تخفیف">
        <TableHeader>
          <TableRow>
            <TableHead scope="col">کد</TableHead>
            <TableHead scope="col">عنوان</TableHead>
            <TableHead scope="col">نوع</TableHead>
            <TableHead scope="col">مقدار</TableHead>
            <TableHead scope="col">اعتبار</TableHead>
            <TableHead scope="col">مصرف</TableHead>
            <TableHead scope="col">وضعیت</TableHead>
            <TableHead scope="col">اقدامات</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.reference}>
              <TableCell>
                <span className="ltr-value admin-coupon-code">{item.code}</span>
              </TableCell>
              <TableCell>{item.title}</TableCell>
              <TableCell>{item.discountTypeLabel}</TableCell>
              <TableCell>
                <span className="ltr-value">{item.discountValueLabel}</span>
              </TableCell>
              <TableCell>
                {item.validityLabel ??
                  (item.startsAtLabel && item.endsAtLabel
                    ? `${item.startsAtLabel} – ${item.endsAtLabel}`
                    : "—")}
                {item.timezoneLabel ? (
                  <div className="text-caption">{item.timezoneLabel}</div>
                ) : null}
              </TableCell>
              <TableCell>{usageLabel(item)}</TableCell>
              <TableCell>
                <CouponLifecycleBadge lifecycle={item.lifecycle} label={item.lifecycleLabel} />
              </TableCell>
              <TableCell>
                <CouponRowActions item={item} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function AdminCouponListCards({ items }: { items: AdminCouponListItemView[] }) {
  return (
    <ul className="admin-coupon-list-mobile admin-coupon-cards">
      {items.map((item) => (
        <li key={item.reference} className="admin-coupon-card">
          <div className="admin-coupon-card__head">
            <CouponLifecycleBadge lifecycle={item.lifecycle} label={item.lifecycleLabel} />
            <span className="ltr-value admin-coupon-code">{item.code}</span>
          </div>
          <p className="admin-coupon-card__title">{item.title}</p>
          <dl className="admin-coupon-card__meta">
            <div>
              <dt>نوع</dt>
              <dd>{item.discountTypeLabel}</dd>
            </div>
            <div>
              <dt>مقدار</dt>
              <dd className="ltr-value">{item.discountValueLabel}</dd>
            </div>
            <div>
              <dt>اعتبار</dt>
              <dd>
                {item.validityLabel ??
                  (item.startsAtLabel && item.endsAtLabel
                    ? `${item.startsAtLabel} – ${item.endsAtLabel}`
                    : "—")}
              </dd>
            </div>
            <div>
              <dt>مصرف</dt>
              <dd>{usageLabel(item)}</dd>
            </div>
          </dl>
          <CouponRowActions item={item} />
        </li>
      ))}
    </ul>
  );
}
