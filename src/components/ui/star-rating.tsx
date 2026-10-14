"use client";

import { useId, useState } from "react";
import { Star } from "lucide-react";
import { FormError } from "@/components/ui/form-field";
import { cx } from "@/lib/utilities/cx";

export function StarRating({
  name,
  value,
  onChange,
  min = 1,
  max = 5,
  legend = "امتیاز",
  description,
  error,
  disabled = false,
  required = false,
}: {
  name: string;
  value: number | null;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  legend?: string;
  description?: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
}) {
  const groupId = useId();
  const errorId = `${groupId}-error`;
  const helpId = `${groupId}-help`;
  const [preview, setPreview] = useState<number | null>(null);
  const display = preview ?? value;
  const options = Array.from({ length: max - min + 1 }, (_, index) => min + index);

  return (
    <fieldset
      className={cx("star-rating", error && "is-invalid")}
      disabled={disabled}
    >
      <legend className="ds-label">
        {legend}
        {required ? <span aria-hidden="true"> *</span> : null}
      </legend>
      {description ? (
        <p id={helpId} className="ds-help">
          {description}
        </p>
      ) : null}
      <div
        className="star-rating__options"
        role="radiogroup"
        aria-label={legend}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={
          [description ? helpId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined
        }
        onMouseLeave={() => setPreview(null)}
      >
        {options.map((option) => {
          const checked = value === option;
          const filled = display != null && option <= display;
          const label = `${option} از ${max}`;
          return (
            <label
              key={option}
              className={cx(
                "star-rating__option",
                filled && "is-filled",
                checked && "is-selected",
              )}
              onMouseEnter={() => {
                if (!disabled) setPreview(option);
              }}
            >
              <input
                type="radio"
                className="star-rating__input"
                name={name}
                value={option}
                checked={checked}
                disabled={disabled}
                onChange={() => onChange(option)}
              />
              <span className="star-rating__icon" aria-hidden="true">
                <Star
                  size={22}
                  fill={filled ? "currentColor" : "none"}
                  strokeWidth={1.75}
                />
              </span>
              <span className="visually-hidden">{label}</span>
            </label>
          );
        })}
      </div>
      <p className="star-rating__value text-caption" aria-live="polite">
        {value != null ? `انتخاب‌شده: ${value} از ${max}` : "امتیازی انتخاب نشده است."}
      </p>
      {error ? <FormError id={errorId}>{error}</FormError> : null}
    </fieldset>
  );
}
