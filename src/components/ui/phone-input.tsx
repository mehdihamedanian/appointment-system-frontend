"use client";

import {
  forwardRef,
  useCallback,
  type ChangeEvent,
  type InputHTMLAttributes,
} from "react";
import { Input } from "@/components/ui/input";
import { toLatinPhone } from "@/lib/utilities/digits";
import { cx } from "@/lib/utilities/cx";

export const PhoneInput = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, "prefix"> & {
    invalid?: boolean;
    prefixLabel?: string;
    onValueChange?: (value: string) => void;
  }
>(function PhoneInput(
  {
    invalid,
    prefixLabel = "+98",
    autoComplete = "tel",
    onValueChange,
    onChange,
    className,
    ...props
  },
  ref,
) {
  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const next = toLatinPhone(event.target.value);
      event.target.value = next;
      onValueChange?.(next);
      onChange?.(event);
    },
    [onChange, onValueChange],
  );

  return (
    <Input
      ref={ref}
      invalid={invalid}
      prefix={<span className="ltr-value">{prefixLabel}</span>}
      className={cx("ltr-value", className)}
      {...props}
      type="tel"
      inputMode="tel"
      autoComplete={autoComplete}
      onChange={handleChange}
    />
  );
});
