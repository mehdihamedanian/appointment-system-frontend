"use client";

import { ChevronDown } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

export type AccordionItemData = {
  id: string;
  title: string;
  content: ReactNode;
  disabled?: boolean;
};

export function Accordion({
  items,
  type = "single",
}: {
  items: AccordionItemData[];
  type?: "single" | "multiple";
}) {
  const baseId = useId();
  const [open, setOpen] = useState<string[]>(
    type === "single" && items[0] ? [items[0].id] : [],
  );

  function toggle(id: string) {
    setOpen((current) => {
      if (current.includes(id)) {
        return current.filter((item) => item !== id);
      }
      return type === "single" ? [id] : [...current, id];
    });
  }

  return (
    <div className="ds-accordion">
      {items.map((item) => {
        const expanded = open.includes(item.id);
        const panelId = `${baseId}-${item.id}`;
        return (
          <div key={item.id} className="ds-accordion__item">
            <h3>
              <button
                type="button"
                className="ds-accordion__trigger"
                aria-expanded={expanded}
                aria-controls={panelId}
                disabled={item.disabled}
                onClick={() => toggle(item.id)}
              >
                {item.title}
                <ChevronDown size={16} aria-hidden="true" />
              </button>
            </h3>
            {expanded ? (
              <div id={panelId} className="ds-accordion__panel">
                {item.content}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
