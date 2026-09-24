"use client";

import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { OfferCountdown } from "@/features/customer/offer-countdown";
import type {
  WaitingListEntryStatus,
  WaitingListOfferStatus,
} from "@/types/waiting-list";
import type { AdminWaitingListListItemView } from "@/types/admin-waiting-list";

function EntryStatusBadge({ status, label }: { status: WaitingListEntryStatus; label: string }) {
  return (
    <span className="admin-wl-entry-status" data-status={status}>
      {label}
    </span>
  );
}

function OfferStatusBadge({ status, label }: { status: WaitingListOfferStatus; label: string }) {
  return (
    <span className="admin-wl-offer-status" data-status={status}>
      {label}
    </span>
  );
}

function OfferCountdownCell({ item }: { item: AdminWaitingListListItemView }) {
  const queryClient = useQueryClient();
  const [fallbackReceivedAt] = useState(() => Date.now());
  if (!item.offerExpiresAt || item.offerStatus !== "pending") return <>—</>;
  return (
    <OfferCountdown
      expiresAt={item.offerExpiresAt}
      serverNow={item.offerServerNow}
      receivedAt={fallbackReceivedAt}
      label="مهلت پیشنهاد"
      onExpired={() => {
        void queryClient.invalidateQueries({ queryKey: ["admin", "waiting-list"] });
      }}
    />
  );
}

function RowActions({ item }: { item: AdminWaitingListListItemView }) {
  return (
    <div className="admin-waiting-list-row-actions">
      {item.canViewDetail ? (
        <Button asChild size="sm">
          <Link href={item.detailHref}>جزئیات</Link>
        </Button>
      ) : null}
      {item.canSendOffer && item.offerHref ? (
        <Button asChild size="sm" variant="secondary">
          <Link href={item.offerHref}>ارسال پیشنهاد</Link>
        </Button>
      ) : null}
    </div>
  );
}

export function AdminWaitingListListTable({ items }: { items: AdminWaitingListListItemView[] }) {
  const showBranch = items.some((item) => Boolean(item.branchName));

  return (
    <div className="admin-waiting-list-list-desktop admin-waiting-list-table-wrap">
      <Table caption="فهرست درخواست‌های لیست انتظار">
        <TableHeader>
          <TableRow>
            <TableHead scope="col">مشتری</TableHead>
            <TableHead scope="col">خدمت</TableHead>
            <TableHead scope="col">ارائه‌دهنده</TableHead>
            {showBranch ? <TableHead scope="col">شعبه</TableHead> : null}
            <TableHead scope="col">ترجیح تاریخ</TableHead>
            <TableHead scope="col">ترجیح ساعت</TableHead>
            <TableHead scope="col">وضعیت درخواست</TableHead>
            <TableHead scope="col">وضعیت پیشنهاد</TableHead>
            <TableHead scope="col">مهلت پیشنهاد</TableHead>
            <TableHead scope="col">ثبت</TableHead>
            <TableHead scope="col">اقدامات</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.reference}>
              <TableCell>
                {item.customer.href ? (
                  <Link href={item.customer.href}>{item.customer.displayName}</Link>
                ) : (
                  item.customer.displayName
                )}
              </TableCell>
              <TableCell>{item.serviceName}</TableCell>
              <TableCell>{item.providerLabel ?? "—"}</TableCell>
              {showBranch ? <TableCell>{item.branchName ?? "—"}</TableCell> : null}
              <TableCell>{item.datePreferenceLabel ?? "—"}</TableCell>
              <TableCell>{item.timePreferenceLabel ?? "—"}</TableCell>
              <TableCell>
                <EntryStatusBadge status={item.entryStatus} label={item.entryStatusLabel} />
              </TableCell>
              <TableCell>
                {item.offerStatus && item.offerStatusLabel ? (
                  <OfferStatusBadge status={item.offerStatus} label={item.offerStatusLabel} />
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell>
                <OfferCountdownCell item={item} />
              </TableCell>
              <TableCell>{item.createdAtLabel ?? "—"}</TableCell>
              <TableCell>
                <RowActions item={item} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function AdminWaitingListListCards({ items }: { items: AdminWaitingListListItemView[] }) {
  return (
    <ul className="admin-waiting-list-list-mobile admin-waiting-list-cards">
      {items.map((item) => (
        <li key={item.reference} className="admin-waiting-list-card">
          <div className="admin-waiting-list-card__head">
            <EntryStatusBadge status={item.entryStatus} label={item.entryStatusLabel} />
            {item.offerStatus && item.offerStatusLabel ? (
              <OfferStatusBadge status={item.offerStatus} label={item.offerStatusLabel} />
            ) : null}
          </div>
          <p className="admin-waiting-list-card__title">
            {item.customer.href ? (
              <Link href={item.customer.href}>{item.customer.displayName}</Link>
            ) : (
              item.customer.displayName
            )}
            {" · "}
            {item.serviceName}
          </p>
          <dl className="admin-waiting-list-card__meta">
            <div>
              <dt>ترجیح</dt>
              <dd>
                {item.datePreferenceLabel ?? "—"}
                {item.timePreferenceLabel ? ` · ${item.timePreferenceLabel}` : ""}
              </dd>
            </div>
            {item.offerExpiresAt && item.offerStatus === "pending" ? (
              <div>
                <dt>مهلت پیشنهاد</dt>
                <dd>
                  <OfferCountdownCell item={item} />
                </dd>
              </div>
            ) : null}
            <div>
              <dt>ثبت</dt>
              <dd>{item.createdAtLabel ?? "—"}</dd>
            </div>
          </dl>
          <RowActions item={item} />
        </li>
      ))}
    </ul>
  );
}
