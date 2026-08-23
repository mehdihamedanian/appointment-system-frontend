import { cx } from "@/lib/utilities/cx";
import type { LabelHTMLAttributes, ReactNode } from "react";

export function Label({
  required,
  optional,
  className,
  children,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement> & {
  required?: boolean;
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <label className={cx("ds-label", className)} {...props}>
      {children}
      {required ? (
        <span className="ds-label__req" aria-hidden="true">
          *
        </span>
      ) : null}
      {optional ? <span className="text-caption"> (اختیاری)</span> : null}
    </label>
  );
}

export function HelperText({
  id,
  children,
}: {
  id?: string;
  children: ReactNode;
}) {
  return (
    <p id={id} className="ds-help">
      {children}
    </p>
  );
}

export function FormError({
  id,
  children,
}: {
  id?: string;
  children: ReactNode;
}) {
  return (
    <p id={id} className="ds-error" role="alert">
      {children}
    </p>
  );
}

export function FormField({
  id,
  label,
  required,
  optional,
  description,
  error,
  success,
  characterCount,
  disabled,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  optional?: boolean;
  description?: string;
  error?: string;
  success?: string;
  characterCount?: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  const descriptionId = description ? `${id}-desc` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const successId = success ? `${id}-success` : undefined;

  return (
    <div className={cx("ds-field", disabled && "is-disabled")}>
      <Label htmlFor={id} required={required} optional={optional}>
        {label}
      </Label>
      {children}
      {description ? <HelperText id={descriptionId}>{description}</HelperText> : null}
      {error ? <FormError id={errorId}>{error}</FormError> : null}
      {success && !error ? (
        <p id={successId} className="ds-success">
          {success}
        </p>
      ) : null}
      {characterCount ? <p className="ds-char-count">{characterCount}</p> : null}
    </div>
  );
}

export function describedBy(
  id: string,
  options: { description?: string; error?: string; success?: string },
): string | undefined {
  const ids = [
    options.description ? `${id}-desc` : null,
    options.error ? `${id}-error` : null,
    options.success ? `${id}-success` : null,
  ].filter(Boolean);
  return ids.length > 0 ? ids.join(" ") : undefined;
}
