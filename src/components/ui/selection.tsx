"use client";

import { cx } from "@/lib/utilities/cx";
import {
  useEffect,
  useRef,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";

type BoxProps = {
  label: ReactNode;
  description?: ReactNode;
  error?: boolean;
  children?: ReactNode;
};

export function Checkbox({
  label,
  description,
  error,
  indeterminate,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> &
  BoxProps & { indeterminate?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = Boolean(indeterminate);
    }
  }, [indeterminate]);

  return (
    <label className={cx("ds-check", error && "is-invalid", className)}>
      <input ref={ref} type="checkbox" {...props} />
      <span>
        <span className="ds-label">{label}</span>
        {description ? <p className="ds-help">{description}</p> : null}
      </span>
    </label>
  );
}

export function Radio({
  label,
  description,
  error,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & BoxProps) {
  return (
    <label className={cx("ds-radio", error && "is-invalid", className)}>
      <input type="radio" {...props} />
      <span>
        <span className="ds-label">{label}</span>
        {description ? <p className="ds-help">{description}</p> : null}
      </span>
    </label>
  );
}

export function RadioGroup({
  legend,
  description,
  error,
  orientation = "vertical",
  children,
}: {
  legend: string;
  description?: string;
  error?: string;
  orientation?: "vertical" | "horizontal";
  children: ReactNode;
}) {
  return (
    <fieldset className="ds-field">
      <legend className="ds-label">{legend}</legend>
      {description ? <p className="ds-help">{description}</p> : null}
      <div
        className={orientation === "horizontal" ? "ds-inline" : "ds-stack"}
        role="presentation"
      >
        {children}
      </div>
      {error ? (
        <p className="ds-error" role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

export function Switch({
  label,
  description,
  checked,
  disabled,
  pending,
  onCheckedChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  pending?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label className="ds-switch">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-busy={pending || undefined}
        disabled={disabled || pending}
        className="ds-switch__track"
        data-checked={checked ? "true" : "false"}
        onClick={() => onCheckedChange(!checked)}
      >
        <span className="ds-switch__thumb" />
      </button>
      <span>
        <span className="ds-label">{label}</span>
        {description ? <p className="ds-help">{description}</p> : null}
      </span>
    </label>
  );
}
