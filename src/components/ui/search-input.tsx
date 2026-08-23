"use client";

import { Search, X } from "lucide-react";
import { forwardRef, type InputHTMLAttributes } from "react";
import { Input } from "@/components/ui/input";
import { IconButton } from "@/components/ui/icon-button";

export const SearchInput = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, "prefix"> & {
    invalid?: boolean;
    loading?: boolean;
    onClear?: () => void;
  }
>(function SearchInput(
  { invalid, loading, onClear, value, ...props },
  ref,
) {
  const showClear = Boolean(onClear && value);

  return (
    <Input
      ref={ref}
      type="search"
      value={value}
      invalid={invalid}
      prefix={<Search size={16} aria-hidden="true" />}
      suffix={
        loading ? (
          <span className="spinner" aria-hidden="true" />
        ) : showClear ? (
          <IconButton type="button" size="sm" label="پاک کردن جستجو" onClick={onClear}>
            <X size={14} />
          </IconButton>
        ) : null
      }
      {...props}
    />
  );
});
