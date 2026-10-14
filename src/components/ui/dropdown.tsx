"use client";

import { cloneElement, isValidElement, type KeyboardEvent, type ReactNode } from "react";
import { Popover } from "@/components/ui/popover";
import { cx } from "@/lib/utilities/cx";

function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
  const items = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])'),
  );
  if (items.length === 0) return;
  const index = items.indexOf(document.activeElement as HTMLElement);
  const targets: Record<string, number> = {
    ArrowDown: (index + 1) % items.length,
    ArrowUp: (index - 1 + items.length) % items.length,
    Home: 0,
    End: items.length - 1,
  };
  const next = targets[event.key];
  if (next === undefined) return;
  event.preventDefault();
  items[next]?.focus();
}

export function Dropdown({
  trigger,
  children,
}: {
  trigger: React.ReactElement;
  children: ReactNode;
}) {
  const menuTrigger = isValidElement(trigger)
    ? cloneElement(trigger as React.ReactElement<Record<string, unknown>>, { "aria-haspopup": "menu" })
    : trigger;
  return (
    <Popover trigger={menuTrigger}>
      <div role="menu" className="ds-menu" onKeyDown={onMenuKeyDown}>
        {children}
      </div>
    </Popover>
  );
}

export function DropdownItem({
  children,
  disabled,
  destructive,
  onSelect,
}: {
  children: ReactNode;
  disabled?: boolean;
  destructive?: boolean;
  onSelect?: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      className={cx("ds-menu-item", destructive && "is-destructive")}
      disabled={disabled}
      onClick={onSelect}
    >
      {children}
    </button>
  );
}

export function DropdownSeparator() {
  return <div className="ds-menu-sep" role="separator" />;
}
