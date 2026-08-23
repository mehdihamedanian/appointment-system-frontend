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
  useId,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { OverlayPortal } from "@/components/ui/overlay-portal";
import { useIsClient } from "@/lib/accessibility/focus";

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

  const triggerNode = isValidElement(trigger)
    ? cloneElement(trigger as ReactElement<Record<string, unknown>>, {
        ref: refs.setReference,
        "aria-expanded": isOpen,
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
                setOpen(false);
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
