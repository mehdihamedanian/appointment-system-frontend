"use client";

import { Check, ChevronDown, X } from "lucide-react";
import { useMemo, useState, type KeyboardEvent } from "react";
import { Popover } from "@/components/ui/popover";
import { IconButton } from "@/components/ui/icon-button";
import { SearchInput } from "@/components/ui/search-input";
import { cx } from "@/lib/utilities/cx";

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type SelectBase = {
  id?: string;
  placeholder?: string;
  options: SelectOption[];
  disabled?: boolean;
  invalid?: boolean;
  loading?: boolean;
  emptyLabel?: string;
  allowClear?: boolean;
  /** Accessible name of the option list (usually the field label). */
  label?: string;
};

/** Arrow/Home/End move between options; ArrowDown from a search field enters the list. */
export function moveOptionFocus(event: KeyboardEvent<HTMLElement>) {
  const options = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>('[role="option"]:not([disabled])'),
  );
  if (options.length === 0) return;
  const index = options.indexOf(document.activeElement as HTMLElement);
  if (index < 0 && event.key !== "ArrowDown") return;
  const targets: Record<string, number> = {
    ArrowDown: index < 0 ? 0 : Math.min(index + 1, options.length - 1),
    ArrowUp: Math.max(index - 1, 0),
    Home: 0,
    End: options.length - 1,
  };
  const next = targets[event.key];
  if (next === undefined) return;
  event.preventDefault();
  options[next]?.focus();
}

export function Select({
  id,
  value,
  onChange,
  placeholder = "انتخاب کنید",
  options,
  disabled,
  invalid,
  loading,
  emptyLabel = "موردی نیست",
  allowClear = false,
  label,
}: SelectBase & {
  value?: string;
  onChange: (value: string | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger={
        <button
          id={id}
          type="button"
          className={cx("ds-control", invalid && "is-invalid")}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          data-invalid={invalid ? "true" : undefined}
        >
          <span>{selected?.label ?? placeholder}</span>
          <ChevronDown size={16} aria-hidden="true" />
        </button>
      }
    >
      <ul
        role="listbox"
        className="ds-listbox"
        aria-label={label ?? placeholder}
        aria-busy={loading || undefined}
        onKeyDown={moveOptionFocus}
      >
        {allowClear && value ? (
          <li role="none">
            <button type="button" className="ds-option" onClick={() => onChange(undefined)}>
              پاک کردن
            </button>
          </li>
        ) : null}
        {options.length === 0 ? (
          <li role="none" className="ds-help">
            {emptyLabel}
          </li>
        ) : null}
        {options.map((option) => (
          <li key={option.value} role="none">
            <button
              type="button"
              role="option"
              className="ds-option"
              aria-selected={option.value === value}
              disabled={option.disabled}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              {option.label}
              {option.value === value ? <Check size={14} aria-hidden="true" /> : null}
            </button>
          </li>
        ))}
      </ul>
    </Popover>
  );
}

export function MultiSelect({
  id,
  values,
  onChange,
  options,
  placeholder = "انتخاب کنید",
  disabled,
  invalid,
  loading,
  emptyLabel = "نتیجه‌ای پیدا نشد",
  maxSelected,
  label,
}: SelectBase & {
  values: string[];
  onChange: (values: string[]) => void;
  maxSelected?: number;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.filter((option) => values.includes(option.value));
  const visible = useMemo(
    () =>
      options.filter((option) =>
        option.label.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [options, query],
  );

  function toggle(value: string) {
    if (values.includes(value)) {
      onChange(values.filter((item) => item !== value));
      return;
    }
    if (maxSelected && values.length >= maxSelected) {
      return;
    }
    onChange([...values, value]);
  }

  return (
    <div className="ds-stack" style={{ gap: "var(--space-2)" }}>
      <Popover
        open={open}
        onOpenChange={setOpen}
        trigger={
          <button
            id={id}
            type="button"
            className={cx("ds-control", invalid && "is-invalid")}
            disabled={disabled}
            aria-haspopup="listbox"
          >
            <span>{selected.length ? `${selected.length} مورد` : placeholder}</span>
            <ChevronDown size={16} aria-hidden="true" />
          </button>
        }
      >
        <div
          className="ds-stack"
          style={{ gap: "var(--space-2)", padding: "var(--space-2)" }}
          onKeyDown={moveOptionFocus}
        >
          <SearchInput
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onClear={() => setQuery("")}
            placeholder="جستجو"
            aria-label="جستجوی گزینه‌ها"
          />
          <ul
            role="listbox"
            aria-multiselectable="true"
            aria-label={label ?? placeholder}
            aria-busy={loading || undefined}
          >
            {visible.length === 0 ? (
              <li role="none" className="ds-help">
                {emptyLabel}
              </li>
            ) : null}
            {visible.map((option) => (
              <li key={option.value} role="none">
                <button
                  type="button"
                  role="option"
                  className="ds-option"
                  aria-selected={values.includes(option.value)}
                  disabled={option.disabled}
                  onClick={() => toggle(option.value)}
                >
                  {option.label}
                  {values.includes(option.value) ? <Check size={14} aria-hidden="true" /> : null}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </Popover>
      {selected.length > 0 ? (
        <div className="ds-inline">
          {selected.map((option) => (
            <span key={option.value} className="ds-chip">
              <span>{option.label}</span>
              <IconButton
                size="sm"
                label={`حذف ${option.label}`}
                onClick={() => toggle(option.value)}
              >
                <X size={12} />
              </IconButton>
            </span>
          ))}
          <button type="button" className="btn btn--link btn--sm" onClick={() => onChange([])}>
            پاک کردن همه
          </button>
        </div>
      ) : null}
    </div>
  );
}
