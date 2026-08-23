"use client";

import { useCallback, useRef, type ReactNode } from "react";
import { OverlayPortal } from "@/components/ui/overlay-portal";
import { useIsClient } from "@/lib/accessibility/focus";
import { useFocusTrap, useScrollLock } from "@/lib/accessibility/overlay";
import { cx } from "@/lib/utilities/cx";

export function Drawer({
  open,
  onClose,
  title,
  placement = "start",
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  placement?: "start" | "end" | "bottom";
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const mounted = useIsClient();
  const getRoot = useCallback(() => panelRef.current, []);
  useScrollLock(open && mounted);
  useFocusTrap(open && mounted, getRoot, { onEscape: onClose });

  if (!open || !mounted) {
    return null;
  }

  return (
    <OverlayPortal>
      <div className="modal-overlay" onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}>
        <div
          ref={panelRef}
          className={cx("ds-drawer", `ds-drawer--${placement}`)}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          tabIndex={-1}
        >
          <div className="modal__header">
            <h2 className="text-card-title">{title}</h2>
          </div>
          <div className="modal__body">{children}</div>
        </div>
      </div>
    </OverlayPortal>
  );
}
