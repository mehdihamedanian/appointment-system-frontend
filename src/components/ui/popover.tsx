"use client";

/* eslint-disable react-hooks/refs -- Floating UI attaches reference callbacks during render */

import {
  autoUpdate,
  flip,
  offset,
  shift,
  useFloating,
} from "@floating-ui/react";
import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { OverlayPortal } from "@/components/ui/overlay-portal";
import { FOCUSABLE_SELECTOR, getFocusable, useIsClient } from "@/lib/accessibility/focus";

type Placement = "bottom-start" | "bottom-end" | "top-start" | "top-end";

export function Popover({
  open,
  onOpenChange,
  placement = "bottom-start",
  trigger,
  children,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  placement?: Placement;
  trigger: ReactElement;
  children: ReactNode;
}) {
  const [uncontrolled, setUncontrolled] = useState(false);
  const isOpen = open ?? uncontrolled;
  const setOpen = onOpenChange ?? setUncontrolled;
  const mounted = useIsClient();
  const { refs, floatingStyles } = useFloating({
    open: isOpen,
    onOpenChange: setOpen,
    placement,
    whileElementsMounted: autoUpdate,
    middleware: [offset(6), flip(), shift({ padding: 8 })],
  });
  const latestSetOpen = useRef(setOpen);
  useEffect(() => {
    latestSetOpen.current = setOpen;
  });

  function focusTrigger() {
    const reference = refs.domReference.current;
    if (!reference) return;
    const target = reference.matches(FOCUSABLE_SELECTOR)
      ? (reference as HTMLElement)
      : reference.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    target?.focus();
  }
  const focusTriggerRef = useRef(focusTrigger);
  useEffect(() => {
    focusTriggerRef.current = focusTrigger;
  });

  // Content is portalled to the end of <body>, so focus must be moved in explicitly.
  useEffect(() => {
    if (!isOpen || !mounted) return;
    const frame = window.requestAnimationFrame(() => {
      const floating = refs.floating.current;
      if (!floating || floating.contains(document.activeElement)) return;
      const preferred = floating.querySelector<HTMLElement>(
        '[aria-selected="true"]:not([disabled]), [role="gridcell"][tabindex="0"]',
      );
      (preferred ?? getFocusable(floating)[0])?.focus();
    });
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (refs.floating.current?.contains(target) || refs.domReference.current?.contains(target)) {
        return;
      }
      latestSetOpen.current(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", onPointerDown);
      // Choosing an option unmounts the focused element; return focus to the trigger.
      if (!document.activeElement || document.activeElement === document.body) {
        focusTriggerRef.current();
      }
    };
  }, [isOpen, mounted, refs]);

  // `aria-expanded` is only valid on the control itself, not on wrapper elements.
  const triggerIsControl = isValidElement(trigger) && trigger.type !== "div" && trigger.type !== "span";

  const triggerNode = isValidElement(trigger)
    ? cloneElement(trigger as ReactElement<Record<string, unknown>>, {
        ref: refs.setReference,
        ...(triggerIsControl ? { "aria-expanded": isOpen } : {}),
        onClick: (event: React.MouseEvent) => {
          const original = (trigger.props as { onClick?: (event: React.MouseEvent) => void })
            .onClick;
          original?.(event);
          setOpen(!isOpen);
        },
      })
    : trigger;

  if (!mounted) {
    return triggerNode;
  }

  return (
    <>
      {triggerNode}
      {isOpen ? (
        <OverlayPortal>
          <div
            className="ds-popover"
            ref={refs.setFloating}
            style={floatingStyles}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.stopPropagation();
                setOpen(false);
                focusTrigger();
              } else if (event.key === "Tab") {
                // Continue the page tab order from the trigger.
                setOpen(false);
                focusTrigger();
              }
            }}
          >
            {children}
          </div>
        </OverlayPortal>
      ) : null}
    </>
  );
}

export function Tooltip({
  label,
  children,
}: {
  label: string;
  children: ReactElement;
}) {
  const tooltipId = useId();
  const [open, setOpen] = useState(false);
  const { refs, floatingStyles } = useFloating({
    open,
    placement: "top",
    whileElementsMounted: autoUpdate,
    middleware: [offset(6), flip(), shift({ padding: 8 })],
  });

  const child = cloneElement(children as ReactElement<Record<string, unknown>>, {
    ref: refs.setReference,
    "aria-describedby": open ? tooltipId : undefined,
    onMouseEnter: () => setOpen(true),
    onMouseLeave: () => setOpen(false),
    onFocus: () => setOpen(true),
    onBlur: () => setOpen(false),
  });

  return (
    <>
      {child}
      {open ? (
        <OverlayPortal>
          <div
            id={tooltipId}
            role="tooltip"
            className="ds-tooltip"
            ref={refs.setFloating}
            style={floatingStyles}
          >
            {label}
          </div>
        </OverlayPortal>
      ) : null}
    </>
  );
}
