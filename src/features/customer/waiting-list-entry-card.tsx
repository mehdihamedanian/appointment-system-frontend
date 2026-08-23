"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/data-display";
import { Button } from "@/components/ui/button";
import { routes } from "@/constants/routes";
import type { WaitingListEntryView } from "@/types/waiting-list";

function providerLabel(entry: WaitingListEntryView): string | undefined {
  if (!entry.provider) return undefined;
  if (entry.provider.name) {
    return entry.provider.title
      ? `${entry.provider.name} — ${entry.provider.title}`
      : entry.provider.name;
  }
  if (entry.provider.preference.type === "any") return "فرقی ندارد";
  if (entry.provider.preference.type === "automatic") {
    return "متخصص توسط مجموعه تعیین می‌شود";
  }
  return undefined;
}

export function WaitingListEntryCard({ entry }: { entry: WaitingListEntryView }) {
  const titleId = `waiting-list-${entry.id}-title`;
  const provider = providerLabel(entry);

  return (
    <article className="waiting-list-card" aria-labelledby={titleId} data-status={entry.status}>
      <div className="waiting-list-card__status">
        <Badge tone={entry.status === "offered" ? "warning" : entry.status === "active" ? "primary" : "neutral"}>
          {entry.statusLabel}
        </Badge>
        {entry.activeOffer ? (
          <Badge tone="information">پیشنهاد فعال</Badge>
        ) : null}
      </div>
      <h3 id={titleId} className="waiting-list-card__title">
        {entry.service.name}
      </h3>
      <p className="text-caption">
        این یک درخواست لیست انتظار است و نوبت قطعی نیست.
      </p>
      {provider ? <p>{provider}</p> : null}
      {entry.branch ? <p>{entry.branch.name}</p> : null}
      {entry.datePreferenceLabel ? <p>{entry.datePreferenceLabel}</p> : null}
      {entry.timePreferenceLabel ? <p>{entry.timePreferenceLabel}</p> : null}
      {entry.createdLabel ? (
        <p className="text-caption">
          ثبت: <time dateTime={entry.createdAt}>{entry.createdLabel}</time>
        </p>
      ) : null}
      <p className="text-caption">
        کد: <span className="ltr-value">{entry.publicReference}</span>
      </p>
      <div className="waiting-list-card__actions">
        <Button asChild>
          <Link href={routes.customer.waitingListEntry(entry.publicReference)}>جزئیات</Link>
        </Button>
        {entry.canViewOffer && entry.activeOffer ? (
          <Button asChild variant="secondary">
            <Link href={routes.customer.waitingListOffer(entry.activeOffer.publicReference)}>
              مشاهده پیشنهاد
            </Link>
          </Button>
        ) : null}
      </div>
    </article>
  );
}
