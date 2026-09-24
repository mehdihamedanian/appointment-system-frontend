import { cx } from "@/lib/utilities/cx";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/layout/page-header";

/**
 * Reusable admin page chrome — works across Dashboard, Appointments, Calendar,
 * Customers, Resources, and Settings without page-specific hardcoding.
 */
export function AdminPageHeader({
  title,
  description,
  breadcrumb,
  primaryAction,
  secondaryActions,
  status,
  toolbar,
  className,
}: {
  title: string;
  description?: string;
  breadcrumb?: ReactNode;
  primaryAction?: ReactNode;
  secondaryActions?: ReactNode;
  status?: ReactNode;
  toolbar?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("admin-page-header", className)}>
      <PageHeader
        title={title}
        description={description}
        breadcrumb={breadcrumb}
        primaryAction={primaryAction}
        secondaryActions={
          <>
            {status}
            {secondaryActions}
          </>
        }
      />
      {toolbar ? <div className="admin-page-header__toolbar">{toolbar}</div> : null}
    </div>
  );
}
