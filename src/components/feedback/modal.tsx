"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

type ModalSize = "sm" | "md" | "lg";

type ModalProps = {
  open: boolean;
  title: string;
  description?: string;
  size?: ModalSize;
  preventClose?: boolean;
  onClose: () => void;
  children: ReactNode;
};

function focusFirstElement(root: HTMLElement) {
  const focusable = root.querySelectorAll<HTMLElement>(FOCUSABLE);
  (focusable[0] ?? root).focus();
}

const subscribeIsClient = () => () => undefined;

function useIsClient() {
  return useSyncExternalStore(subscribeIsClient, () => true, () => false);
}

export function Modal({
  open,
  title,
  description,
  size = "md",
  preventClose = false,
  onClose,
  children,
}: ModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const mounted = useIsClient();

  const setDialogRef = useCallback((node: HTMLDivElement | null) => {
    dialogRef.current = node;
    if (node) {
      previouslyFocused.current = document.activeElement as HTMLElement | null;
      focusFirstElement(node);
    }
  }, []);

  useEffect(() => {
    if (!open || !mounted || !dialogRef.current) {
      return;
    }

    focusFirstElement(dialogRef.current);
  }, [open, mounted]);

  useEffect(() => {
    if (!open || !mounted) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      const root = dialogRef.current;
      if (event.key === "Escape" && !preventClose) {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab" || !root) {
        return;
      }

      const items = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) {
        event.preventDefault();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = originalOverflow;
      previouslyFocused.current?.focus();
    };
  }, [open, mounted, onClose, preventClose]);

  if (!open || !mounted) {
    return null;
  }

  const target = document.getElementById("modal-portal") ?? document.body;

  return createPortal(
    <div
      className="modal-overlay"
      onMouseDown={(event) => {
        if (!preventClose && event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={setDialogRef}
        className={`modal modal--${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
      >
        <h2 id={titleId} className="modal__title">
          {title}
        </h2>
        {description ? (
          <p id={descriptionId} className="modal__description">
            {description}
          </p>
        ) : null}
        {children}
      </div>
    </div>,
    target,
  );
}
