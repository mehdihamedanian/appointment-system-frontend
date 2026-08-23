"use client";

import { X } from "lucide-react";
import {
  useCallback,
  useId,
  useRef,
  type ReactNode,
} from "react";
import { OverlayPortal } from "@/components/ui/overlay-portal";
import { IconButton } from "@/components/ui/icon-button";
import { useIsClient } from "@/lib/accessibility/focus";
import { useFocusTrap, useScrollLock } from "@/lib/accessibility/overlay";
import { cx } from "@/lib/utilities/cx";

type ModalSize = "sm" | "md" | "lg" | "xl";

export type ModalProps = {
  open: boolean;
  title: string;
  description?: string;
  size?: ModalSize;
  preventClose?: boolean;
  onClose: () => void;
  children?: ReactNode;
  footer?: ReactNode;
  showClose?: boolean;
};

export function Modal({
  open,
  title,
  description,
  size = "md",
  preventClose = false,
  onClose,
  children,
  footer,
  showClose = true,
}: ModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const mounted = useIsClient();
  const getRoot = useCallback(() => dialogRef.current, []);

  useScrollLock(open && mounted);
  useFocusTrap(open && mounted, getRoot, {
    onEscape: onClose,
    preventClose,
  });

  if (!open || !mounted) {
    return null;
  }

  return (
    <OverlayPortal>
      <div
        className="modal-overlay"
        onMouseDown={(event) => {
          if (!preventClose && event.target === event.currentTarget) {
            onClose();
          }
        }}
      >
        <div
          ref={dialogRef}
          className={cx("modal", `modal--${size}`)}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={description ? descriptionId : undefined}
          tabIndex={-1}
        >
          <div className="modal__header">
            <div>
              <h2 id={titleId} className="modal__title">
                {title}
              </h2>
              {description ? (
                <p id={descriptionId} className="modal__description">
                  {description}
                </p>
              ) : null}
            </div>
            {showClose && !preventClose ? (
              <IconButton label="بستن" onClick={onClose}>
                <X size={18} />
              </IconButton>
            ) : null}
          </div>
          <div className="modal__body">{children}</div>
          {footer ? <div className="modal__actions">{footer}</div> : null}
        </div>
      </div>
    </OverlayPortal>
  );
}
