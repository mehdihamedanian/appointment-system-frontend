"use client";

import type { ReactNode } from "react";
import { Popover } from "@/components/ui/popover";
import { cx } from "@/lib/utilities/cx";

export function Dropdown({
  trigger,
  children,
}: {
  trigger: React.ReactElement;
  children: ReactNode;
}) {
  return (
    <Popover trigger={trigger}>
      <div role="menu" className="ds-menu">
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
