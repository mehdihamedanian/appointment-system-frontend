import { cx } from "@/lib/utilities/cx";
import type { ReactNode } from "react";

export type BreadcrumbItem = {
  href?: string;
  label: string;
};

export function Breadcrumb({
  items,
  className,
}: {
  items: BreadcrumbItem[];
  className?: string;
}) {
  return (
    <nav aria-label="مسیر صفحه" className={className}>
      <ol className="ds-breadcrumb">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`}>
              {last || !item.href ? (
                <span aria-current={last ? "page" : undefined}>{item.label}</span>
              ) : (
                <a href={item.href}>{item.label}</a>
              )}
              {last ? null : <span aria-hidden="true">/</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function PageHeader({
  title,
  description,
  breadcrumb,
  primaryAction,
  secondaryActions,
  className,
}: {
  title: string;
  description?: string;
  breadcrumb?: ReactNode;
  primaryAction?: ReactNode;
  secondaryActions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cx("ds-page-header", className)}>
      <div className="ds-stack" style={{ gap: "var(--space-2)", minWidth: 0 }}>
        {breadcrumb}
        <h1 className="text-page-title">{title}</h1>
        {description ? <p className="text-body-sm">{description}</p> : null}
      </div>
      <div className="ds-inline">
        {secondaryActions}
        {primaryAction}
      </div>
    </header>
  );
}
