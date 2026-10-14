"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { cx } from "@/lib/utilities/cx";

type TabsContextValue = {
  value: string;
  setValue: (value: string) => void;
  id: string;
  /** Values whose TabPanel is mounted; tabs used as plain filters have none. */
  panels: ReadonlySet<string>;
  registerPanel: (value: string) => () => void;
};

const TabsContext = createContext<TabsContextValue | null>(null);

export function Tabs({
  value,
  defaultValue,
  onValueChange,
  children,
}: {
  value?: string;
  defaultValue: string;
  onValueChange?: (value: string) => void;
  children: ReactNode;
}) {
  const id = useId();
  const [uncontrolled, setUncontrolled] = useState(defaultValue);
  const [panels, setPanels] = useState<ReadonlySet<string>>(() => new Set());
  const selected = value ?? uncontrolled;
  const setValue = (next: string) => {
    onValueChange?.(next);
    if (value === undefined) {
      setUncontrolled(next);
    }
  };
  const registerPanel = useCallback((panel: string) => {
    setPanels((current) => new Set(current).add(panel));
    return () =>
      setPanels((current) => {
        const next = new Set(current);
        next.delete(panel);
        return next;
      });
  }, []);

  return (
    <TabsContext.Provider value={{ value: selected, setValue, id, panels, registerPanel }}>
      <div className="ds-tabs">{children}</div>
    </TabsContext.Provider>
  );
}

function useTabs() {
  const value = useContext(TabsContext);
  if (!value) {
    throw new Error("Tabs components must be used within Tabs");
  }
  return value;
}

export function TabList({ children }: { children: ReactNode }) {
  const { setValue } = useTabs();

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const tabs = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]:not([disabled])'),
    );
    const index = tabs.indexOf(document.activeElement as HTMLButtonElement);
    if (index < 0) return;
    const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
    let next = index;
    if (event.key === "ArrowRight") next = index + (rtl ? -1 : 1);
    if (event.key === "ArrowLeft") next = index + (rtl ? 1 : -1);
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = tabs.length - 1;
    if (next === index) return;
    event.preventDefault();
    const bounded = (next + tabs.length) % tabs.length;
    tabs[bounded]?.focus();
    const value = tabs[bounded]?.dataset.value;
    if (value) setValue(value);
  }

  return (
    <div role="tablist" className="ds-tablist" onKeyDown={onKeyDown}>
      {children}
    </div>
  );
}

export function Tab({
  value,
  disabled,
  children,
}: {
  value: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  const tabs = useTabs();
  const selected = tabs.value === value;
  return (
    <button
      type="button"
      role="tab"
      className="ds-tab"
      id={`${tabs.id}-${value}`}
      data-value={value}
      aria-selected={selected}
      aria-controls={tabs.panels.has(value) ? `${tabs.id}-panel-${value}` : undefined}
      tabIndex={selected ? 0 : -1}
      disabled={disabled}
      onClick={() => tabs.setValue(value)}
    >
      {children}
    </button>
  );
}

export function TabPanel({
  value,
  children,
}: {
  value: string;
  children: ReactNode;
}) {
  const tabs = useTabs();
  const active = tabs.value === value;
  const { registerPanel } = tabs;
  useEffect(() => (active ? registerPanel(value) : undefined), [active, registerPanel, value]);
  if (!active) {
    return null;
  }
  return (
    <div
      role="tabpanel"
      id={`${tabs.id}-panel-${value}`}
      aria-labelledby={`${tabs.id}-${value}`}
      className={cx("ds-tabpanel")}
      tabIndex={0}
    >
      {children}
    </div>
  );
}
