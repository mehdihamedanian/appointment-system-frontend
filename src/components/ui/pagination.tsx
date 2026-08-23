"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

function pageList(current: number, total: number): Array<number | "ellipsis"> {
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }
  const pages: Array<number | "ellipsis"> = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) pages.push("ellipsis");
  for (let page = start; page <= end; page += 1) pages.push(page);
  if (end < total - 1) pages.push("ellipsis");
  pages.push(total);
  return pages;
}

export function Pagination({
  page,
  pageCount,
  onPageChange,
  disabled,
}: {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}) {
  const pages = pageList(page, pageCount);

  return (
    <nav className="ds-pagination" aria-label="صفحه‌بندی">
      <Button
        variant="secondary"
        size="sm"
        disabled={disabled || page <= 1}
        onClick={() => onPageChange(page - 1)}
        leadingIcon={<ChevronRight className="icon-dir" size={16} />}
      >
        قبلی
      </Button>
      {pages.map((item, index) =>
        item === "ellipsis" ? (
          <span key={`e-${index}`} className="text-caption">
            …
          </span>
        ) : (
          <Button
            key={item}
            variant={item === page ? "primary" : "ghost"}
            size="sm"
            aria-current={item === page ? "page" : undefined}
            disabled={disabled}
            onClick={() => onPageChange(item)}
          >
            <span className="ltr-value">{item}</span>
          </Button>
        ),
      )}
      <Button
        variant="secondary"
        size="sm"
        disabled={disabled || page >= pageCount}
        onClick={() => onPageChange(page + 1)}
        trailingIcon={<ChevronLeft className="icon-dir" size={16} />}
      >
        بعدی
      </Button>
    </nav>
  );
}
