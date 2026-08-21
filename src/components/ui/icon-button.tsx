"use client";

import { cx } from "@/lib/utilities/cx";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  children: ReactNode;
};

export function IconButton({
  label,
  className,
  children,
  type = "button",
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      className={cx("icon-btn", className)}
      aria-label={label}
      title={label}
      {...props}
    >
      {children}
    </button>
  );
}
