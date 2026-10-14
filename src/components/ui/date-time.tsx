"use client";

import { useId, useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover } from "@/components/ui/popover";
import { moveOptionFocus } from "@/components/ui/select";
import { IconButton } from "@/components/ui/icon-button";
import { X } from "lucide-react";
import { formatIsoDateLabel } from "@/lib/date-time/format";

export function DatePicker({
  id,
  value,
  onChange,
  min,
  max,
  isDateDisabled,
  invalid,
  disabled,
  placeholder = "انتخاب تاریخ",
  timeZone,
}: {
  id?: string;
  /** Gregorian ISO date (`YYYY-MM-DD`); displayed in the configured calendar. */
  value?: string;
  onChange: (value: string | undefined) => void;
  min?: string;
  max?: string;
  isDateDisabled?: (isoDate: string) => boolean;
  invalid?: boolean;
  disabled?: boolean;
  placeholder?: string;
  timeZone?: string;
}) {
  const [open, setOpen] = useState(false);
  const dialogId = useId();
  const display = value ? (formatIsoDateLabel(value) ?? value) : "";

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger={
        <div>
          <Input
            id={id}
            readOnly
            disabled={disabled}
            invalid={invalid}
            value={display}
            placeholder={placeholder}
            data-value={value ?? ""}
            role="combobox"
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-controls={open ? dialogId : undefined}
            onKeyDown={(event) => {
              if (disabled) return;
              if (event.key === "Enter" || event.key === " " || event.key === "ArrowDown") {
                event.preventDefault();
                setOpen(true);
              }
            }}
            suffix={
              value ? (
                <IconButton
                  size="sm"
                  label="پاک کردن تاریخ"
                  onClick={(event) => {
                    event.stopPropagation();
                    onChange(undefined);
                  }}
                >
                  <X size={14} />
                </IconButton>
              ) : null
            }
          />
        </div>
      }
    >
      <div id={dialogId} role="dialog" aria-label="انتخاب تاریخ">
        <Calendar
          value={value}
          min={min}
          max={max}
          timeZone={timeZone}
          isDateDisabled={isDateDisabled}
          onChange={(next) => {
            onChange(next);
            setOpen(false);
          }}
        />
      </div>
    </Popover>
  );
}

function formatTime(hours: number, minutes: number): string {
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function TimePicker({
  id,
  value,
  onChange,
  interval = 30,
  hourCycle = 24,
  min,
  max,
  disabled,
  invalid,
}: {
  id?: string;
  value?: string;
  onChange: (value: string) => void;
  interval?: 15 | 30 | 60;
  hourCycle?: 12 | 24;
  min?: string;
  max?: string;
  disabled?: boolean;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const options: string[] = [];
  for (let minutes = 0; minutes < 24 * 60; minutes += interval) {
    const stamp = formatTime(Math.floor(minutes / 60), minutes % 60);
    if (min && stamp < min) continue;
    if (max && stamp > max) continue;
    options.push(stamp);
  }

  function labelFor(stamp: string) {
    if (hourCycle === 24) {
      return stamp;
    }
    const [h, m] = stamp.split(":").map(Number);
    const suffix = h >= 12 ? "PM" : "AM";
    const hour = h % 12 === 0 ? 12 : h % 12;
    return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
  }

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger={
        <button
          id={id}
          type="button"
          className={`ds-control ltr-value${invalid ? " is-invalid" : ""}`}
          disabled={disabled}
          aria-haspopup="listbox"
        >
          {value ? labelFor(value) : "انتخاب ساعت"}
        </button>
      }
    >
      <ul role="listbox" className="ds-listbox" aria-label="انتخاب ساعت" onKeyDown={moveOptionFocus}>
        {options.map((option) => (
          <li key={option} role="none">
            <button
              type="button"
              role="option"
              className="ds-option ltr-value"
              aria-selected={option === value}
              onClick={() => {
                onChange(option);
                setOpen(false);
              }}
            >
              {labelFor(option)}
            </button>
          </li>
        ))}
      </ul>
    </Popover>
  );
}
