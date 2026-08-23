"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";

export function ReferenceCopy({
  value,
  label = "رونوشت کد پیگیری",
  successMessage = "کد پیگیری کپی شد.",
}: {
  value: string;
  label?: string;
  successMessage?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="reference-copy">
      <span className="ltr-value">{value}</span>
      <IconButton label={label} onClick={() => void copy()}>
        {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
      </IconButton>
      <span className="visually-hidden" aria-live="polite">
        {copied ? successMessage : ""}
      </span>
    </div>
  );
}
