import { cx } from "@/lib/utilities/cx";
import type { ReactNode } from "react";
import {
  getStatusPresentation,
  type StatusKey,
} from "@/lib/status/status-map";

type BadgeTone =
  | "neutral"
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "information"
  | "outline";

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return <span className={cx("ds-badge", `ds-badge--${tone}`, className)}>{children}</span>;
}

export function StatusBadge({
  status,
  label,
  withDot = true,
  icon,
}: {
  status: StatusKey;
  label?: string;
  withDot?: boolean;
  icon?: ReactNode;
}) {
  const presentation = getStatusPresentation(status, label);
  return (
    <span className={cx("ds-status", `ds-status--${presentation.tone}`)}>
      {withDot ? <span className="ds-status__dot" aria-hidden="true" /> : null}
      {icon}
      <span>{presentation.label}</span>
    </span>
  );
}

export function Avatar({
  src,
  alt,
  name,
  size = "md",
}: {
  src?: string;
  alt?: string;
  name: string;
  size?: "sm" | "md" | "lg";
}) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("");

  return (
    <span className={cx("ds-avatar", `ds-avatar--${size}`)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt ?? name} onError={(event) => {
          event.currentTarget.style.display = "none";
        }} />
      ) : (
        <span aria-hidden="true">{initials}</span>
      )}
      <span className="visually-hidden">{alt ?? name}</span>
    </span>
  );
}

export function Card({
  title,
  description,
  children,
  footer,
}: {
  title?: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className="ds-card">
      {title ? <h2 className="text-card-title">{title}</h2> : null}
      {description ? <p className="ds-help">{description}</p> : null}
      {children}
      {footer}
    </section>
  );
}

export function StatCard({
  label,
  value,
  icon,
  trend,
  comparison,
  loading,
  trendTone = "neutral",
}: {
  label: string;
  value: string;
  icon?: ReactNode;
  trend?: string;
  comparison?: string;
  loading?: boolean;
  trendTone?: "neutral" | "positive" | "negative";
}) {
  return (
    <article className="ds-card ds-stat">
      <div className="ds-inline">
        {icon}
        <p className="text-caption">{label}</p>
      </div>
      {loading ? (
        <span className="skeleton skeleton--title" />
      ) : (
        <p className="ds-stat__value text-numeric">{value}</p>
      )}
      {trend ? (
        <p className="ds-stat__trend" data-tone={trendTone}>
          {trend}
        </p>
      ) : null}
      {comparison ? <p className="text-caption">{comparison}</p> : null}
    </article>
  );
}

export type TimelineItem = {
  id: string;
  title: string;
  description?: string;
  meta?: string;
  state?: "complete" | "current" | "upcoming" | "error";
  icon?: ReactNode;
};

export function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <ol className="ds-timeline">
      {items.map((item) => (
        <li key={item.id} className="ds-timeline__item" data-state={item.state ?? "upcoming"}>
          <span className="ds-timeline__marker" aria-hidden="true">
            {item.icon}
          </span>
          <div>
            <p>
              {item.title}
              <span className="visually-hidden">
                {item.state === "complete"
                  ? " انجام‌شده"
                  : item.state === "current"
                    ? " جاری"
                    : item.state === "error"
                      ? " خطا"
                      : " آینده"}
              </span>
            </p>
            {item.description ? <p className="ds-help">{item.description}</p> : null}
            {item.meta ? <p className="text-caption ltr-value">{item.meta}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
