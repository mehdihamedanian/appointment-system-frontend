"use client";

import { cx } from "@/lib/utilities/cx";
import {
  cloneElement,
  isValidElement,
  type ButtonHTMLAttributes,
  type ReactElement,
  type ReactNode,
} from "react";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "destructive"
  | "danger"
  | "link";
export type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  asChild?: boolean;
  children: ReactNode;
};

function Spinner() {
  return <span className="spinner" aria-hidden="true" />;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  fullWidth = false,
  leadingIcon,
  trailingIcon,
  asChild = false,
  className,
  type = "button",
  disabled,
  children,
  onClick,
  ...props
}: ButtonProps) {
  const visual = variant === "danger" ? "destructive" : variant;
  const classes = cx(
    "btn",
    `btn--${visual}`,
    size !== "md" && `btn--${size}`,
    fullWidth && "btn--block",
    className,
  );
  const isDisabled = disabled || loading;

  const content = (
    <>
      <span className="btn__label" data-hidden={loading ? "true" : undefined}>
        {leadingIcon}
        {children}
        {trailingIcon}
      </span>
      {loading ? (
        <span className="btn__spinner">
          <Spinner />
          <span className="visually-hidden">در حال انجام</span>
        </span>
      ) : null}
    </>
  );

  if (asChild && isValidElement(children)) {
    const child = children as ReactElement<{ className?: string }>;
    return cloneElement(child, {
      className: cx(classes, child.props.className),
    });
  }

  return (
    <button
      type={type}
      className={classes}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      onClick={loading ? undefined : onClick}
      {...props}
    >
      {content}
    </button>
  );
}
