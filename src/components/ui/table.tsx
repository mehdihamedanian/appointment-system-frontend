import { cx } from "@/lib/utilities/cx";
import type { ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { ApiErrorState, EmptyState, NoResultsState } from "@/components/feedback/app-states";
import { Skeleton } from "@/components/feedback/loading-states";

export function Table({
  caption,
  density = "regular",
  stickyHeader = true,
  children,
}: {
  caption: string;
  density?: "regular" | "compact";
  stickyHeader?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="ds-table-wrap">
      <table
        className={cx(
          "ds-table",
          density === "compact" && "ds-table--compact",
          !stickyHeader && "ds-table--static",
        )}
      >
        <caption className="visually-hidden">{caption}</caption>
        {children}
      </table>
    </div>
  );
}

export function TableHeader({ children }: { children: ReactNode }) {
  return <thead>{children}</thead>;
}

export function TableBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function TableFooter({ children }: { children: ReactNode }) {
  return <tfoot>{children}</tfoot>;
}

export function TableRow({
  selected,
  disabled,
  children,
}: {
  selected?: boolean;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <tr data-selected={selected ? "true" : undefined} data-disabled={disabled ? "true" : undefined}>
      {children}
    </tr>
  );
}

export function TableHead({
  children,
  sorted,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement> & {
  sorted?: "asc" | "desc";
}) {
  return (
    <th {...props}>
      {children}
      {sorted ? (
        <span aria-hidden="true">{sorted === "asc" ? " ↑" : " ↓"}</span>
      ) : null}
    </th>
  );
}

export function TableCell(props: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td {...props} />;
}

export function TableSkeletonRows({ rows = 4, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, row) => (
        <TableRow key={row}>
          {Array.from({ length: columns }).map((__, column) => (
            <TableCell key={column}>
              <Skeleton variant="line" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

export function TableEmpty({ type = "empty" }: { type?: "empty" | "no-results" | "error" }) {
  if (type === "no-results") return <NoResultsState />;
  if (type === "error") return <ApiErrorState />;
  return <EmptyState />;
}
