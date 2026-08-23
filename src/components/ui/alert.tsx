"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";
import { IconButton } from "@/components/ui/icon-button";
import { cx } from "@/lib/utilities/cx";

export function Alert({
  tone = "info",
  title,
  description,
  action,
  dismissible,
  onDismiss,
}: {
  tone?: "info" | "success" | "warning" | "error";
  title: string;
  description?: string;
  action?: ReactNode;
  dismissible?: boolean;
  onDismiss?: () => void;
}) {
  return (
    <div
      className={cx("ds-alert", `ds-alert--${tone}`)}
      role={tone === "error" ? "alert" : "status"}
    >
      <div>
        <strong>{title}</strong>
        {description ? <p className="ds-help">{description}</p> : null}
        {action}
      </div>
      {dismissible ? (
        <IconButton label="بستن هشدار" onClick={onDismiss}>
          <X size={16} />
        </IconButton>
      ) : null}
    </div>
  );
}

export function Progress({
  value,
  label,
}: {
  value: number;
  label: string;
}) {
  const bounded = Math.max(0, Math.min(100, value));
  return (
    <div>
      <div className="ds-progress" role="progressbar" aria-valuenow={bounded} aria-label={label}>
        <div className="ds-progress__bar" style={{ width: `${bounded}%` }} />
      </div>
    </div>
  );
}

export function Spinner({ label = "در حال بارگذاری" }: { label?: string }) {
  return (
    <span role="status" aria-label={label} className="ds-inline">
      <span className="spinner" aria-hidden="true" />
      <span className="visually-hidden">{label}</span>
    </span>
  );
}
