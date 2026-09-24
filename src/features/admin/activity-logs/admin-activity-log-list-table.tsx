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
import type {
  AdminActivityLogListItemView,
  AdminActivityLogResult,
} from "@/types/admin-activity-log";

function resultTone(result: AdminActivityLogResult) {
  switch (result) {
    case "success":
      return "success" as const;
    case "failure":
    case "denied":
      return "danger" as const;
    case "partial":
      return "warning" as const;
    default:
      return "neutral" as const;
  }
}

function ResultBadge({
  result,
  label,
}: {
  result: AdminActivityLogResult;
  label: string;
}) {
  return (
    <Badge
      tone={resultTone(result)}
      className="admin-activity-log-result"
      data-result={result}
    >
      {label}
    </Badge>
  );
}

export function AdminActivityLogListTable({
  items,
  showBranch,
}: {
  items: AdminActivityLogListItemView[];
  showBranch: boolean;
}) {
  return (
    <>
      <div className="admin-activity-log-list-desktop admin-activity-log-table-wrap">
        <Table caption="گزارش فعالیت مدیریت">
          <TableHeader>
            <TableRow>
              <TableHead scope="col">زمان</TableHead>
              <TableHead scope="col">عامل</TableHead>
              <TableHead scope="col">اقدام</TableHead>
              <TableHead scope="col">موجودیت</TableHead>
              <TableHead scope="col">خلاصه</TableHead>
              <TableHead scope="col">نتیجه</TableHead>
              {showBranch ? <TableHead scope="col">شعبه</TableHead> : null}
              <TableHead scope="col">عملیات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.reference}>
                <TableCell>
                  <time dateTime={item.occurredAt}>{item.occurredAtLabel}</time>
                  {item.relativeTimeLabel ? (
                    <span className="admin-activity-log-relative text-caption">
                      {" "}
                      ({item.relativeTimeLabel})
                    </span>
                  ) : null}
                </TableCell>
                <TableCell>{item.actorLabel}</TableCell>
                <TableCell>
                  <span>{item.actionLabel}</span>
                </TableCell>
                <TableCell>
                  <div>{item.entityTypeLabel}</div>
                  {item.entityReference ? (
                    <code className="ltr-value text-caption">{item.entityReference}</code>
                  ) : null}
                </TableCell>
                <TableCell>{item.summary}</TableCell>
                <TableCell>
                  <ResultBadge result={item.result} label={item.resultLabel} />
                </TableCell>
                {showBranch ? <TableCell>{item.branchLabel ?? "—"}</TableCell> : null}
                <TableCell>
                  <Button asChild size="sm">
                    <Link href={item.detailHref}>جزئیات</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="admin-activity-log-list-mobile admin-activity-log-cards">
        {items.map((item) => (
          <li key={item.reference} className="admin-activity-log-card">
            <div className="admin-activity-log-card__head">
              <strong>{item.actionLabel}</strong>
              <ResultBadge result={item.result} label={item.resultLabel} />
            </div>
            <dl className="admin-activity-log-card__meta">
              <div>
                <dt>زمان</dt>
                <dd>
                  <time dateTime={item.occurredAt}>{item.occurredAtLabel}</time>
                </dd>
              </div>
              <div>
                <dt>عامل</dt>
                <dd>{item.actorLabel}</dd>
              </div>
              <div>
                <dt>موجودیت</dt>
                <dd>
                  {item.entityTypeLabel}
                  {item.entityReference ? (
                    <>
                      {" "}
                      <code className="ltr-value">{item.entityReference}</code>
                    </>
                  ) : null}
                </dd>
              </div>
              <div>
                <dt>خلاصه</dt>
                <dd>{item.summary}</dd>
              </div>
            </dl>
            <Button asChild size="sm">
              <Link href={item.detailHref}>جزئیات</Link>
            </Button>
          </li>
        ))}
      </ul>
    </>
  );
}
