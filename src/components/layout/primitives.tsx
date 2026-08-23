import { cx } from "@/lib/utilities/cx";
import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

type Space = 1 | 2 | 3 | 4 | 5 | 6 | 8;

const spaceVar = (value?: Space) =>
  value ? (`var(--space-${value})` as const) : undefined;

export function Container({
  size = "lg",
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  size?: "sm" | "md" | "lg" | "xl";
  children: ReactNode;
}) {
  return (
    <div
      className={cx("ds-container", className)}
      style={{ "--container-width": `var(--container-${size})` } as CSSProperties}
      {...props}
    >
      {children}
    </div>
  );
}

export function Stack({
  gap = 4,
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { gap?: Space; children: ReactNode }) {
  return (
    <div
      className={cx("ds-stack", className)}
      style={{ gap: spaceVar(gap) }}
      {...props}
    >
      {children}
    </div>
  );
}

export function Inline({
  gap = 3,
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { gap?: Space; children: ReactNode }) {
  return (
    <div
      className={cx("ds-inline", className)}
      style={{ gap: spaceVar(gap) }}
      {...props}
    >
      {children}
    </div>
  );
}

export function Grid({
  columns = 2,
  gap = 4,
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  columns?: number;
  gap?: Space;
  children: ReactNode;
}) {
  return (
    <div
      className={cx("ds-grid", className)}
      style={{
        gap: spaceVar(gap),
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
      }}
      {...props}
    >
      {children}
    </div>
  );
}

export function Divider({ className }: { className?: string }) {
  return <hr className={cx("ds-divider", className)} />;
}

export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span className="visually-hidden">{children}</span>;
}
