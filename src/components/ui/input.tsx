"use client";

import { cx } from "@/lib/utilities/cx";
import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { describedBy } from "@/components/ui/form-field";

type SharedField = {
  invalid?: boolean;
  prefix?: ReactNode;
  suffix?: ReactNode;
};

export const Input = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, "prefix"> & SharedField
>(function Input(
  { className, invalid, prefix, suffix, id, disabled, readOnly, ...props },
  ref,
) {
  return (
    <div
      className={cx(
        "ds-control",
        invalid && "is-invalid",
        disabled && "is-disabled",
        className,
      )}
    >
      {prefix}
      <input
        ref={ref}
        id={id}
        disabled={disabled}
        readOnly={readOnly}
        aria-invalid={invalid || undefined}
        {...props}
      />
      {suffix}
    </div>
  );
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & {
    invalid?: boolean;
    maxLength?: number;
  }
>(function Textarea(
  { className, invalid, id, disabled, rows = 4, maxLength, value, ...props },
  ref,
) {
  const count =
    typeof value === "string" && maxLength
      ? `${value.length} / ${maxLength}`
      : undefined;

  return (
    <div className="ds-stack" style={{ gap: "var(--space-1)" }}>
      <div
        className={cx(
          "ds-control ds-control--textarea",
          invalid && "is-invalid",
          disabled && "is-disabled",
          className,
        )}
      >
        <textarea
          ref={ref}
          id={id}
          disabled={disabled}
          rows={rows}
          maxLength={maxLength}
          aria-invalid={invalid || undefined}
          value={value}
          {...props}
        />
      </div>
      {count ? <p className="ds-char-count">{count}</p> : null}
    </div>
  );
});

export function fieldDescribedBy(
  id: string,
  options: { description?: string; error?: string; success?: string },
): string | undefined {
  return describedBy(id, options);
}
