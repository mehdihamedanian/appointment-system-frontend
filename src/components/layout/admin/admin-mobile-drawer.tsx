"use client";

import { useCallback, useRef } from "react";
import { Brand } from "@/components/layout/brand";
import { AdminNavigation } from "@/components/layout/admin/admin-navigation";
import { IconButton } from "@/components/ui/icon-button";
import { OverlayPortal } from "@/components/ui/overlay-portal";
import { useIsClient } from "@/lib/accessibility/focus";
import { useFocusTrap, useScrollLock } from "@/lib/accessibility/overlay";
import type { NavSection } from "@/constants/navigation";
import { X } from "lucide-react";

export function AdminMobileDrawer({
  open,
  onClose,
  sections,
  pathname,
}: {
  open: boolean;
  onClose: () => void;
  sections: NavSection[];
  pathname: string;
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
      <div
        className="admin-drawer-overlay"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <div
          ref={panelRef}
          className="admin-sidebar is-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="منوی مدیریت"
          tabIndex={-1}
        >
          <div className="admin-drawer__head">
            <Brand />
            <IconButton label="بستن منوی مدیریت" onClick={onClose}>
              <X size={20} />
            </IconButton>
          </div>
          <div className="admin-sidebar__scroll">
            <AdminNavigation
              sections={sections}
              pathname={pathname}
              onNavigate={onClose}
            />
          </div>
        </div>
      </div>
    </OverlayPortal>
  );
}
