"use client";

import { cx } from "@/lib/utilities/cx";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Tooltip } from "@/components/ui/tooltip";

type IconButtonVariant = "ghost" | "primary" | "secondary";
type IconButtonSize = "sm" | "md" | "lg";

export type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  children: ReactNode;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  loading?: boolean;
  tooltip?: string;
};

export function IconButton({
  label,
  className,
  children,
  type = "button",
  variant = "ghost",
  size = "md",
  loading = false,
  tooltip,
  disabled,
  ...props
}: IconButtonProps) {
  const button = (
    <button
      type={type}
      className={cx(
        "icon-btn",
        variant !== "ghost" && `icon-btn--${variant}`,
        size !== "md" && `icon-btn--${size}`,
        className,
      )}
      aria-label={label}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <span className="spinner" aria-hidden="true" /> : children}
    </button>
  );

  if (!tooltip) {
    return button;
  }

  return <Tooltip label={tooltip}>{button}</Tooltip>;
}
